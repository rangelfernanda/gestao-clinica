'use strict';
/**
 * dados.js — carrega tudo de uma vez (carregarTudo) e guarda em memória enquanto a página está aberta.
 * Depois de salvar algo, chame dados.invalidar() e a próxima tela busca de novo na planilha.
 */

const dados = {
  cache: null,
  promessa: null,

  async carregar(forcar) {
    if (this.cache && !forcar) return this.cache;
    if (!this.promessa) {
      this.promessa = api('carregarTudo').then((d) => { this.cache = d; return d; }).finally(() => { this.promessa = null; });
    }
    return this.promessa;
  },

  invalidar() { this.cache = null; },

  lista(entidade) { return (this.cache && this.cache[entidade]) || []; },
  achar(entidade, id) { return this.lista(entidade).find((r) => r.id === id) || null; },
  esquema(entidade) { return this.cache.esquema[entidade]; },
  opcoes(nomeLista) { return (this.cache.listas && this.cache.listas[nomeLista]) || []; },

  nome(entidade, id) {
    const r = this.achar(entidade, id);
    if (!r) return id || '—';
    const titulo = this.esquema(entidade).titulo;
    if (entidade === 'pacientes') return r.nome_social || r.nome;
    return r[titulo] || id;
  },
};

/** Classe da pílula de status (cores do styles.css). */
function classeStatus(valor) {
  const v = String(valor || '');
  if (/^(Ativo|Realizada|Dominado|Concluíd|Em manutenção|Em generalização|Alta)/.test(v)) return 'st-pago';
  if (/^(Em aquisição|Em intervenção|Linha de base|Agendada|Reposição|Planejad|Em processo)/.test(v)) return 'st-vencer';
  if (/^(Pausad|Suspens|Não iniciado)/.test(v)) return 'st-breve';
  if (/^(Cancelada|Falta|Encerrad|Inativo)/.test(v)) return 'st-neutro';
  return 'st-neutro';
}

function classeAlerta(alerta) {
  if (alerta === 'REVISÃO ATRASADA') return 'st-atrasado';
  if (alerta === 'AVALIAR PROGRESSO') return 'st-breve';
  return 'st-neutro';
}

function idadeTexto(anos) {
  return anos == null ? '' : `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
}

function horasTexto(h) {
  if (h == null || h === '') return '—';
  if (typeof h === 'string') return h;
  const min = Math.round(h * 60);
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`;
}
