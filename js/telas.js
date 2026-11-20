'use strict';
/**
 * telas.js — Início, Pacientes (lista e ficha), Programas, Objetivos, Sessões (lista e detalhe) e Histórico.
 * Tudo que vem da planilha passa por esc() antes de ir para innerHTML.
 */

function barraMeta(valor, meta) {
  const v = valor == null ? 0 : Math.max(0, Math.min(1, valor));
  const m = meta == null || meta === '' ? null : Math.max(0, Math.min(1, meta));
  return `<div class="barra-meta" role="img" aria-label="Independência ${pct(valor)}${m != null ? `, meta ${pct(m)}` : ''}">
      <span class="preench" style="width:${(v * 100).toFixed(1)}%"></span>
      ${m != null ? `<span class="marca-meta" style="left:calc(${(m * 100).toFixed(1)}% - 1px)"></span>` : ''}
    </div>
    <div class="barra-meta-legenda"><span>Independência: ${valor == null ? 'sem tentativas' : pct(valor)}</span><span>${m != null ? `Meta ${pct(m)}` : ''}</span></div>`;
}

function cartaoObjetivo(o, opcoes = {}) {
  return `<article class="cartao-item">
    <div class="linha-pilulas">${pilula(classeStatus(o.status), o.status)}${o.alerta ? pilula(classeAlerta(o.alerta), o.alerta) : ''}${o.meta_atingida ? pilula('st-pago', 'Meta atingida') : ''}</div>
    <h3>${esc(o.objetivo)}</h3>
    <div class="meta">${opcoes.semPaciente ? '' : `<span>${esc(dados.nome('pacientes', o.paciente_id))}</span>`}<span>${esc(dados.nome('programas', o.programa_id))}</span></div>
    ${barraMeta(o.pct_independencia, o.meta)}
    <div class="meta"><span>${o.tentativas_validas} tentativas válidas</span><span>Acertos ${pct(o.pct_acertos)}</span>${o.delta_linha_base != null ? `<span>vs. linha de base ${o.delta_linha_base >= 0 ? '+' : ''}${num2(o.delta_linha_base * 100)} p.p.</span>` : ''}${o.revisao_prevista ? `<span>Revisão ${dataBr(o.revisao_prevista)}</span>` : ''}</div>
    <div class="botoes-linha">
      <button class="botao botao-secundario botao-pequeno" type="button" data-editar-obj="${esc(o.id)}">Editar</button>
      <button class="botao botao-perigo botao-pequeno" type="button" data-excluir-obj="${esc(o.id)}">Excluir</button>
    </div>
  </article>`;
}

function ligarBotoesObjetivo(raiz, aoMudar) {
  raiz.querySelectorAll('[data-editar-obj]').forEach((b) => b.addEventListener('click', async () => {
    const o = dados.achar('objetivos', b.dataset.editarObj);
    const id = await formularioEntidade('objetivos', o);
    if (id) aoMudar();
  }));
  raiz.querySelectorAll('[data-excluir-obj]').forEach((b) => b.addEventListener('click', async () => {
    if (await excluirEntidade('objetivos', b.dataset.excluirObj)) aoMudar();
  }));
}

function tabelaSessoes(lista, opcoes = {}) {
  if (!lista.length) return '<p class="vazio">Nenhuma sessão registrada.</p>';
  return `<div class="tabela-rolagem"><table class="tabela tabela-responsiva">
    <thead><tr><th>Data</th>${opcoes.semPaciente ? '' : '<th>Paciente</th>'}<th>Status</th><th class="num">Duração</th><th class="num">DTT</th><th class="num">Independência</th><th class="acoes"></th></tr></thead>
    <tbody>${lista.map((s) => `<tr>
      <td class="principal-cel"><strong>${dataBr(s.data)}</strong>${s.inicio ? `<small>${esc(s.inicio)}${s.termino ? '–' + esc(s.termino) : ''}</small>` : ''}</td>
      ${opcoes.semPaciente ? '' : `<td data-rotulo="Paciente">${esc(dados.nome('pacientes', s.paciente_id))}</td>`}
      <td data-rotulo="Status">${pilula(classeStatus(s.status), s.status)}</td>
      <td class="num" data-rotulo="Duração">${esc(horasTexto(s.duracao_h))}</td>
      <td class="num" data-rotulo="Tentativas">${s.n_dtt || '—'}</td>
      <td class="num" data-rotulo="Independência">${pct(s.pct_indep)}</td>
      <td class="acoes"><div class="botoes-linha">
        <a class="botao botao-secundario botao-pequeno" href="#/sessoes/${esc(s.id)}">Ver</a>
        <a class="botao botao-secundario botao-pequeno" href="#/registrar/${esc(s.id)}">Editar</a>
      </div></td>
    </tr>`).join('')}</tbody></table></div>`;
}

