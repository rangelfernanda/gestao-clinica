'use strict';
/**
 * app.js — inicialização, login, navegação por hash, modal, confirmação e toasts.
 *
 * Para criar uma tela nova:
 *   1. index.html: item no menu lateral e no menu inferior (data-rota="x") + <section id="vista-x" class="vista" hidden>.
 *   2. Aqui: ROTAS.x = { titulo: '...', mostrar: (param) => objeto.mostrar(param) }.
 *   3. O objeto da tela (veja js/telas.js) e o <script> no index.html.
 * Endereços: #/rota/parametro?chave=valor (ex.: #/registrar?p=PAC-0001, #/sessoes/SES-00012).
 */

const ROTA_INICIAL = 'painel';
const ROTAS = {
  painel: { titulo: 'Início', mostrar: () => telaPainel.mostrar() },
  dashboard: { titulo: 'Dashboard', mostrar: () => telaDashboard.mostrar() },
  registrar: { titulo: 'Registrar sessão', mostrar: (p, q) => telaRegistrar.mostrar(p, q) },
  pacientes: { titulo: 'Pacientes', mostrar: (p) => telaPacientes.mostrar(p) },
  programas: { titulo: 'Programas', mostrar: () => telaProgramas.mostrar() },
  objetivos: { titulo: 'Objetivos', mostrar: (p) => telaObjetivos.mostrar(p) },
  sessoes: { titulo: 'Sessões', mostrar: (p) => telaSessoes.mostrar(p) },
  evolucao: { titulo: 'Evolução', mostrar: (p, q) => telaEvolucao.mostrar(p, q) },
  avaliacoes: { titulo: 'Avaliações', mostrar: (p, q) => telaAvaliacoes.mostrar(p, q) },
  relatorio: { titulo: 'Relatório', mostrar: (p, q) => telaRelatorio.mostrar(p, q) },
  historico: { titulo: 'Histórico', mostrar: () => telaHistorico.mostrar() },
};

const app = {
  rotaAtual: null,

  iniciar() {
    sessao.carregar();
    el('form-login').addEventListener('submit', (e) => { e.preventDefault(); this.entrar(); });
    document.addEventListener('click', (e) => this.cliqueGlobal(e));
    document.addEventListener('sessao-expirada', () => { toast('Sua sessão expirou. Entre de novo.', 'erro'); this.mostrarLogin(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el('modal').hidden) fecharModal(); });
    window.addEventListener('hashchange', () => this.navegar());
    if (sessao.dados) this.mostrarApp(); else this.mostrarLogin();
  },

  cliqueGlobal(e) {
    const alvo = e.target.closest('[data-acao]');
    if (!alvo) return;
    const acao = alvo.dataset.acao;
    if (acao === 'sair') this.sair();
    else if (acao === 'fechar-modal') fecharModal();
    else if (acao === 'atualizar') { dados.invalidar(); this.navegar(); }
  },

  mostrarLogin() {
    el('tela-app').hidden = true;
    el('tela-login').hidden = false;
    el('login-aviso').hidden = true;
    setTimeout(() => el('login-usuario').focus(), 50);
  },

  async entrar() {
    const usuario = el('login-usuario').value.trim();
    const senha = el('login-senha').value;
    const aviso = el('login-aviso');
    aviso.hidden = true;
    if (!usuario || !senha) { aviso.textContent = 'Informe o usuário e a senha.'; aviso.hidden = false; return; }
    const botao = el('login-botao');
    botao.disabled = true; botao.textContent = 'Entrando…';
    try {
      const s = await api('login', { usuario, senha });
      sessao.guardar(s);
      el('login-senha').value = '';
      this.mostrarApp();
    } catch (erro) {
      aviso.textContent = erro.message; aviso.hidden = false;
    } finally {
      botao.disabled = false; botao.textContent = 'Entrar';
    }
  },

  mostrarApp() {
    const s = sessao.dados;
    const iniciais = s.nome.split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
    el('menu-nome').textContent = s.nome;
    el('topo-nome').textContent = s.nome;
    el('menu-avatar').textContent = iniciais;
    el('topo-avatar').textContent = iniciais;
    el('tela-login').hidden = true;
    el('tela-app').hidden = false;
    // Sem endereço: define o inicial e deixa o evento hashchange abrir a tela (evita abrir duas vezes).
    if (!location.hash || location.hash === '#') { location.hash = '#/' + ROTA_INICIAL; return; }
    this.navegar();
  },

  async sair() {
    try { await api('logout'); } catch (e) { /* o token some de qualquer jeito */ }
    sessao.limpar();
    fecharModal();
    this.mostrarLogin();
  },

  async navegar() {
    if (!sessao.dados) return;
    const [caminho, busca] = location.hash.replace(/^#\/?/, '').split('?');
    const partes = caminho.split('/').filter(Boolean);
    const rota = ROTAS[partes[0]] ? partes[0] : ROTA_INICIAL;
    const parametro = partes[1] ? decodeURIComponent(partes[1]) : null;
    const query = new URLSearchParams(busca || '');

    qa('.vista').forEach((v) => { v.hidden = true; });
    qa('[data-rota]').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === rota));
    el('topo-titulo').textContent = ROTAS[rota].titulo;
    document.title = `${ROTAS[rota].titulo} · Gestão Clínica`;
    const vista = el(`vista-${rota}`);
    vista.hidden = false;
    this.rotaAtual = rota;
    window.scrollTo(0, 0);

    try {
      await ROTAS[rota].mostrar(parametro, query);
    } catch (erro) {
      if (erro.codigo !== 'SESSAO') {
        vista.innerHTML = `<div class="cartao aviso-erro-bloco"><p>${esc(erro.message)}</p><button class="botao botao-secundario" type="button" data-acao="atualizar">Tentar de novo</button></div>`;
      }
    }
  },
};

