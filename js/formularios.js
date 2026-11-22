'use strict';
/**
 * formularios.js — formulário e exibição gerados a partir do esquema que o Apps Script envia
 * (entidades_ em Entidades.gs). Um campo novo na planilha aparece aqui sem mexer no site.
 */

/** Valor formatado para leitura. */
function mostrarValor(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  switch (campo.tipo) {
    case 'data': return dataBr(valor);
    case 'moeda': return moeda(valor);
    case 'pct': return pct(valor);
    case 'numero': return numCampo(valor);
    case 'ref': return dados.nome(campo.ref, valor);
    default: return String(valor);
  }
}

/** Valor no formato do campo de digitação. */
function valorCampo(campo, valor) {
  if (valor === null || valor === undefined) return '';
  if (campo.tipo === 'pct') return pctCampo(valor);
  if (campo.tipo === 'numero' || campo.tipo === 'moeda') return numCampo(valor);
  return String(valor);
}

function opcoesRef(campo, registro, fixos) {
  const pacienteId = (fixos && fixos.paciente_id) || registro.paciente_id || '';
  let itens = dados.lista(campo.ref);
  if (campo.ref === 'pacientes') {
    itens = itens.filter((p) => p.status !== 'Inativo' && p.status !== 'Alta' || p.id === registro[campo.campo]);
  } else if (campo.ref === 'programas') {
    // Banco compartilhado: todos os programas aparecem, seja qual for o paciente.
  } else if (pacienteId) {
    itens = itens.filter((x) => x.paciente_id === pacienteId);
  } else {
    itens = [];
  }
  if (campo.ref !== 'pacientes' && registro.programa_id && campo.ref === 'objetivos') {
    itens = itens.filter((x) => x.programa_id === registro.programa_id);
  }
  return itens.map((x) => ({ valor: x.id, rotulo: dados.nome(campo.ref, x.id) }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}

function htmlCampo(campo, registro, fixos) {
  const nome = campo.campo;
  const valor = registro[nome] != null && registro[nome] !== '' ? registro[nome] : (registro.id ? '' : (campo.padrao || ''));
  const obrig = campo.obrig ? ' required' : '';
  const asterisco = campo.obrig ? ' <span aria-hidden="true">*</span>' : '';
  const largo = campo.tipo === 'longo' ? ' col-2' : '';
  let entrada;
  if (fixos && fixos[nome] != null) {
    return `<input type="hidden" name="${esc(nome)}" value="${esc(fixos[nome])}">`;
  }
  switch (campo.tipo) {
    case 'longo':
      entrada = `<textarea class="campo" name="${esc(nome)}" rows="3"${obrig}>${esc(valor)}</textarea>`; break;
    case 'data':
      entrada = `<input class="campo" type="date" name="${esc(nome)}" value="${esc(valor)}"${obrig}>`; break;
    case 'hora':
      entrada = `<input class="campo" type="time" name="${esc(nome)}" value="${esc(valor)}"${obrig}>`; break;
    case 'numero': case 'moeda':
      entrada = `<input class="campo" name="${esc(nome)}" inputmode="decimal" value="${esc(valorCampo(campo, valor))}"${obrig}>`; break;
    case 'pct':
      entrada = `<input class="campo" name="${esc(nome)}" inputmode="decimal" placeholder="ex.: 80" value="${esc(valorCampo(campo, valor))}"${obrig}>`; break;
    case 'telefone':
      entrada = `<input class="campo" type="tel" name="${esc(nome)}" data-mascara="telefone" value="${esc(valor)}"${obrig}>`; break;
    case 'email':
      entrada = `<input class="campo" type="email" name="${esc(nome)}" autocapitalize="none" value="${esc(valor)}"${obrig}>`; break;
    case 'lista': {
      const opcoes = dados.opcoes(campo.lista).slice();
      if (valor && opcoes.indexOf(valor) < 0) opcoes.push(valor);
      entrada = `<select class="campo" name="${esc(nome)}"${obrig}>${opcoesSelect(opcoes, valor, 'Selecione…')}</select>`; break;
    }
    case 'ref':
      entrada = `<select class="campo" name="${esc(nome)}" data-ref="${esc(campo.ref)}"${obrig}>${opcoesSelect(opcoesRef(campo, registro, fixos), valor, 'Selecione…')}</select>`; break;
    default: {
      // sugestoes: lista da planilha oferecida como atalho, mas aceita texto novo
      const sug = campo.sugestoes ? `form-sug-${nome}` : '';
      entrada = `<input class="campo" name="${esc(nome)}" value="${esc(valor)}"${sug ? ` list="${sug}"` : ''}${campo.max ? ` maxlength="${campo.max}"` : ''}${obrig}>`
        + (sug ? `<datalist id="${sug}">${dados.opcoes(campo.sugestoes).map((x) => `<option value="${esc(x)}">`).join('')}</datalist>` : '');
    }
  }
  const rotulo = campo.tipo === 'pct' ? `${esc(campo.rotulo)} (%)` : campo.tipo === 'moeda' ? `${esc(campo.rotulo)} (R$)` : esc(campo.rotulo);
  return `<label class="rotulo${largo}">${rotulo}${asterisco}${entrada}</label>`;
}

/** Lê o formulário e converte números/percentuais do jeito brasileiro. */
function lerFormulario(form, esquema) {
  const f = new FormData(form);
  const saida = {};
  esquema.campos.forEach((c) => {
    if (!f.has(c.campo)) return;
    const bruto = String(f.get(c.campo) || '').trim();
    if (c.tipo === 'numero' || c.tipo === 'moeda') saida[c.campo] = bruto === '' ? '' : lerNumero(bruto);
    else if (c.tipo === 'pct') saida[c.campo] = bruto === '' ? '' : lerPct(bruto);
    else saida[c.campo] = bruto;
  });
  return saida;
}

/**
 * Abre o formulário de uma entidade em modal.
 * opcoes.fixos: campos já definidos (ex.: { paciente_id }) que não aparecem para edição.
 * Devolve uma promessa com o id salvo (ou null se fechar).
 */
function formularioEntidade(entidade, registro = {}, opcoes = {}) {
  const esquema = dados.esquema(entidade);
  const fixos = opcoes.fixos || null;
  const novo = !registro.id;
  abrirModal(`${novo ? 'Novo' : 'Editar'} ${esquema.rotulo.toLowerCase()}`, `
    <form id="form-entidade" class="form-grade" novalidate>
      ${esquema.campos.map((c) => htmlCampo(c, registro, fixos)).join('')}
      <p class="nota col-2">Campos com * são obrigatórios.</p>
      <p id="form-entidade-erro" class="aviso-erro col-2" hidden></p>
      <div class="modal-botoes col-2">
        <button class="botao botao-secundario" type="button" data-acao="fechar-modal">Cancelar</button>
        <button class="botao botao-primario" type="submit">Salvar</button>
      </div>
    </form>`, { larga: true });

  const form = el('form-entidade');
  form.querySelectorAll('[data-mascara=telefone]').forEach((i) => i.addEventListener('input', () => { i.value = mascaraTelefone(i.value); }));

  // Paciente → filtra objetivos; programa → filtra objetivos.
  const atualizarDependentes = () => {
    const atual = lerFormulario(form, esquema);
    const base = Object.assign({}, registro, atual, fixos || {});
    form.querySelectorAll('select[data-ref]').forEach((s) => {
      if (s.dataset.ref === 'pacientes') return;
      const campo = esquema.campos.find((c) => c.campo === s.name);
      const escolhido = s.value;
      s.innerHTML = opcoesSelect(opcoesRef(campo, base, fixos), escolhido, 'Selecione…');
    });
  };
  form.querySelectorAll('select[data-ref]').forEach((s) => s.addEventListener('change', atualizarDependentes));

  return new Promise((resolve) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const botao = form.querySelector('[type=submit]');
      const aviso = el('form-entidade-erro');
      aviso.hidden = true;
      botao.disabled = true; botao.textContent = 'Salvando…';
      try {
        const corpo = Object.assign(lerFormulario(form, esquema), fixos || {}, { id: registro.id || '' });
        const r = await api('salvar', { entidade, registro: corpo });
        fecharModal();
        toast(novo ? `${esquema.rotulo} cadastrado.` : `${esquema.rotulo} atualizado.`);
        dados.invalidar();
        resolve(r.id);
      } catch (erro) {
        aviso.textContent = erro.message; aviso.hidden = false;
        botao.disabled = false; botao.textContent = 'Salvar';
      }
    });
  });
}

