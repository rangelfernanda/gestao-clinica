'use strict';
/**
 * Servidor local para testar o site com o backend simulado (sem Apps Script).
 *   AGORA=2026-11-17T10:00:00-03:00 fixa a data (útil para vencimentos/atrasos).
 *   node tests/servidor-dev.js [porta]
 * Serve os arquivos do projeto e responde POST /api como se fosse o doPost.
 * O js/config.js servido aponta para /api. Nada disso vai para o GitHub Pages.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { criarAmbiente } = require('./simulador');

const porta = Number(process.argv[2]) || 8788;
const raiz = path.join(__dirname, '..');
const agora = process.env.AGORA || null;
const amb = criarAmbiente({ agora, silencioso: true });
amb.rodar('setupPlanilha');
amb.rodar('criarUsuario', 'fernanda', 'Fernanda Rangel', 'teste123');
// Dados de exemplo (fictícios) para a tela não abrir vazia. Nunca use dados reais aqui.
amb.rodar('popularDemo');

const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/api')) {
    let corpo = '';
    req.on('data', (c) => { corpo += c; });
    req.on('end', () => {
      const saida = amb.sandbox.doPost({ postData: { contents: corpo } });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(saida.getContent());
    });
    return;
  }
  if (req.url.startsWith('/js/config.js')) {
    res.writeHead(200, { 'Content-Type': tipos['.js'] });
    res.end(`window.API_URL = 'http://localhost:${porta}/api';`);
    return;
  }
  const urlLimpa = decodeURIComponent(req.url.split('?')[0]);
  const arquivo = path.join(raiz, urlLimpa === '/' ? 'index.html' : urlLimpa);
  if (!arquivo.startsWith(raiz) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('não encontrado'); return;
  }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
}).listen(porta, () => console.log(`Site de teste em http://localhost:${porta}  (usuário fernanda, senha teste123)`));