// ───────────────────────────── Modal, confirmação e avisos ─────────────────────────────

function abrirModal(titulo, html, opcoes = {}) {
  const modal = el('modal');
  el('modal-titulo').textContent = titulo;
  el('modal-corpo').innerHTML = html;
  modal.querySelector('.modal-caixa').classList.toggle('modal-larga', !!opcoes.larga);
  modal.hidden = false;
  document.body.classList.add('sem-rolagem');
  const primeiro = modal.querySelector('input:not([type=hidden]):not([readonly]), select, textarea');
  if (primeiro) setTimeout(() => primeiro.focus(), 30);
}

function fecharModal() {
  const modal = el('modal');
  if (modal.hidden) return;
  modal.hidden = true;
  el('modal-corpo').innerHTML = '';
  document.body.classList.remove('sem-rolagem');
}

function confirmar(titulo, mensagem, opcoes = {}) {
  return new Promise((resolve) => {
    const dialogo = el('dialogo-confirma');
    dialogo.querySelector('.modal-caixa').innerHTML = `
      <header class="modal-topo"><h2>${esc(titulo)}</h2></header>
      <div class="modal-corpo">
        <p class="modal-texto">${esc(mensagem)}</p>
        <div class="modal-botoes">
          <button class="botao botao-secundario" type="button" data-conf="nao">${esc(opcoes.cancelar || 'Cancelar')}</button>
          <button class="botao ${opcoes.perigo ? 'botao-perigo' : 'botao-primario'}" type="button" data-conf="sim">${esc(opcoes.ok || 'Confirmar')}</button>
        </div>
      </div>`;
    dialogo.hidden = false;
    document.body.classList.add('sem-rolagem');
    dialogo.querySelector('[data-conf="sim"]').focus();
    const fechar = (resultado) => {
      dialogo.hidden = true;
      dialogo.querySelector('.modal-caixa').innerHTML = '';
      if (el('modal').hidden) document.body.classList.remove('sem-rolagem');
      document.removeEventListener('keydown', aoTeclar, true);
      resolve(resultado);
    };
    const aoTeclar = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(false); } };
    document.addEventListener('keydown', aoTeclar, true);
    dialogo.onclick = (e) => {
      const b = e.target.closest('[data-conf]');
      if (b) fechar(b.dataset.conf === 'sim');
      else if (e.target.classList.contains('modal-fundo')) fechar(false);
    };
  });
}

function toast(mensagem, tipo = 'sucesso', duracao = 3500) {
  const caixa = document.createElement('div');
  caixa.className = `toast toast-${tipo}`;
  caixa.textContent = mensagem;
  el('toasts').appendChild(caixa);
  requestAnimationFrame(() => caixa.classList.add('visivel'));
  setTimeout(() => { caixa.classList.remove('visivel'); setTimeout(() => caixa.remove(), 300); }, duracao);
}

document.addEventListener('DOMContentLoaded', () => app.iniciar());
