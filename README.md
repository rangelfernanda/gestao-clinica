# Gestão Clínica

| Parte | Onde fica | O que faz |
|---|---|---|
| Site (HTML/JS) | GitHub Pages | Telas, login e cálculos no navegador |
| API | Apps Script (Aplicativo da Web) | Login, leitura e gravação |
| Banco de dados | Planilha Google (abas `db_*`) | Pacientes, programas, objetivos, sessões, usuários e histórico (`db_log`) |

Nenhum dado real fica no GitHub: o repositório só tem o código. Os dados ficam na planilha.

## Instalação (uma vez)

1. **Planilha**: crie uma planilha Google (ou use a existente, já convertida para Planilhas Google — arquivo .xlsx não tem o menu Extensões).
2. **Apps Script**: na planilha, *Extensões → Apps Script*. Crie um arquivo para cada `.gs` da pasta `apps-script/` (mesmo nome) e cole o conteúdo. Em *Configurações do projeto*, marque "Mostrar appsscript.json" e cole o `appsscript.json`.
3. **Abas**: no editor, escolha `setupPlanilha` e clique em *Executar* (autorize quando pedir). Rodar de novo não apaga nada.
4. **Usuários**: recarregue a planilha e use o menu *Gestão Clínica → Criar ou redefinir usuário*. O primeiro usuário é administrador. Digitar direto na aba não funciona (a senha vira hash).
5. **Publicar a API**: *Implantar → Nova implantação → Aplicativo da Web*, executar como *Eu*, acesso *Qualquer pessoa*. Copie a URL que termina em `/exec`.
6. **Ligar o site**: a URL vai em `js/config.js`.

Para atualizar o Apps Script depois: *Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar*. A URL não muda. Sem "Nova versão", o site continua usando o código antigo.

Se uma tela nova não aparecer no navegador: **Ctrl + Shift + R** (no celular, fechar e abrir a aba).

## Desenvolvimento

```
node tests/testes-backend.js     # testes do Apps Script num simulador
node tests/testes-calculos.js    # testes dos cálculos (batem com a planilha)
node tests/servidor-dev.js 8788  # site + backend simulado em http://localhost:8788 (fernanda / teste123)
```
