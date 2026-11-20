'use strict';
/**
 * theme.js — tema claro/escuro.
 * Primeira visita: segue o prefers-color-scheme do aparelho.
 * Depois: a escolha fica em localStorage.
 */
(function () {
  const CHAVE = 'gestao_clinica_tema';
  const raiz = document.documentElement;

  function temaSalvo() {
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }

  function temaInicial() {
    const salvo = temaSalvo();
    if (salvo === 'dark' || salvo === 'light') return salvo;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function aplicar(tema) {
    raiz.setAttribute('data-theme', tema);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tema === 'dark' ? '#0A0D12' : '#601222');
    document.querySelectorAll('[data-acao="alternar-tema"]').forEach((b) => {
      b.setAttribute('aria-label', tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro');
      b.setAttribute('title', b.getAttribute('aria-label'));
    });
  }

  // Aplica antes da primeira pintura para não piscar.
  aplicar(temaInicial());

  // Sem escolha manual, acompanha a mudança do sistema.
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!temaSalvo()) aplicar(e.matches ? 'dark' : 'light');
    });
  }

  window.alternarTema = function () {
    const novo = raiz.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(CHAVE, novo); } catch (e) { /* ignora */ }
    aplicar(novo);
  };

  document.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-acao="alternar-tema"]');
    if (botao) window.alternarTema();
  });
})();