// ───────────────────────────── Início ─────────────────────────────

const telaPainel = {
  async mostrar() {
    const vista = el('vista-painel');
    vista.innerHTML = `<div class="cartao">${skeleton(5)}</div>`;
    const d = await dados.carregar(true);
    const mes = d.hoje.slice(0, 7);
    const ativos = d.pacientes.filter((p) => p.status === 'Ativo');
    const doMes = d.sessoes.filter((s) => s.data.slice(0, 7) === mes && s.status === 'Realizada');
    const alertas = d.objetivos.filter((o) => o.alerta);
    const alertasAva = (d.avaliacoes || []).filter((a) => a.alerta);
    const agendadas = d.sessoes.filter((s) => s.status === 'Agendada' && s.data >= d.hoje).sort((a, b) => (a.data < b.data ? -1 : 1));
    const nomeCurto = (d.usuario.nome || '').split(' ')[0];
    vista.innerHTML = `
      <div class="cab-detalhe">
        <div><h2>Olá, ${esc(nomeCurto)}</h2><div class="sub">${dataBr(d.hoje)}</div></div>
        <a class="botao botao-primario" href="#/registrar">+ Registrar sessão</a>
      </div>
      <div class="cards-resumo cards-4">
        <a class="card-numero card-link" href="#/pacientes"><span class="rotulo-card">Pacientes ativos</span><span class="valor-card">${ativos.length}</span><span class="sub-card">${d.pacientes.length} cadastrados</span></a>
        <a class="card-numero card-link" href="#/sessoes"><span class="rotulo-card">Sessões no mês</span><span class="valor-card">${doMes.length}</span><span class="sub-card">realizadas</span></a>
        <a class="card-numero card-link${alertas.length ? ' card-breve' : ''}" href="#/objetivos/alertas"><span class="rotulo-card">Objetivos em alerta</span><span class="valor-card">${alertas.length}</span><span class="sub-card">revisar ou avaliar</span></a>
        <a class="card-numero card-link" href="#/sessoes"><span class="rotulo-card">Agendadas</span><span class="valor-card">${agendadas.length}</span><span class="sub-card">${agendadas[0] ? 'próxima ' + dataBr(agendadas[0].data) : 'nenhuma'}</span></a>
      </div>
      <div class="detalhe-grade">
        <div class="cartao">
          <h3 class="secao-titulo">Precisa de atenção</h3>
          ${alertas.length || alertasAva.length ? `<ul class="lista-mini">${alertasAva.map((a) => `<li><span class="txt"><a href="#/avaliacoes?p=${esc(a.paciente_id)}">${esc(a.instrumento)}</a><small>${esc(dados.nome('pacientes', a.paciente_id))} · reavaliação ${a.proxima_avaliacao ? dataBr(a.proxima_avaliacao) : ''}</small></span>${pilula(classeAlerta(a.alerta), a.alerta)}</li>`).join('')}${alertas.map((o) => `<li><span class="txt"><a href="#/evolucao?p=${esc(o.paciente_id)}&o=${esc(o.id)}">${esc(o.objetivo)}</a><small>${esc(dados.nome('pacientes', o.paciente_id))}</small></span>${pilula(classeAlerta(o.alerta), o.alerta)}</li>`).join('')}</ul>` : '<p class="vazio">Nada pendente agora.</p>'}
        </div>
        <div class="cartao">
          <h3 class="secao-titulo">Últimas sessões</h3>
          ${d.sessoes.length ? `<ul class="lista-mini">${d.sessoes.filter((s) => s.data <= d.hoje).slice(0, 6).map((s) => `<li><span class="txt"><a href="#/sessoes/${esc(s.id)}">${esc(dados.nome('pacientes', s.paciente_id))}</a><small>${dataBr(s.data)} · ${s.n_dtt} tentativas</small></span><span>${pct(s.pct_indep)}</span></li>`).join('')}</ul>` : '<p class="vazio">Nenhuma sessão ainda.</p>'}
        </div>
      </div>
      <p class="nota"><a href="#/historico">Ver histórico de alterações</a></p>`;
  },
};

