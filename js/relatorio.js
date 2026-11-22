'use strict';
/**
 * relatorio.js — tela #/relatorio?p=PAC&de=&ate=
 * Monta uma folha A4 com os dados do período para a profissional revisar, completar e imprimir/salvar em PDF.
 * Os textos digitados na folha (síntese, orientações) NÃO são salvos em lugar nenhum — só vão para a impressão.
 * Nome e CRP da profissional ficam guardados no navegador (preferência, não é dado clínico).
 */

const telaRelatorio = {
  estado: { p: '', de: '', ate: '' },

  preferencia(chave, valor) {
    try {
      if (valor === undefined) return localStorage.getItem(`rel-${chave}`) || '';
      localStorage.setItem(`rel-${chave}`, valor);
    } catch (e) { /* navegador sem armazenamento: segue sem lembrar */ }
    return '';
  },

  async mostrar(param, query) {
    const vista = el('vista-relatorio');
    vista.innerHTML = `<div class="cartao">${skeleton(6)}</div>`;
    const d = await dados.carregar();
    const e = this.estado;
    if (query && query.has('p')) e.p = query.get('p');
    if (query && (query.has('de') || query.has('ate'))) { e.de = query.get('de') || ''; e.ate = query.get('ate') || ''; }
    if (!e.de && !e.ate) { e.de = evoDataInicio('6m', d.hoje); e.ate = d.hoje; }
    if (!e.p || !dados.achar('pacientes', e.p)) {
      const ativo = dados.lista('pacientes').find((p) => p.status === 'Ativo') || dados.lista('pacientes')[0];
      e.p = ativo ? ativo.id : '';
    }
    this.renderizarFiltros();
    await this.atualizar();
  },

  gravarEndereco() {
    const e = this.estado;
    const q = new URLSearchParams();
    if (e.p) q.set('p', e.p);
    if (e.de) q.set('de', e.de);
    if (e.ate) q.set('ate', e.ate);
    history.replaceState(null, '', `#/relatorio?${q.toString()}`);
  },

  renderizarFiltros() {
    const vista = el('vista-relatorio');
    const e = this.estado;
    const pacientes = dados.lista('pacientes').map((p) => ({ valor: p.id, rotulo: p.nome_social || p.nome }));
    const prof = this.preferencia('profissional') || (dados.cache.usuario && dados.cache.usuario.nome) || '';
    vista.innerHTML = `<div class="f2">
      <div class="cartao no-print">
        <div class="barra-ferramentas">
          <select id="rel-pac" class="campo" aria-label="Paciente">${opcoesSelect(pacientes, e.p)}</select>
          <label class="rotulo-inline"><span class="rotulo-curto">De</span><input id="rel-de" class="campo campo-data-curto" type="date" value="${esc(e.de)}"></label>
          <label class="rotulo-inline"><span class="rotulo-curto">Até</span><input id="rel-ate" class="campo campo-data-curto" type="date" value="${esc(e.ate)}"></label>
          <input id="rel-prof" class="campo" type="text" placeholder="Profissional" value="${esc(prof)}" aria-label="Nome da profissional">
          <input id="rel-crp" class="campo campo-data-curto" type="text" placeholder="CRP 00/00000" value="${esc(this.preferencia('crp'))}" aria-label="CRP">
          <span class="espaco"></span>
          <button class="botao botao-primario" type="button" id="rel-imprimir" disabled>Imprimir / salvar PDF</button>
        </div>
        <p class="nota" style="margin:4px 0 0">Revise os números e escreva a síntese direto na folha. O texto digitado não é salvo: imprima ou salve o PDF antes de sair desta tela.</p>
      </div>
      <div id="rel-corpo"><div class="cartao">${skeleton(8)}</div></div>
    </div>`;
    el('rel-pac').addEventListener('change', (ev) => { e.p = ev.target.value; this.gravarEndereco(); this.atualizar(); });
    const mudarData = () => { e.de = el('rel-de').value; e.ate = el('rel-ate').value; this.gravarEndereco(); this.atualizar(); };
    el('rel-de').addEventListener('change', mudarData);
    el('rel-ate').addEventListener('change', mudarData);
    el('rel-prof').addEventListener('input', debounce((ev) => { this.preferencia('profissional', ev.target.value); this.assinatura(); }, 200));
    el('rel-crp').addEventListener('input', debounce((ev) => { this.preferencia('crp', ev.target.value); this.assinatura(); }, 200));
    el('rel-imprimir').addEventListener('click', () => window.print());
  },

  assinatura() {
    const caixa = el('rel-assinatura');
    if (!caixa) return;
    const nome = el('rel-prof').value.trim();
    const crp = el('rel-crp').value.trim();
    caixa.innerHTML = `<strong>${esc(nome || '____________________________')}</strong><br>Psicóloga · ${crp ? esc(crp) : 'CRP ____________'}`;
  },

  async atualizar() {
    const e = this.estado;
    const corpo = el('rel-corpo');
    el('rel-imprimir').disabled = true;
    if (!e.p) { corpo.innerHTML = '<div class="cartao"><p class="vazio">Cadastre um paciente para gerar o relatório.</p></div>'; return; }
    corpo.innerHTML = `<div class="cartao">${skeleton(8)}</div>`;
    let r;
    try {
      r = await evoBuscar(e.p, e.de, e.ate);
    } catch (erro) {
      corpo.innerHTML = `<div class="cartao aviso-erro-bloco"><p>${esc(erro.message)}</p></div>`;
      return;
    }
    corpo.innerHTML = this.folha(r);
    this.assinatura();
    el('rel-imprimir').disabled = false;
    el('topo-titulo').textContent = `Relatório · ${dados.nome('pacientes', e.p)}`;
    document.title = `Relatório ${dados.nome('pacientes', e.p)} · Gestão Clínica`;
  },

  folha(r) {
    const e = this.estado;
    const d = dados.cache;
    const p = dados.achar('pacientes', e.p);
    const objetivos = evoObjetivos(r, e.p);
    const comportamentos = evoComportamentos(r);
    const abc = evoAbc(r);
    const geral = Calculos.resumoDtt(r.dtt);
    // Programas são compartilhados: os do paciente vêm dos objetivos dele.
    // "Ativo" = programa não encerrado com pelo menos um objetivo do paciente em andamento.
    const objsPac = dados.lista('objetivos').filter((o) => o.paciente_id === e.p);
    const programas = dados.programasDoPaciente(e.p);
    const progAtivos = programas.filter((g) => !/^(Encerrad|Pausad|Suspens|Concluíd|Inativo)/.test(g.status || '') &&
      objsPac.some((o) => o.programa_id === g.id && !/^(Encerrad|Pausad|Dominado)/.test(o.status || '')));
    const emAquisicao = objetivos.filter((x) => x.o.status === 'Em aquisição');
    const avaliacoes = dados.lista('avaliacoes').filter((a) => a.paciente_id === e.p)
      .sort((a, b) => (a.data_aplicacao < b.data_aplicacao ? 1 : -1));
    const periodo = `${e.de ? dataBr(e.de) : 'início'} a ${e.ate ? dataBr(e.ate) : dataBr(d.hoje)}`;
    const ident = [
      ['Paciente', p.nome_social ? `${p.nome_social} (${p.nome})` : p.nome],
      ['Nascimento', p.nascimento ? `${dataBr(p.nascimento)}${p.idade != null ? ` · ${idadeTexto(p.idade)}` : ''}` : '—'],
      ['Responsável', p.responsavel || '—'],
      ['Diagnóstico informado', p.diagnostico || '—'],
      ['Início do acompanhamento', p.inicio ? dataBr(p.inicio) : '—'],
      ['Modalidade', [p.modalidade, p.frequencia_semanal ? `${p.frequencia_semanal}x por semana` : ''].filter(Boolean).join(' · ') || '—'],
      ['Período do relatório', periodo],
      ['Emitido em', dataBr(d.hoje)],
    ];
    const comTentativas = objetivos.filter((x) => x.validas > 0);
    const semTentativas = objetivos.filter((x) => x.validas === 0);

    return `<article class="rel-folha">
      <header class="rel-cab">
        <img src="assets/logo.png?v=1" alt="">
        <div><span class="rel-nome">Fernanda Rangel</span><span class="rel-sub">Psicologia · Análise do Comportamento Aplicada</span></div>
      </header>
      <h2 class="rel-titulo">RELATÓRIO INDIVIDUAL DE ACOMPANHAMENTO</h2>
      <p class="rel-subtitulo">Relatório para revisão e assinatura profissional • Não é laudo</p>

      <h3 class="rel-secao">1. Identificação</h3>
      <dl class="rel-ident">${ident.map(([t, v]) => `<div><dt>${esc(t)}:</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>

      <h3 class="rel-secao">2. Indicadores do período</h3>
      <div class="rel-indicadores">
        <div><span>Sessões realizadas</span><strong>${r.sessoes}</strong></div>
        <div><span>Tentativas válidas</span><strong>${geral.validas}</strong></div>
        <div><span>Programas ativos</span><strong>${progAtivos.length}</strong></div>
        <div><span>Objetivos em aquisição</span><strong>${emAquisicao.length}</strong></div>
        <div><span>Acertos (indep. + com ajuda)</span><strong>${pct(geral.pctAcerto)}</strong></div>
        <div><span>Independência</span><strong>${pct(geral.pctIndep)}</strong></div>
      </div>

      <h3 class="rel-secao">3. Objetivos de intervenção</h3>
      ${comTentativas.length ? `<div class="rel-tabela-rolagem"><table class="rel-tabela">
        <thead><tr><th>Objetivo</th><th>Programa</th><th>Status</th><th class="num">Linha de base</th><th class="num">Independência</th><th class="num">Meta</th><th class="num">Tent.</th><th>Tendência</th></tr></thead>
        <tbody>${comTentativas.map((x) => `<tr>
          <td>${esc(x.o.objetivo)}</td>
          <td>${esc(dados.nome('programas', x.o.programa_id))}</td>
          <td>${esc(x.o.status || '—')}</td>
          <td class="num">${pct(x.linhaBase)}</td>
          <td class="num"><strong>${pct(x.pctIndep)}</strong>${x.deltaPp != null ? `<br><small>${evoPp(x.deltaPp)}</small>` : ''}</td>
          <td class="num">${pct(x.meta)}</td>
          <td class="num">${x.validas}</td>
          <td>${Graficos.sparkline(x.serie.map((s) => s.pct_indep), x.meta, 84, 22)}</td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="rel-vazio">Nenhuma tentativa registrada no período.</p>'}
      ${semTentativas.length ? `<p class="rel-vazio" style="margin-top:6px">Sem registros no período: ${semTentativas.map((x) => esc(x.o.objetivo)).join('; ')}.</p>` : ''}

      <h3 class="rel-secao">4. Comportamentos-alvo</h3>
      ${comportamentos.length ? `<div class="rel-tabela-rolagem"><table class="rel-tabela">
        <thead><tr><th>Comportamento</th><th>Método</th><th>Medida</th><th class="num">Registros</th><th class="num">Primeiro</th><th class="num">Último</th><th class="num">Média</th><th class="num">Linha de base</th></tr></thead>
        <tbody>${comportamentos.map((c) => `<tr>
          <td>${esc(c.nome)}</td>
          <td>${esc(c.metodo || '—')}</td>
          <td>${esc(c.metrica.nome)}</td>
          <td class="num">${c.registros}</td>
          <td class="num">${evoNumero(c.primeiro, c.metrica.unidade)}</td>
          <td class="num">${evoNumero(c.ultimo, c.metrica.unidade)}</td>
          <td class="num"><strong>${evoNumero(c.media, c.metrica.unidade)}</strong></td>
          <td class="num">${evoNumero(c.linhaBase, c.metrica.unidade)}</td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="rel-vazio">Nenhum comportamento registrado no período.</p>'}

      <h3 class="rel-secao">5. Registros ABC (resumo)</h3>
      ${abc.total ? `<p style="margin:0 0 4px">${abc.total} ${abc.total === 1 ? 'registro' : 'registros'} no período.</p>
        <div class="rel-tabela-rolagem"><table class="rel-tabela">
          <thead><tr><th>Antecedentes mais frequentes</th><th>Consequências mais frequentes</th><th>Comportamentos</th></tr></thead>
          <tbody><tr>${[abc.antecedentes, abc.consequencias, abc.comportamentos].map((l) => `<td style="vertical-align:top">${l.slice(0, 4).map((i) => `${esc(i.rotulo)} (${i.n})`).join('<br>')}</td>`).join('')}</tr></tbody>
        </table></div>` : '<p class="rel-vazio">Nenhum registro ABC no período.</p>'}

      <h3 class="rel-secao">6. Avaliações</h3>
      ${avaliacoes.length ? `<div class="rel-tabela-rolagem"><table class="rel-tabela">
        <thead><tr><th>Instrumento</th><th>Aplicação</th><th>Status</th><th>Domínios</th><th>Próxima</th></tr></thead>
        <tbody>${avaliacoes.map((a) => `<tr>
          <td>${esc(a.instrumento)}${a.versao ? ` <small>(${esc(a.versao)})</small>` : ''}</td>
          <td>${dataBr(a.data_aplicacao)}</td>
          <td>${esc(a.status || '—')}</td>
          <td>${esc(a.dominios || '—')}</td>
          <td>${a.proxima_avaliacao ? dataBr(a.proxima_avaliacao) : '—'}</td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="rel-vazio">Nenhuma avaliação registrada.</p>'}

      <h3 class="rel-secao">7. Síntese clínica</h3>
      <div class="rel-editavel" contenteditable="true" data-dica="Clique aqui e escreva a síntese do período (não é salvo, só sai na impressão)."></div>
      <div class="rel-linhas"></div>

      <h3 class="rel-secao">8. Orientações e próximos passos</h3>
      <div class="rel-editavel" contenteditable="true" data-dica="Orientações à família/escola e próximos passos da intervenção."></div>
      <div class="rel-linhas"></div>

      <div class="rel-assinatura"><div id="rel-assinatura"></div></div>
      <p class="rel-rodape">Documento gerado a partir dos registros de sessão do período indicado. Percentuais calculados sobre as tentativas válidas (todas as registradas, exceto as anuladas). As informações são de uso profissional e sigilosas, conforme o Código de Ética Profissional do Psicólogo. Este documento não substitui laudo ou parecer psicológico.</p>
    </article>`;
  },
};
