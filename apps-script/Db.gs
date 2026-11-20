/**
 * Db.gs — leitura e escrita genérica das abas (cabeçalho na linha 1).
 * As colunas são localizadas pelo nome do cabeçalho, nunca pela posição.
 */

function cabecalhos_(nome) {
  switch (nome) {
    case ABA_USUARIOS: return ['usuario', 'nome', 'senha_hash', 'perfil', 'ativo'];
    case ABA_LOG: return ['data_hora', 'usuario', 'acao', 'entidade', 'registro_id', 'resumo_alteracao'];
    default:
      var ent = entidadeDaAba_(nome);
      if (ent) return cabecalhoEntidade_(entidades_()[ent]);
      throw new Error('Aba desconhecida: ' + nome);
  }
}

// Colunas de texto puro (formato "@"): datas, CPF, telefone e ids não podem ser convertidos pelo Sheets.
function colunasTexto_(nome) {
  switch (nome) {
    case ABA_USUARIOS: return ['usuario', 'senha_hash'];
    case ABA_LOG: return ['data_hora', 'registro_id'];
    default:
      var ent = entidadeDaAba_(nome);
      return ent ? textoEntidade_(entidades_()[ent]) : [];
  }
}

function aba_(nome) {
  var aba = planilha_().getSheetByName(nome);
  if (!aba) falha_('A aba ' + nome + ' não existe. Rode setupPlanilha() no editor do Apps Script.');
  return aba;
}

/** Lê a aba inteira como objetos com as chaves do cabeçalho e `_linha`. Linhas com a 1ª coluna vazia são ignoradas. */
function lerTabela_(nome) {
  var valores = aba_(nome).getDataRange().getValues();
  if (valores.length < 2) return [];
  var cabecalho = valores[0].map(function (c) { return texto_(c); });
  var linhas = [];
  for (var i = 1; i < valores.length; i++) {
    if (texto_(valores[i][0]) === '') continue;
    var obj = { _linha: i + 1 };
    for (var c = 0; c < cabecalho.length; c++) {
      if (cabecalho[c]) obj[cabecalho[c]] = valores[i][c];
    }
    linhas.push(obj);
  }
  return linhas;
}

function indiceColunas_(aba) {
  var cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  return { nomes: cab.map(function (c) { return texto_(c); }) };
}

function montarLinha_(nomes, obj) {
  return nomes.map(function (campo) {
    var v = obj[campo];
    return v == null ? '' : v;
  });
}

function inserirLinha_(nome, obj) {
  var aba = aba_(nome);
  var cols = indiceColunas_(aba);
  var linha = aba.getLastRow() + 1;
  aba.getRange(linha, 1, 1, cols.nomes.length).setValues([montarLinha_(cols.nomes, obj)]);
  return linha;
}

function inserirLinhas_(nome, objetos) {
  if (!objetos.length) return;
  var aba = aba_(nome);
  var cols = indiceColunas_(aba);
  var inicio = aba.getLastRow() + 1;
  var matriz = objetos.map(function (o) { return montarLinha_(cols.nomes, o); });
  aba.getRange(inicio, 1, matriz.length, cols.nomes.length).setValues(matriz);
}

function atualizarLinha_(nome, linha, obj) {
  var aba = aba_(nome);
  var cols = indiceColunas_(aba);
  var atual = aba.getRange(linha, 1, 1, cols.nomes.length).getValues()[0];
  cols.nomes.forEach(function (campo, i) {
    if (Object.prototype.hasOwnProperty.call(obj, campo)) {
      atual[i] = obj[campo] == null ? '' : obj[campo];
    }
  });
  aba.getRange(linha, 1, 1, cols.nomes.length).setValues([atual]);
}

/**
 * Troca todas as linhas em que `campo` = `valor` pelas `novas` (reescreve o corpo da aba de uma vez).
 * Útil para gravar de uma vez os itens filhos de um registro.
 */
function substituirLinhas_(nome, campo, valor, novas) {
  var aba = aba_(nome);
  var valores = aba.getDataRange().getValues();
  var nomes = valores[0].map(function (c) { return texto_(c); });
  var col = nomes.indexOf(campo);
  var corpo = valores.slice(1).filter(function (l) {
    return texto_(l[0]) !== '' && texto_(l[col]) !== texto_(valor);
  });
  novas.forEach(function (o) { corpo.push(montarLinha_(nomes, o)); });
  var ultima = aba.getLastRow();
  if (ultima > 1) aba.getRange(2, 1, ultima - 1, nomes.length).setValues(
    Array.apply(null, Array(ultima - 1)).map(function () { return nomes.map(function () { return ''; }); }));
  if (corpo.length) aba.getRange(2, 1, corpo.length, nomes.length).setValues(corpo);
}

function proximoId_(prefixo, digitos, registros) {
  var maior = 0;
  registros.forEach(function (r) {
    var m = String(r.id || '').match(new RegExp('^' + prefixo + '(\\d+)$'));
    if (m) maior = Math.max(maior, Number(m[1]));
  });
  var n = String(maior + 1);
  while (n.length < digitos) n = '0' + n;
  return prefixo + n;
}

function registrarLog_(usuario, acao, entidade, registroId, resumo) {
  inserirLinha_(ABA_LOG, {
    data_hora: agoraTexto_(),
    usuario: usuario && usuario.nome ? usuario.nome : String(usuario || 'sistema'),
    acao: acao,
    entidade: entidade,
    registro_id: registroId,
    resumo_alteracao: texto_(resumo, 500)
  });
}

function acaoListLog(dados) {
  var limite = Math.min(inteiro_(dados.limite) || 300, 2000);
  return lerTabela_(ABA_LOG).map(function (l) {
    return {
      data_hora: texto_(l.data_hora), usuario: texto_(l.usuario), acao: texto_(l.acao),
      entidade: texto_(l.entidade), registro_id: texto_(l.registro_id), resumo_alteracao: texto_(l.resumo_alteracao)
    };
  }).slice(-limite).reverse();
}

function publico_(obj) {
  var copia = {};
  Object.keys(obj).forEach(function (k) { if (k.charAt(0) !== '_') copia[k] = obj[k]; });
  return copia;
}
