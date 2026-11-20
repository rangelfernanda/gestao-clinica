'use strict';
/**
 * evolucao.js — tela #/evolucao?p=PAC&o=OBJ&per=6m&de=&ate=&c=Comportamento
 * Busca na API só os dados enxutos do paciente no período (ação "evolucao") e guarda em memória.
 * Filtros mudam o endereço com history.replaceState (sem recarregar a tela).
 * Funções evo* também são usadas pelo relatório (relatorio.js).
 */

const evoCache = new Map();

/** Busca (com cache em memória) os dados de evolução de um paciente num período. */
async function evoBuscar(pacienteId, de, ate, forcar) {
  const chave = `${pacienteId}|${de || ''}|${ate || ''}`;
  if (!forcar && evoCache.has(chave)) return evoCache.get(chave);
  const r = await api('evolucao', { paciente_id: pacienteId, de: de || '', ate: ate || '' });
  evoCache.set(chave, r);
  return r;
}

/** Data inicial de um período rápido (3m, 6m, 12m) a partir de hoje (yyyy-mm-dd). */
function evoDataInicio(periodo, hoje) {
  const meses = { '3m': 3, '6m': 6, '12m': 12 }[periodo];
  if (!meses) return '';
  const [a, m, d] = hoje.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1 - meses, d));
  return dt.toISOString().slice(0, 10);
}

/** Resumo por objetivo do paciente: série por sessão + totais do período. */
function evoObjetivos(r, pacienteId) {
  const porObj = {};
  r.dtt.forEach((t) => { (porObj[t.objetivo_id] = porObj[t.objetivo_id] || []).push(t); });
  return dados.lista('objetivos').filter((o) => o.paciente_id === pacienteId).map((o) => {
    const tent = porObj[o.id] || [];
    const res = Calculos.resumoDtt(tent);
    const serie = Calculos.serieObjetivo(tent);
    const lb = o.linha_base === '' || o.linha_base == null ? null : Number(o.linha_base);
    return {
      o, serie, validas: res.validas, pctIndep: res.pctIndep, pctAcerto: res.pctAcerto,
      sessoes: serie.length, linhaBase: lb, meta: o.meta === '' || o.meta == null ? null : Number(o.meta),
      deltaPp: lb != null && res.pctIndep != null ? (res.pctIndep - lb) * 100 : null,
    };
  }).sort((a, b) => (b.validas - a.validas) || a.o.objetivo.localeCompare(b.o.objetivo, 'pt-BR'));
}

/** Comportamentos do período agrupados pelo nome, com a métrica principal escolhida pelo método. */
function evoComportamentos(r) {
  const grupos = {};
  r.comportamentos.forEach((c) => { (grupos[c.comportamento] = grupos[c.comportamento] || []).push(c); });
  return Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'pt-BR')).map((nome) => {
    const regs = grupos[nome];
    const metodo = regs[regs.length - 1].metodo || regs[0].metodo || '';
    const serie = Calculos.serieComportamento(regs);
    const lbs = regs.map((c) => c.linha_base_freq).filter((v) => v !== '' && v != null);
    const linhaBase = lbs.length ? Number(lbs[lbs.length - 1]) : null;
    let metrica;
    if (metodo === 'Duração') metrica = { chave: 'duracao', nome: 'Duração total', unidade: 'min' };
    else if (metodo === 'Latência') metrica = { chave: 'latencia', nome: 'Latência média', unidade: 's' };
    else if (serie.some((p) => p.taxa_hora != null)) metrica = { chave: 'taxa_hora', nome: 'Taxa por hora', unidade: '/h' };
    else metrica = { chave: 'frequencia', nome: 'Frequência', unidade: '' };
    const valores = serie.map((p) => p[metrica.chave]).filter((v) => v != null);
    const media = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
    const ultimo = valores.length ? valores[valores.length - 1] : null;
    const primeiro = valores.length ? valores[0] : null;
    return { nome, metodo, serie, metrica, media, ultimo, primeiro, registros: regs.length, linhaBase: metrica.chave === 'frequencia' ? linhaBase : null };
  });
}

