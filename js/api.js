'use strict';
/**
 * api.js — chamadas ao Apps Script e sessão.
 *
 * Um único endpoint doPost com { action, token, payload }. O corpo vai como
 * text/plain para evitar o preflight de CORS, que o Apps Script não responde.
 */

const SESSAO_STORAGE = 'gestao_clinica_sessao';
const TEMPO_LIMITE_MS = 45000;

class ErroApi extends Error {
  constructor(mensagem, codigo) {
    super(mensagem);
    this.codigo = codigo || null;
  }
}

const sessao = {
  dados: null,
  carregar() {
    try {
      const bruto = localStorage.getItem(SESSAO_STORAGE);
      const s = bruto ? JSON.parse(bruto) : null;
      this.dados = s && s.token && s.expiraEm > Date.now() ? s : null;
    } catch (e) {
      this.dados = null;
    }
    return this.dados;
  },
  guardar(dados) {
    this.dados = dados;
    try { localStorage.setItem(SESSAO_STORAGE, JSON.stringify(dados)); } catch (e) { /* navegação privada */ }
  },
  limpar() {
    this.dados = null;
    try { localStorage.removeItem(SESSAO_STORAGE); } catch (e) { /* ignora */ }
  },
};

async function api(action, payload) {
  if (!window.API_URL) throw new ErroApi('O site ainda não foi ligado ao Apps Script: preencha a URL em js/config.js.');
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  let resposta;
  try {
    const http = await fetch(window.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: sessao.dados && sessao.dados.token, payload: payload || {} }),
      signal: controle.signal,
    });
    resposta = await http.json();
  } catch (erro) {
    throw new ErroApi('Sem conexão com o sistema. Confira a internet e tente de novo.');
  } finally {
    clearTimeout(limite);
  }
  if (!resposta || !resposta.ok) {
    const codigo = resposta && resposta.code;
    if (codigo === 'SESSAO') {
      sessao.limpar();
      document.dispatchEvent(new CustomEvent('sessao-expirada'));
    }
    throw new ErroApi((resposta && resposta.error) || 'Não foi possível concluir.', codigo);
  }
  return resposta.data;
}
