/**
 * Sessoes.gs — a sessão é gravada inteira de uma vez: dados da sessão + tentativas DTT +
 * comportamentos + registros ABC. Ao editar, os registros filhos daquela sessão são substituídos.
 * Também monta a carga inicial do site (carregarTudo) com os indicadores já calculados.
 */

var FILHOS_SESSAO = ['dtt', 'comportamentos', 'abc'];

function acaoSalvarSessao(dados, usuario) {
  var e = entidade_('sessoes');
  var s = dados.sessao || {};
  var listas = lerListas_();
  var cache = {};
  var todas = lerEntidade_('sessoes');
  var atual = s.id ? todas.filter(function (x) { return x.id === texto_(s.id) && x.ativo; })[0] : null;
  if (s.id && !atual) falha_('Sessão não encontrada. Recarregue a página.');

  var campos = validarCampos_(e, s, atual, listas);
  conferirVinculos_('sessoes', campos, cache);
  var id = atual ? atual.id : proximoId_(e.prefixo, e.digitos, todas);
  var agora = agoraTexto_();

  // Valida todos os filhos ANTES de gravar qualquer coisa.
  var novosFilhos = {};
  FILHOS_SESSAO.forEach(function (nome) {
    var ef = entidade_(nome);
    var existentes = lerEntidade_(nome);
    var daSessao = {};
    existentes.forEach(function (x) { if (x.sessao_id === id) daSessao[x.id] = x; });
    var proximo = Number((proximoId_(ef.prefixo, ef.digitos, existentes).match(/\d+$/) || ['1'])[0]);
    var contagem = {};
    var itens = Array.isArray(dados[nome]) ? dados[nome] : [];
    if (itens.length > 500) falha_('Máximo de 500 ' + ef.plural.toLowerCase() + ' por sessão.');
    novosFilhos[nome] = itens.map(function (item, i) {
      var entrada = Object.assign({}, item, { sessao_id: id, paciente_id: campos.paciente_id, data: campos.data });
      if (nome === 'dtt' && (entrada.tentativa === '' || entrada.tentativa == null)) {
        contagem[entrada.objetivo_id] = (contagem[entrada.objetivo_id] || 0) + 1;
        entrada.tentativa = contagem[entrada.objetivo_id];
      }
      var antigo = item.id && daSessao[texto_(item.id)] ? daSessao[texto_(item.id)] : null;
      var validado;
      try {
        validado = validarCampos_(ef, entrada, antigo, listas);
        conferirVinculos_(nome, validado, cache);
      } catch (erro) {
        if (erro.publico) falha_(ef.rotulo + ' nº ' + (i + 1) + ': ' + erro.message);
        throw erro;
      }
      var idFilho = antigo ? antigo.id : ef.prefixo + ('00000000' + (proximo++)).slice(-ef.digitos);
      return Object.assign({ id: idFilho, ativo: true,
        criado_em: antigo ? '' : agora, criado_por: antigo ? antigo.criado_por : usuario.nome,
        atualizado_em: agora, atualizado_por: usuario.nome }, validado);
    });
    // Mantém a data de criação original dos que já existiam.
    var linhasAntigas = lerTabela_(ef.aba);
    novosFilhos[nome].forEach(function (n) {
      if (n.criado_em) return;
      var l = linhasAntigas.filter(function (x) { return texto_(x.id) === n.id; })[0];
      n.criado_em = l ? texto_(l.criado_em) : agora;
    });
  });

  campos.atualizado_em = agora;
  campos.atualizado_por = usuario.nome;
  if (atual) atualizarLinha_(e.aba, atual._linha, campos);
  else inserirLinha_(e.aba, Object.assign({ id: id, ativo: true, criado_em: agora, criado_por: usuario.nome }, campos));
  FILHOS_SESSAO.forEach(function (nome) { substituirLinhas_(entidade_(nome).aba, 'sessao_id', id, novosFilhos[nome]); });

  var resumo = novosFilhos.dtt.length + ' tentativas DTT, ' + novosFilhos.comportamentos.length +
    ' comportamentos, ' + novosFilhos.abc.length + ' ABC';
  registrarLog_(usuario, atual ? 'editar' : 'criar', 'sessoes', id, campos.data + ' · ' + resumo);
  return { id: id };
}

