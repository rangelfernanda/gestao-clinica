'use strict';
/** Testes do módulo de cálculos contra a planilha original (dados de demonstração). node tests/testes-calculos.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const C = require('../js/calculos.js');
const golden = require('./golden-planilha.json');

let passaram = 0, falharam = 0;
function teste(nome, fn) { try { fn(); passaram++; console.log('  ok ', nome); } catch (e) { falharam++; console.log('  FALHOU', nome, '\n      ', e.message); } }
const perto = (a, b, msg) => assert.ok(Math.abs(Number(a) - Number(b)) < 1e-6, `${msg}: ${a} ≠ ${b}`);

console.log('Calculos.gs é cópia idêntica de js/calculos.js');
teste('arquivos iguais', () => {
  const a = fs.readFileSync(path.join(__dirname, '..', 'js', 'calculos.js'), 'utf8');
  const b = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Calculos.gs'), 'utf8');
  assert.strictEqual(a, b, 'rode: cp js/calculos.js apps-script/Calculos.gs');
});

console.log('Golden: objetivos da planilha (306 tentativas DTT)');
golden.obj.forEach((o) => teste(o.id, () => {
  const tent = golden.dtt.filter((d) => d[0] === o.id).map((d) => ({ resultado: d[1] }));
  const m = C.metricasObjetivo({ linha_base: o.lb, meta: o.meta, revisao_prevista: o.rev.slice(0, 10), status: o.st }, tent, '2026-11-19');
  assert.strictEqual(m.tentativas_validas, Number(o.val));
  perto(m.pct_acertos, o.ac, '% acertos');
  perto(m.pct_independencia, o.ind, '% independência');
  perto(m.delta_linha_base, o.d, 'Δ');
  assert.strictEqual(m.alerta, o.al || '');
}));

console.log('Golden: comportamentos');
const n = (v) => (v === 'None' ? null : Number(v));
golden.cmp.forEach((c, i) => teste('linha ' + (i + 7) + ' ' + c[0], () => {
  const m = C.metricasComportamento({ metodo: c[0], frequencia: n(c[1]), duracao_total: n(c[2]), latencia: n(c[4]), tempo_observado: n(c[5]), linha_base_freq: n(c[7]) });
  if (c[3] !== 'None') perto(m.duracao_media, c[3], 'duração média'); else assert.strictEqual(m.duracao_media, null);
  if (c[6] !== 'None') perto(m.taxa_hora, c[6], 'taxa/h'); else assert.strictEqual(m.taxa_hora, null);
  if (c[8] !== 'None') perto(m.delta_freq, c[8], 'Δ freq');
  assert.strictEqual(m.tendencia, c[9] === 'None' ? '' : c[9]);
  assert.strictEqual(m.conferencia, c[11]);
}));

console.log('Regras avulsas');
teste('revisão atrasada vence o resto', () => {
  assert.strictEqual(C.metricasObjetivo({ revisao_prevista: '2026-10-01', status: 'Em aquisição', meta: 0.8 }, [], '2026-11-19').alerta, 'REVISÃO ATRASADA');
  assert.strictEqual(C.metricasObjetivo({ revisao_prevista: '2026-10-01', status: 'Dominado', meta: 0.8 }, [], '2026-11-19').alerta, '');
});
teste('tentativa anulada não conta como válida', () => {
  const r = C.resumoDtt([{ resultado: 'Tentativa anulada' }, { resultado: 'Erro' }, { resultado: 'Acerto independente' }]);
  assert.deepStrictEqual([r.validas, r.anuladas, r.pctAcerto], [2, 1, 0.5]);
});
teste('conferência de ajuda', () => {
  assert.strictEqual(C.conferenciaAjuda('Acerto independente', 'Ajuda verbal'), 'REVISAR AJUDA');
  assert.strictEqual(C.conferenciaAjuda('Acerto com ajuda', 'Independente'), 'REVISAR AJUDA');
  assert.strictEqual(C.conferenciaAjuda('Acerto com ajuda', 'Modelação'), 'OK');
});
teste('duração da sessão e idade', () => {
  perto(C.duracaoHoras('09:00', '09:50'), 50 / 60, 'h');
  assert.strictEqual(C.duracaoHoras('10:00', '09:00'), 'VERIFICAR HORA');
  assert.strictEqual(C.idade('2017-04-17', '2026-11-19'), 9);
  assert.strictEqual(C.idade('2017-11-20', '2026-11-19'), 8);
});

console.log(`\n${passaram} passaram, ${falharam} falharam`);
process.exit(falharam ? 1 : 0);
