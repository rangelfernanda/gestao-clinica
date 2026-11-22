/**
 * Entidades.gs — esquema único das entidades clínicas + cadastro genérico (listar, salvar, excluir).
 *
 * O site recebe este mesmo esquema (ação carregarTudo) e monta os formulários a partir dele,
 * então um campo novo entra AQUI e aparece no site e na planilha (setupPlanilha acrescenta a coluna).
 *
 * Tipos de campo: texto · longo · data · hora · numero · pct (0–1) · moeda · telefone · email · lista · ref
 */

var CAMPOS_AUDITORIA = ['ativo', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por'];
var CRIADOR_DEMO = 'demonstração';

function entidades_() {
  return {
    pacientes: {
      aba: 'db_pacientes', prefixo: 'PAC-', digitos: 4, rotulo: 'Paciente', plural: 'Pacientes', titulo: 'nome',
      campos: [
        { campo: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrig: true, max: 120 },
        { campo: 'nome_social', rotulo: 'Nome social', tipo: 'texto', max: 120 },
        { campo: 'nascimento', rotulo: 'Data de nascimento', tipo: 'data' },
        { campo: 'responsavel', rotulo: 'Responsável legal', tipo: 'texto', max: 120 },
        { campo: 'telefone', rotulo: 'Telefone do responsável', tipo: 'telefone' },
        { campo: 'email', rotulo: 'E-mail', tipo: 'email' },
        { campo: 'inicio', rotulo: 'Início do acompanhamento', tipo: 'data', obrig: true },
        { campo: 'diagnostico', rotulo: 'Diagnóstico informado', tipo: 'texto', max: 200 },
        { campo: 'profissional', rotulo: 'Profissional responsável', tipo: 'texto', max: 120 },
        { campo: 'modalidade', rotulo: 'Modalidade', tipo: 'lista', lista: 'MODALIDADE' },
        { campo: 'frequencia_semanal', rotulo: 'Sessões por semana', tipo: 'numero' },
        { campo: 'status', rotulo: 'Status', tipo: 'lista', lista: 'STATUS PACIENTE', obrig: true, padrao: 'Ativo' },
        { campo: 'valor_sessao', rotulo: 'Valor da sessão', tipo: 'moeda' },
        { campo: 'informacoes', rotulo: 'Informações relevantes', tipo: 'longo' },
        { campo: 'observacoes', rotulo: 'Observações clínicas', tipo: 'longo' }
      ]
    },
    // Programas formam um banco compartilhado: não pertencem a um paciente.
    // O vínculo paciente ↔ programa é feito no objetivo (db_objetivos: paciente_id + programa_id),
    // e o mesmo programa pode ser usado em objetivos de vários pacientes.
    programas: {
      aba: 'db_programas', prefixo: 'PRO-', digitos: 4, rotulo: 'Programa', plural: 'Programas', titulo: 'nome',
      campos: [
        { campo: 'nome', rotulo: 'Nome do programa', tipo: 'texto', obrig: true, max: 150 },
        { campo: 'area', rotulo: 'Área de desenvolvimento', tipo: 'lista', lista: 'ÁREAS DE DESENVOLVIMENTO', obrig: true },
        { campo: 'dominio', rotulo: 'Domínio', tipo: 'texto', max: 120 },
        { campo: 'habilidade_alvo', rotulo: 'Habilidade-alvo', tipo: 'texto', max: 200 },
        { campo: 'descricao', rotulo: 'Descrição operacional', tipo: 'longo' },
        { campo: 'objetivo', rotulo: 'Objetivo terapêutico', tipo: 'longo' },
        { campo: 'criterio_aquisicao', rotulo: 'Critério de aquisição', tipo: 'texto', max: 200 },
        { campo: 'criterio_manutencao', rotulo: 'Critério de manutenção', tipo: 'texto', max: 200 },
        { campo: 'criterio_generalizacao', rotulo: 'Critério de generalização', tipo: 'texto', max: 200 },
        { campo: 'procedimento', rotulo: 'Tipo de procedimento', tipo: 'lista', lista: 'PROCEDIMENTOS' },
        { campo: 'data_inicio', rotulo: 'Data de início', tipo: 'data' },
        { campo: 'data_revisao', rotulo: 'Data de revisão', tipo: 'data' },
        { campo: 'profissional', rotulo: 'Profissional', tipo: 'texto', max: 120 },
        { campo: 'status', rotulo: 'Status', tipo: 'lista', lista: 'STATUS PROGRAMA', obrig: true, padrao: 'Ativo' }
      ]
    },
    objetivos: {
      aba: 'db_objetivos', prefixo: 'OBJ-', digitos: 4, rotulo: 'Objetivo', plural: 'Objetivos', titulo: 'objetivo',
      campos: [
        { campo: 'paciente_id', rotulo: 'Paciente', tipo: 'ref', ref: 'pacientes', obrig: true },
        { campo: 'programa_id', rotulo: 'Programa', tipo: 'ref', ref: 'programas', obrig: true },
        { campo: 'objetivo', rotulo: 'Objetivo terapêutico', tipo: 'texto', obrig: true, max: 200 },
        { campo: 'area', rotulo: 'Área de desenvolvimento', tipo: 'lista', lista: 'ÁREAS DE DESENVOLVIMENTO' },
        { campo: 'descricao', rotulo: 'Descrição operacional', tipo: 'longo' },
        { campo: 'linha_base', rotulo: 'Linha de base (% independência)', tipo: 'pct' },
        { campo: 'data_linha_base', rotulo: 'Data da linha de base', tipo: 'data' },
        { campo: 'meta', rotulo: 'Meta (% independência)', tipo: 'pct', obrig: true },
        { campo: 'criterio_dominio', rotulo: 'Critério de domínio', tipo: 'texto', max: 200 },
        { campo: 'criterio_generalizacao', rotulo: 'Critério de generalização', tipo: 'texto', max: 200 },
        { campo: 'criterio_manutencao', rotulo: 'Critério de manutenção', tipo: 'texto', max: 200 },
        { campo: 'data_inicio', rotulo: 'Data de início', tipo: 'data' },
        { campo: 'revisao_prevista', rotulo: 'Revisão prevista', tipo: 'data' },
        { campo: 'data_aquisicao', rotulo: 'Data de aquisição', tipo: 'data' },
        { campo: 'status', rotulo: 'Status', tipo: 'lista', lista: 'STATUS OBJETIVO', obrig: true, padrao: 'Linha de base' },
        { campo: 'observacoes', rotulo: 'Observações', tipo: 'longo' }
      ]
    },
    sessoes: {
      aba: 'db_sessoes', prefixo: 'SES-', digitos: 4, rotulo: 'Sessão', plural: 'Sessões', titulo: 'data', composta: true,
      campos: [
        { campo: 'paciente_id', rotulo: 'Paciente', tipo: 'ref', ref: 'pacientes', obrig: true },
        { campo: 'data', rotulo: 'Data', tipo: 'data', obrig: true },
        { campo: 'inicio', rotulo: 'Início', tipo: 'hora' },
        { campo: 'termino', rotulo: 'Término', tipo: 'hora' },
        { campo: 'modalidade', rotulo: 'Modalidade', tipo: 'lista', lista: 'MODALIDADE' },
        { campo: 'profissional', rotulo: 'Profissional', tipo: 'texto', max: 120 },
        { campo: 'status', rotulo: 'Status', tipo: 'lista', lista: 'SESSÃO STATUS', obrig: true, padrao: 'Realizada' },
        { campo: 'estrategias', rotulo: 'Estratégias utilizadas', tipo: 'longo' },
        { campo: 'materiais', rotulo: 'Materiais', tipo: 'longo' },
        { campo: 'participacao', rotulo: 'Participação', tipo: 'texto', max: 200 },
        { campo: 'resumo', rotulo: 'Resumo clínico', tipo: 'longo' },
        { campo: 'observacoes', rotulo: 'Observações', tipo: 'longo' },
        { campo: 'orientacoes', rotulo: 'Orientações aos responsáveis', tipo: 'longo' },
        { campo: 'proximos_passos', rotulo: 'Próximos passos', tipo: 'longo' }
      ]
    },
    dtt: {
      aba: 'db_dtt', prefixo: 'DTT-', digitos: 6, rotulo: 'Tentativa DTT', plural: 'Tentativas DTT', filhoDe: 'sessoes',
      campos: [
        { campo: 'sessao_id', rotulo: 'Sessão', tipo: 'ref', ref: 'sessoes', obrig: true },
        { campo: 'paciente_id', rotulo: 'Paciente', tipo: 'ref', ref: 'pacientes', obrig: true },
        { campo: 'data', rotulo: 'Data', tipo: 'data', obrig: true },
        { campo: 'programa_id', rotulo: 'Programa', tipo: 'ref', ref: 'programas' },
        { campo: 'objetivo_id', rotulo: 'Objetivo', tipo: 'ref', ref: 'objetivos', obrig: true },
        { campo: 'tentativa', rotulo: 'Nº tentativa', tipo: 'numero' },
        { campo: 'estimulo', rotulo: 'Estímulo apresentado', tipo: 'texto', max: 200 },
        { campo: 'resposta_esperada', rotulo: 'Resposta esperada', tipo: 'texto', max: 200 },
        { campo: 'resposta_observada', rotulo: 'Resposta observada', tipo: 'texto', max: 200 },
        { campo: 'resultado', rotulo: 'Resultado', tipo: 'lista', lista: 'RESULTADO DTT', obrig: true },
        { campo: 'tipo_ajuda', rotulo: 'Tipo de ajuda', tipo: 'lista', lista: 'TIPOS DE AJUDA' },
        { campo: 'nivel_ajuda', rotulo: 'Nível de ajuda', tipo: 'lista', lista: 'NÍVEL DE AJUDA' },
        { campo: 'latencia_seg', rotulo: 'Resposta (seg.)', tipo: 'numero' },
        { campo: 'observacoes', rotulo: 'Observações', tipo: 'texto', max: 300 }
      ]
    },
    comportamentos: {
      aba: 'db_comportamentos', prefixo: 'CMP-', digitos: 5, rotulo: 'Comportamento', plural: 'Comportamentos', filhoDe: 'sessoes',
      campos: [
        { campo: 'sessao_id', rotulo: 'Sessão', tipo: 'ref', ref: 'sessoes', obrig: true },
        { campo: 'paciente_id', rotulo: 'Paciente', tipo: 'ref', ref: 'pacientes', obrig: true },
        { campo: 'data', rotulo: 'Data', tipo: 'data', obrig: true },
        { campo: 'comportamento', rotulo: 'Comportamento-alvo', tipo: 'texto', sugestoes: 'COMPORTAMENTOS ALVO', obrig: true, max: 120 },
        { campo: 'definicao', rotulo: 'Definição operacional', tipo: 'texto', max: 300 },
        { campo: 'contexto', rotulo: 'Contexto', tipo: 'texto', max: 200 },
        { campo: 'metodo', rotulo: 'Método de mensuração', tipo: 'lista', lista: 'MENSURAÇÃO', obrig: true },
        { campo: 'frequencia', rotulo: 'Frequência (qtd.)', tipo: 'numero' },
        { campo: 'duracao_total', rotulo: 'Duração total (min.)', tipo: 'numero' },
        { campo: 'latencia', rotulo: 'Latência (seg.)', tipo: 'numero' },
        { campo: 'tempo_observado', rotulo: 'Tempo observado (min.)', tipo: 'numero' },
        { campo: 'linha_base_freq', rotulo: 'Linha de base (freq.)', tipo: 'numero' },
        { campo: 'intensidade', rotulo: 'Intensidade', tipo: 'lista', lista: 'INTENSIDADE' },
        { campo: 'unidade', rotulo: 'Unidade', tipo: 'texto', max: 40 },
        { campo: 'observacoes', rotulo: 'Observações', tipo: 'texto', max: 300 }
      ]
    },
    abc: {
      aba: 'db_abc', prefixo: 'ABC-', digitos: 5, rotulo: 'Registro ABC', plural: 'Registros ABC', filhoDe: 'sessoes',
      campos: [
        { campo: 'sessao_id', rotulo: 'Sessão', tipo: 'ref', ref: 'sessoes', obrig: true },
        { campo: 'paciente_id', rotulo: 'Paciente', tipo: 'ref', ref: 'pacientes', obrig: true },
        { campo: 'data', rotulo: 'Data', tipo: 'data', obrig: true },
        { campo: 'horario', rotulo: 'Horário', tipo: 'hora' },
        { campo: 'local', rotulo: 'Local', tipo: 'texto', max: 120 },
        { campo: 'atividade', rotulo: 'Atividade', tipo: 'texto', max: 200 },
        { campo: 'categoria_antecedente', rotulo: 'Categoria do antecedente', tipo: 'lista', lista: 'ANTECEDENTES' },
        { campo: 'antecedente', rotulo: 'Antecedente (A)', tipo: 'longo', obrig: true },
        { campo: 'comportamento_alvo', rotulo: 'Comportamento-alvo', tipo: 'lista', lista: 'COMPORTAMENTOS ALVO' },
        { campo: 'comportamento', rotulo: 'Comportamento (B)', tipo: 'longo', obrig: true },
        { campo: 'categoria_consequencia', rotulo: 'Categoria da consequência', tipo: 'lista', lista: 'CONSEQUÊNCIAS' },
        { campo: 'consequencia', rotulo: 'Consequência (C)', tipo: 'longo', obrig: true },
        { campo: 'pessoas', rotulo: 'Pessoas presentes', tipo: 'texto', max: 200 },
        { campo: 'intensidade', rotulo: 'Intensidade', tipo: 'lista', lista: 'INTENSIDADE' },
        { campo: 'duracao', rotulo: 'Duração (min.)', tipo: 'numero' },
        { campo: 'hipotese', rotulo: 'Hipótese funcional', tipo: 'longo' },
        { campo: 'observacoes', rotulo: 'Observações', tipo: 'longo' }
      ]
    },
    avaliacoes: {
      aba: 'db_avaliacoes', prefixo: 'AVA-', digitos: 4, rotulo: 'Avaliação', plural: 'Avaliações', titulo: 'instrumento',
      campos: [
        { campo: 'paciente_id', rotulo: 'Paciente', tipo: 'ref', ref: 'pacientes', obrig: true },
        { campo: 'instrumento', rotulo: 'Instrumento', tipo: 'lista', lista: 'INSTRUMENTOS', obrig: true },
        { campo: 'versao', rotulo: 'Versão / nível', tipo: 'texto', max: 60 },
        { campo: 'data_aplicacao', rotulo: 'Data da aplicação', tipo: 'data', obrig: true },
        { campo: 'profissional', rotulo: 'Profissional', tipo: 'texto', max: 120 },
        { campo: 'status', rotulo: 'Status', tipo: 'lista', lista: 'STATUS AVALIAÇÃO', obrig: true, padrao: 'Planejada' },
        { campo: 'proxima_avaliacao', rotulo: 'Próxima avaliação', tipo: 'data' },
        { campo: 'dominios', rotulo: 'Domínios avaliados', tipo: 'texto', max: 300 },
        { campo: 'objetivo', rotulo: 'Objetivo da avaliação', tipo: 'longo' },
        { campo: 'resultados', rotulo: 'Resultados autorizados', tipo: 'longo' },
        { campo: 'observacoes', rotulo: 'Observações clínicas', tipo: 'longo' },
        { campo: 'referencia_documento', rotulo: 'Referência segura ao documento', tipo: 'texto', max: 200 }
      ]
    }
  };
}

function entidade_(nome) {
  var e = entidades_()[nome];
  if (!e) falha_('Cadastro desconhecido: ' + nome);
  e.nome = nome;
  return e;
}

/** Nome da entidade dona de uma aba (ou null). */
function entidadeDaAba_(aba) {
  var todas = entidades_();
  for (var k in todas) if (todas[k].aba === aba) return k;
  return null;
}

function cabecalhoEntidade_(e) {
  return ['id'].concat(e.campos.map(function (c) { return c.campo; })).concat(CAMPOS_AUDITORIA);
}

function textoEntidade_(e) {
  var tipos = ['data', 'hora', 'ref', 'telefone'];
  return ['id'].concat(e.campos.filter(function (c) { return tipos.indexOf(c.tipo) >= 0; })
    .map(function (c) { return c.campo; })).concat(['criado_em', 'atualizado_em']);
}

// ───────────────────────────── Leitura ─────────────────────────────

function lerValorCampo_(c, v) {
  switch (c.tipo) {
    case 'data': return dataIso_(v);
    case 'hora': return horaTexto_(v);
    case 'numero': case 'pct': case 'moeda': return numero_(v);
    default: return texto_(v);
  }
}

function lerEntidade_(nome) {
  var e = entidade_(nome);
  return lerTabela_(e.aba).map(function (l) {
    var r = { id: texto_(l.id), _linha: l._linha, ativo: booleano_(l.ativo),
      criado_por: texto_(l.criado_por), atualizado_em: texto_(l.atualizado_em), atualizado_por: texto_(l.atualizado_por) };
    e.campos.forEach(function (c) { r[c.campo] = lerValorCampo_(c, l[c.campo]); });
    return r;
  });
}

function ativos_(nome) {
  return lerEntidade_(nome).filter(function (r) { return r.ativo; });
}

/** "9:00", Date (30/12/1899 09:00) ou 0,375 → "09:00". */
function horaTexto_(v) {
  if (v === '' || v == null) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, FUSO, 'HH:mm');
  if (typeof v === 'number' && v >= 0 && v < 1) {
    var m = Math.round(v * 1440);
    return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
  }
  var t = String(v).trim().match(/^(\d{1,2})[:h](\d{2})/);
  if (!t || Number(t[1]) > 23 || Number(t[2]) > 59) return '';
  return ('0' + t[1]).slice(-2) + ':' + t[2];
}

