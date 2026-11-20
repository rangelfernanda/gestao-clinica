/**
 * Setup.gs — instalação (rodar uma vez) e usuários.
 *
 * No editor do Apps Script (vinculado à planilha):
 *   1. Selecione `setupPlanilha` e clique em Executar. Autorize quando pedir.
 *      Cria as abas que faltam. Pode rodar de novo: nunca apaga nem sobrescreve dados.
 *   2. Recarregue a planilha e use o menu "Gestão Clínica → Criar ou redefinir usuário".
 *      (Digitar direto na aba db_usuarios NÃO funciona: a senha é guardada como hash.)
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu(NOME_SISTEMA)
    .addItem('Criar ou redefinir usuário', 'menuCriarUsuario')
    .addItem('Desativar usuário', 'menuDesativarUsuario')
    .addSeparator()
    .addItem('Instalar / completar abas', 'setupPlanilha')
    .addSeparator()
    .addItem('Carregar dados de exemplo (fictícios)', 'menuPopularDemo')
    .addItem('Apagar dados de exemplo', 'menuApagarDemo')
    .addToUi();
}

function abasDoSistema_() {
  var abas = [];
  var todas = entidades_();
  Object.keys(todas).forEach(function (k) { abas.push(todas[k].aba); });
  return abas.concat([ABA_USUARIOS, ABA_LOG]);
}

function setupPlanilha() {
  var ss = planilha_();
  var criadas = [];
  abasDoSistema_().forEach(function (nome) {
    if (!ss.getSheetByName(nome)) { criarAba_(ss, nome); criadas.push(nome); }
    else completarColunas_(ss.getSheetByName(nome), nome);
  });
  if (!ss.getSheetByName(ABA_LISTAS)) { criarAbaListas_(ss); criadas.push(ABA_LISTAS); }
  registrarLog_('sistema', 'setup', 'planilha', '', 'Abas criadas: ' + (criadas.join(', ') || 'nenhuma'));
  var msg = 'Pronto. Abas criadas: ' + (criadas.join(', ') || 'nenhuma') +
    '. Agora cadastre os usuários pelo menu ' + NOME_SISTEMA + '.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* rodando pelo editor */ }
  return msg;
}

function criarAba_(ss, nome) {
  var aba = ss.insertSheet(nome);
  var cab = cabecalhos_(nome);
  aba.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground(COR_CABECALHO).setFontColor('#FFFFFF');
  aba.setFrozenRows(1);
  colunasTexto_(nome).forEach(function (campo) {
    var col = cab.indexOf(campo) + 1;
    if (col > 0) aba.getRange(1, col, aba.getMaxRows(), 1).setNumberFormat('@');
  });
  if (aba.getMaxColumns() > cab.length) aba.deleteColumns(cab.length + 1, aba.getMaxColumns() - cab.length);
  return aba;
}

/** Atualização de versão: acrescenta no fim as colunas novas do cabeçalho, sem mexer nas existentes. */
function completarColunas_(aba, nome) {
  var atuais = aba.getRange(1, 1, 1, Math.max(1, aba.getLastColumn())).getValues()[0].map(function (c) { return texto_(c); });
  var faltam = cabecalhos_(nome).filter(function (c) { return atuais.indexOf(c) < 0; });
  if (!faltam.length) return;
  var inicio = atuais.filter(function (c) { return c; }).length + 1;
  if (aba.getMaxColumns() < inicio + faltam.length - 1) aba.insertColumnsAfter(aba.getMaxColumns(), inicio + faltam.length - 1 - aba.getMaxColumns());
  aba.getRange(1, inicio, 1, faltam.length).setValues([faltam]).setFontWeight('bold').setBackground(COR_CABECALHO).setFontColor('#FFFFFF');
  faltam.forEach(function (campo, i) {
    if (colunasTexto_(nome).indexOf(campo) >= 0) aba.getRange(1, inicio + i, aba.getMaxRows(), 1).setNumberFormat('@');
  });
}

// ───────────────────────────── Usuários ─────────────────────────────

function criarUsuario(usuario, nome, senha) {
  usuario = normalizar_(usuario).replace(/\s+/g, '');
  nome = texto_(nome, 80);
  senha = String(senha == null ? '' : senha);
  if (!usuario || !nome) throw new Error('Informe o usuário (login) e o nome.');
  if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');

  var existente = buscarUsuario_(usuario);
  var registro = { usuario: usuario, nome: nome, senha_hash: gerarHash_(senha), perfil: existente ? existente.perfil : (lerUsuarios_().length ? 'usuario' : 'admin'), ativo: true };
  if (existente) {
    atualizarLinha_(ABA_USUARIOS, existente._linha, registro);
    registrarLog_('sistema', 'editar', 'usuario', usuario, 'Senha redefinida para ' + nome);
    return 'Senha de "' + usuario + '" redefinida.';
  }
  inserirLinha_(ABA_USUARIOS, registro);
  registrarLog_('sistema', 'criar', 'usuario', usuario, 'Usuário criado: ' + nome);
  return 'Usuário "' + usuario + '" criado.';
}

function desativarUsuario(usuario) {
  var existente = buscarUsuario_(usuario);
  if (!existente) throw new Error('Usuário não encontrado.');
  atualizarLinha_(ABA_USUARIOS, existente._linha, { ativo: false });
  registrarLog_('sistema', 'editar', 'usuario', existente.usuario, 'Usuário desativado');
  return 'Usuário "' + existente.usuario + '" desativado.';
}

function menuCriarUsuario() {
  var ui = SpreadsheetApp.getUi();
  var login = perguntar_(ui, 'Usuário (login, sem espaços). Ex.: fernanda');
  if (login === null) return;
  var nome = perguntar_(ui, 'Nome que aparece no sistema. Ex.: Fernanda Rangel');
  if (nome === null) return;
  var senha = perguntar_(ui, 'Senha (mínimo 6 caracteres)');
  if (senha === null) return;
  try { ui.alert(criarUsuario(login, nome, senha)); } catch (e) { ui.alert('Não foi possível: ' + e.message); }
}

function menuDesativarUsuario() {
  var ui = SpreadsheetApp.getUi();
  var login = perguntar_(ui, 'Usuário (login) a desativar');
  if (login === null) return;
  try { ui.alert(desativarUsuario(login)); } catch (e) { ui.alert('Não foi possível: ' + e.message); }
}

function perguntar_(ui, pergunta) {
  var r = ui.prompt(NOME_SISTEMA, pergunta, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  return r.getResponseText();
}
