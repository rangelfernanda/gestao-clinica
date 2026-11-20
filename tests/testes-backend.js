'use strict';
/** Testes do backend (Apps Script) no simulador. Rodar: node tests/testes-backend.js */
const assert = require('assert');
const { criarAmbiente } = require('./simulador');

let passaram = 0, falharam = 0;
function teste(nome, fn) {
  try { fn(); passaram++; console.log('  ok ', nome); }
  catch (e) { falharam++; console.log('  FALHOU', nome, '\n      ', e.message); }
}
const ok = (r, msg) => { assert.strictEqual(r.ok, true, (msg || 'resposta') + ': ' + r.error); return r.data; };
const erro = (r, trecho) => {
  assert.strictEqual(r.ok, false, 'esperava erro');
  if (trecho) assert.ok(r.error.includes(trecho) || r.code === trecho, `erro "${r.error}" (code ${r.code}) não contém "${trecho}"`);
};

const amb = criarAmbiente({ agora: '2026-11-19T10:00:00-03:00', silencioso: true });
const { ss } = amb;
const ABAS = ['db_pacientes', 'db_programas', 'db_objetivos', 'db_sessoes', 'db_dtt', 'db_comportamentos', 'db_abc', 'db_avaliacoes', 'db_usuarios', 'db_log', 'cfg_listas'];

console.log('Instalação');
teste('setupPlanilha cria todas as abas', () => {
  amb.rodar('setupPlanilha');
  ABAS.forEach((n) => assert.ok(ss.getSheetByName(n), 'falta ' + n));
});
teste('rodar de novo não duplica nada', () => {
  const antes = ss.sheets.length;
  amb.rodar('setupPlanilha');
  assert.strictEqual(ss.sheets.length, antes);
});
teste('coluna nova no esquema é acrescentada sem apagar dados', () => {
  const aba = ss.getSheetByName('db_pacientes');
  aba.rows[0] = aba.rows[0].filter((c) => c !== 'observacoes');
  amb.rodar('setupPlanilha');
  assert.ok(aba.rows[0].includes('observacoes'));
});
teste('cfg_listas traz as listas da planilha original', () => {
  const l = ss.getSheetByName('cfg_listas').rows;
  assert.ok(l[0].includes('MODALIDADE'));
  assert.ok(!l[0].includes('RESULTADO DTT'), 'resultado DTT é fixo, não editável');
});

console.log('Login');
teste('primeiro usuário é admin e senha vira hash', () => {
  amb.rodar('criarUsuario', 'fernanda', 'Fernanda Rangel', 'teste123');
  const linhas = ss.getSheetByName('db_usuarios').rows;
  assert.strictEqual(linhas[1][3], 'admin');
  assert.ok(!String(linhas[1][2]).includes('teste123'));
});
teste('senha errada falha com mensagem amigável', () => erro(amb.chamar('login', { usuario: 'fernanda', senha: 'x' }), 'incorretos'));
teste('sem token → code SESSAO', () => erro(amb.chamar('carregarTudo', {}), 'SESSAO'));
const token = ok(amb.chamar('login', { usuario: 'Fernanda', senha: 'teste123' })).token;
const salvar = (entidade, registro) => amb.chamar('salvar', { entidade, registro }, token);