// ───────────────────────────── Pacientes ─────────────────────────────

const telaPacientes = {
  filtro: { busca: '', status: 'Ativo' },
  aba: 'resumo',

  async mostrar(id) {
    const vista = el('vista-pacientes');
    if (!dados.cache) vista.innerHTML = `<div class="cartao">${skeleton(5)}</div>`;
    await dados.carregar();
    if (id) this.ficha(id); else this.lista();
  },

  recarregar() { dados.invalidar(); app.navegar(); },

  lista() {
    const vista = el('vista-pacientes');
    const busca = semAcento(this.filtro.busca);
    const itens = dados.lista('pacientes')
      .filter((p) => (!this.filtro.status || p.status === this.filtro.status) &&
        (!busca || semAcento(`${p.nome} ${p.nome_social} ${p.responsavel} ${p.diagnostico}`).includes(busca)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    vista.innerHTML = `
      <div class="cartao">
        <div class="barra-ferramentas">
          <input id="pac-busca" class="campo" type="search" placeholder="Buscar paciente…" value="${esc(this.filtro.busca)}" aria-label="Buscar">
          <select id="pac-status" class="campo" aria-label="Status">${opcoesSelect(dados.opcoes('STATUS PACIENTE'), this.filtro.status, 'Todos os status')}</select>
          <span class="espaco"></span>
          <button class="botao botao-primario" type="button" id="pac-novo">+ Novo paciente</button>
        </div>
      </div>
      ${itens.length ? `<div class="grade-cartoes">${itens.map((p) => `
        <article class="cartao-item">
          <div class="linha-pilulas">${pilula(classeStatus(p.status), p.status)}${p.modalidade ? pilula('st-neutro', p.modalidade) : ''}</div>
          <h3><a class="titulo-link" href="#/pacientes/${esc(p.id)}">${esc(p.nome_social || p.nome)}</a></h3>
          <div class="meta">${p.idade != null ? `<span>${idadeTexto(p.idade)}</span>` : ''}${p.diagnostico ? `<span>${esc(p.diagnostico)}</span>` : ''}</div>
          <div class="meta"><span>Última sessão: ${p.ultima_sessao ? dataBr(p.ultima_sessao) : '—'}</span></div>
          <div class="botoes-linha">
            <a class="botao botao-secundario botao-pequeno" href="#/pacientes/${esc(p.id)}">Abrir</a>
            <a class="botao botao-primario botao-pequeno" href="#/registrar?p=${esc(p.id)}">Registrar sessão</a>
          </div>
        </article>`).join('')}</div>` : '<div class="cartao"><p class="vazio">Nenhum paciente com esse filtro.</p></div>'}`;
    el('pac-busca').addEventListener('input', debounce((e) => { this.filtro.busca = e.target.value; this.lista(); el('pac-busca').focus(); }, 250));
    el('pac-status').addEventListener('change', (e) => { this.filtro.status = e.target.value; this.lista(); });
    el('pac-novo').addEventListener('click', async () => {
      const novoId = await formularioEntidade('pacientes', {});
      if (novoId) location.hash = `#/pacientes/${novoId}`;
    });
  },

  ficha(id) {
    const vista = el('vista-pacientes');
    const p = dados.achar('pacientes', id);
    if (!p) { vista.innerHTML = '<div class="cartao"><p class="vazio">Paciente não encontrado.</p><a href="#/pacientes">Voltar</a></div>'; return; }
    el('topo-titulo').textContent = p.nome_social || p.nome;
    const programas = dados.lista('programas').filter((x) => x.paciente_id === id);
    const objetivos = dados.lista('objetivos').filter((x) => x.paciente_id === id);
    const sessoes = dados.lista('sessoes').filter((x) => x.paciente_id === id);
    const avaliacoes = dados.lista('avaliacoes').filter((x) => x.paciente_id === id);
    const abas = [['resumo', 'Resumo', ''], ['programas', 'Programas', programas.length], ['objetivos', 'Objetivos', objetivos.length], ['sessoes', 'Sessões', sessoes.length], ['avaliacoes', 'Avaliações', avaliacoes.length]];
    let corpo = '';
    if (this.aba === 'resumo') {
      corpo = `<div class="detalhe-grade">
        <div class="cartao"><h3 class="secao-titulo">Cadastro</h3>${fichaEntidade('pacientes', p, ['informacoes', 'observacoes'])}</div>
        <div class="cartao"><h3 class="secao-titulo">Informações e observações</h3>
          ${p.informacoes ? `<p class="texto-longo">${esc(p.informacoes)}</p>` : ''}${p.observacoes ? `<p class="texto-longo">${esc(p.observacoes)}</p>` : ''}
          ${!p.informacoes && !p.observacoes ? '<p class="vazio">Nada anotado.</p>' : ''}
        </div></div>`;
    } else if (this.aba === 'programas') {
      corpo = `<div class="barra-ferramentas"><span class="espaco"></span><button class="botao botao-primario" type="button" id="fic-novo-prog">+ Novo programa</button></div>
        ${programas.length ? `<div class="grade-cartoes">${programas.map((g) => {
          const objs = objetivos.filter((o) => o.programa_id === g.id);
          return `<article class="cartao-item">
            <div class="linha-pilulas">${pilula(classeStatus(g.status), g.status)}${g.procedimento ? pilula('st-neutro', g.procedimento) : ''}</div>
            <h3>${esc(g.nome)}</h3>
            <div class="meta"><span>${esc(g.area)}</span>${g.data_revisao ? `<span>Revisão ${dataBr(g.data_revisao)}</span>` : ''}</div>
            ${g.criterio_aquisicao ? `<div class="meta"><span>Critério: ${esc(g.criterio_aquisicao)}</span></div>` : ''}
            <div class="meta"><span>${objs.length} ${objs.length === 1 ? 'objetivo' : 'objetivos'}</span></div>
            <div class="botoes-linha">
              <button class="botao botao-secundario botao-pequeno" type="button" data-novo-obj="${esc(g.id)}">+ Objetivo</button>
              <button class="botao botao-secundario botao-pequeno" type="button" data-editar-prog="${esc(g.id)}">Editar</button>
              <button class="botao botao-perigo botao-pequeno" type="button" data-excluir-prog="${esc(g.id)}">Excluir</button>
            </div></article>`;
        }).join('')}</div>` : '<div class="cartao"><p class="vazio">Nenhum programa ainda.</p></div>'}`;
    } else if (this.aba === 'objetivos') {
      corpo = `<div class="barra-ferramentas"><span class="espaco"></span><button class="botao botao-primario" type="button" id="fic-novo-obj">+ Novo objetivo</button></div>
        ${objetivos.length ? `<div class="grade-cartoes">${objetivos.map((o) => cartaoObjetivo(o, { semPaciente: true })).join('')}</div>` : '<div class="cartao"><p class="vazio">Nenhum objetivo ainda.</p></div>'}`;
    } else if (this.aba === 'avaliacoes') {
      corpo = `<div class="barra-ferramentas"><span class="espaco"></span><button class="botao botao-primario" type="button" id="fic-nova-ava">+ Nova avaliação</button></div>
        ${avaliacoes.length ? `<div class="grade-cartoes">${avaliacoes.map((a) => cartaoAvaliacao(a, { semPaciente: true })).join('')}</div>` : '<div class="cartao"><p class="vazio">Nenhuma avaliação registrada.</p></div>'}`;
    } else {
      corpo = `<div class="cartao">${tabelaSessoes(sessoes, { semPaciente: true })}</div>`;
    }
    vista.innerHTML = `
      <a class="voltar" href="#/pacientes">← Pacientes</a>
      <div class="cab-detalhe">
        <div><h2>${esc(p.nome_social || p.nome)}</h2>
          <div class="sub">${[p.nome_social ? esc(p.nome) : '', idadeTexto(p.idade), esc(p.id)].filter(Boolean).join(' · ')}</div>
          <div class="linha-pilulas" style="margin-top:6px">${pilula(classeStatus(p.status), p.status)}</div></div>
        <div class="botoes-linha">
          <a class="botao botao-primario" href="#/registrar?p=${esc(p.id)}">Registrar sessão</a>
          <a class="botao botao-secundario" href="#/evolucao?p=${esc(p.id)}">Evolução</a>
          <a class="botao botao-secundario" href="#/relatorio?p=${esc(p.id)}">Relatório</a>
          <button class="botao botao-secundario" type="button" id="fic-editar">Editar</button>
          <button class="botao botao-perigo" type="button" id="fic-excluir">Excluir</button>
        </div>
      </div>
      <div class="abas" role="tablist">${abas.map(([k, t, n]) => `<button class="aba${this.aba === k ? ' ativa' : ''}" type="button" role="tab" data-aba="${k}">${t}${n !== '' ? `<span class="contador">${n}</span>` : ''}</button>`).join('')}</div>
      ${corpo}`;

    vista.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { this.aba = b.dataset.aba; this.ficha(id); }));
    el('fic-editar').addEventListener('click', async () => { if (await formularioEntidade('pacientes', p)) this.recarregar(); });
    el('fic-excluir').addEventListener('click', async () => {
      if (await excluirEntidade('pacientes', id, 'Programas e sessões dele continuam na planilha.')) location.hash = '#/pacientes';
    });
    const novoProg = el('fic-novo-prog');
    if (novoProg) novoProg.addEventListener('click', async () => { if (await formularioEntidade('programas', {}, { fixos: { paciente_id: id } })) this.recarregar(); });
    const novoObj = el('fic-novo-obj');
    if (novoObj) novoObj.addEventListener('click', async () => { if (await formularioEntidade('objetivos', {}, { fixos: { paciente_id: id } })) this.recarregar(); });
    vista.querySelectorAll('[data-novo-obj]').forEach((b) => b.addEventListener('click', async () => {
      if (await formularioEntidade('objetivos', { programa_id: b.dataset.novoObj }, { fixos: { paciente_id: id } })) this.recarregar();
    }));
    vista.querySelectorAll('[data-editar-prog]').forEach((b) => b.addEventListener('click', async () => {
      if (await formularioEntidade('programas', dados.achar('programas', b.dataset.editarProg), { fixos: { paciente_id: id } })) this.recarregar();
    }));
    vista.querySelectorAll('[data-excluir-prog]').forEach((b) => b.addEventListener('click', async () => {
      if (await excluirEntidade('programas', b.dataset.excluirProg)) this.recarregar();
    }));
    ligarBotoesObjetivo(vista, () => this.recarregar());
    const novaAva = el('fic-nova-ava');
    if (novaAva) novaAva.addEventListener('click', async () => { if (await formularioEntidade('avaliacoes', {}, { fixos: { paciente_id: id } })) this.recarregar(); });
    ligarBotoesAvaliacao(vista, () => this.recarregar(), { paciente_id: id });
  },
};

