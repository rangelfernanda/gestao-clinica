'use strict';
/**
 * avaliacoes.js — tela #/avaliacoes (VB-MAPP, Vineland, avaliações de habilidades…).
 * Guarda só o registro da aplicação e um resumo dos resultados autorizados — nunca itens protegidos do instrumento.
 * Alerta de reavaliação vem calculado do servidor (Calculos.alertaAvaliacao).
 */

function cartaoAvaliacao(a, opcoes = {}) {
  return `<article class="cartao-item">
    <div class="linha-pilulas">${pilula(classeStatus(a.status), a.status)}${a.alerta ? pilula(classeAlerta(a.alerta), a.alerta) : ''}</div>
    <h3>${esc(a.instrumento)}${a.versao ? ` <span class="nota">· ${esc(a.versao)}</span>` : ''}</h3>
    <div class="meta">${opcoes.semPaciente ? '' : `<span><a href="#/pacientes/${esc(a.paciente_id)}">${esc(dados.nome('pacientes', a.paciente_id))}</a></span>`}<span>Aplicação ${dataBr(a.data_aplicacao)}</span>${a.profissional ? `<span>${esc(a.profissional)}</span>` : ''}</div>
    ${a.dominios ? `<div class="meta"><span>Domínios: ${esc(a.dominios)}</span></div>` : ''}
    <div class="meta"><span>Próxima avaliação: ${a.proxima_avaliacao ? dataBr(a.proxima_avaliacao) : '—'}</span></div>
    <div class="botoes-linha">
      <button class="botao botao-secundario botao-pequeno" type="button" data-ver-ava="${esc(a.id)}">Ver</button>
      <button class="botao botao-secundario botao-pequeno" type="button" data-editar-ava="${esc(a.id)}">Editar</button>
      <button class="botao botao-perigo botao-pequeno" type="button" data-excluir-ava="${esc(a.id)}">Excluir</button>
    </div>
  </article>`;
}

function ligarBotoesAvaliacao(raiz, aoMudar, fixos) {
  raiz.querySelectorAll('[data-ver-ava]').forEach((b) => b.addEventListener('click', () => {
    const a = dados.achar('avaliacoes', b.dataset.verAva);
    if (!a) return;
    abrirModal(`${a.instrumento} · ${dados.nome('pacientes', a.paciente_id)}`, `
      ${a.alerta ? `<div class="linha-pilulas" style="margin-bottom:10px">${pilula(classeAlerta(a.alerta), a.alerta)}</div>` : ''}
      ${fichaEntidade('avaliacoes', a)}
      <div class="botoes-linha" style="margin-top:14px"><button class="botao botao-secundario" type="button" data-acao="fechar-modal">Fechar</button></div>`, { larga: true });
  }));
  raiz.querySelectorAll('[data-editar-ava]').forEach((b) => b.addEventListener('click', async () => {
    if (await formularioEntidade('avaliacoes', dados.achar('avaliacoes', b.dataset.editarAva), fixos ? { fixos } : {})) aoMudar();
  }));
  raiz.querySelectorAll('[data-excluir-ava]').forEach((b) => b.addEventListener('click', async () => {
    if (await excluirEntidade('avaliacoes', b.dataset.excluirAva)) aoMudar();
  }));
}

const AVISO_INSTRUMENTO = 'Registre aqui só a aplicação, os domínios e um resumo dos resultados que você pode divulgar. Não copie itens, perguntas ou folhas de resposta protegidas dos instrumentos — guarde o protocolo original em local seguro e anote só a referência.';

const telaAvaliacoes = {
  filtro: { paciente: '', status: '', pendente: false },

  async mostrar(param, query) {
    const vista = el('vista-avaliacoes');
    if (param === 'pendentes') this.filtro = { paciente: '', status: '', pendente: true };
    if (query && query.get('p')) this.filtro.paciente = query.get('p');
    if (!dados.cache) vista.innerHTML = `<div class="cartao">${skeleton(5)}</div>`;
    await dados.carregar();
    this.renderizar();
  },

  renderizar() {
    const vista = el('vista-avaliacoes');
    const f = this.filtro;
    const itens = dados.lista('avaliacoes').filter((a) => (!f.paciente || a.paciente_id === f.paciente) && (!f.status || a.status === f.status) && (!f.pendente || a.alerta));
    const pacientes = dados.lista('pacientes').map((p) => ({ valor: p.id, rotulo: p.nome_social || p.nome }));
    vista.innerHTML = `<div class="f2">
      <div class="cartao">
        <div class="barra-ferramentas">
          <select id="ava-pac" class="campo" aria-label="Paciente">${opcoesSelect(pacientes, f.paciente, 'Todos os pacientes')}</select>
          <select id="ava-status" class="campo" aria-label="Status">${opcoesSelect(dados.opcoes('STATUS AVALIAÇÃO'), f.status, 'Todos os status')}</select>
          <label class="rotulo-check"><input type="checkbox" id="ava-pendente"${f.pendente ? ' checked' : ''}> Só reavaliação pendente</label>
          <span class="espaco"></span>
          <button class="botao botao-primario" type="button" id="ava-nova">+ Nova avaliação</button>
        </div>
      </div>
      <p class="nota-aviso">${esc(AVISO_INSTRUMENTO)}</p>
      ${itens.length ? `<div class="grade-cartoes">${itens.map((a) => cartaoAvaliacao(a)).join('')}</div>` : '<div class="cartao"><p class="vazio">Nenhuma avaliação com esse filtro.</p></div>'}
    </div>`;
    el('ava-pac').addEventListener('change', (e) => { f.paciente = e.target.value; this.renderizar(); });
    el('ava-status').addEventListener('change', (e) => { f.status = e.target.value; this.renderizar(); });
    el('ava-pendente').addEventListener('change', (e) => { f.pendente = e.target.checked; this.renderizar(); });
    const depois = async () => { await dados.carregar(true); this.renderizar(); };
    el('ava-nova').addEventListener('click', async () => {
      if (await formularioEntidade('avaliacoes', { paciente_id: f.paciente })) depois();
    });
    ligarBotoesAvaliacao(vista, depois);
  },
};
