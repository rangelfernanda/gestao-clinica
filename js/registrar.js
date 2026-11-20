'use strict';
/**
 * registrar.js — registro da sessão pelo celular, durante o atendimento.
 *   DTT: escolhe o objetivo e toca no resultado de cada tentativa (contador e % ao vivo).
 *   Comportamentos: contador +/− com tempo observado.
 *   ABC: formulário rápido.
 *   Anotações: os demais campos da sessão.
 * Tudo fica num rascunho no aparelho (localStorage) até tocar em "Salvar sessão";
 * se a internet cair ou a página fechar, o rascunho continua lá.
 */

const RASCUNHO_STORAGE = 'gestao_clinica_rascunho';
const CLASSE_RESULTADO = {
  'Acerto independente': 'r-indep', 'Acerto com ajuda': 'r-ajuda', 'Erro': 'r-erro',
  'Ausência de resposta': 'r-sem', 'Tentativa anulada': 'r-anulada',
};
const CAMPOS_ANOTACOES = ['status', 'modalidade', 'profissional', 'estrategias', 'materiais', 'participacao', 'resumo', 'observacoes', 'orientacoes', 'proximos_passos'];

function horaAgora() {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

const telaRegistrar = {
  r: null,          // rascunho em edição
  aba: 'dtt',
  retomar: false,
  vez: 0,

  // ───────── rascunho no aparelho ─────────
  lerRascunho() {
    try { const b = localStorage.getItem(RASCUNHO_STORAGE); return b ? JSON.parse(b) : null; } catch (e) { return null; }
  },
  guardar() {
    if (!this.r) return;
    this.r.alterado = true;
    try { localStorage.setItem(RASCUNHO_STORAGE, JSON.stringify(this.r)); } catch (e) { /* navegação privada */ }
  },
  descartarRascunho() {
    try { localStorage.removeItem(RASCUNHO_STORAGE); } catch (e) { /* ignora */ }
  },

  novoRascunho(pacienteId) {
    const paciente = dados.achar('pacientes', pacienteId);
    return {
      chave: 'novo', alterado: false,
      sessao: { id: '', paciente_id: pacienteId || '', data: dados.cache.hoje, inicio: horaAgora(), termino: '', status: 'Realizada',
        modalidade: paciente ? paciente.modalidade : '', profissional: paciente ? paciente.profissional : '' },
      dtt: [], comportamentos: [], abc: [],
      objetivo: '', nivel: '',
    };
  },

  async mostrar(id, query) {
    const vista = el('vista-registrar');
    vista.innerHTML = `<div class="cartao">${skeleton(6)}</div>`;
    const vez = ++this.vez;   // se a tela for aberta de novo enquanto carrega, só a última vale
    await dados.carregar();
    if (vez !== this.vez) return;
    const salvo = this.lerRascunho();
    const chave = id || 'novo';

    // Veio do botão "Continuar" de um rascunho de outra página: abre direto o rascunho.
    if (this.retomar && salvo && salvo.chave === chave) {
      this.retomar = false;
      this.r = salvo; this.aba = 'dtt';
      if (id) el('topo-titulo').textContent = 'Editar sessão';
      this.render();
      return;
    }
    this.retomar = false;

    if (id) {
      const r = await api('obterSessao', { id });
      if (vez !== this.vez) return;
      this.r = {
        chave: id, alterado: false,
        sessao: r.sessao, dtt: r.dtt, comportamentos: r.comportamentos, abc: r.abc, objetivo: '', nivel: '',
      };
      el('topo-titulo').textContent = 'Editar sessão';
    } else {
      this.r = this.novoRascunho(query && query.get('p'));
    }
    this.aba = 'dtt';
    this.render();

    // Rascunho deixado para trás (página fechou, internet caiu…)
    if (salvo && salvo.alterado && salvo.chave === chave) {
      this.mostrarAvisoRascunho(salvo);
    } else if (salvo && salvo.alterado && !id && salvo.chave !== 'novo') {
      this.mostrarAvisoRascunho(salvo);
    }
  },

  mostrarAvisoRascunho(salvo) {
    const caixa = el('reg-aviso');
    const n = (salvo.dtt || []).length;
    caixa.hidden = false;
    caixa.innerHTML = `<span>Há um registro não salvo${salvo.chave !== 'novo' ? ' (edição de sessão)' : ''}: <strong>${esc(dados.nome('pacientes', salvo.sessao.paciente_id))}</strong>, ${dataBr(salvo.sessao.data)}, ${n} ${n === 1 ? 'tentativa' : 'tentativas'}.</span>
      <span class="espaco"></span>
      <button class="botao botao-primario botao-pequeno" type="button" id="rasc-continuar">Continuar</button>
      <button class="botao botao-secundario botao-pequeno" type="button" id="rasc-descartar">Descartar</button>`;
    el('rasc-continuar').addEventListener('click', () => {
      if (salvo.chave !== this.r.chave) {
        this.retomar = true;
        location.hash = salvo.chave === 'novo' ? '#/registrar' : `#/registrar/${salvo.chave}`;
        return;
      }
      this.r = salvo; this.render();
    });
    el('rasc-descartar').addEventListener('click', () => { this.descartarRascunho(); caixa.hidden = true; });
  },

  objetivosDoPaciente() {
    const pid = this.r.sessao.paciente_id;
    const usados = new Set(this.r.dtt.map((t) => t.objetivo_id));
    return dados.lista('objetivos').filter((o) => o.paciente_id === pid && (usados.has(o.id) || (o.status !== 'Encerrado' && o.status !== 'Dominado')));
  },

  // ───────── tela ─────────
  render() {
    const vista = el('vista-registrar');
    const s = this.r.sessao;
    const pacientes = dados.lista('pacientes').filter((p) => p.status !== 'Inativo' && p.status !== 'Alta' || p.id === s.paciente_id)
      .map((p) => ({ valor: p.id, rotulo: p.nome_social || p.nome })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
    const abas = [['dtt', 'DTT', this.r.dtt.length], ['comportamentos', 'Comportamentos', this.r.comportamentos.length], ['abc', 'ABC', this.r.abc.length], ['anotacoes', 'Anotações', '']];
    vista.innerHTML = `
      <div id="reg-aviso" class="aviso-rascunho" hidden></div>
      <div class="cartao">
        <div class="reg-topo">
          <label class="rotulo">Paciente<select class="campo" id="reg-paciente">${opcoesSelect(pacientes, s.paciente_id, 'Selecione o paciente…')}</select></label>
          <label class="rotulo">Data<input class="campo" type="date" id="reg-data" value="${esc(s.data)}"></label>
          <label class="rotulo">Início<input class="campo" type="time" id="reg-inicio" value="${esc(s.inicio || '')}"></label>
          <label class="rotulo">Término<input class="campo" type="time" id="reg-termino" value="${esc(s.termino || '')}"></label>
        </div>
      </div>
      ${s.paciente_id ? `
        <div class="abas" role="tablist">${abas.map(([k, t, n]) => `<button class="aba${this.aba === k ? ' ativa' : ''}" type="button" role="tab" data-aba="${k}">${t}<span class="contador" data-contador="${k}">${n === '' ? '' : n}</span></button>`).join('')}</div>
        <div id="reg-corpo"></div>` : '<div class="cartao"><p class="vazio">Escolha o paciente para começar.</p></div>'}
      <div class="reg-rodape">
        <span class="resumo" id="reg-resumo"></span>
        <span class="espaco"></span>
        <button class="botao botao-secundario" type="button" id="reg-cancelar">Descartar</button>
        <button class="botao botao-primario" type="button" id="reg-salvar"${s.paciente_id ? '' : ' disabled'}>Salvar sessão</button>
      </div>`;

    el('reg-paciente').addEventListener('change', (e) => this.trocarPaciente(e.target.value));
    [['reg-data', 'data'], ['reg-inicio', 'inicio'], ['reg-termino', 'termino']].forEach(([idCampo, campo]) =>
      el(idCampo).addEventListener('change', (e) => { this.r.sessao[campo] = e.target.value; this.guardar(); }));
    vista.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => {
      this.aba = b.dataset.aba;
      vista.querySelectorAll('[data-aba]').forEach((x) => x.classList.toggle('ativa', x === b));
      this.renderAba();
    }));
    el('reg-cancelar').addEventListener('click', () => this.cancelar());
    el('reg-salvar').addEventListener('click', () => this.salvar());
    if (s.paciente_id) this.renderAba();
    this.atualizarRodape();
  },

  async trocarPaciente(pid) {
    const temDados = this.r.dtt.length || this.r.comportamentos.length || this.r.abc.length;
    if (temDados && pid !== this.r.sessao.paciente_id) {
      const ok = await confirmar('Trocar de paciente?', 'As tentativas, comportamentos e registros ABC anotados até agora serão apagados deste rascunho.', { ok: 'Trocar', perigo: true });
      if (!ok) { el('reg-paciente').value = this.r.sessao.paciente_id; return; }
      this.r.dtt = []; this.r.comportamentos = []; this.r.abc = [];
    }
    const p = dados.achar('pacientes', pid);
    this.r.sessao.paciente_id = pid;
    if (p && !this.r.sessao.id) { this.r.sessao.modalidade = p.modalidade || ''; this.r.sessao.profissional = p.profissional || ''; }
    this.r.objetivo = '';
    this.guardar();
    this.render();
  },

  atualizarRodape() {
    const r = this.r;
    const t = Calculos.resumoDtt(r.dtt);
    el('reg-resumo').textContent = `${r.dtt.length} ${r.dtt.length === 1 ? 'tentativa' : 'tentativas'}${t.pctIndep != null ? ` · ${pct(t.pctIndep)} indep.` : ''} · ${r.comportamentos.length} comp. · ${r.abc.length} ABC`;
    qa('[data-contador]').forEach((c) => {
      const k = c.dataset.contador;
      if (k !== 'anotacoes') c.textContent = r[k].length;
    });
  },

  renderAba() {
    const corpo = el('reg-corpo');
    if (!corpo) return;
    if (this.aba === 'dtt') this.abaDtt(corpo);
    else if (this.aba === 'comportamentos') this.abaComportamentos(corpo);
    else if (this.aba === 'abc') this.abaAbc(corpo);
    else this.abaAnotacoes(corpo);
  },

  // ───────── DTT ─────────
  abaDtt(corpo) {
    const objetivos = this.objetivosDoPaciente();
    if (!objetivos.length) {
      corpo.innerHTML = `<div class="cartao"><p class="vazio">Este paciente ainda não tem objetivos em andamento.</p>
        <a class="botao botao-secundario" href="#/pacientes/${esc(this.r.sessao.paciente_id)}">Cadastrar programa e objetivo</a></div>`;
      return;
    }
    if (!objetivos.some((o) => o.id === this.r.objetivo)) this.r.objetivo = objetivos[0].id;
    const niveis = dados.opcoes('NÍVEL DE AJUDA').filter((n) => n !== 'Independente');
    if (!this.r.nivel || niveis.indexOf(this.r.nivel) < 0) this.r.nivel = niveis[0] || '';
    const doObjetivo = this.r.dtt.filter((t) => t.objetivo_id === this.r.objetivo);
    const res = Calculos.resumoDtt(doObjetivo);
    const obj = dados.achar('objetivos', this.r.objetivo);

    corpo.innerHTML = `<div class="cartao">
      <div class="reg-objetivos" role="listbox" aria-label="Objetivo">${objetivos.map((o) => {
        const n = this.r.dtt.filter((t) => t.objetivo_id === o.id).length;
        return `<button type="button" class="reg-obj${o.id === this.r.objetivo ? ' ativo' : ''}" data-obj="${esc(o.id)}" role="option" aria-selected="${o.id === this.r.objetivo}">
          <span class="reg-obj-n">${n}</span>${esc(o.objetivo)}<small>${esc(dados.nome('programas', o.programa_id))}</small></button>`;
      }).join('')}</div>
      <div class="dtt-placar">
        <div><strong>${res.validas}</strong><span>válidas</span></div>
        <div><strong>${res.pctIndep == null ? '—' : Math.round(res.pctIndep * 100) + '%'}</strong><span>independência${obj && obj.meta !== '' && obj.meta != null ? ` · meta ${Math.round(obj.meta * 100)}%` : ''}</span></div>
        <div><strong>${res.pctAcerto == null ? '—' : Math.round(res.pctAcerto * 100) + '%'}</strong><span>acertos</span></div>
      </div>
      <div class="dtt-botoes">
        <button type="button" class="dtt-btn dtt-indep" data-res="Acerto independente">Independente<small>acerto sem ajuda</small></button>
        <button type="button" class="dtt-btn dtt-ajuda" data-res="Acerto com ajuda">Com ajuda<small id="dtt-nivel-txt">${esc(this.r.nivel)}</small></button>
        <button type="button" class="dtt-btn dtt-erro" data-res="Erro">Erro</button>
        <button type="button" class="dtt-btn dtt-sem" data-res="Ausência de resposta">Sem resposta</button>
        <button type="button" class="dtt-btn dtt-anular" data-res="Tentativa anulada">Anular tentativa</button>
      </div>
      <div class="nivel-ajuda" aria-label="Nível de ajuda">${niveis.map((n) => `<button type="button" data-nivel="${esc(n)}" class="${n === this.r.nivel ? 'ativo' : ''}">${esc(n)}</button>`).join('')}</div>
      <div class="dtt-trilha" aria-label="Tentativas deste objetivo">${doObjetivo.map((t, i) => `<button type="button" class="bolinha ${CLASSE_RESULTADO[t.resultado] || ''}" data-tent="${this.r.dtt.indexOf(t)}" title="${esc(t.resultado)}${t.nivel_ajuda ? ' · ' + esc(t.nivel_ajuda) : ''}">${i + 1}</button>`).join('')}</div>
      ${doObjetivo.length ? '<div class="botoes-linha" style="margin-top:10px"><button type="button" class="botao botao-secundario botao-pequeno" id="dtt-desfazer">Desfazer última</button><span class="nota">Toque num número para corrigir.</span></div>' : ''}
    </div>`;

    corpo.querySelectorAll('[data-obj]').forEach((b) => b.addEventListener('click', () => { this.r.objetivo = b.dataset.obj; this.guardar(); this.renderAba(); }));
    corpo.querySelectorAll('[data-nivel]').forEach((b) => b.addEventListener('click', () => {
      this.r.nivel = b.dataset.nivel; this.guardar();
      corpo.querySelectorAll('[data-nivel]').forEach((x) => x.classList.toggle('ativo', x === b));
      el('dtt-nivel-txt').textContent = this.r.nivel;
    }));
    corpo.querySelectorAll('[data-res]').forEach((b) => b.addEventListener('click', () => this.anotarTentativa(b.dataset.res)));
    corpo.querySelectorAll('[data-tent]').forEach((b) => b.addEventListener('click', () => this.editarTentativa(Number(b.dataset.tent))));
    const desfazer = el('dtt-desfazer');
    if (desfazer) desfazer.addEventListener('click', () => {
      for (let i = this.r.dtt.length - 1; i >= 0; i--) {
        if (this.r.dtt[i].objetivo_id === this.r.objetivo) { this.r.dtt.splice(i, 1); break; }
      }
      this.guardar(); this.renderAba(); this.atualizarRodape();
    });
  },

  anotarTentativa(resultado) {
    const nivel = resultado === 'Acerto independente' ? 'Independente' : resultado === 'Acerto com ajuda' ? this.r.nivel : '';
    this.r.dtt.push({ objetivo_id: this.r.objetivo, resultado, nivel_ajuda: nivel });
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* ignora */ } }
    this.guardar(); this.renderAba(); this.atualizarRodape();
  },

  editarTentativa(indice) {
    const t = this.r.dtt[indice];
    if (!t) return;
    abrirModal('Corrigir tentativa', `
      <form id="form-tent" class="form-grade" novalidate>
        <label class="rotulo">Resultado<select class="campo" name="resultado">${opcoesSelect(dados.opcoes('RESULTADO DTT'), t.resultado)}</select></label>
        <label class="rotulo">Nível de ajuda<select class="campo" name="nivel_ajuda">${opcoesSelect(dados.opcoes('NÍVEL DE AJUDA'), t.nivel_ajuda || '', '—')}</select></label>
        <label class="rotulo">Tipo de ajuda<select class="campo" name="tipo_ajuda">${opcoesSelect(dados.opcoes('TIPOS DE AJUDA'), t.tipo_ajuda || '', '—')}</select></label>
        <label class="rotulo">Latência (seg)<input class="campo" name="latencia_seg" inputmode="decimal" value="${esc(t.latencia_seg == null ? '' : numCampo(t.latencia_seg))}"></label>
        <label class="rotulo">Estímulo<input class="campo" name="estimulo" value="${esc(t.estimulo || '')}"></label>
        <label class="rotulo">Resposta observada<input class="campo" name="resposta_observada" value="${esc(t.resposta_observada || '')}"></label>
        <label class="rotulo col-2">Observações<textarea class="campo" name="observacoes" rows="2">${esc(t.observacoes || '')}</textarea></label>
        <div class="modal-botoes col-2">
          <button class="botao botao-perigo" type="button" id="tent-remover">Remover</button>
          <span class="espaco"></span>
          <button class="botao botao-secundario" type="button" data-acao="fechar-modal">Cancelar</button>
          <button class="botao botao-primario" type="submit">Salvar</button>
        </div>
      </form>`);
    el('tent-remover').addEventListener('click', () => { this.r.dtt.splice(indice, 1); this.guardar(); fecharModal(); this.renderAba(); this.atualizarRodape(); });
    el('form-tent').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      ['resultado', 'nivel_ajuda', 'tipo_ajuda', 'estimulo', 'resposta_observada', 'observacoes'].forEach((k) => { t[k] = String(f.get(k) || ''); });
      t.latencia_seg = String(f.get('latencia_seg') || '').trim() === '' ? '' : lerNumero(f.get('latencia_seg'));
      this.guardar(); fecharModal(); this.renderAba(); this.atualizarRodape();
    });
  },

  // ───────── Comportamentos ─────────
  abaComportamentos(corpo) {
    const lista = this.r.comportamentos;
    const intens = dados.opcoes('INTENSIDADE');
    corpo.innerHTML = `<div class="cartao">
      ${lista.length ? `<div class="pilha">${lista.map((c, i) => {
        const metodo = c.metodo || 'Frequência';
        const m = Calculos.metricasComportamento(c);
        return `<div class="cmp-item" data-cmp="${i}">
          <div class="cmp-cab"><div><strong>${esc(c.comportamento)}</strong><div class="nota">${esc(metodo)}${m.taxa_hora != null ? ` · ${num2(m.taxa_hora)} por hora` : ''}${m.tendencia ? ` · ${m.tendencia.toLowerCase()} vs. linha de base` : ''}</div></div>
            <button type="button" class="botao botao-perigo botao-pequeno" data-cmp-remover="${i}">Remover</button></div>
          ${metodo === 'Frequência' || metodo === 'Taxa' ? `<div class="contador-grande">
            <button type="button" data-cmp-menos="${i}" aria-label="Diminuir">−</button>
            <output aria-live="polite">${Number(c.frequencia) || 0}</output>
            <button type="button" class="mais" data-cmp-mais="${i}" aria-label="Aumentar">+</button></div>` : ''}
          <div class="cmp-campos">
            ${metodo === 'Duração' ? `<label class="rotulo">Duração total (min)<input class="campo" inputmode="decimal" data-cmp-campo="duracao_total" value="${esc(c.duracao_total == null ? '' : numCampo(c.duracao_total))}"></label>
              <label class="rotulo">Nº de episódios<input class="campo" inputmode="numeric" data-cmp-campo="frequencia" value="${esc(c.frequencia == null ? '' : numCampo(c.frequencia))}"></label>` : ''}
            ${metodo === 'Latência' ? `<label class="rotulo">Latência (seg)<input class="campo" inputmode="decimal" data-cmp-campo="latencia" value="${esc(c.latencia == null ? '' : numCampo(c.latencia))}"></label>` : ''}
            <label class="rotulo">Tempo observado (min)<input class="campo" inputmode="decimal" data-cmp-campo="tempo_observado" value="${esc(c.tempo_observado == null ? '' : numCampo(c.tempo_observado))}"></label>
            <label class="rotulo">Linha de base (freq.)<input class="campo" inputmode="decimal" data-cmp-campo="linha_base_freq" value="${esc(c.linha_base_freq == null ? '' : numCampo(c.linha_base_freq))}"></label>
            <label class="rotulo">Intensidade<select class="campo" data-cmp-campo="intensidade">${opcoesSelect(intens, c.intensidade || '', '—')}</select></label>
          </div>
        </div>`;
      }).join('')}</div>` : '<p class="vazio">Nenhum comportamento registrado nesta sessão.</p>'}
      <form id="cmp-novo" class="form-grade" style="margin-top:14px" novalidate>
        <label class="rotulo">Comportamento<input class="campo" name="comportamento" list="lista-comportamentos" placeholder="Escolha ou digite" required></label>
        <label class="rotulo">Método<select class="campo" name="metodo">${opcoesSelect(dados.opcoes('MENSURAÇÃO'), 'Frequência')}</select></label>
        <datalist id="lista-comportamentos">${dados.opcoes('COMPORTAMENTOS ALVO').map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
        <div class="col-2"><button class="botao botao-secundario" type="submit">+ Adicionar comportamento</button></div>
      </form>
    </div>`;

    const numeroCampo = (v) => (String(v).trim() === '' ? '' : lerNumero(v));
    corpo.querySelectorAll('[data-cmp-mais],[data-cmp-menos]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.cmpMais != null ? b.dataset.cmpMais : b.dataset.cmpMenos);
      const c = lista[i];
      const atual = Number(c.frequencia) || 0;
      c.frequencia = b.dataset.cmpMais != null ? atual + 1 : Math.max(0, atual - 1);
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) { /* ignora */ } }
      this.guardar(); this.renderAba(); this.atualizarRodape();
    }));
    corpo.querySelectorAll('[data-cmp-campo]').forEach((inp) => inp.addEventListener('change', () => {
      const i = Number(inp.closest('[data-cmp]').dataset.cmp);
      const campo = inp.dataset.cmpCampo;
      lista[i][campo] = campo === 'intensidade' ? inp.value : numeroCampo(inp.value);
      this.guardar(); this.renderAba();
    }));
    corpo.querySelectorAll('[data-cmp-remover]').forEach((b) => b.addEventListener('click', async () => {
      const i = Number(b.dataset.cmpRemover);
      if (!(await confirmar('Remover comportamento?', `"${lista[i].comportamento}" sai desta sessão.`, { ok: 'Remover', perigo: true }))) return;
      lista.splice(i, 1); this.guardar(); this.renderAba(); this.atualizarRodape();
    }));
    el('cmp-novo').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const nome = String(f.get('comportamento') || '').trim();
      if (!nome) { toast('Informe o comportamento.', 'erro'); return; }
      const duracao = Calculos.duracaoHoras(this.r.sessao.inicio, this.r.sessao.termino);
      lista.push({ comportamento: nome, metodo: String(f.get('metodo') || 'Frequência'), frequencia: 0,
        tempo_observado: typeof duracao === 'number' ? Math.round(duracao * 60) : '' });
      this.guardar(); this.renderAba(); this.atualizarRodape();
    });
  },

  // ───────── ABC ─────────
  abaAbc(corpo) {
    const lista = this.r.abc;
    const intens = dados.opcoes('INTENSIDADE');
    corpo.innerHTML = `<div class="cartao">
      ${lista.length ? `<ul class="lista-mini">${lista.map((a, i) => `<li><span class="txt"><strong>${esc(a.comportamento)}</strong>${a.horario ? ` · ${esc(a.horario)}` : ''}
          <small>A: ${esc(a.antecedente)}${a.categoria_antecedente ? ` (${esc(a.categoria_antecedente)})` : ''}</small>
          <small>C: ${esc(a.consequencia)}${a.categoria_consequencia ? ` (${esc(a.categoria_consequencia)})` : ''}</small></span>
          <button type="button" class="botao botao-perigo botao-pequeno" data-abc-remover="${i}">Remover</button></li>`).join('')}</ul>` : '<p class="vazio">Nenhum registro ABC nesta sessão.</p>'}
      <h3 class="secao-titulo" style="margin-top:16px">Novo registro ABC</h3>
      <form id="abc-novo" class="form-grade" novalidate>
        <label class="rotulo">Horário<input class="campo" type="time" name="horario" value="${esc(horaAgora())}"></label>
        <label class="rotulo">Atividade<input class="campo" name="atividade"></label>
        <label class="rotulo">Categoria do antecedente<select class="campo" name="categoria_antecedente">${opcoesSelect(dados.opcoes('ANTECEDENTES'), '', '—')}</select></label>
        <label class="rotulo">Antecedente (A) *<input class="campo" name="antecedente" required></label>
        <label class="rotulo col-2">Comportamento (B) *<input class="campo" name="comportamento" list="lista-comportamentos-abc" required></label>
        <label class="rotulo">Categoria da consequência<select class="campo" name="categoria_consequencia">${opcoesSelect(dados.opcoes('CONSEQUÊNCIAS'), '', '—')}</select></label>
        <label class="rotulo">Consequência (C) *<input class="campo" name="consequencia" required></label>
        <label class="rotulo">Intensidade<select class="campo" name="intensidade">${opcoesSelect(intens, '', '—')}</select></label>
        <label class="rotulo">Duração<input class="campo" name="duracao" placeholder="ex.: 2 min"></label>
        <label class="rotulo col-2">Hipótese de função<input class="campo" name="hipotese"></label>
        <datalist id="lista-comportamentos-abc">${dados.opcoes('COMPORTAMENTOS ALVO').map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
        <div class="col-2"><button class="botao botao-secundario" type="submit">+ Adicionar registro ABC</button></div>
      </form>
    </div>`;
    corpo.querySelectorAll('[data-abc-remover]').forEach((b) => b.addEventListener('click', () => {
      lista.splice(Number(b.dataset.abcRemover), 1); this.guardar(); this.renderAba(); this.atualizarRodape();
    }));
    el('abc-novo').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const item = {};
      ['horario', 'atividade', 'categoria_antecedente', 'antecedente', 'comportamento', 'categoria_consequencia', 'consequencia', 'intensidade', 'duracao', 'hipotese']
        .forEach((k) => { item[k] = String(f.get(k) || '').trim(); });
      if (!item.antecedente || !item.comportamento || !item.consequencia) { toast('Preencha antecedente, comportamento e consequência.', 'erro'); return; }
      lista.push(item); this.guardar(); this.renderAba(); this.atualizarRodape();
      toast('Registro ABC adicionado.');
    });
  },

  // ───────── Anotações ─────────
  abaAnotacoes(corpo) {
    const esquema = dados.esquema('sessoes');
    const campos = esquema.campos.filter((c) => CAMPOS_ANOTACOES.indexOf(c.campo) >= 0);
    corpo.innerHTML = `<div class="cartao"><form id="form-anot" class="form-grade" novalidate>${campos.map((c) => htmlCampo(c, Object.assign({ id: 'x' }, this.r.sessao), null)).join('')}</form></div>`;
    const form = el('form-anot');
    const ler = () => { Object.assign(this.r.sessao, lerFormulario(form, { campos })); this.guardar(); };
    form.addEventListener('input', debounce(ler, 300));
    form.addEventListener('change', ler);
  },

  // ───────── salvar / cancelar ─────────
  async cancelar() {
    if (this.r.alterado && !(await confirmar('Descartar registro?', 'O que foi anotado e ainda não foi salvo será perdido.', { ok: 'Descartar', perigo: true }))) return;
    this.descartarRascunho();
    const volta = this.r.sessao.id ? `#/sessoes/${this.r.sessao.id}` : '#/painel';
    this.r = null;
    location.hash = volta;
  },

  montarEnvio() {
    const r = this.r;
    const contagem = {};
    const limpo = (obj, campos) => { const o = {}; campos.forEach((k) => { if (obj[k] !== undefined) o[k] = obj[k]; }); return o; };
    const camposDe = (ent) => ['id'].concat(dados.esquema(ent).campos.map((c) => c.campo));
    return {
      sessao: limpo(r.sessao, camposDe('sessoes')),
      dtt: r.dtt.map((t) => {
        contagem[t.objetivo_id] = (contagem[t.objetivo_id] || 0) + 1;
        return Object.assign(limpo(t, camposDe('dtt')), { tentativa: contagem[t.objetivo_id] });
      }),
      comportamentos: r.comportamentos.map((c) => limpo(c, camposDe('comportamentos'))),
      abc: r.abc.map((a) => limpo(a, camposDe('abc'))),
    };
  },

  async salvar() {
    const botao = el('reg-salvar');
    if (!this.r.sessao.paciente_id) { toast('Escolha o paciente.', 'erro'); return; }
    botao.disabled = true; botao.textContent = 'Salvando…';
    try {
      const res = await api('salvarSessao', this.montarEnvio());
      this.descartarRascunho();
      dados.invalidar();
      toast('Sessão salva na planilha.');
      this.r = null;
      location.hash = `#/sessoes/${res.id}`;
    } catch (erro) {
      toast(`${erro.message} O rascunho continua guardado neste aparelho.`, 'erro', 7000);
      botao.disabled = false; botao.textContent = 'Salvar sessão';
    }
  },
};
