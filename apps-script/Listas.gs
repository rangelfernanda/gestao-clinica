/**
 * Listas.gs — opções das listas suspensas, na aba cfg_listas (editável pela Fernanda).
 * Cada coluna é uma lista: o nome na linha 1 e as opções abaixo, uma por linha.
 * Para acrescentar uma opção, basta digitar na primeira célula vazia da coluna.
 * "RESULTADO DTT" é fixa (os cálculos dependem dela) e não fica na aba.
 */

var ABA_LISTAS = 'cfg_listas';

function listasPadrao_() {
  return {
    'ÁREAS DE DESENVOLVIMENTO': ['Comunicação receptiva', 'Comunicação expressiva', 'Linguagem', 'Interação social', 'Habilidades sociais', 'Cognição', 'Atenção', 'Funções executivas', 'Autonomia', 'Atividades de vida diária', 'Coordenação motora', 'Brincar', 'Regulação emocional', 'Comportamentos adaptativos', 'Redução de comportamentos interferentes'],
    'STATUS PACIENTE': ['Ativo', 'Suspenso', 'Em processo de alta', 'Alta', 'Inativo'],
    'STATUS PROGRAMA': ['Ativo', 'Planejado', 'Pausado', 'Concluído', 'Encerrado'],
    'STATUS OBJETIVO': ['Não iniciado', 'Linha de base', 'Em aquisição', 'Em intervenção', 'Em generalização', 'Em manutenção', 'Dominado', 'Pausado', 'Encerrado'],
    'NÍVEL DE AJUDA': ['Independente', 'Ajuda gestual', 'Ajuda verbal', 'Ajuda visual', 'Modelação', 'Ajuda parcial física', 'Ajuda física total', 'Outro'],
    'SESSÃO STATUS': ['Agendada', 'Realizada', 'Cancelada', 'Reposição', 'Falta'],
    'MODALIDADE': ['Presencial', 'Online', 'Domiciliar', 'Escolar', 'Híbrida', 'Outra'],
    'MENSURAÇÃO': ['Frequência', 'Taxa', 'Duração', 'Latência', 'Intervalo parcial', 'Intervalo total', 'Amostragem momentânea', 'Outros'],
    'ANTECEDENTES': ['Demanda', 'Transição', 'Negação de acesso', 'Retirada de item', 'Atenção indisponível', 'Ambiente sensorial', 'Interação social', 'Evento inesperado', 'Outro'],
    'CONSEQUÊNCIAS': ['Atenção', 'Retirada ou adiamento da demanda', 'Acesso a item ou atividade', 'Estimulação sensorial', 'Nenhuma consequência identificada', 'Outro'],
    'INSTRUMENTOS': ['VB-MAPP', 'Vineland', 'Avaliação curricular', 'Avaliação de habilidades', 'Avaliação funcional', 'Outro'],
    'STATUS AVALIAÇÃO': ['Planejada', 'Em aplicação', 'Concluída', 'Reavaliação prevista', 'Suspensa'],
    'COMPORTAMENTOS ALVO': ['Solicitação funcional', 'Engajamento em tarefa', 'Comunicação espontânea', 'Fuga de demanda', 'Interrupções de atividade', 'Início de resposta', 'Autorregulação', 'Resposta ao nome', 'Permanência em atividade', 'Outro'],
    'PROCEDIMENTOS': ['DTT', 'NET', 'Modelagem', 'Encadeamento', 'Treino de comunicação funcional', 'Reforçamento diferencial', 'Outro'],
    'TIPOS DE AJUDA': ['Sem ajuda', 'Prompt gestual', 'Prompt verbal', 'Prompt visual', 'Modelação', 'Prompt físico parcial', 'Prompt físico total', 'Outro'],
    'INTENSIDADE': ['Baixa', 'Moderada', 'Alta', 'Não aplicável'],
    'FORMA PAGAMENTO': ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Convênio'],
    'STATUS PAGAMENTO': ['Pago', 'Pendente', 'Isento', 'Não cobrar']
  };
}

function lerListas_() {
  var listas = {};
  var aba = planilha_().getSheetByName(ABA_LISTAS);
  var padrao = listasPadrao_();
  if (aba && aba.getLastRow() > 0) {
    var valores = aba.getDataRange().getValues();
    for (var c = 0; c < valores[0].length; c++) {
      var nome = texto_(valores[0][c]);
      if (!nome) continue;
      var itens = [];
      for (var l = 1; l < valores.length; l++) {
        var v = texto_(valores[l][c]);
        if (v && itens.indexOf(v) < 0) itens.push(v);
      }
      listas[nome] = itens;
    }
  }
  Object.keys(padrao).forEach(function (k) { if (!listas[k] || !listas[k].length) listas[k] = padrao[k]; });
  listas['RESULTADO DTT'] = Calculos.RESULTADOS.slice();
  return listas;
}

/** Cria a cfg_listas com as opções da planilha original (só quando ainda não existe). */
function criarAbaListas_(ss) {
  var padrao = listasPadrao_();
  var nomes = Object.keys(padrao);
  var maior = nomes.reduce(function (m, k) { return Math.max(m, padrao[k].length); }, 0);
  var matriz = [nomes];
  for (var i = 0; i < maior; i++) matriz.push(nomes.map(function (k) { return padrao[k][i] || ''; }));
  var aba = ss.insertSheet(ABA_LISTAS);
  if (aba.getMaxColumns() < nomes.length) aba.insertColumnsAfter(aba.getMaxColumns(), nomes.length - aba.getMaxColumns());
  aba.getRange(1, 1, 1, nomes.length).setNumberFormat('@');
  aba.getRange(1, 1, matriz.length, nomes.length).setValues(matriz);
  aba.getRange(1, 1, 1, nomes.length).setFontWeight('bold').setBackground(COR_CABECALHO).setFontColor('#FFFFFF');
  aba.setFrozenRows(1);
  return aba;
}
