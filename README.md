<div align="center">
  <img src="assets/logo-jl.svg" alt="Logo JL" width="110" />

Thumbnail Counter

Painel visual de contadores editáveis, responsivo e sincronizado entre dispositivos.

  <p>
    <img alt="HTML5" src="https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white">
    <img alt="CSS3" src="https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white">
    <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=111">
    <img alt="Netlify" src="https://img.shields.io/badge/Netlify-00C7B7?logo=netlify&logoColor=white">
    <img alt="Responsive" src="https://img.shields.io/badge/Layout-Responsivo-6C63FF">
  </p>
</div>

Sobre o projeto

O Thumbnail Counter é um painel para criar e acompanhar contadores personalizados. Os cartões podem ser posicionados livremente na tela, editados e sincronizados na nuvem para que o mesmo usuário encontre seu painel em computadores, tablets e celulares.

O projeto utiliza autenticação individual. Cada conta possui um painel privado, salvo separadamente no Netlify Blobs por meio de uma Netlify Function.

Demonstração:

https://courageous-elf-7f33e6.netlify.app/

Funcionalidades

Criação de contadores personalizados.

Incremento e decremento de valores.

Definição de nome, meta, valor inicial e cor.

Movimentação livre dos cartões por mouse ou toque.

Posições proporcionais à tela e preservadas entre dispositivos.

Modo de edição para alterar, duplicar e excluir cartões.

Exclusão de todos os contadores pelo botão Reset all.

Importação e exportação dos dados em JSON.

Cadastro, login, logout e recuperação de senha.

Login direto com Google.

Painel privado para cada usuário.

Sincronização automática com a nuvem.

Cache local para uso durante falhas temporárias de conexão.

Tema claro e escuro conforme a preferência do sistema.

Fundo quadriculado adaptado ao tema.

Interface responsiva para desktop, notebook, tablet e celular.

Suporte a telas com notch e mudança de orientação.

Instalação como aplicativo pelo navegador, por meio do Web App Manifest.

Tecnologias

Camada

Tecnologia

Interface

HTML5, CSS3 e JavaScript ES Modules

Autenticação

Netlify Identity

Login social

Google OAuth via Netlify Identity

Backend

Netlify Functions

Persistência

Netlify Blobs

Hospedagem

Netlify

Versionamento

Git e GitHub

Estrutura do projeto

.
├── assets/
│   ├── favicon.png
│   ├── favicon.svg
│   └── logo.svg
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