// ───────────────────────────── Programas ─────────────────────────────

const telaProgramas = {
  filtro: { paciente: '', status: '' },

  async mostrar() {
    const vista = el('vista-programas');
    if (!dados.cache) vista.innerHTML = `<div class="cartao">${skeleton(5)}</div>`;
    await dados.carregar();
    this.renderizar();
  },

  renderizar() {
    const vista = el('vista-programas');
    const itens = dados.lista('programas').filter((g) => (!this.filtro.paciente || g.paciente_id === this.filtro.paciente) && (!this.filtro.status || g.status === this.filtro.status));
    const pacientes = dados.lista('pacientes').map((p) => ({ valor: p.id, rotulo: p.nome_social || p.nome }));
    vista.innerHTML = `<div class="cartao">
      <div class="barra-ferramentas">
        <select id="prog-pac" class="campo" aria-label="Paciente">${opcoesSelect(pacientes, this.filtro.paciente, 'Todos os pacientes')}</select>
        <select id="prog-status" class="campo" aria-label="Status">${opcoesSelect(dados.opcoes('STATUS PROGRAMA'), this.filtro.status, 'Todos os status')}</select>
        <span class="espaco"></span>
        <button class="botao botao-primario" type="button" id="prog-novo">+ Novo programa</button>
      </div>
      ${itens.length ? `<div class="tabela-rolagem"><table class="tabela tabela-responsiva">
        <thead><tr><th>Programa</th><th>Paciente</th><th>Área</th><th>Status</th><th>Revisão</th><th class="acoes"></th></tr></thead>
        <tbody>${itens.map((g) => `<tr>
          <td class="principal-cel"><strong>${esc(g.nome)}</strong>${g.procedimento ? `<small>${esc(g.procedimento)}</small>` : ''}</td>
          <td data-rotulo="Paciente"><a href="#/pacientes/${esc(g.paciente_id)}">${esc(dados.nome('pacientes', g.paciente_id))}</a></td>
          <td data-rotulo="Área">${esc(g.area)}</td>
          <td data-rotulo="Status">${pilula(classeStatus(g.status), g.status)}</td>
          <td data-rotulo="Revisão">${dataBr(g.data_revisao)}</td>
          <td class="acoes"><div class="botoes-linha">
            <button class="botao botao-secundario botao-pequeno" type="button" data-editar="${esc(g.id)}">Editar</button>
            <button class="botao botao-perigo botao-pequeno" type="button" data-excluir="${esc(g.id)}">Excluir</button>
          </div></td></tr>`).join('')}</tbody></table></div>` : '<p class="vazio">Nenhum programa com esse filtro.</p>'}
    </div>`;
    el('prog-pac').addEventListener('change', (e) => { this.filtro.paciente = e.target.value; this.renderizar(); });
    el('prog-status').addEventListener('change', (e) => { this.filtro.status = e.target.value; this.renderizar(); });
    const depois = async () => { await dados.carregar(true); this.renderizar(); };
    el('prog-novo').addEventListener('click', async () => {
      if (await formularioEntidade('programas', { paciente_id: this.filtro.paciente })) depois();
    });
    vista.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', async () => {
      if (await formularioEntidade('programas', dados.achar('programas', b.dataset.editar))) depois();
    }));
    vista.querySelectorAll('[data-excluir]').forEach((b) => b.addEventListener('click', async () => {
      if (await excluirEntidade('programas', b.dataset.excluir)) depois();
    }));
  },
};

