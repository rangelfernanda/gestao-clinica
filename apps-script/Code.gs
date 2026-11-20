/**
 * Gestão Clínica — Fernanda Rangel
 * API JSON (Apps Script) sobre a planilha do sistema.
 *
 * Regras de ouro:
 *  - A planilha é o banco. Abas db_* são dados do sistema (não editar à mão);
 *    abas cfg_* (se houver) são configuração editável.
 *  - Cabeçalho na linha 1; colunas localizadas pelo NOME, nunca pela posição.
 *  - Toda escrita passa por comTrava_ (LockService) e grava em db_log.
 *  - Datas e ids ficam em colunas de texto ("@") para o Sheets não converter.
 *
 * Arquivos: Code.gs (roteamento + utilitários) · Auth.gs (login) · Db.gs (leitura/escrita)
 *           Entidades.gs (esquema + cadastro genérico) · Sessoes.gs (sessão + DTT/comportamentos/ABC)
 *           Listas.gs (cfg_listas) · Calculos.gs (regras clínicas, cópia de js/calculos.js)
 *           Demo.gs (dados fictícios) · Setup.gs (instalação)
 */

// Deixe vazio quando o script estiver vinculado à planilha (Extensões → Apps Script).
var SPREADSHEET_ID = '';

var FUSO = 'America/Sao_Paulo';
var NOME_SISTEMA = 'Gestão Clínica';
var COR_CABECALHO = '#3F5E55';

var ABA_USUARIOS = 'db_usuarios';
var ABA_LOG = 'db_log';

var SESSAO_HORAS = 12;
var CACHE_MAX_SEGUNDOS = 21600;   // o CacheService guarda no máximo 6 h por gravação
var MAX_TENTATIVAS_LOGIN = 5;
var BLOQUEIO_LOGIN_SEGUNDOS = 900;
var ESPERA_LOCK_MS = 20000;

// ───────────────────────────── Entrada da API ─────────────────────────────

// Mapa preguiçoso (função): os .gs carregam em ordem indefinida, então as funções
// de outros arquivos só podem ser referenciadas na hora da chamada.
function acoes_() {
  return {
    carregarTudo:    { fn: acaoCarregarTudo },
    salvar:          { fn: acaoSalvar, escrita: true },
    excluir:         { fn: acaoExcluir, escrita: true },
    obterSessao:     { fn: acaoObterSessao },
    salvarSessao:    { fn: acaoSalvarSessao, escrita: true },
    excluirSessao:   { fn: acaoExcluirSessao, escrita: true },
    evolucao:        { fn: acaoEvolucao },
    painel:          { fn: acaoPainel },
    listLog:         { fn: acaoListLog }
  };
}

function doGet() {
  return respostaJson_({ ok: true, sistema: NOME_SISTEMA });
}

function doPost(e) {
  var resposta;
  try {
    var pedido = JSON.parse(e.postData.contents);
    resposta = { ok: true, data: executar_(pedido), error: null };
  } catch (erro) {
    if (!erro.publico) console.error(erro);
    resposta = {
      ok: false,
      data: null,
      error: erro.publico ? erro.message : 'Erro no servidor. Tente de novo em instantes.',
      code: erro.code || null
    };
  }
  return respostaJson_(resposta);
}

function executar_(pedido) {
  var acao = pedido.action;
  var dados = pedido.payload || {};
  if (acao === 'login') return acaoLogin(dados);

  var usuario = validarSessao_(pedido.token);
  if (acao === 'logout') return acaoLogout(pedido.token);

  var acoes = acoes_();
  var definicao = Object.prototype.hasOwnProperty.call(acoes, acao) ? acoes[acao] : null;
  if (!definicao) falha_('Ação desconhecida.');
  if (definicao.admin && usuario.perfil !== 'admin') falha_('Só o administrador pode fazer isso.');
  if (!definicao.escrita) return definicao.fn(dados, usuario);
  return comTrava_(function () { return definicao.fn(dados, usuario); });
}

function respostaJson_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Erro "público": a mensagem vai para a tela. Erros comuns viram mensagem genérica. */
function falha_(mensagem, codigo) {
  var erro = new Error(mensagem);
  erro.publico = true;
  erro.code = codigo || null;
  throw erro;
}

function comTrava_(funcao) {
  var trava = LockService.getScriptLock();
  try {
    trava.waitLock(ESPERA_LOCK_MS);
  } catch (e) {
    falha_('O sistema está ocupado com outro registro. Tente de novo.');
  }
  try {
    return funcao();
  } finally {
    trava.releaseLock();
  }
}

function planilha_() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

// ───────────────────────────── Utilitários ─────────────────────────────

// Atenção: use sempre lista.map(function (c) { return texto_(c); }) — map(texto_) passa o
// índice como "maximo" e trunca o texto.
function texto_(valor, maximo) {
  var t = String(valor == null ? '' : valor).trim();
  return maximo ? t.slice(0, maximo) : t;
}

function normalizar_(valor) {
  return texto_(valor).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Converte para número (aceita "1.234,56", "R$ 10" e "12%"); devolve null quando não é número. */
function numero_(valor) {
  if (valor === '' || valor == null) return null;
  if (typeof valor === 'number') return isFinite(valor) ? valor : null;
  var t = String(valor).trim().replace(/R\$\s?/, '');
  var pct = /%$/.test(t);
  t = t.replace('%', '').trim();
  if (/,/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  var n = Number(t);
  if (!isFinite(n)) return null;
  return pct ? n / 100 : n;
}

function inteiro_(valor) {
  var n = numero_(valor);
  return n !== null && Math.floor(n) === n ? n : null;
}

/** Date, "2026-11-17" ou "17/11/2026" → "2026-11-17" (fuso de São Paulo). */
function dataIso_(valor) {
  if (valor == null || valor === '') return '';
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    return isNaN(valor.getTime()) ? '' : Utilities.formatDate(valor, FUSO, 'yyyy-MM-dd');
  }
  var t = String(valor).trim();
  var m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    var br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!br) return '';
    m = [null, br[3], ('0' + br[2]).slice(-2), ('0' + br[1]).slice(-2)];
  }
  return m[1] + '-' + m[2] + '-' + m[3];
}

function agoraTexto_() {
  return Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd HH:mm:ss');
}

function hojeIso_() {
  return Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
}

function booleano_(valor) {
  if (valor === true || valor === false) return valor;
  var t = normalizar_(valor);
  return t === 'true' || t === 'sim' || t === '1' || t === 'verdadeiro';
}
