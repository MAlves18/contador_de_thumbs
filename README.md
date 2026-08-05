# Thumbnail Counter — sistema de usuários

Painel de contadores editáveis com autenticação, dados privados por usuário e sincronização entre dispositivos.

## O que mudou

- Cadastro com nome, e-mail e senha.
- Login e logout.
- Cada usuário possui um painel separado.
- Contadores, valores, título e posições são salvos no Netlify Blobs usando o ID do usuário.
- A sincronização não usa mais a variável `SYNC_SECRET`.
- A conta conectada aparece no topo do painel.
- O painel continua mantendo um cache local por usuário para suportar falhas temporárias de conexão.


## Atualização visual — grade e movimentação livre

- O painel agora usa uma grade quadrada gerada por CSS, sem depender de uma imagem de fundo.
- Em modo claro, o fundo é branco com linhas cinza discretas.
- Em modo escuro, o fundo é preto com linhas claras, seguindo automaticamente a preferência de tema do sistema ou navegador (`prefers-color-scheme`).
- Os contadores podem ser arrastados a qualquer momento pela área superior do cartão; não é mais necessário ativar **Edit mode**.
- O **Edit mode** continua sendo usado para exibir as ações de editar, duplicar e excluir.
- As posições continuam sendo salvas localmente e sincronizadas pelo painel privado do usuário.

## Estrutura

```text
.
├── assets/
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── netlify/
│   └── functions/
│       └── board-state.mjs
├── index.html
├── manifest.webmanifest
├── netlify.toml
├── package.json
└── README.md
```