// ───────────────────────────── Objetivos ─────────────────────────────

const telaObjetivos = {
  filtro: { paciente: '', status: '', alerta: false },

  async mostrar(param) {
    const vista = el('vista-objetivos');
    if (param === 'alertas') this.filtro = { paciente: '', status: '', alerta: true };
    if (!dados.cache) vista.innerHTML = `<div class="cartao">${skeleton(5)}</div>`;
    await dados.carregar();
    this.renderizar();
  },

  renderizar() {
    const vista = el('vista-objetivos');
    const f = this.filtro;
    const itens = dados.lista('objetivos').filter((o) => (!f.paciente || o.paciente_id === f.paciente) && (!f.status || o.status === f.status) && (!f.alerta || o.alerta));
    const pacientes = dados.lista('pacientes').map((p) => ({ valor: p.id, rotulo: p.nome_social || p.nome }));
    vista.innerHTML = `<div class="cartao">
      <div class="barra-ferramentas">
        <select id="obj-pac" class="campo" aria-label="Paciente">${opcoesSelect(pacientes, f.paciente, 'Todos os pacientes')}</select>
        <select id="obj-status" class="campo" aria-label="Status">${opcoesSelect(dados.opcoes('STATUS OBJETIVO'), f.status, 'Todos os status')}</select>
        <label class="rotulo-check"><input type="checkbox" id="obj-alerta"${f.alerta ? ' checked' : ''}> Só com alerta</label>
        <span class="espaco"></span>
        <button class="botao botao-primario" type="button" id="obj-novo">+ Novo objetivo</button>
      </div></div>
      ${itens.length ? `<div class="grade-cartoes">${itens.map((o) => cartaoObjetivo(o)).join('')}</div>` : '<div class="cartao"><p class="vazio">Nenhum objetivo com esse filtro.</p></div>'}`;
    el('obj-pac').addEventListener('change', (e) => { f.paciente = e.target.value; this.renderizar(); });
    el('obj-status').addEventListener('change', (e) => { f.status = e.target.value; this.renderizar(); });
    el('obj-alerta').addEventListener('change', (e) => { f.alerta = e.target.checked; this.renderizar(); });
    const depois = async () => { await dados.carregar(true); this.renderizar(); };
    el('obj-novo').addEventListener('click', async () => {
      if (await formularioEntidade('objetivos', { paciente_id: f.paciente })) depois();
    });
    ligarBotoesObjetivo(vista, depois);
  },
};

