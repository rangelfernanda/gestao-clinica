/**
 * Auth.gs — login, hash de senha e token de sessão.
 *
 * A senha nunca fica no código nem na planilha: a aba db_usuarios guarda só
 * "salt$sha256(salt:senha)". O token de sessão vive no CacheService por 12 h
 * (regravado a cada uso, porque o cache guarda no máximo 6 h por gravação).
 */

function acaoLogin(dados) {
  var usuario = normalizar_(dados.usuario);
  var senha = String(dados.senha == null ? '' : dados.senha);
  if (!usuario || !senha) falha_('Informe o usuário e a senha.');

  // A trava impede que tentativas simultâneas escapem do limite de senha errada.
  return comTrava_(function () {
    var cache = CacheService.getScriptCache();
    var chaveTentativas = 'tent_' + usuario;
    var tentativas = Number(cache.get(chaveTentativas) || 0);
    if (tentativas >= MAX_TENTATIVAS_LOGIN) {
      falha_('Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.');
    }

    var registro = buscarUsuario_(usuario);
    if (!registro || !registro.ativo || !senhaConfere_(senha, registro.senha_hash)) {
      cache.put(chaveTentativas, String(tentativas + 1), BLOQUEIO_LOGIN_SEGUNDOS);
      falha_('Usuário ou senha incorretos.');
    }

    cache.remove(chaveTentativas);
    var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    var expiraEm = Date.now() + SESSAO_HORAS * 3600 * 1000;
    cache.put('sess_' + token, JSON.stringify({ usuario: registro.usuario, exp: expiraEm }), CACHE_MAX_SEGUNDOS);
    return { token: token, usuario: registro.usuario, nome: registro.nome, perfil: registro.perfil, expiraEm: expiraEm };
  });
}

function acaoLogout(token) {
  CacheService.getScriptCache().remove('sess_' + token);
  return { saiu: true };
}

/** Devolve o usuário da sessão ou falha com code SESSAO (o site volta para o login). */
function validarSessao_(token) {
  var expirada = 'Sua sessão expirou. Entre de novo.';
  if (!token) falha_(expirada, 'SESSAO');

  var cache = CacheService.getScriptCache();
  var chave = 'sess_' + token;
  var bruto = cache.get(chave);
  if (!bruto) falha_(expirada, 'SESSAO');

  var sessao = JSON.parse(bruto);
  var restanteSegundos = Math.floor((sessao.exp - Date.now()) / 1000);
  var usuario = buscarUsuario_(sessao.usuario);
  if (restanteSegundos <= 0 || !usuario || !usuario.ativo) {
    cache.remove(chave);
    falha_(expirada, 'SESSAO');
  }

  cache.put(chave, bruto, Math.min(restanteSegundos, CACHE_MAX_SEGUNDOS));
  return usuario;
}

function lerUsuarios_() {
  return lerTabela_(ABA_USUARIOS).map(function (l) {
    return {
      usuario: normalizar_(l.usuario),
      nome: texto_(l.nome),
      senha_hash: texto_(l.senha_hash),
      perfil: normalizar_(l.perfil) === 'admin' ? 'admin' : 'usuario',
      ativo: booleano_(l.ativo),
      _linha: l._linha
    };
  }).filter(function (u) { return u.usuario; });
}

function buscarUsuario_(usuario) {
  var alvo = normalizar_(usuario);
  return lerUsuarios_().filter(function (u) { return u.usuario === alvo; })[0] || null;
}

function gerarHash_(senha) {
  var sal = Utilities.getUuid().replace(/-/g, '');
  return sal + '$' + sha256_(sal + ':' + senha);
}

function senhaConfere_(senha, guardado) {
  var partes = String(guardado).split('$');
  return partes.length === 2 && sha256_(partes[0] + ':' + senha) === partes[1];
}

function sha256_(textoOriginal) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, textoOriginal, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    hex += ('0' + (bytes[i] & 0xff).toString(16)).slice(-2);
  }
  return hex;
}