function acaoObterSessao(dados) {
  var id = texto_(dados.id);
  var sessao = ativos_('sessoes').filter(function (x) { return x.id === id; })[0];
  if (!sessao) falha_('Sessão não encontrada.');
  var saida = { sessao: publico_(sessao) };
  FILHOS_SESSAO.forEach(function (nome) {
    saida[nome] = ativos_(nome).filter(function (x) { return x.sessao_id === id; })
      .map(function (x) {
        var p = publico_(x);
        if (nome === 'dtt') p.conferencia = Calculos.conferenciaAjuda(x.resultado, x.nivel_ajuda);
        if (nome === 'comportamentos') Object.assign(p, Calculos.metricasComportamento(x));
        return p;
      });
  });
  return saida;
}

function acaoExcluirSessao(dados, usuario) {
  var id = texto_(dados.id);
  var sessao = ativos_('sessoes').filter(function (x) { return x.id === id; })[0];
  if (!sessao) falha_('Sessão não encontrada.');
  var agora = agoraTexto_();
  atualizarLinha_('db_sessoes', sessao._linha, { ativo: false, atualizado_em: agora, atualizado_por: usuario.nome });
  FILHOS_SESSAO.forEach(function (nome) {
    var aba = entidade_(nome).aba;
    lerTabela_(aba).forEach(function (l) {
      if (texto_(l.sessao_id) === id && booleano_(l.ativo)) atualizarLinha_(aba, l._linha, { ativo: false, atualizado_em: agora, atualizado_por: usuario.nome });
    });
  });
  registrarLog_(usuario, 'excluir', 'sessoes', id, sessao.data);
  return { excluido: id };
}

/** Carga inicial do site: esquema, listas e os cadastros com indicadores calculados. */
function acaoCarregarTudo(dados, usuario) {
  var hoje = hojeIso_();
  var pacientes = ativos_('pacientes');
  var programas = ativos_('programas');
  var objetivos = ativos_('objetivos');
  var sessoes = ativos_('sessoes');
  var sessaoAtiva = {};
  sessoes.forEach(function (s) { sessaoAtiva[s.id] = true; });
  var dtt = ativos_('dtt').filter(function (d) { return sessaoAtiva[d.sessao_id]; });
  var cmp = ativos_('comportamentos').filter(function (d) { return sessaoAtiva[d.sessao_id]; });
  var abc = ativos_('abc').filter(function (d) { return sessaoAtiva[d.sessao_id]; });

  function agrupar(lista, campo) {
    var g = {};
    lista.forEach(function (x) { (g[x[campo]] = g[x[campo]] || []).push(x); });
    return g;
  }
  var dttPorObjetivo = agrupar(dtt, 'objetivo_id');
  var dttPorSessao = agrupar(dtt, 'sessao_id'), cmpPorSessao = agrupar(cmp, 'sessao_id'), abcPorSessao = agrupar(abc, 'sessao_id');
  var ultimaSessao = {};
  sessoes.forEach(function (s) { if (!ultimaSessao[s.paciente_id] || s.data > ultimaSessao[s.paciente_id]) ultimaSessao[s.paciente_id] = s.data; });

  return {
    usuario: { nome: usuario.nome, perfil: usuario.perfil },
    hoje: hoje,
    esquema: esquemaPublico_(),
    listas: lerListas_(),
    pacientes: pacientes.map(function (p) {
      return Object.assign(publico_(p), {
        idade: Calculos.idade(p.nascimento, hoje),
        ultima_sessao: ultimaSessao[p.id] || '',
        conferencia: !p.inicio || !p.status ? 'PREENCHER OBRIGATÓRIOS' : 'OK'
      });
    }),
    programas: programas.map(function (p) { return publico_(p); }),
    objetivos: objetivos.map(function (o) {
      return Object.assign(publico_(o), Calculos.metricasObjetivo(o, dttPorObjetivo[o.id] || [], hoje));
    }),
    sessoes: sessoes.map(function (s) {
      var d = dttPorSessao[s.id] || [];
      var r = Calculos.resumoDtt(d);
      return Object.assign(publico_(s), {
        duracao_h: Calculos.duracaoHoras(s.inicio, s.termino),
        n_dtt: d.length, pct_indep: r.pctIndep, pct_acerto: r.pctAcerto,
        n_comportamentos: (cmpPorSessao[s.id] || []).length, n_abc: (abcPorSessao[s.id] || []).length
      });
    }).sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : (a.id < b.id ? 1 : -1); }),
    avaliacoes: ativos_('avaliacoes').map(function (a) {
      return Object.assign(publico_(a), { alerta: Calculos.alertaAvaliacao(a, hoje) });
    }).sort(function (a, b) { return a.data_aplicacao < b.data_aplicacao ? 1 : a.data_aplicacao > b.data_aplicacao ? -1 : 0; })
  };
}