/** Contagens do ABC (antecedente, consequência, comportamento) em ordem decrescente. */
function evoAbc(r) {
  const contar = (campo) => {
    const m = {};
    r.abc.forEach((a) => { const v = a[campo] || 'Não informado'; m[v] = (m[v] || 0) + 1; });
    return Object.keys(m).map((k) => ({ rotulo: k, n: m[k] })).sort((a, b) => b.n - a.n);
  };
  return { total: r.abc.length, antecedentes: contar('categoria_antecedente'), consequencias: contar('categoria_consequencia'), comportamentos: contar('comportamento_alvo') };
}

function evoNumero(v, unidade) {
  if (v == null) return '—';
  const t = num2(v).replace(/,00$/, '');
  if (!unidade) return t;
  return unidade.startsWith('/') ? `${t}${unidade}` : `${t} ${unidade}`;
}

function evoPp(v) {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : '−'}${num2(Math.abs(v)).replace(/,00$/, '')} p.p.`;
}

const telaEvolucao = {
  estado: { p: '', o: '', per: '6m', de: '', ate: '', c: '' },
  dadosAtuais: null,

  async mostrar(param, query) {
    const vista = el('vista-evolucao');
    vista.innerHTML = `<div class="cartao">${skeleton(5)}</div>`;
    await dados.carregar();
    const e = this.estado;
    if (query) {
      if (query.has('p')) { const novo = query.get('p'); if (novo !== e.p) { e.o = ''; e.c = ''; } e.p = novo; }
      if (query.has('o')) e.o = query.get('o');
      if (query.has('c')) e.c = query.get('c');
      if (query.has('per')) e.per = query.get('per');
      if (query.has('de') || query.has('ate')) { e.de = query.get('de') || ''; e.ate = query.get('ate') || ''; if (!query.has('per')) e.per = 'livre'; }
    }
    if (!e.p || !dados.achar('pacientes', e.p)) {
      const ativo = dados.lista('pacientes').find((p) => p.status === 'Ativo') || dados.lista('pacientes')[0];
      e.p = ativo ? ativo.id : '';
    }
    await this.atualizar();
  },

  periodo() {
    const e = this.estado;
    if (e.per === 'livre') return { de: e.de, ate: e.ate };
    return { de: evoDataInicio(e.per, dados.cache.hoje), ate: '' };
  },

  gravarEndereco() {
    const e = this.estado;
    const q = new URLSearchParams();
    if (e.p) q.set('p', e.p);
    if (e.o) q.set('o', e.o);
    if (e.per === 'livre') { if (e.de) q.set('de', e.de); if (e.ate) q.set('ate', e.ate); } else q.set('per', e.per);
    if (e.c) q.set('c', e.c);
    history.replaceState(null, '', `#/evolucao?${q.toString()}`);
  },

  async atualizar() {
    const vista = el('vista-evolucao');
    const e = this.estado;
    if (!e.p) { vista.innerHTML = '<div class="cartao"><p class="vazio">Cadastre um paciente para ver a evolução.</p></div>'; return; }
    const { de, ate } = this.periodo();
    this.renderizarFiltros(true);
    try {
      this.dadosAtuais = await evoBuscar(e.p, de, ate);
    } catch (erro) {
      el('evo-corpo').innerHTML = `<div class="cartao aviso-erro-bloco"><p>${esc(erro.message)}</p></div>`;
      return;
    }
    this.renderizarCorpo();
  },

  renderizarFiltros(carregando) {
    const vista = el('vista-evolucao');
    const e = this.estado;
    const pacientes = dados.lista('pacientes').map((p) => ({ valor: p.id, rotulo: p.nome_social || p.nome }));
    const chips = [['3m', '3 meses'], ['6m', '6 meses'], ['12m', '12 meses'], ['tudo', 'Tudo']];
    const { de, ate } = this.periodo();
    vista.innerHTML = `<div class="f2">
      <div class="cartao">
        <div class="barra-ferramentas">
          <select id="evo-pac" class="campo" aria-label="Paciente">${opcoesSelect(pacientes, e.p)}</select>
          <span class="chips" role="group" aria-label="Período">${chips.map(([k, t]) => `<button type="button" class="chip${e.per === k ? ' ativo' : ''}" data-per="${k}" aria-pressed="${e.per === k}">${t}</button>`).join('')}</span>
          <input id="evo-de" class="campo campo-data-curto" type="date" value="${esc(de)}" aria-label="De">
          <input id="evo-ate" class="campo campo-data-curto" type="date" value="${esc(ate)}" aria-label="Até">
          <span class="espaco"></span>
          <a class="botao botao-secundario" href="#/relatorio?p=${esc(e.p)}${de ? '&de=' + esc(de) : ''}${ate ? '&ate=' + esc(ate) : ''}">Relatório</a>
        </div>
      </div>
      <div id="evo-corpo" class="f2">${carregando ? `<div class="cartao">${skeleton(6)}</div>` : ''}</div>
    </div>`;
    el('evo-pac').addEventListener('change', (ev) => { e.p = ev.target.value; e.o = ''; e.c = ''; this.gravarEndereco(); this.atualizar(); });
    vista.querySelectorAll('[data-per]').forEach((b) => b.addEventListener('click', () => { e.per = b.dataset.per; this.gravarEndereco(); this.atualizar(); }));
    const mudarData = () => { e.per = 'livre'; e.de = el('evo-de').value; e.ate = el('evo-ate').value; this.gravarEndereco(); this.atualizar(); };
    el('evo-de').addEventListener('change', mudarData);
    el('evo-ate').addEventListener('change', mudarData);
  },

  renderizarCorpo() {
    const e = this.estado;
    const r = this.dadosAtuais;
    const corpo = el('evo-corpo');
    const objetivos = evoObjetivos(r, e.p);
    const comportamentos = evoComportamentos(r);
    const abc = evoAbc(r);
    if (!objetivos.find((x) => x.o.id === e.o)) e.o = objetivos.length ? objetivos[0].o.id : '';
    if (!comportamentos.find((x) => x.nome === e.c)) e.c = comportamentos.length ? comportamentos[0].nome : '';
    this.gravarEndereco();
    const sel = objetivos.find((x) => x.o.id === e.o);
    const cmp = comportamentos.find((x) => x.nome === e.c);
    const nomePac = dados.nome('pacientes', e.p);
    el('topo-titulo').textContent = `Evolução · ${nomePac}`;

    corpo.innerHTML = `
      ${sel ? `
      <div class="kpis">
        <div class="kpi"><span class="rotulo-kpi">Linha de base</span><span class="valor-kpi">${pct(sel.linhaBase)}</span><span class="sub-kpi">${sel.o.data_linha_base ? dataBr(sel.o.data_linha_base) : 'independência'}</span></div>
        <div class="kpi"><span class="rotulo-kpi">Independência no período</span><span class="valor-kpi">${pct(sel.pctIndep)}</span><span class="sub-kpi">meta ${pct(sel.meta)}</span></div>
        <div class="kpi"><span class="rotulo-kpi">Acertos no período</span><span class="valor-kpi">${pct(sel.pctAcerto)}</span><span class="sub-kpi">independentes + com ajuda</span></div>
        <div class="kpi"><span class="rotulo-kpi">Diferença da linha de base</span><span class="valor-kpi">${evoPp(sel.deltaPp)}</span><span class="sub-kpi">em independência</span></div>
        <div class="kpi"><span class="rotulo-kpi">Tentativas válidas</span><span class="valor-kpi">${sel.validas}</span><span class="sub-kpi">em ${sel.sessoes} ${sel.sessoes === 1 ? 'sessão' : 'sessões'}</span></div>
        <div class="kpi"><span class="rotulo-kpi">Sessões no período</span><span class="valor-kpi">${r.sessoes}</span><span class="sub-kpi">todas do paciente</span></div>
      </div>
      <div class="cartao">
        <div class="linha-pilulas" style="margin-bottom:6px">${pilula(classeStatus(sel.o.status), sel.o.status)}${sel.o.alerta ? pilula(classeAlerta(sel.o.alerta), sel.o.alerta) : ''}</div>
        <h3 class="evo-obj-titulo">${esc(sel.o.objetivo)}</h3>
        <p class="nota" style="margin:0 0 10px">${esc(dados.nome('programas', sel.o.programa_id))}</p>
        <div id="evo-graf-obj"></div>
      </div>` : '<div class="cartao"><p class="vazio">Este paciente ainda não tem objetivos cadastrados.</p></div>'}

      ${objetivos.length ? `<div class="cartao">
        <h3 class="secao-titulo">Todos os objetivos no período</h3>
        <div class="tabela-rolagem"><table class="tabela tabela-responsiva">
          <thead><tr><th>Objetivo</th><th>Status</th><th class="num">Tentativas</th><th class="num">Independência</th><th class="num">Meta</th><th>Tendência</th></tr></thead>
          <tbody>${objetivos.map((x) => `<tr class="selecionavel${x.o.id === e.o ? ' selecionada' : ''}" data-obj="${esc(x.o.id)}" tabindex="0" aria-selected="${x.o.id === e.o}">
            <td class="principal-cel"><strong>${esc(x.o.objetivo)}</strong><small>${esc(dados.nome('programas', x.o.programa_id))}</small></td>
            <td data-rotulo="Status">${pilula(classeStatus(x.o.status), x.o.status)}</td>
            <td class="num" data-rotulo="Tentativas">${x.validas || '—'}</td>
            <td class="num" data-rotulo="Independência">${pct(x.pctIndep)}</td>
            <td class="num" data-rotulo="Meta">${pct(x.meta)}</td>
            <td data-rotulo="Tendência">${Graficos.sparkline(x.serie.map((p) => p.pct_indep), x.meta)}</td>
          </tr>`).join('')}</tbody></table></div>
      </div>` : ''}

      <div class="cartao">
        <h3 class="secao-titulo">Comportamentos</h3>
        ${comportamentos.length ? `
          <div class="barra-ferramentas">
            <select id="evo-cmp" class="campo" aria-label="Comportamento">${opcoesSelect(comportamentos.map((x) => ({ valor: x.nome, rotulo: x.nome })), e.c)}</select>
            ${cmp ? `<span class="nota">${esc(cmp.metodo || 'Método não informado')} · ${cmp.registros} ${cmp.registros === 1 ? 'registro' : 'registros'} · média ${evoNumero(cmp.media, cmp.metrica.unidade)}</span>` : ''}
          </div>
          <div id="evo-graf-cmp"></div>` : '<p class="vazio">Nenhum comportamento registrado no período.</p>'}
      </div>

      <div class="cartao">
        <h3 class="secao-titulo">Resumo ABC</h3>
        ${abc.total ? `<p class="nota" style="margin-top:0">${abc.total} ${abc.total === 1 ? 'registro' : 'registros'} no período.</p>
          <div class="evo-abc">
            ${[['Antecedentes mais comuns', abc.antecedentes], ['Consequências mais comuns', abc.consequencias], ['Comportamentos', abc.comportamentos]].map(([t, l]) => `
              <div><h4 class="nota" style="margin:0 0 6px;font-weight:600">${t}</h4><ul class="lista-mini">${l.slice(0, 4).map((i) => `<li><span class="txt">${esc(i.rotulo)}</span><strong>${i.n}</strong></li>`).join('')}</ul></div>`).join('')}
          </div>` : '<p class="vazio">Nenhum registro ABC no período.</p>'}
      </div>`;

    if (sel) {
      Graficos.linha(el('evo-graf-obj'), {
        pontos: sel.serie,
        series: [
          { chave: 'pct_indep', nome: '% independência', curto: 'indep.', cor: 's1' },
          { chave: 'pct_acerto', nome: '% acertos', curto: 'acertos', cor: 's2' },
        ],
        referencias: [
          { valor: sel.meta, rotulo: 'Meta', tipo: 'meta' },
          { valor: sel.linhaBase, rotulo: 'Linha de base', tipo: 'base' },
        ],
        extraDica: (p) => `<div class="nota">${p.validas} tentativas válidas</div>`,
      });
    }
    if (cmp) {
      Graficos.barras(el('evo-graf-cmp'), {
        titulo: cmp.metrica.nome,
        nome: cmp.metrica.nome,
        unidade: cmp.metrica.unidade,
        pontos: cmp.serie.map((p) => ({ data: p.data, valor: p[cmp.metrica.chave] })),
        referencia: cmp.linhaBase != null ? { valor: cmp.linhaBase, rotulo: 'Linha de base' } : null,
      });
    }

    corpo.querySelectorAll('[data-obj]').forEach((tr) => {
      const escolher = () => { e.o = tr.dataset.obj; this.renderizarCorpo(); el('evo-graf-obj').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      tr.addEventListener('click', escolher);
      tr.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); escolher(); } });
    });
    const selCmp = el('evo-cmp');
    if (selCmp) selCmp.addEventListener('change', (ev) => { e.c = ev.target.value; this.renderizarCorpo(); });
  },
};