console.log('Pacientes, programas e objetivos');
let pac1, pac2, pro1, obj1, obj2;
teste('cria paciente com id PAC-0001, datas em texto e status padrão', () => {
  pac1 = ok(salvar('pacientes', { nome: 'Paciente Teste A', nascimento: '17/04/2017', inicio: '2026-01-12', valor_sessao: '180,00', telefone: '64999990000' })).id;
  assert.strictEqual(pac1, 'PAC-0001');
  const aba = ss.getSheetByName('db_pacientes');
  const cab = aba.rows[0], linha = aba.rows[1];
  assert.strictEqual(linha[cab.indexOf('nascimento')], '2017-04-17');
  assert.strictEqual(typeof linha[cab.indexOf('telefone')], 'string');
  assert.strictEqual(linha[cab.indexOf('status')], 'Ativo');
  assert.strictEqual(linha[cab.indexOf('valor_sessao')], 180);
  pac2 = ok(salvar('pacientes', { nome: 'Paciente Teste B', inicio: '2026-02-01' })).id;
});
teste('validações: obrigatório, lista, e-mail', () => {
  erro(salvar('pacientes', { inicio: '2026-01-01' }), 'nome completo');
  erro(salvar('pacientes', { nome: 'X', inicio: '2026-01-01', status: 'Qualquer' }), 'fora da lista');
  erro(salvar('pacientes', { nome: 'X', inicio: '2026-01-01', email: 'semarroba' }), 'E-mail');
});
teste('programa exige paciente existente', () => {
  erro(salvar('programas', { paciente_id: 'PAC-9999', nome: 'P', area: 'Linguagem' }), 'não encontrado');
  pro1 = ok(salvar('programas', { paciente_id: pac1, nome: 'Atender instruções', area: 'Comunicação receptiva' })).id;
  assert.strictEqual(pro1, 'PRO-0001');
});
teste('objetivo: programa precisa ser do mesmo paciente; % aceita 85 ou 0,85', () => {
  erro(salvar('objetivos', { paciente_id: pac2, programa_id: pro1, objetivo: 'X', meta: 80 }), 'outro paciente');
  obj1 = ok(salvar('objetivos', { paciente_id: pac1, programa_id: pro1, objetivo: 'Seguir instrução de 1 etapa', linha_base: '35', meta: '85%', revisao_prevista: '2026-12-12' })).id;
  obj2 = ok(salvar('objetivos', { paciente_id: pac1, programa_id: pro1, objetivo: 'Identificar objetos', linha_base: 0.4, meta: 0.8, revisao_prevista: '2026-11-01' })).id;
  const o = ok(amb.chamar('carregarTudo', {}, token)).objetivos.find((x) => x.id === obj1);
  assert.strictEqual(o.linha_base, 0.35);
  assert.strictEqual(o.meta, 0.85);
});
teste('edição não cria linha nova', () => {
  ok(salvar('pacientes', { id: pac2, nome: 'Paciente Teste B2', inicio: '2026-02-01' }));
  assert.strictEqual(ss.getSheetByName('db_pacientes').getLastRow(), 3);
});

