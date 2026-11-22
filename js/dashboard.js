'use strict';
/**
 * dashboard.js — tela #/dashboard: visão geral da clínica, com filtros (paciente, programa, área,
 * status do objetivo e período). Usa o carregarTudo (dados.cache) + a ação "painel" (tentativas DTT
 * e comportamentos enxutos: só data, ids, resultado e frequência — nenhum texto clínico).
 * Filtros ficam só em memória (nada em localStorage).
 */

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function dashMesCurto(iso) { const [a, m] = iso.split('-'); return `${MESES_CURTOS[Number(m) - 1]}/${a.slice(2)}`; }
function dashMesLongo(iso) { const [a, m] = iso.split('-'); return `${MESES_LONGOS[Number(m) - 1]} de ${a}`; }

/** Soma n meses a um 'yyyy-mm' e devolve 'yyyy-mm'. */
function dashSomarMes(ym, n) {
  const [a, m] = ym.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

/** Último dia de um 'yyyy-mm' (yyyy-mm-dd). */
function dashFimMes(ym) {
  const [a, m] = ym.split('-').map(Number);
  return `${ym}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

const telaDashboard = {
  estado: { pac: '', prog: '', area: '', stat: '', per: 'ano', de: '', ate: '' },
  base: null,
  extra: null,

  async mostrar() {
    const vista = el('vista-dashboard');
    vista.innerHTML = `<div class="cartao">${skeleton(6)}</div>`;
    const d = await dados.carregar();
    if (this.base !== d || !this.extra) {
      this.extra = await api('painel');
      this.base = d;
    }
    const e = this.estado;
    if (e.pac && !dados.achar('pacientes', e.pac)) e.pac = '';
    if (e.prog && !dados.achar('programas', e.prog)) e.prog = '';
    this.renderizarFiltros();
    this.renderizarCorpo();
  },

  periodo() {
    const e = this.estado;
    const mes = dados.cache.hoje.slice(0, 7);
    const fim = dashFimMes(mes);
    switch (e.per) {
      case 'mes': return { de: `${mes}-01`, ate: fim };
      case '3m': return { de: `${dashSomarMes(mes, -2)}-01`, ate: fim };
      case 'ano': return { de: `${mes.slice(0, 4)}-01-01`, ate: fim };
      case '12m': return { de: `${dashSomarMes(mes, -11)}-01`, ate: fim };
      case 'tudo': return { de: '', ate: '' };
      default: return { de: e.de, ate: e.ate };
    }
  },

  renderizarFiltros() {
    const vista = el('vista-dashboard');
    const e = this.estado;
    const pacientes = dados.lista('pacientes').map((p) => ({ valor: p.id, rotulo: p.nome_social || p.nome }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
    const programas = (e.pac ? dados.programasDoPaciente(e.pac) : dados.lista('programas'))
      .map((p) => ({ valor: p.id, rotulo: dados.nome('programas', p.id) }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
    if (e.prog && !programas.find((p) => p.valor === e.prog)) e.prog = '';
    const areas = dados.opcoes('ÁREAS DE DESENVOLVIMENTO');
    const status = dados.opcoes('STATUS OBJETIVO');
    const chips = [['mes', 'Este mês'], ['3m', '3 meses'], ['ano', 'Este ano'], ['12m', '12 meses'], ['tudo', 'Tudo']];
    const { de, ate } = this.periodo();
    vista.innerHTML = `<div class="f2">
      <div class="cartao">
        <div class="dash-filtros">
          <select id="dash-pac" class="campo" aria-label="Paciente">${opcoesSelect(pacientes, e.pac, 'Todos os pacientes')}</select>
          <select id="dash-prog" class="campo" aria-label="Programa">${opcoesSelect(programas, e.prog, 'Todos os programas')}</select>
          <select id="dash-area" class="campo" aria-label="Área">${opcoesSelect(areas, e.area, 'Todas as áreas')}</select>
          <select id="dash-stat" class="campo" aria-label="Status do objetivo">${opcoesSelect(status, e.stat, 'Todos os status')}</select>
        </div>
        <div class="barra-ferramentas dash-periodo">
          <span class="chips" role="group" aria-label="Período">${chips.map(([k, t]) => `<button type="button" class="chip${e.per === k ? ' ativo' : ''}" data-per="${k}" aria-pressed="${e.per === k}">${t}</button>`).join('')}</span>
          <input id="dash-de" class="campo campo-data-curto" type="date" value="${esc(de)}" aria-label="De">
          <input id="dash-ate" class="campo campo-data-curto" type="date" value="${esc(ate)}" aria-label="Até">
          <span class="espaco"></span>
          <button type="button" id="dash-limpar" class="botao botao-secundario"${this.temFiltro() ? '' : ' hidden'}>Limpar filtros</button>
        </div>
      </div>
      <div id="dash-corpo" class="f2"></div>
    </div>`;
    const mudar = (campo) => (ev) => { e[campo] = ev.target.value; this.renderizarFiltros(); this.renderizarCorpo(); };
    el('dash-pac').addEventListener('change', mudar('pac'));
    el('dash-prog').addEventListener('change', mudar('prog'));
    el('dash-area').addEventListener('change', mudar('area'));
    el('dash-stat').addEventListener('change', mudar('stat'));
    vista.querySelectorAll('[data-per]').forEach((b) => b.addEventListener('click', () => { e.per = b.dataset.per; this.renderizarFiltros(); this.renderizarCorpo(); }));
    const mudarData = () => { e.per = 'livre'; e.de = el('dash-de').value; e.ate = el('dash-ate').value; this.renderizarFiltros(); this.renderizarCorpo(); };
    el('dash-de').addEventListener('change', mudarData);
    el('dash-ate').addEventListener('change', mudarData);
    el('dash-limpar').addEventListener('click', () => { Object.assign(e, { pac: '', prog: '', area: '', stat: '', per: 'ano', de: '', ate: '' }); this.renderizarFiltros(); this.renderizarCorpo(); });
  },

  temFiltro() {
    const e = this.estado;
    return !!(e.pac || e.prog || e.area || e.stat || e.per !== 'ano');
  },

  /** Aplica os filtros e devolve as listas já recortadas. */
  filtrar() {
    const e = this.estado;
    const { de, ate } = this.periodo();
    const noPeriodo = (data) => (!de || data >= de) && (!ate || data <= ate);
    const doPac = (x) => !e.pac || x.paciente_id === e.pac;
    const progs = {};
    dados.lista('programas').forEach((p) => { progs[p.id] = p; });
    const areaObj = (o) => o.area || (progs[o.programa_id] && progs[o.programa_id].area) || '';
    const filtroClinico = !!(e.prog || e.area || e.stat);

    const pacientes = dados.lista('pacientes').filter(doPac);
    // Programas são compartilhados: com paciente escolhido, contam os que ele usa nos objetivos.
    const programas = (e.pac ? dados.programasDoPaciente(e.pac) : dados.lista('programas'))
      .filter((p) => (!e.prog || p.id === e.prog) && (!e.area || p.area === e.area));
    const objetivos = dados.lista('objetivos').filter((o) => doPac(o) && (!e.prog || o.programa_id === e.prog)
      && (!e.area || areaObj(o) === e.area) && (!e.stat || o.status === e.stat));
    const objIds = new Set(objetivos.map((o) => o.id));
    const sessoes = dados.lista('sessoes').filter((s) => doPac(s) && noPeriodo(s.data));
    const dtt = (this.extra.dtt || []).filter((t) => doPac(t) && noPeriodo(t.data) && (!filtroClinico || objIds.has(t.objetivo_id)));
    const comportamentos = (this.extra.comportamentos || []).filter((c) => doPac(c) && noPeriodo(c.data));
    return { de, ate, pacientes, programas, objetivos, sessoes, dtt, comportamentos, areaObj, filtroClinico };
  },

  /** Lista de meses ('yyyy-mm') do período, no máximo os últimos 12. */
  meses(f) {
    const hojeMes = dados.cache.hoje.slice(0, 7);
    const datas = [].concat(f.sessoes.map((s) => s.data), f.dtt.map((t) => t.data), f.comportamentos.map((c) => c.data)).filter(Boolean).sort();
    let fim = f.ate ? f.ate.slice(0, 7) : (datas.length && datas[datas.length - 1].slice(0, 7) > hojeMes ? datas[datas.length - 1].slice(0, 7) : hojeMes);
    let ini = f.de ? f.de.slice(0, 7) : (datas.length ? datas[0].slice(0, 7) : fim);
    if (ini > fim) { const t = ini; ini = fim; fim = t; }
    const lista = [];
    for (let m = fim; m >= ini && lista.length < 12; m = dashSomarMes(m, -1)) lista.unshift(m);
    return lista;
  },

  renderizarCorpo() {
    const e = this.estado;
    const f = this.filtrar();
    const corpo = el('dash-corpo');
    const cont = (lista, st) => lista.filter((x) => x.status === st).length;

    const realizadas = f.sessoes.filter((s) => s.status === 'Realizada');
    const horas = realizadas.reduce((a, s) => a + (Number(s.duracao_h) || 0), 0);
    const resDtt = Calculos.resumoDtt(f.dtt);
    const tiposCmp = new Set(f.comportamentos.map((c) => c.comportamento).filter(Boolean));
    const ocorrencias = f.comportamentos.reduce((a, c) => a + (Number(c.frequencia) || 0), 0);
    const emAquisicao = f.objetivos.filter((o) => o.status === 'Em aquisição' || o.status === 'Em intervenção').length;
    const rotPeriodo = f.de || f.ate ? `${f.de ? dataBr(f.de) : 'início'} a ${f.ate ? dataBr(f.ate) : 'hoje'}` : 'todo o histórico';
    const hrs = num2(horas).replace(/,00$/, '');

    const kpi = (rotulo, valor, sub) => `<div class="kpi"><span class="rotulo-kpi">${rotulo}</span><span class="valor-kpi">${valor}</span>${sub ? `<span class="sub-kpi">${sub}</span>` : ''}</div>`;
    const nomePac = e.pac ? dados.nome('pacientes', e.pac) : '';

    corpo.innerHTML = `
      <p class="nota dash-resumo">${nomePac ? `<strong>${esc(nomePac)}</strong> · ` : ''}Período: ${esc(rotPeriodo)}${f.filtroClinico ? ' · filtros de programa/área/status valem para objetivos e tentativas' : ''}</p>
      ${e.pac ? '' : `<h3 class="secao-titulo dash-secao">Pacientes</h3>
      <div class="kpis">
        ${kpi('Pacientes', f.pacientes.length, 'cadastrados')}
        ${kpi('Ativos', cont(f.pacientes, 'Ativo'), '')}
        ${kpi('Suspensos', cont(f.pacientes, 'Suspenso'), '')}
        ${kpi('Em alta', cont(f.pacientes, 'Alta'), `${cont(f.pacientes, 'Em processo de alta')} em processo de alta`)}
      </div>`}
      <h3 class="secao-titulo dash-secao">Sessões no período</h3>
      <div class="kpis">
        ${kpi('Realizadas', realizadas.length, '')}
        ${kpi('Agendadas', cont(f.sessoes, 'Agendada'), '')}
        ${kpi('Faltas', cont(f.sessoes, 'Falta'), `${cont(f.sessoes, 'Cancelada')} canceladas`)}
        ${kpi('Horas de atendimento', `${hrs} h`, 'sessões realizadas')}
      </div>
      <h3 class="secao-titulo dash-secao">Clínico</h3>
      <div class="kpis">
        ${kpi('Programas ativos', cont(f.programas, 'Ativo'), `${f.programas.length} no filtro`)}
        ${kpi('Obj. em aquisição', emAquisicao, 'em aquisição ou intervenção')}
        ${kpi('Obj. dominados', cont(f.objetivos, 'Dominado'), `${f.objetivos.length} objetivos no filtro`)}
        ${kpi('Independência DTT', pct(resDtt.pctIndep), `${resDtt.validas} tentativas válidas`)}
        ${kpi('Comportamentos', f.comportamentos.length, `${tiposCmp.size} ${tiposCmp.size === 1 ? 'tipo' : 'tipos'} · ${num2(ocorrencias).replace(/,00$/, '')} ocorrências`)}
      </div>
      <div class="dash-grade">
        <div class="cartao"><div id="dash-g-sessoes"></div></div>
        <div class="cartao"><div id="dash-g-dtt"></div></div>
        <div class="cartao"><div id="dash-g-area"></div></div>
        <div class="cartao"><div id="dash-g-status"></div></div>
        ${e.pac ? '' : '<div class="cartao"><div id="dash-g-pac"></div></div>'}
        <div class="cartao"><div id="dash-g-cmp"></div></div>
      </div>`;

    const meses = this.meses(f);
    const porMes = (lista) => { const m = {}; lista.forEach((x) => { const k = x.data.slice(0, 7); (m[k] = m[k] || []).push(x); }); return m; };
    const mesData = (ym) => `${ym}-01`;

    // 1. Sessões realizadas por mês
    const sesMes = porMes(realizadas);
    Graficos.barras(el('dash-g-sessoes'), {
      titulo: 'Sessões realizadas por mês', nome: 'Sessões realizadas', inteiro: true, minTopo: 4,
      rotuloX: dashMesCurto, rotuloData: dashMesLongo,
      pontos: meses.map((m) => ({ data: mesData(m), valor: (sesMes[m] || []).length })),
      vazio: 'Sem sessões no período.',
    });

    // 2. Independência DTT por mês
    const dttMes = porMes(f.dtt);
    const pontosDtt = meses.map((m) => { const r = Calculos.resumoDtt(dttMes[m] || []); return { data: mesData(m), pct_indep: r.pctIndep, validas: r.validas }; })
      .filter((p) => p.validas > 0);
    Graficos.linha(el('dash-g-dtt'), {
      titulo: 'Independência DTT por mês',
      pontos: pontosDtt,
      series: [{ chave: 'pct_indep', nome: '% independência', curto: 'indep.', cor: 's1' }],
      rotuloX: dashMesCurto, rotuloData: dashMesLongo,
      extraDica: (p) => `<div class="nota">${p.validas} tentativas válidas</div>`,
      vazio: 'Sem tentativas DTT no período.',
    });

    // 3. Independência por área (tentativas do período agrupadas pela área do objetivo)
    const objs = {};
    dados.lista('objetivos').forEach((o) => { objs[o.id] = o; });
    const agrupar = (chaveFn) => {
      const g = {};
      f.dtt.forEach((t) => { const k = chaveFn(t); if (k) (g[k] = g[k] || []).push(t); });
      return Object.keys(g).map((k) => { const r = Calculos.resumoDtt(g[k]); return { rotulo: k, valor: r.pctIndep, extra: r.validas }; })
        .filter((x) => x.extra > 0).sort((a, b) => (b.valor - a.valor) || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
    };
    Graficos.barrasH(el('dash-g-area'), {
      titulo: 'Independência por área', nome: '% independência', formato: 'pct', cabecalho: 'Área', colunaExtra: 'Tentativas válidas',
      itens: agrupar((t) => (objs[t.objetivo_id] ? f.areaObj(objs[t.objetivo_id]) || 'Sem área' : '')),
      extraDica: (p) => `<div class="nota">${p.extra} tentativas válidas</div>`,
      vazio: 'Sem tentativas DTT no período.',
    });

    // 4. Objetivos por status (situação atual)
    const ordem = dados.opcoes('STATUS OBJETIVO');
    const contStatus = {};
    f.objetivos.forEach((o) => { const k = o.status || 'Sem status'; contStatus[k] = (contStatus[k] || 0) + 1; });
    const chavesStatus = ordem.filter((s) => contStatus[s]).concat(Object.keys(contStatus).filter((s) => !ordem.includes(s)));
    Graficos.barrasH(el('dash-g-status'), {
      titulo: 'Objetivos por status', nome: 'Objetivos', formato: 'num', cabecalho: 'Status',
      itens: chavesStatus.map((s) => ({ rotulo: s, valor: contStatus[s] })),
      vazio: 'Nenhum objetivo neste filtro.',
    });

    // 5. Independência por paciente
    if (!e.pac) {
      Graficos.barrasH(el('dash-g-pac'), {
        titulo: 'Independência por paciente', nome: '% independência', formato: 'pct', cabecalho: 'Paciente', colunaExtra: 'Tentativas válidas',
        itens: agrupar((t) => dados.nome('pacientes', t.paciente_id)),
        extraDica: (p) => `<div class="nota">${p.extra} tentativas válidas</div>`,
        vazio: 'Sem tentativas DTT no período.',
      });
    }

    // 6. Ocorrências de comportamentos por mês
    const cmpMes = porMes(f.comportamentos);
    Graficos.barras(el('dash-g-cmp'), {
      titulo: 'Ocorrências de comportamentos por mês', nome: 'Ocorrências', inteiro: true, minTopo: 4,
      rotuloX: dashMesCurto, rotuloData: dashMesLongo,
      pontos: f.comportamentos.length ? meses.map((m) => ({
        data: mesData(m), valor: (cmpMes[m] || []).reduce((a, c) => a + (Number(c.frequencia) || 0), 0), registros: (cmpMes[m] || []).length,
      })) : [],
      extraDica: (p) => `<div class="nota">${p.registros} ${p.registros === 1 ? 'registro' : 'registros'}</div>`,
      vazio: 'Nenhum comportamento registrado no período.',
    });
  },
};