// ───────────────────────────── Sessões ─────────────────────────────

const telaSessoes = {
  filtro: { paciente: '', status: '' },

  async mostrar(id) {
    const vista = el('vista-sessoes');
    if (!dados.cache || id) vista.innerHTML = `<div class="cartao">${skeleton(5)}</div>`;
    await dados.carregar();
    if (id) await this.detalhe(id); else this.lista();
  },

  lista() {
    const vista = el('vista-sessoes');
    const f = this.filtro;
    const itens = dados.lista('sessoes').filter((s) => (!f.paciente || s.paciente_id === f.paciente) && (!f.status || s.status === f.status));
    const pacientes = dados.lista('pacientes').map((p) => ({ valor: p.id, rotulo: p.nome_social || p.nome }));
    vista.innerHTML = `<div class="cartao">
      <div class="barra-ferramentas">
        <select id="ses-pac" class="campo" aria-label="Paciente">${opcoesSelect(pacientes, f.paciente, 'Todos os pacientes')}</select>
        <select id="ses-status" class="campo" aria-label="Status">${opcoesSelect(dados.opcoes('SESSÃO STATUS'), f.status, 'Todos os status')}</select>
        <span class="espaco"></span>
        <button class="botao botao-secundario" type="button" id="ses-csv">Exportar CSV</button>
        <a class="botao botao-primario" href="#/registrar${f.paciente ? '?p=' + esc(f.paciente) : ''}">+ Registrar sessão</a>
      </div>
      ${tabelaSessoes(itens)}
    </div>`;
    el('ses-pac').addEventListener('change', (e) => { f.paciente = e.target.value; this.lista(); });
    el('ses-status').addEventListener('change', (e) => { f.status = e.target.value; this.lista(); });
    el('ses-csv').addEventListener('click', () => exportarCsv('sessoes', [
      { rotulo: 'ID', valor: (s) => s.id },
      { rotulo: 'Data', valor: (s) => dataBr(s.data) },
      { rotulo: 'Paciente', valor: (s) => dados.nome('pacientes', s.paciente_id) },
      { rotulo: 'Status', valor: (s) => s.status },
      { rotulo: 'Início', valor: (s) => s.inicio },
      { rotulo: 'Término', valor: (s) => s.termino },
      { rotulo: 'Tentativas DTT', valor: (s) => s.n_dtt },
      { rotulo: '% independência', valor: (s) => (s.pct_indep == null ? '' : Math.round(s.pct_indep * 1000) / 10) },
      { rotulo: '% acertos', valor: (s) => (s.pct_acerto == null ? '' : Math.round(s.pct_acerto * 1000) / 10) },
    ], itens));
  },

  async detalhe(id) {
    const vista = el('vista-sessoes');
    const r = await api('obterSessao', { id });
    const s = r.sessao;
    el('topo-titulo').textContent = `Sessão de ${dataBr(s.data)}`;
    const porObjetivo = {};
    r.dtt.forEach((t) => { (porObjetivo[t.objetivo_id] = porObjetivo[t.objetivo_id] || []).push(t); });
    const resumoDtt = Object.keys(porObjetivo).map((oid) => {
      const res = Calculos.resumoDtt(porObjetivo[oid]);
      const revisar = porObjetivo[oid].filter((t) => t.conferencia === 'REVISAR AJUDA').length;
      return `<li><span class="txt">${esc(dados.nome('objetivos', oid))}<small>${res.validas} válidas · ${res.independentes} indep. · ${res.comAjuda} c/ ajuda · ${res.erros} erros · ${res.semResposta} sem resp.${res.anuladas ? ` · ${res.anuladas} anuladas` : ''}${revisar ? ` · ${revisar} para revisar ajuda` : ''}</small></span><strong>${pct(res.pctIndep)}</strong></li>`;
    }).join('');
    const campoS = dados.esquema('sessoes');
    vista.innerHTML = `
      <a class="voltar" href="#/sessoes">← Sessões</a>
      <div class="cab-detalhe">
        <div><h2>${esc(dados.nome('pacientes', s.paciente_id))}</h2>
          <div class="sub">${dataBr(s.data)}${s.inicio ? ` · ${esc(s.inicio)}${s.termino ? '–' + esc(s.termino) : ''}` : ''} · ${esc(s.id)}</div>
          <div class="linha-pilulas" style="margin-top:6px">${pilula(classeStatus(s.status), s.status)}${s.modalidade ? pilula('st-neutro', s.modalidade) : ''}</div></div>
        <div class="botoes-linha">
          <a class="botao botao-primario" href="#/registrar/${esc(s.id)}">Editar sessão</a>
          <button class="botao botao-perigo" type="button" id="ses-excluir">Excluir</button>
        </div>
      </div>
      <div class="detalhe-grade">
        <div class="cartao"><h3 class="secao-titulo">Tentativas DTT por objetivo</h3>
          ${resumoDtt ? `<ul class="lista-mini">${resumoDtt}</ul>` : '<p class="vazio">Sem tentativas nesta sessão.</p>'}</div>
        <div class="cartao"><h3 class="secao-titulo">Registro da sessão</h3>${fichaEntidade('sessoes', s, ['paciente_id', 'data', 'inicio', 'termino', 'status', 'modalidade'])}</div>
      </div>
      ${r.comportamentos.length ? `<div class="cartao"><h3 class="secao-titulo">Comportamentos</h3><div class="tabela-rolagem"><table class="tabela tabela-responsiva">
        <thead><tr><th>Comportamento</th><th>Método</th><th class="num">Frequência</th><th class="num">Tempo (min)</th><th class="num">Taxa/hora</th><th>Tendência</th></tr></thead>
        <tbody>${r.comportamentos.map((c) => `<tr><td class="principal-cel"><strong>${esc(c.comportamento)}</strong>${c.contexto ? `<small>${esc(c.contexto)}</small>` : ''}</td>
          <td data-rotulo="Método">${esc(c.metodo)}</td><td class="num" data-rotulo="Frequência">${c.frequencia === '' || c.frequencia == null ? '—' : numCampo(c.frequencia)}</td>
          <td class="num" data-rotulo="Tempo">${c.tempo_observado === '' || c.tempo_observado == null ? '—' : numCampo(c.tempo_observado)}</td>
          <td class="num" data-rotulo="Taxa/hora">${c.taxa_hora == null ? '—' : num2(c.taxa_hora)}</td>
          <td data-rotulo="Tendência">${c.tendencia ? pilula(c.tendencia === 'DIMINUIU' ? 'st-pago' : c.tendencia === 'AUMENTOU' ? 'st-breve' : 'st-neutro', c.tendencia) : '—'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      ${r.abc.length ? `<div class="cartao"><h3 class="secao-titulo">Registros ABC</h3><ul class="lista-mini">${r.abc.map((a) => `<li><span class="txt"><strong>${esc(a.comportamento)}</strong>${a.horario ? ` · ${esc(a.horario)}` : ''}
        <small>A: ${esc(a.antecedente)}${a.categoria_antecedente ? ` (${esc(a.categoria_antecedente)})` : ''}</small>
        <small>C: ${esc(a.consequencia)}${a.categoria_consequencia ? ` (${esc(a.categoria_consequencia)})` : ''}</small>
        ${a.hipotese ? `<small>Hipótese: ${esc(a.hipotese)}</small>` : ''}</span>${a.intensidade ? pilula('st-neutro', a.intensidade) : ''}</li>`).join('')}</ul></div>` : ''}`;
    void campoS;
    el('ses-excluir').addEventListener('click', async () => {
      const ok = await confirmar('Excluir sessão?', `A sessão de ${dataBr(s.data)} e as tentativas dela saem das listas (continuam guardadas na planilha).`, { ok: 'Excluir', perigo: true });
      if (!ok) return;
      try {
        await api('excluirSessao', { id });
        toast('Sessão excluída.');
        dados.invalidar();
        location.hash = '#/sessoes';
      } catch (erro) { toast(erro.message, 'erro'); }
    });
  },
};

// ───────────────────────────── Histórico ─────────────────────────────

const telaHistorico = {
  async mostrar() {
    const vista = el('vista-historico');
    vista.innerHTML = `<div class="cartao">${skeleton(6)}</div>`;
    const log = await api('listLog', { limite: 300 });
    vista.innerHTML = `<div class="cartao">${log.length ? `<div class="tabela-rolagem"><table class="tabela tabela-responsiva">
      <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Registro</th><th>Resumo</th></tr></thead>
      <tbody>${log.map((l) => `<tr><td class="principal-cel"><strong>${esc(dataHoraBr(l.data_hora))}</strong></td><td data-rotulo="Quem">${esc(l.usuario)}</td><td data-rotulo="Ação">${esc(l.acao)}</td><td data-rotulo="Registro">${esc(l.registro_id)}</td><td class="quebra" data-rotulo="Resumo">${esc(l.resumo_alteracao)}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="vazio">Nada registrado ainda.</p>'}</div>`;
  },
};