console.log('Sessão com DTT, comportamento e ABC');
let ses1;
const dtt = [];
for (let i = 0; i < 20; i++) {
  dtt.push({ objetivo_id: obj1,
    resultado: i < 9 ? 'Acerto independente' : i < 14 ? 'Acerto com ajuda' : i < 18 ? 'Erro' : i < 19 ? 'Ausência de resposta' : 'Tentativa anulada',
    nivel_ajuda: i >= 9 && i < 14 ? 'Ajuda verbal' : '' });
}
teste('grava a sessão inteira de uma vez', () => {
  ses1 = ok(amb.chamar('salvarSessao', {
    sessao: { paciente_id: pac1, data: '2026-11-18', inicio: '9:00', termino: '09:50' },
    dtt,
    comportamentos: [{ comportamento: 'Interrupções de atividade', metodo: 'Frequência', frequencia: 8, tempo_observado: 50, linha_base_freq: 10 }],
    abc: [{ antecedente: 'Demanda nova', comportamento: 'Levantou', consequencia: 'Pausa', categoria_antecedente: 'Demanda' }]
  }, token)).id;
  assert.strictEqual(ses1, 'SES-0001');
  assert.strictEqual(ss.getSheetByName('db_dtt').getLastRow(), 21);
});
teste('filhos herdam paciente, data e programa (do objetivo) e numeram tentativas', () => {
  const s = ok(amb.chamar('obterSessao', { id: ses1 }, token));
  assert.strictEqual(s.sessao.inicio, '09:00');
  assert.strictEqual(s.dtt.length, 20);
  assert.ok(s.dtt.every((d) => d.paciente_id === pac1 && d.data === '2026-11-18' && d.programa_id === pro1));
  assert.deepStrictEqual(s.dtt.slice(0, 3).map((d) => d.tentativa), [1, 2, 3]);
  assert.strictEqual(s.comportamentos[0].taxa_hora, 9.6);
  assert.strictEqual(s.comportamentos[0].tendencia, 'DIMINUIU');
});
teste('carregarTudo calcula % do objetivo, alertas e indicadores da sessão', () => {
  const t = ok(amb.chamar('carregarTudo', {}, token));
  const o1 = t.objetivos.find((x) => x.id === obj1), o2 = t.objetivos.find((x) => x.id === obj2);
  assert.strictEqual(o1.tentativas_validas, 19);
  assert.ok(Math.abs(o1.pct_independencia - 9 / 19) < 1e-9);
  assert.strictEqual(o1.alerta, 'AVALIAR PROGRESSO');      // 47% < 85% − 15 pontos, com ≥ 15 tentativas
  assert.strictEqual(o2.alerta, 'REVISÃO ATRASADA');       // revisão 01/11 já passou
  const s = t.sessoes[0];
  assert.strictEqual(s.n_dtt, 20); assert.strictEqual(s.n_comportamentos, 1); assert.strictEqual(s.n_abc, 1);
  assert.ok(Math.abs(s.duracao_h - 50 / 60) < 1e-9);
  assert.strictEqual(t.pacientes.find((p) => p.id === pac1).ultima_sessao, '2026-11-18');
  assert.ok(t.listas['RESULTADO DTT'].includes('Tentativa anulada'));
  assert.ok(t.esquema.pacientes.campos.length > 5);
});
teste('evolucao devolve dados enxutos do paciente, filtrados por período', () => {
  const e = ok(amb.chamar('evolucao', { paciente_id: pac1 }, token));
  assert.strictEqual(e.sessoes, 1);
  assert.strictEqual(e.dtt.length, 20);
  assert.deepStrictEqual(Object.keys(e.dtt[0]).sort(), ['data', 'nivel_ajuda', 'objetivo_id', 'resultado', 'sessao_id']);
  assert.strictEqual(e.comportamentos[0].frequencia, 8);
  assert.ok(!('antecedente' in e.abc[0]), 'texto clínico longo não vai para o gráfico');
  assert.strictEqual(ok(amb.chamar('evolucao', { paciente_id: pac1, de: '2026-11-19' }, token)).dtt.length, 0);
  assert.strictEqual(ok(amb.chamar('evolucao', { paciente_id: pac2 }, token)).dtt.length, 0);
  erro(amb.chamar('evolucao', {}, token), 'paciente');
});
teste('erro em uma tentativa não grava nada e diz qual é', () => {
  const antes = ss.getSheetByName('db_dtt').getLastRow();
  erro(amb.chamar('salvarSessao', { sessao: { paciente_id: pac2, data: '2026-11-18' }, dtt: [{ objetivo_id: obj1, resultado: 'Erro' }] }, token), 'Tentativa DTT nº 1');
  erro(amb.chamar('salvarSessao', { sessao: { paciente_id: pac1, data: '2026-11-18' }, dtt: [{ objetivo_id: obj1, resultado: 'Talvez' }] }, token), 'fora da lista');
  assert.strictEqual(ss.getSheetByName('db_dtt').getLastRow(), antes);
  assert.strictEqual(ss.getSheetByName('db_sessoes').getLastRow(), 2);
});
teste('comportamento fora da lista sugerida é aceito (texto livre)', () => {
  const r = ok(amb.chamar('salvarSessao', { sessao: { paciente_id: pac1, data: '2026-11-17' },
    comportamentos: [{ comportamento: 'Morder a manga da blusa', metodo: 'Frequência', frequencia: 3 }] }, token));
  const s = ok(amb.chamar('obterSessao', { id: r.id }, token));
  assert.strictEqual(s.comportamentos[0].comportamento, 'Morder a manga da blusa');
  ok(amb.chamar('excluirSessao', { id: r.id }, token));
});
teste('editar a sessão mantém ids das tentativas e substitui o resto', () => {
  const s = ok(amb.chamar('obterSessao', { id: ses1 }, token));
  const manter = s.dtt.slice(0, 5);
  ok(amb.chamar('salvarSessao', { sessao: Object.assign({}, s.sessao, { resumo: 'Editada' }),
    dtt: manter.concat([{ objetivo_id: obj2, resultado: 'Erro' }]), comportamentos: [], abc: s.abc }, token));
  const s2 = ok(amb.chamar('obterSessao', { id: ses1 }, token));
  assert.strictEqual(s2.dtt.length, 6);
  assert.deepStrictEqual(s2.dtt.slice(0, 5).map((d) => d.id), manter.map((d) => d.id));
  assert.strictEqual(s2.dtt[5].id, 'DTT-000021');
  assert.strictEqual(s2.comportamentos.length, 0);
  assert.strictEqual(s2.sessao.resumo, 'Editada');
  assert.strictEqual(ss.getSheetByName('db_dtt').getLastRow(), 7);
});
teste('salvar genérico recusa sessão e filhos', () => {
  erro(salvar('sessoes', { paciente_id: pac1, data: '2026-11-18' }), 'tela de sessão');
  erro(salvar('dtt', {}), 'tela de sessão');
});
teste('excluir sessão some com ela e com os filhos (suave)', () => {
  ok(amb.chamar('excluirSessao', { id: ses1 }, token));
  const t = ok(amb.chamar('carregarTudo', {}, token));
  assert.strictEqual(t.sessoes.length, 0);
  assert.strictEqual(t.objetivos.find((x) => x.id === obj1).tentativas_validas, 0);
  assert.strictEqual(ss.getSheetByName('db_dtt').getLastRow(), 7, 'linhas continuam na planilha');
});
teste('excluir paciente é suave e fica no log', () => {
  ok(amb.chamar('excluir', { entidade: 'pacientes', id: pac2 }, token));
  assert.ok(!ok(amb.chamar('carregarTudo', {}, token)).pacientes.some((p) => p.id === pac2));
  assert.ok(ss.getSheetByName('db_log').rows.some((l) => l[2] === 'excluir' && l[4] === pac2));
});