async function excluirEntidade(entidade, id, aviso) {
  const esquema = dados.esquema(entidade);
  const ok = await confirmar(`Excluir ${esquema.rotulo.toLowerCase()}?`,
    `"${dados.nome(entidade, id)}" sai das listas (continua guardado na planilha). ${aviso || ''}`, { ok: 'Excluir', perigo: true });
  if (!ok) return false;
  try {
    await api('excluir', { entidade, id });
    toast(`${esquema.rotulo} excluído.`);
    dados.invalidar();
    return true;
  } catch (erro) { toast(erro.message, 'erro'); return false; }
}

/** Lista de definição (dt/dd) com os campos preenchidos. */
function fichaEntidade(entidade, registro, ignorar = []) {
  const esquema = dados.esquema(entidade);
  const linhas = esquema.campos.filter((c) => ignorar.indexOf(c.campo) < 0 && registro[c.campo] !== '' && registro[c.campo] != null)
    .map((c) => `<dt>${esc(c.rotulo)}</dt><dd class="${c.tipo === 'longo' ? 'texto-longo' : ''}">${esc(mostrarValor(c, registro[c.campo]))}</dd>`);
  return linhas.length ? `<dl class="lista-dados">${linhas.join('')}</dl>` : '<p class="vazio">Nada preenchido.</p>';
}
