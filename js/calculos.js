/**
 * calculos.js — regras clínicas puras (sem planilha, sem tela).
 * Roda no navegador (window.Calculos), no Node (require) e no Apps Script (Calculos.gs é cópia idêntica).
 * Espelha as fórmulas da planilha original Sistema_Gestao_Clinica_Terapeutica_v2.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Calculos = fabrica();
})(this, function () {
  'use strict';

  var RESULTADOS = ['Acerto independente', 'Acerto com ajuda', 'Erro', 'Ausência de resposta', 'Tentativa anulada'];

  function vazio(v) { return v === '' || v === null || v === undefined; }
  function num(v) {
    if (vazio(v)) return null;
    var n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  /** Resumo de uma lista de tentativas [{resultado}] — colunas P–U do DTT e S–U de OBJETIVOS. */
  function resumoDtt(tentativas) {
    var r = { total: 0, validas: 0, acertos: 0, independentes: 0, comAjuda: 0, erros: 0, semResposta: 0, anuladas: 0, pctAcerto: null, pctIndep: null };
    (tentativas || []).forEach(function (t) {
      var res = t && t.resultado;
      if (vazio(res)) return;
      r.total++;
      if (res === 'Tentativa anulada') { r.anuladas++; return; }
      if (RESULTADOS.indexOf(res) < 0) return;
      r.validas++;
      if (res === 'Acerto independente') { r.acertos++; r.independentes++; }
      else if (res === 'Acerto com ajuda') { r.acertos++; r.comAjuda++; }
      else if (res === 'Erro') r.erros++;
      else r.semResposta++;
    });
    if (r.validas > 0) {
      r.pctAcerto = r.acertos / r.validas;
      r.pctIndep = r.independentes / r.validas;
    }
    return r;
  }

  /** Conferência da ajuda (DTT coluna V): "REVISAR AJUDA" quando resultado e nível não combinam. */
  function conferenciaAjuda(resultado, nivel) {
    if (vazio(resultado)) return '';
    if (resultado === 'Acerto independente' && !vazio(nivel) && nivel !== 'Independente') return 'REVISAR AJUDA';
    if (resultado === 'Acerto com ajuda' && nivel === 'Independente') return 'REVISAR AJUDA';
    return 'OK';
  }

  /**
   * Métricas e alerta de um objetivo (OBJETIVOS S–W).
   * obj: {linha_base, meta, revisao_prevista (yyyy-mm-dd), status}; hoje: 'yyyy-mm-dd'.
   */
  function metricasObjetivo(obj, tentativas, hoje) {
    var r = resumoDtt(tentativas);
    var lb = num(obj.linha_base), meta = num(obj.meta);
    var delta = lb === null || r.pctIndep === null ? null : r.pctIndep - lb;
    var alerta = '';
    var st = obj.status || '';
    if (!vazio(obj.revisao_prevista) && obj.revisao_prevista < hoje && st !== 'Dominado' && st !== 'Encerrado') {
      alerta = 'REVISÃO ATRASADA';
    } else if (r.validas >= 15 && r.pctIndep !== null && r.pctIndep < (meta || 0) - 0.15 && st !== 'Pausado') {
      alerta = 'AVALIAR PROGRESSO';
    }
    return {
      tentativas_validas: r.validas, pct_acertos: r.pctAcerto, pct_independencia: r.pctIndep,
      delta_linha_base: delta, alerta: alerta, meta_atingida: r.pctIndep !== null && meta !== null && r.pctIndep >= meta
    };
  }

  /** Comportamento (COMPORTAMENTOS K, Q, S, T, U, V). */
  function metricasComportamento(c) {
    var metodo = c.metodo || '';
    var freq = num(c.frequencia), dur = num(c.duracao_total), lat = num(c.latencia), tempo = num(c.tempo_observado), lbf = num(c.linha_base_freq);
    var out = { duracao_media: null, taxa_hora: null, taxa_min: null, delta_freq: null, tendencia: '', conferencia: '' };
    if (metodo === 'Duração' && freq && dur !== null) out.duracao_media = dur / freq;
    if (metodo === 'Frequência' && freq !== null && tempo !== null && tempo > 0) {
      out.taxa_hora = freq / tempo * 60;
      out.taxa_min = out.taxa_hora / 60;
    }
    if (metodo === 'Frequência' && freq !== null && lbf !== null) {
      out.delta_freq = freq - lbf;
      out.tendencia = out.delta_freq > 0 ? 'AUMENTOU' : out.delta_freq < 0 ? 'DIMINUIU' : 'ESTÁVEL';
    }
    if (metodo) {
      if (metodo === 'Frequência' && (freq === null || tempo === null)) out.conferencia = 'INFORMAR QTD./TEMPO';
      else if (metodo === 'Duração' && dur === null) out.conferencia = 'INFORMAR DURAÇÃO';
      else if (metodo === 'Latência' && lat === null) out.conferencia = 'INFORMAR LATÊNCIA';
      else out.conferencia = 'OK';
    }
    return out;
  }

  /** Duração em horas entre "09:00" e "09:50"; null se faltar; 'VERIFICAR HORA' se término < início. */
  function duracaoHoras(inicio, termino) {
    function min(h) { var m = String(h || '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
    var a = min(inicio), b = min(termino);
    if (a === null || b === null) return null;
    if (b < a) return 'VERIFICAR HORA';
    return (b - a) / 60;
  }

  /** Idade em anos completos (DATEDIF "Y"). */
  function idade(nascimento, hoje) {
    if (!nascimento || !hoje) return null;
    var n = String(nascimento).split('-').map(Number), h = String(hoje).split('-').map(Number);
    if (n.length < 3 || h.length < 3) return null;
    var anos = h[0] - n[0];
    if (h[1] < n[1] || (h[1] === n[1] && h[2] < n[2])) anos--;
    return anos;
  }

  /** Dias entre duas datas yyyy-mm-dd (b - a). */
  function dias(a, b) {
    function t(x) { var p = String(x).split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
    return Math.round((t(b) - t(a)) / 86400000);
  }

  /**
   * Alerta de reavaliação: 'REAVALIAÇÃO ATRASADA' (data já passou), 'REAVALIAÇÃO PRÓXIMA' (até 30 dias) ou ''.
   * Avaliação suspensa não gera alerta.
   */
  function alertaAvaliacao(av, hoje) {
    var data = av && av.proxima_avaliacao;
    if (vazio(data) || !hoje || (av.status || '') === 'Suspensa') return '';
    var d = dias(hoje, data);
    if (d < 0) return 'REAVALIAÇÃO ATRASADA';
    if (d <= 30) return 'REAVALIAÇÃO PRÓXIMA';
    return '';
  }

  /** Série por sessão de um objetivo: [{data, sessao_id, resultado}] -> [{data, sessao_id, validas, pct_indep, pct_acerto}]. */
  function serieObjetivo(tentativas) {
    var grupos = {}, ordem = [];
    (tentativas || []).forEach(function (t) {
      if (!t || vazio(t.data)) return;
      var chave = t.data + '|' + (t.sessao_id || '');
      if (!grupos[chave]) { grupos[chave] = { data: t.data, sessao_id: t.sessao_id || '', lista: [] }; ordem.push(chave); }
      grupos[chave].lista.push(t);
    });
    return ordem.map(function (k) {
      var g = grupos[k], r = resumoDtt(g.lista);
      return { data: g.data, sessao_id: g.sessao_id, validas: r.validas, pct_indep: r.pctIndep, pct_acerto: r.pctAcerto };
    }).filter(function (p) { return p.validas > 0; })
      .sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : (a.sessao_id < b.sessao_id ? -1 : 1); });
  }

  /**
   * Série por data de um comportamento: [{data, frequencia, duracao_total, latencia, tempo_observado}]
   * -> [{data, frequencia, duracao, latencia, tempo, taxa_hora, n}] (somas por dia; latência = média).
   */
  function serieComportamento(registros) {
    var porData = {};
    (registros || []).forEach(function (c) {
      if (!c || vazio(c.data)) return;
      var p = porData[c.data] = porData[c.data] || { data: c.data, frequencia: null, duracao: null, latencia: null, tempo: null, taxa_hora: null, n: 0, _lat: [] };
      var f = num(c.frequencia), d = num(c.duracao_total), l = num(c.latencia), t = num(c.tempo_observado);
      if (f !== null) p.frequencia = (p.frequencia || 0) + f;
      if (d !== null) p.duracao = (p.duracao || 0) + d;
      if (t !== null) p.tempo = (p.tempo || 0) + t;
      if (l !== null) p._lat.push(l);
      p.n++;
    });
    return Object.keys(porData).sort().map(function (k) {
      var p = porData[k];
      if (p._lat.length) p.latencia = p._lat.reduce(function (a, b) { return a + b; }, 0) / p._lat.length;
      if (p.frequencia !== null && p.tempo) p.taxa_hora = p.frequencia / p.tempo * 60;
      delete p._lat;
      return p;
    });
  }

  return {
    RESULTADOS: RESULTADOS, resumoDtt: resumoDtt, conferenciaAjuda: conferenciaAjuda,
    metricasObjetivo: metricasObjetivo, metricasComportamento: metricasComportamento,
    duracaoHoras: duracaoHoras, idade: idade, dias: dias,
    alertaAvaliacao: alertaAvaliacao, serieObjetivo: serieObjetivo, serieComportamento: serieComportamento
  };
});
