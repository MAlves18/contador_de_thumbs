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

## Publicação pelo GitHub

Substitua os arquivos do repositório por esta versão e envie o commit:

```bash
git add .
git commit -m "Adicionar sistema de usuarios"
git push
```

O Netlify fará um novo deploy automaticamente porque o projeto já está conectado ao GitHub.

## Ativar os usuários no Netlify

1. Abra o projeto no Netlify.
2. Acesse **Project configuration → Identity**.
3. Clique em **Enable Identity**.
4. Em **Identity → Registration → Registration preferences**, escolha uma opção:
   - **Open:** qualquer pessoa pode criar conta na tela do site.
   - **Invite only:** somente pessoas convidadas no painel do Netlify podem criar conta.
5. Em **Identity → Emails**, decida se o usuário precisará confirmar o e-mail antes do primeiro login.
6. Faça um novo deploy pelo GitHub após ativar o Identity.

A variável `SYNC_SECRET` não é mais usada e pode ser removida das variáveis de ambiente.

## Gerenciar usuários

No Netlify, acesse:

```text
Project configuration → Identity → Users
```

Nesse local é possível:

- visualizar usuários cadastrados;
- convidar usuários;
- enviar redefinição de senha;
- excluir ou bloquear contas;
- editar nome e funções de acesso.

## Funcionamento dos dados

A Function `board-state.mjs` valida a sessão do Netlify Identity e salva o painel com uma chave privada:

```text
users/ID_DO_USUARIO/dashboard
```

Por isso, dois usuários diferentes não acessam os mesmos contadores. O mesmo usuário, ao entrar em outro dispositivo, recebe o painel salvo na nuvem.

## Primeiro acesso

1. Abra o site publicado.
2. Clique em **Create a new account**.
3. Informe nome, e-mail e senha.
4. Confirme o e-mail, caso essa exigência esteja ativa no Netlify.
5. Entre com a conta.

## Teste da proteção

Sem estar conectado, abra:

```text
https://SEU-SITE.netlify.app/api/board-state
```

O retorno esperado é:

```json
{"error":"Authentication required."}
```

Após fazer login pelo site, o painel acessará a Function automaticamente usando o cookie seguro criado pelo Netlify Identity.

## Desenvolvimento local

O painel visual pode ser aberto com Live Server, mas login e cadastro precisam de um site Netlify publicado com HTTPS e Identity habilitado.

Para testar Functions localmente:

```bash
npm install
npx netlify dev
```

Mesmo usando `netlify dev`, os fluxos de autenticação funcionam melhor em um deploy de teste no Netlify.


## Login com Google

O projeto inclui o botão **Continue with Google**. Para ativá-lo no Netlify:

1. Abra `Project configuration > Identity > Registration > External providers`.
2. Clique em `Add provider`.
3. Escolha `Google` e salve.
4. Envie esta versão ao GitHub para o Netlify executar um novo deploy.

Nenhum Client ID, Client Secret ou senha do Google deve ser colocado no `app.js`, no `index.html` ou no GitHub. Por padrão, o Netlify pode usar a integração OAuth dele. Para mostrar o nome da sua própria aplicação na tela de consentimento, configure credenciais próprias diretamente no painel do Netlify.

Se o cadastro estiver em `Invite only`, o endereço Google também precisará ser convidado antes do primeiro acesso.
