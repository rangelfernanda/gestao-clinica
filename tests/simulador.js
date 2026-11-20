'use strict';
/**
 * Simulador mínimo do ambiente Apps Script (SpreadsheetApp, Utilities,
 * CacheService, LockService, ContentService) para rodar os arquivos .gs em Node.
 * Uso: const { criarAmbiente } = require('./simulador');
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = this.sheet.rows[this.r - 1 + i] || [];
      out.push(Array.from({ length: this.nc }, (_, j) => (row[this.c - 1 + j] === undefined ? '' : row[this.c - 1 + j])));
    }
    return out;
  }
  setValues(matriz) {
    if (matriz.length !== this.nr || matriz.some((l) => l.length !== this.nc)) throw new Error('setValues: dimensões erradas');
    for (let i = 0; i < this.nr; i++) {
      const idx = this.r - 1 + i;
      while (this.sheet.rows.length <= idx) this.sheet.rows.push([]);
      for (let j = 0; j < this.nc; j++) this.sheet.rows[idx][this.c - 1 + j] = coerce(this.sheet, this.c + j, matriz[i][j]);
    }
    this.sheet.maxRows = Math.max(this.sheet.maxRows, this.sheet.rows.length);
    return this;
  }
  setNumberFormat(f) { for (let j = 0; j < this.nc; j++) this.sheet.formatos[this.c + j] = f; return this; }
  setFontWeight() { return this; }
  setWrap() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
}

// Imita o Sheets: uma célula sem formato "@" converte texto "2026-11-10" em Date
// e "123" em número. É assim que pegamos esquecimentos de formato nos testes.
function coerce(sheet, col, v) {
  if (sheet.formatos[col] === '@') return v == null ? '' : String(v);
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T03:00:00Z');
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  }
  return v;
}

class Sheet {
  constructor(name, rows) {
    this.name = name; this.rows = rows || []; this.formatos = {}; this.frozen = 0;
    this.maxRows = Math.max(1000, this.rows.length); this.maxCols = 26;
  }
  getName() { return this.name; }
  setName(n) { this.name = n; return this; }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  getLastRow() { let last = 0; this.rows.forEach((row, i) => { if (row.some((v) => v !== '' && v != null)) last = i + 1; }); return last; }
  getLastColumn() { return this.rows.reduce((m, row) => Math.max(m, row.length), 0); }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxCols; }
  deleteColumns(from, n) { this.maxCols -= n; return this; }
  insertColumnsAfter(after, n) { this.maxCols += n; return this; }
  insertRowsAfter(after, n) { this.maxRows += n; return this; }
  deleteRow(r) { this.rows.splice(r - 1, 1); return this; }
  clear() { this.rows = []; return this; }
  setFrozenRows(n) { this.frozen = n; return this; }
}

class Spreadsheet {
  constructor() { this.sheets = []; this.active = null; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  setActiveSheet(s) { this.active = s; return s; }
  moveActiveSheet(pos) { const i = this.sheets.indexOf(this.active); this.sheets.splice(i, 1); this.sheets.splice(pos - 1, 0, this.active); }
  getSpreadsheetTimeZone() { return 'America/Sao_Paulo'; }
  getSheets() { return this.sheets; }
}

function formatDate(date, tz, fmt) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const h = partes.hour === '24' ? '00' : partes.hour;
  if (fmt === 'yyyy-MM-dd') return `${partes.year}-${partes.month}-${partes.day}`;
  if (fmt === 'yyyy-MM-dd HH:mm:ss') return `${partes.year}-${partes.month}-${partes.day} ${h}:${partes.minute}:${partes.second}`;
  throw new Error('formato não simulado: ' + fmt);
}

function criarAmbiente(opcoes = {}) {
  const ss = new Spreadsheet();
  (opcoes.abas || []).forEach(({ nome, linhas }) => ss.sheets.push(new Sheet(nome, linhas)));
  const cache = new Map();
  let agoraFixo = opcoes.agora ? Date.parse(opcoes.agora) : null;
  const RealDate = Date;
  class DateSim extends RealDate {
    constructor(...a) { if (a.length === 0 && agoraFixo) super(agoraFixo); else super(...a); }
    static now() { return agoraFixo || RealDate.now(); }
  }
  const sandbox = {
    console, Date: DateSim,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      openById: () => ss,
      getUi: () => { throw new Error('sem UI no simulador'); },
    },
    Utilities: {
      formatDate,
      getUuid: () => crypto.randomUUID(),
      computeDigest: (alg, texto) => Array.from(crypto.createHash('sha256').update(texto, 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => { const e = cache.get(k); if (!e) return null; if (e.exp < DateSim.now()) { cache.delete(k); return null; } return e.v; },
        put: (k, v, s) => { cache.set(k, { v: String(v), exp: DateSim.now() + (s || 600) * 1000 }); },
        remove: (k) => cache.delete(k),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: (() => { const p = new Map(); const api = { getProperty: (k) => (p.has(k) ? p.get(k) : null), setProperty: (k, v) => { p.set(k, String(v)); return api; }, deleteProperty: (k) => { p.delete(k); return api; }, getProperties: () => Object.fromEntries(p) }; return { getScriptProperties: () => api }; })(),
    MailApp: { enviados: [], sendEmail(o) { this.enviados.push(o); } },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teste@exemplo.com' }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t) => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } }),
    },
    Logger: { log: (...a) => (opcoes.silencioso ? null : console.log('[Logger]', ...a)) },
  };
  vm.createContext(sandbox);
  const dir = path.join(__dirname, '..', 'apps-script');
  // Carrega todos os .gs da pasta (ordem alfabética, como o Apps Script não garante ordem, os mapas são preguiçosos).
  fs.readdirSync(dir).filter((f) => f.endsWith('.gs')).sort().forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
  });
  return {
    ss, sandbox,
    setAgora(iso) { agoraFixo = Date.parse(iso); },
    chamar(action, payload, token) {
      const saida = sandbox.doPost({ postData: { contents: JSON.stringify({ action, token, payload }) } });
      return JSON.parse(saida.getContent());
    },
    // JSON de ida e volta: objetos criados dentro do vm têm outro protótipo e quebram o deepStrictEqual.
    rodar(nome, ...args) { const r = sandbox[nome](...args); return r === undefined ? r : JSON.parse(JSON.stringify(r)); },
  };
}

module.exports = { criarAmbiente };