console.log('Avaliações');
teste('avaliação: id AVA-0001, status padrão e alerta de reavaliação', () => {
  const id = ok(salvar('avaliacoes', { paciente_id: pac1, instrumento: 'VB-MAPP', data_aplicacao: '2026-08-01', proxima_avaliacao: '2026-11-01' })).id;
  assert.strictEqual(id, 'AVA-0001');
  ok(salvar('avaliacoes', { paciente_id: pac1, instrumento: 'Vineland', data_aplicacao: '2026-10-01', proxima_avaliacao: '2026-12-10', status: 'Concluída' }));
  const t = ok(amb.chamar('carregarTudo', {}, token));
  assert.strictEqual(t.avaliacoes.length, 2);
  assert.strictEqual(t.avaliacoes[0].instrumento, 'Vineland', 'mais recente primeiro');
  assert.strictEqual(t.avaliacoes[0].alerta, 'REAVALIAÇÃO PRÓXIMA');
  assert.strictEqual(t.avaliacoes[1].alerta, 'REAVALIAÇÃO ATRASADA');
  assert.strictEqual(t.avaliacoes[1].status, 'Planejada');
  assert.ok(t.esquema.avaliacoes.campos.some((c) => c.campo === 'resultados'));
});
teste('avaliação valida instrumento e paciente', () => {
  erro(salvar('avaliacoes', { paciente_id: pac1, instrumento: 'Teste inventado', data_aplicacao: '2026-08-01' }), 'fora da lista');
  erro(salvar('avaliacoes', { paciente_id: 'PAC-9999', instrumento: 'VB-MAPP', data_aplicacao: '2026-08-01' }));
  erro(salvar('avaliacoes', { paciente_id: pac1, instrumento: 'VB-MAPP' }));
});

console.log('Lista editável pela Fernanda');
teste('opção nova na cfg_listas passa a valer', () => {
  const aba = ss.getSheetByName('cfg_listas');
  const col = aba.rows[0].indexOf('MODALIDADE');
  const vazia = aba.rows.findIndex((l, i) => i > 0 && !l[col]);
  aba.rows[vazia][col] = 'Clínica parceira';
  ok(salvar('pacientes', { nome: 'Paciente Teste C', inicio: '2026-03-01', modalidade: 'Clínica parceira' }));
});

console.log('Dados de exemplo');
const amb2 = criarAmbiente({ agora: '2026-11-19T10:00:00-03:00', silencioso: true });
teste('popularDemo enche um cadastro vazio e apagarDemo limpa tudo', () => {
  amb2.rodar('setupPlanilha');
  amb2.rodar('popularDemo');
  amb2.rodar('criarUsuario', 'fernanda', 'Fernanda', 'teste123');
  const tk = amb2.chamar('login', { usuario: 'fernanda', senha: 'teste123' }).data.token;
  const t = ok(amb2.chamar('carregarTudo', {}, tk));
  assert.strictEqual(t.pacientes.length, 3);
  assert.strictEqual(t.objetivos.length, 6);
  assert.strictEqual(t.sessoes.length, 21);
  assert.strictEqual(t.avaliacoes.length, 3);
  assert.deepStrictEqual(t.avaliacoes.map((a) => a.alerta).sort(), ['', 'REAVALIAÇÃO ATRASADA', 'REAVALIAÇÃO PRÓXIMA']);
  assert.ok(t.pacientes.every((p) => /Fictício/.test(p.nome)));
  assert.throws(() => amb2.rodar('popularDemo'), /Já existem/);
  amb2.rodar('apagarDemo');
  const t2 = ok(amb2.chamar('carregarTudo', {}, tk));
  assert.strictEqual(t2.pacientes.length + t2.sessoes.length + t2.objetivos.length + t2.avaliacoes.length, 0);
  assert.strictEqual(amb2.ss.getSheetByName('db_dtt').getLastRow(), 1);
});

console.log(`\n${passaram} passaram, ${falharam} falharam`);
process.exit(falharam ? 1 : 0);