// ───────────────────────────── Validação ─────────────────────────────

/**
 * Valida e normaliza `entrada` pelos campos da entidade. `atual` (na edição) permite manter
 * um valor de lista que a Fernanda tirou da cfg_listas depois.
 */
function validarCampos_(e, entrada, atual, listas) {
  var saida = {};
  e.campos.forEach(function (c) {
    var bruto = entrada[c.campo];
    var vazio = bruto === '' || bruto == null;
    if (vazio && c.padrao) { bruto = c.padrao; vazio = false; }
    var nomeCampo = c.rotulo.toLowerCase();
    if (vazio) {
      if (c.obrig) falha_('Preencha ' + nomeCampo + '.');
      saida[c.campo] = '';
      return;
    }
    var v;
    switch (c.tipo) {
      case 'data':
        v = dataIso_(bruto);
        if (!v) falha_('Data inválida em ' + nomeCampo + '.');
        break;
      case 'hora':
        v = horaTexto_(bruto);
        if (!v) falha_('Horário inválido em ' + nomeCampo + ' (use 09:30).');
        break;
      case 'numero': case 'moeda':
        v = numero_(bruto);
        if (v === null || v < 0) falha_('Número inválido em ' + nomeCampo + '.');
        if (c.tipo === 'moeda') v = Math.round(v * 100) / 100;
        break;
      case 'pct':
        v = numero_(bruto);
        if (v !== null && v > 1 && !/%/.test(String(bruto))) v = v / 100;   // "85" → 0,85
        if (v === null || v < 0 || v > 1) falha_('Percentual inválido em ' + nomeCampo + ' (0 a 100%).');
        break;
      case 'email':
        v = texto_(bruto, 120);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) falha_('E-mail inválido.');
        break;
      case 'telefone':
        v = texto_(bruto, 30);
        break;
      case 'lista':
        v = texto_(bruto);
        var opcoes = listas[c.lista] || [];
        if (opcoes.length && opcoes.indexOf(v) < 0 && !(atual && atual[c.campo] === v)) falha_(c.rotulo + ' fora da lista: ' + v);
        break;
      case 'longo':
        v = texto_(bruto, 5000);
        break;
      default:
        v = texto_(bruto, c.max || 500);
    }
    saida[c.campo] = v;
  });
  return saida;
}