/**
 * Dados enxutos para os gráficos de evolução e o relatório de um paciente.
 * dados: {paciente_id, de?, ate?} (yyyy-mm-dd). Só sessões ativas; sem textos clínicos longos.
 */
function acaoEvolucao(dados, usuario) {
  var pid = texto_(dados && dados.paciente_id);
  if (!pid) falha_('Escolha o paciente.');
  var de = texto_(dados.de), ate = texto_(dados.ate);
  var dataSessao = {};
  ativos_('sessoes').forEach(function (s) {
    if (s.paciente_id !== pid) return;
    if (de && s.data < de) return;
    if (ate && s.data > ate) return;
    dataSessao[s.id] = s.data;
  });
  function daSessao(nome, campos) {
    return ativos_(nome).filter(function (x) { return dataSessao[x.sessao_id]; }).map(function (x) {
      var o = { sessao_id: x.sessao_id, data: dataSessao[x.sessao_id] };
      campos.forEach(function (c) { o[c] = x[c] === undefined || x[c] === null ? '' : x[c]; });
      return o;
    });
  }
  return {
    paciente_id: pid, de: de, ate: ate,
    sessoes: Object.keys(dataSessao).length,
    dtt: daSessao('dtt', ['objetivo_id', 'resultado', 'nivel_ajuda']),
    comportamentos: daSessao('comportamentos', ['comportamento', 'metodo', 'frequencia', 'duracao_total', 'latencia', 'tempo_observado', 'linha_base_freq']),
    abc: daSessao('abc', ['categoria_antecedente', 'comportamento_alvo', 'categoria_consequencia'])
  };
}

/**
 * Dados enxutos do Dashboard (todos os pacientes): tentativas DTT e comportamentos com data.
 * Só sessões ativas e só os campos numéricos/categóricos — nenhum texto clínico.
 */
function acaoPainel(dados, usuario) {
  var dataSessao = {};
  ativos_('sessoes').forEach(function (s) { dataSessao[s.id] = s.data; });
  function daSessao(nome, campos) {
    return ativos_(nome).filter(function (x) { return dataSessao[x.sessao_id]; }).map(function (x) {
      var o = { data: dataSessao[x.sessao_id], paciente_id: x.paciente_id };
      campos.forEach(function (c) { o[c] = x[c] === undefined || x[c] === null ? '' : x[c]; });
      return o;
    });
  }
  return {
    dtt: daSessao('dtt', ['objetivo_id', 'resultado']),
    comportamentos: daSessao('comportamentos', ['comportamento', 'metodo', 'frequencia'])
  };
}
