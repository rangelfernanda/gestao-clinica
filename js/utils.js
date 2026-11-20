'use strict';
/**
 * utils.js — formatação brasileira e ajudantes de DOM.
 */

const FUSO = 'America/Sao_Paulo';
const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNumAte4 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

const el = (id) => document.getElementById(id);
const q = (sel, raiz = document) => raiz.querySelector(sel);
const qa = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

function esc(valor) {
  return String(valor == null ? '' : valor).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function semAcento(valor) {
  return String(valor || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** R$ 1.234,56 · '—' quando não há valor. */
function moeda(valor) {
  return valor === null || valor === undefined || valor === '' || !isFinite(valor) ? '—' : fmtMoeda.format(Number(valor));
}

function num2(valor) {
  return valor === null || valor === undefined || valor === '' ? '—' : fmtNum2.format(Number(valor));
}

function numCampo(valor) {
  return valor === null || valor === undefined || valor === '' ? '' : fmtNumAte4.format(Number(valor)).replace(/\./g, '');
}

/** 0,15 → "15,00%". */
function pct(valor) {
  return valor === null || valor === undefined || valor === '' ? '—' : fmtNum2.format(Number(valor) * 100) + '%';
}

/** Lê número digitado em português ("1.234,56", "12,5", "1234.5"). Vazio → null. */
function lerNumero(texto) {
  if (typeof texto === 'number') return isFinite(texto) ? texto : null;
  let t = String(texto == null ? '' : texto).trim().replace(/R\$\s?/, '').replace('%', '');
  if (!t) return null;
  if (/,/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Campo de percentual: o usuário digita 15 (ou 15%) e guardamos 0,15. */
function lerPct(texto) {
  const n = lerNumero(texto);
  return n === null ? null : n / 100;
}
function pctCampo(valor) {
  return valor === null || valor === undefined || valor === '' ? '' : numCampo(Math.round(Number(valor) * 1e8) / 1e6);
}

function dataBr(iso) {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}

function dataHoraBr(texto) {
  const m = String(texto || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : String(texto || '');
}


function hojeIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
}

function mascaraCpf(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function mascaraTelefone(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (d.length > 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d;
}

function opcoesSelect(lista, selecionado, vazio) {
  const inicio = vazio != null ? `<option value="">${esc(vazio)}</option>` : '';
  return inicio + lista.map((item) => {
    const valor = typeof item === 'string' ? item : item.valor;
    const rotulo = typeof item === 'string' ? item : item.rotulo;
    return `<option value="${esc(valor)}"${valor === selecionado ? ' selected' : ''}>${esc(rotulo)}</option>`;
  }).join('');
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function pilula(classe, texto) {
  return `<span class="pilula ${classe}">${esc(texto)}</span>`;
}

function skeleton(linhas = 5, altura = 44) {
  return Array.from({ length: linhas }, () => `<div class="skeleton" style="height:${altura}px"></div>`).join('');
}

/** Baixa um CSV (separador ; e BOM, abre direto no Excel em português). */
function exportarCsv(nomeArquivo, colunas, linhas) {
  const celula = (v) => {
    const t = typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const conteudo = [colunas.map((c) => celula(c.rotulo)).join(';')]
    .concat(linhas.map((l) => colunas.map((c) => celula(c.valor(l))).join(';')))
    .join('\r\n');
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
