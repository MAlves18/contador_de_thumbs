# Thumbnail Counter — sistema de usuários

Painel de contadores editáveis com autenticação, dados privados por usuário e sincronização entre dispositivos.

## O que mudou

- Cadastro com nome, e-mail e senha.
- Login e logout.
- Cada usuário possui um painel separado.
- Contadores, valores, título e posições são salvos no Netlify Blobs usando o ID do usuário.
- A conta conectada aparece no topo do painel.
- O painel manten um cache local por usuário para suportar falhas temporárias de conexão.

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