/** Confere vínculos: paciente e programa existem; objetivo é do mesmo paciente. */
function conferirVinculos_(nome, campos, cache) {
  function busca(ent, id) {
    if (!cache[ent]) cache[ent] = lerEntidade_(ent);
    return cache[ent].filter(function (r) { return r.id === id; })[0];
  }
  if (campos.paciente_id && !busca('pacientes', campos.paciente_id)) falha_('Paciente não encontrado: ' + campos.paciente_id);
  if (campos.programa_id) {
    // Programa é compartilhado entre pacientes: basta existir.
    if (!busca('programas', campos.programa_id)) falha_('Programa não encontrado: ' + campos.programa_id);
  }
  if (campos.objetivo_id) {
    var o = busca('objetivos', campos.objetivo_id);
    if (!o) falha_('Objetivo não encontrado: ' + campos.objetivo_id);
    if (o.paciente_id !== campos.paciente_id) falha_('O objetivo ' + o.id + ' é de outro paciente.');
    if (nome === 'dtt') campos.programa_id = o.programa_id;   // programa vem do objetivo, como na planilha
  }
}

// ───────────────────────────── Ações genéricas ─────────────────────────────

function acaoSalvar(dados, usuario) {
  var e = entidade_(texto_(dados.entidade));
  if (e.composta || e.filhoDe) falha_('Use a tela de sessão para gravar ' + e.plural.toLowerCase() + '.');
  var r = dados.registro || {};
  var todos = lerEntidade_(e.nome);
  var atual = r.id ? todos.filter(function (x) { return x.id === texto_(r.id) && x.ativo; })[0] : null;
  if (r.id && !atual) falha_(e.rotulo + ' não encontrado. Recarregue a página.');

  var campos = validarCampos_(e, r, atual, lerListas_());
  conferirVinculos_(e.nome, campos, {});
  campos.atualizado_em = agoraTexto_();
  campos.atualizado_por = usuario.nome;
  var titulo = String(campos[e.titulo] || '');

  if (atual) {
    atualizarLinha_(e.aba, atual._linha, campos);
    registrarLog_(usuario, 'editar', e.nome, atual.id, titulo);
    return { id: atual.id };
  }
  var novo = Object.assign({ id: proximoId_(e.prefixo, e.digitos, todos), ativo: true, criado_em: agoraTexto_(), criado_por: usuario.nome }, campos);
  inserirLinha_(e.aba, novo);
  registrarLog_(usuario, 'criar', e.nome, novo.id, titulo);
  return { id: novo.id };
}

function acaoExcluir(dados, usuario) {
  var e = entidade_(texto_(dados.entidade));
  if (e.filhoDe) falha_('Exclua pela tela da sessão.');
  var id = texto_(dados.id);
  var atual = ativos_(e.nome).filter(function (x) { return x.id === id; })[0];
  if (!atual) falha_(e.rotulo + ' não encontrado.');
  atualizarLinha_(e.aba, atual._linha, { ativo: false, atualizado_em: agoraTexto_(), atualizado_por: usuario.nome });
  registrarLog_(usuario, 'excluir', e.nome, id, String(atual[e.titulo] || ''));
  return { excluido: id };
}

/** Esquema enxuto para o site montar formulários. */
function esquemaPublico_() {
  var todas = entidades_(), saida = {};
  Object.keys(todas).forEach(function (k) {
    var e = todas[k];
    saida[k] = { rotulo: e.rotulo, plural: e.plural, titulo: e.titulo, filhoDe: e.filhoDe || null, campos: e.campos };
  });
  return saida;
}
