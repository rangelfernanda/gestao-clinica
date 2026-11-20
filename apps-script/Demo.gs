/**
 * Demo.gs — dados FICTÍCIOS para testar o sistema (nenhum paciente real).
 * Menu: "Carregar dados de exemplo" (só funciona com o cadastro vazio) e "Apagar dados de exemplo".
 * Tudo o que é criado aqui fica com criado_por = "demonstração" e é apagado pelo segundo item.
 */

function popularDemo() {
  return comTrava_(function () {
    if (ativos_('pacientes').length) throw new Error('Já existem pacientes cadastrados. Os dados de exemplo só entram com o cadastro vazio.');
    var u = { nome: CRIADOR_DEMO, perfil: 'admin' };
    var semente = 7;
    function sorte() { semente = (semente * 9301 + 49297) % 233280; return semente / 233280; }
    function diasAtras(n) { return Utilities.formatDate(new Date(Date.now() - n * 86400000), FUSO, 'yyyy-MM-dd'); }

    var pac = [
      ['Paciente Fictício 001', '2017-04-17', 'Responsável Fictício A', 'Presencial', 2, 'Ativo', 180],
      ['Paciente Fictício 002', '2019-09-03', 'Responsável Fictício B', 'Presencial', 1, 'Ativo', 180],
      ['Paciente Fictício 003', '2016-01-27', 'Responsável Fictício C', 'Online', 1, 'Suspenso', 150]
    ].map(function (p) {
      return acaoSalvar({ entidade: 'pacientes', registro: { nome: p[0], nascimento: p[1], responsavel: p[2], telefone: '(00) 00000-0000',
        inicio: diasAtras(120), diagnostico: 'Exemplo ilustrativo', profissional: 'Profissional Demo', modalidade: p[3],
        frequencia_semanal: p[4], status: p[5], valor_sessao: p[6], informacoes: 'Dados exclusivamente ilustrativos' } }, u).id;
    });

    var planos = [
      [0, 'Atender instruções simples', 'Comunicação receptiva', [['Seguir instrução de 1 etapa', 0.35, 0.85], ['Identificar objetos comuns', 0.45, 0.8]]],
      [0, 'Solicitar itens desejados', 'Comunicação expressiva', [['Pedir item com palavra isolada', 0.25, 0.8]]],
      [1, 'Imitação motora', 'Habilidades sociais', [['Imitar ações com objetos', 0.2, 0.75], ['Imitar movimentos amplos', 0.42, 0.8]]],
      [2, 'Rotina de autocuidado', 'Atividades de vida diária', [['Lavar as mãos com apoio visual', 0.3, 0.7]]]
    ];
    var objetivos = [];
    planos.forEach(function (pl) {
      var proId = acaoSalvar({ entidade: 'programas', registro: { paciente_id: pac[pl[0]], nome: pl[1], area: pl[2], procedimento: 'DTT',
        data_inicio: diasAtras(110), data_revisao: diasAtras(-60), profissional: 'Profissional Demo', status: 'Ativo',
        criterio_aquisicao: '≥ 80% em 3 sessões' } }, u).id;
      pl[3].forEach(function (o, i) {
        var id = acaoSalvar({ entidade: 'objetivos', registro: { paciente_id: pac[pl[0]], programa_id: proId, objetivo: o[0], area: pl[2],
          linha_base: o[1], data_linha_base: diasAtras(105), meta: o[2], data_inicio: diasAtras(100),
          revisao_prevista: i === 1 && pl[0] === 0 ? diasAtras(5) : diasAtras(-30), status: 'Em aquisição',
          criterio_dominio: '≥ ' + Math.round(o[2] * 100) + '% de respostas independentes' } }, u).id;
        objetivos.push({ id: id, paciente: pac[pl[0]], base: o[1] });
      });
    });

    var ajudas = ['Ajuda gestual', 'Ajuda verbal', 'Modelação', 'Ajuda parcial física'];
    [0, 1].forEach(function (p) {
      var objs = objetivos.filter(function (o) { return o.paciente === pac[p]; });
      for (var semana = 9; semana >= 0; semana--) {
        var progresso = (9 - semana) / 9;
        var dtt = [];
        objs.forEach(function (o) {
          for (var t = 0; t < 8; t++) {
            var x = sorte(), indep = o.base + progresso * 0.4;
            var res = x < indep ? 'Acerto independente' : x < indep + 0.25 ? 'Acerto com ajuda' : x < 0.96 ? 'Erro' : 'Ausência de resposta';
            dtt.push({ objetivo_id: o.id, resultado: res, estimulo: 'Estímulo do programa (exemplo)', resposta_esperada: 'Resposta-alvo operacional',
              nivel_ajuda: res === 'Acerto com ajuda' ? ajudas[Math.floor(sorte() * ajudas.length)] : res === 'Acerto independente' ? 'Independente' : '',
              latencia_seg: Math.round((1 + sorte() * 4) * 10) / 10 });
          }
        });
        var freq = Math.max(1, Math.round(9 - progresso * 5 + sorte() * 2));
        acaoSalvarSessao({
          sessao: { paciente_id: pac[p], data: diasAtras(semana * 7 + p), inicio: '09:00', termino: '09:50', modalidade: 'Presencial',
            profissional: 'Profissional Demo', status: 'Realizada', resumo: 'Sessão fictícia para demonstração.', participacao: 'Participação variável' },
          dtt: dtt,
          comportamentos: [{ comportamento: 'Interrupções de atividade', metodo: 'Frequência', frequencia: freq, tempo_observado: 50,
            linha_base_freq: 8, intensidade: 'Moderada', unidade: 'Eventos', contexto: 'Atividade estruturada' }],
          abc: semana % 3 === 0 ? [{ horario: '09:20', local: 'Sala de atendimento', atividade: 'Atividade de mesa', categoria_antecedente: 'Demanda',
            antecedente: 'Apresentada tarefa nova (exemplo).', comportamento_alvo: 'Fuga de demanda', comportamento: 'Levantou da cadeira (exemplo).',
            categoria_consequencia: 'Retirada ou adiamento da demanda', consequencia: 'Pausa de 1 minuto (exemplo).', intensidade: 'Baixa' }] : []
        }, u);
      }
    });
    acaoSalvarSessao({ sessao: { paciente_id: pac[1], data: diasAtras(-3), inicio: '14:00', termino: '14:50', status: 'Agendada', modalidade: 'Presencial' } }, u);
    return 'Dados de exemplo carregados: 3 pacientes fictícios, 4 programas, 6 objetivos e 21 sessões.';
  });
}

function apagarDemo() {
  return comTrava_(function () {
    var total = 0;
    var todas = entidades_();
    Object.keys(todas).forEach(function (k) {
      var aba = aba_(todas[k].aba);
      var linhas = lerTabela_(todas[k].aba).filter(function (l) { return texto_(l.criado_por) === CRIADOR_DEMO; });
      linhas.sort(function (a, b) { return b._linha - a._linha; }).forEach(function (l) { aba.deleteRow(l._linha); total++; });
    });
    registrarLog_('sistema', 'excluir', 'demonstração', '', total + ' linhas de exemplo apagadas');
    return total + ' linhas de exemplo apagadas.';
  });
}

function menuPopularDemo() {
  var ui = SpreadsheetApp.getUi();
  try { ui.alert(popularDemo()); } catch (e) { ui.alert('Não foi possível: ' + e.message); }
}

function menuApagarDemo() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert(NOME_SISTEMA, 'Apagar todos os dados de exemplo (fictícios)? Os dados reais não são tocados.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  try { ui.alert(apagarDemo()); } catch (e) { ui.alert('Não foi possível: ' + e.message); }
}
