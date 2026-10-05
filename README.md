# AACN — Carteirinha do Associado

App web (PWA, instalável em Android e iPhone) para a Associação de Airsoft de
Caldas Novas. Permite que jogadores se cadastrem, completem seus dados,
solicitem entrada em um time (sujeito à aprovação do representante do time) e
gerem sua carteirinha digital/impressa com QR code. Administradores gerenciam
jogadores, times e status de pagamento.

## Stack

- React + Vite + TypeScript + Tailwind CSS
- Firebase Auth (e-mail/senha) e Firestore (banco de dados)
- `vite-plugin-pwa` para instalação no celular
- `react-qr-code` para gerar o QR code da carteirinha

> **Foto 3x4 sem Firebase Storage.** O Storage exige o plano pago Blaze, então o jogador enquadra
> o rosto (arrasta e dá zoom, com um oval de guia), e a foto é reduzida para 240x320 (JPEG, ~20 KB)
> no próprio navegador e guardada como
> texto no Firestore (campo `fotoUrl`). Fica no plano gratuito. Se um dia migrarem para o
> Blaze, dá para trocar para o Storage mudando só `src/components/PhotoUploader.tsx`.

## 1. Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com e crie um projeto novo.
2. Em **Build > Authentication > Sign-in method**, ative o provedor
   **E-mail/senha**.
3. Em **Build > Firestore Database**, crie o banco (modo produção).
4. Em **Configurações do projeto > Geral**, adicione um app da Web e copie as
   credenciais (`apiKey`, `authDomain`, etc).

## 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com as credenciais do passo
anterior:

```bash
cp .env.example .env.local
```

## 3. Instalar dependências e rodar localmente

```bash
npm install
npm run dev
```

## 4. Publicar as regras de segurança e índices

Instale a CLI do Firebase, faça login e associe o projeto:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
```

Depois, publique as regras e os índices já configurados neste repositório
(`firestore.rules`, `firestore.indexes.json`):

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 5. Notificação por e-mail ao representante do time

O envio de e-mail usa a extensão oficial **Trigger Email**
(`firestore-send-email`) do Firebase, que observa a coleção `mail` (o app já
grava os documentos lá em `src/lib/mailer.ts`).

1. No console do Firebase, vá em **Build > Extensions** e instale
   **Trigger Email** (`firebase/firestore-send-email`).
2. Configure com um servidor SMTP (ex: um e-mail Gmail com senha de app, ou um
   serviço como SendGrid/Mailgun/Brevo — todos têm planos gratuitos
   suficientes para uma associação pequena).
3. Use `mail` como nome da coleção observada (valor padrão).

Sem essa extensão instalada, o cadastro dos documentos em `mail` continua
funcionando, mas nenhum e-mail é realmente enviado — só é necessário
configurar antes de ir para produção.

## 6. Administradores e cargos

- **Administrador:** só é definido direto no Firebase (o app nunca cria nem remove admin, e as
  regras do banco também impedem). Cadastre-se normalmente pelo app, abra o Firestore no console,
  encontre o documento em `players/{uid}` dessa pessoa e mude o campo `role` de `"player"`
  para `"admin"`. Para remover um admin, o caminho é o mesmo (volte para `"player"`).
- **Demais cargos (ex: tesoureiro):** o admin delega pelo app, em **Admin: Cargos**, escolhendo o
  cargo de cada jogador. Fica registrado quem definiu. O admin não altera o cargo de outro admin.
- **Criar um cargo novo:** adicione o valor em `UserRole` (`src/types.ts`), uma linha em
  `CARGOS_DELEGAVEIS` (`src/lib/roles.ts`) e as permissões dele em `firestore.rules`. Ele
  passa a aparecer sozinho em Admin: Cargos.

## 7. Publicar o app (hosting)

Qualquer hospedagem de site estático funciona (Firebase Hosting, Vercel,
Netlify). Para usar o Firebase Hosting, já incluído em `firebase.json`:

```bash
npm run build
firebase deploy --only hosting
```

## 8. Instalar como app no celular

Depois de publicado (precisa ser HTTPS — hospedagens acima já servem em
HTTPS), basta abrir a URL do app:

- **Android (Chrome):** menu ⋮ → "Adicionar à tela inicial" / "Instalar app".
- **iPhone (Safari):** botão de compartilhar → "Adicionar à Tela de Início".

## Como funciona a aprovação de time

1. Um admin cadastra o time em **Admin: Times** e define o representante
   (precisa ser alguém já cadastrado como jogador).
2. Um jogador escolhe o time em **Meus dados**. Isso cria uma solicitação
   pendente e envia e-mail ao representante.
3. O representante acessa **Solicitações do time** e aprova ou recusa. Só
   depois de aprovado o time aparece na carteirinha do jogador.

## Carteirinha e QR code para parceiros

Cada jogador vê sua carteirinha em **Minha carteirinha**, com botão para
imprimir. O QR code aponta para uma página pública (`/verificar/:uid`, sem
necessidade de login) que mostra nome, foto, time e status de pagamento —
essa é a página que o comerciante parceiro abre ao escanear o código para
validar se o associado está em dia e pode receber desconto.

## Mensalidade por Pix

- O admin cadastra a chave Pix, o nome/cidade do recebedor e o valor (ex: R$ 5,00)
  em **Admin: Pagamentos**.
- O jogador vê **Mensalidade** na tela da carteirinha, toca em "Gerar Pix" e recebe um
  QR code + "copia e cola" com o valor fixo.
- Quando o dinheiro cair na conta, o admin confirma em **Admin: Pagamentos** (informando
  a data do pagamento). O sistema define o vencimento para **30 dias depois do pagamento**
  (se pagou adiantado, conta a partir do vencimento atual, sem perder dias).
- O status é calculado pelo vencimento: passou da data = **inadimplente** automaticamente
  (não precisa de rotina agendada). **Inativo** é decisão manual do admin.
- A página pública do QR (`/verificar/:uid`) mostra o status e o vencimento.

**Limitação atual:** o app não detecta o pagamento sozinho, o admin confirma manualmente.
A confirmação automática exige um provedor de Pix (Mercado Pago, Efí etc.) e um servidor
para receber o aviso de pagamento.

## Créditos de jogo

- Cada pagamento Pix confirmado gera créditos: **R$ 1,00 = 2 créditos** (constante
  `CREDITOS_POR_REAL` em `src/lib/credits.ts`). Mensalidade de R$ 10 = 20 créditos.
- O admin cria jogos em **Admin: Jogos** com o valor em dinheiro (ex: R$ 10) e o custo em
  créditos (padrão: o mesmo número, ex: 10 créditos). Assim, R$ 10 pagos na mensalidade
  (20 créditos) valem 2 jogos.
- O jogador vê o saldo na carteirinha e em **Jogos**, onde se inscreve gastando créditos.
  Sem saldo, o app avisa quanto falta e que dá para pagar em dinheiro no local.
- O admin pode inscrever alguém (debitando créditos ou marcando "pagou em dinheiro") e
  cancelar inscrições; ao cancelar, os créditos debitados voltam (estorno) e a inscrição fica
  no histórico como "cancelada" (o jogador não consegue se reinscrever sozinho nesse jogo).
- **Extrato detalhado:** todo movimento de saldo (pagamento, inscrição, estorno, ajuste) vira
  uma linha com data, descrição, quem fez, valor e saldo após. O jogador vê o dele em **Jogos**;
  o admin vê o de qualquer um em **Admin: Créditos**. O extrato é imutável (nem o admin edita
  ou apaga linhas) e é gravado no mesmo lote do saldo, então os dois nunca divergem.
- **Ajuste manual:** em **Admin: Créditos**, o admin soma ou subtrai créditos de um jogador
  informando obrigatoriamente o motivo, que fica no extrato. Não deixa o saldo ficar negativo.
- Pagamento confirmado, crédito e mudança de vencimento são gravados juntos; confirmar duas
  vezes o mesmo pagamento é bloqueado.
- Segurança (`firestore.rules`): o jogador não consegue aumentar o próprio saldo. Só consegue
  gastar exatamente o custo de um jogo aberto, junto com a própria inscrição. Essas regras
  ainda não foram testadas com o emulador do Firebase (exige Java); teste no "Rules Playground"
  do console assim que o projeto existir.
- Créditos não expiram.

## Cargo de tesoureiro

O admin delega o cargo em **Admin: Cargos** (ver seção 6).

- **Vê e faz:** Pagamentos (confirmar Pix recebido), Jogos (criar jogos, inscrever e cancelar)
  e Créditos (extrato e ajuste de saldo). Confirmar pagamento, ajustar créditos e inscrever
  ficam registrados no extrato com o nome de quem fez.
- **Não vê:** a lista completa de jogadores, endereço, contato de emergência, condições médicas,
  times e cargos. Para escolher um jogador ele usa só o cartão público (nome, time e status,
  os mesmos dados do QR).
- **Não faz:** alterar a chave Pix e o valor da mensalidade (só o admin, para ninguém desviar
  os pagamentos), promover cargos, nem reativar um jogador inativo.
- Tudo isso é imposto nas regras do Firestore (`firestore.rules`), não só escondido na tela.
 

## Cargo de organizador

O admin delega em **Admin: Cargos**.

- **Faz:** criar jogos, editar nome/data e os valores cobrados (em dinheiro e em créditos) e
  abrir/encerrar inscrições. Vê quem está inscrito em cada jogo.
- **Não faz:** inscrever ou cancelar jogadores (isso mexe em créditos/dinheiro, é do tesoureiro),
  ver pagamentos, créditos e extrato, alterar a chave Pix, ver dados pessoais, apagar jogos
  nem alterar cargos.
- Alterar o valor de um jogo vale para as próximas inscrições; quem já se inscreveu mantém o que
  foi cobrado.

## Testes das regras do Firestore

As regras foram verificadas contra o Firebase com a API de testes de regras (28 casos: o que
organizador, tesoureiro, admin e jogador podem e não podem fazer, incluindo gastar créditos
sem inflar o saldo). O script é descartável e não está no repositório; refaça-o ao mudar
permissões.

## Ícones do app

Os ícones em `public/pwa-192x192.png`, `public/pwa-512x512.png`,
`public/apple-touch-icon.png` e `public/favicon.svg` são placeholders sólidos
gerados por `scripts/gen-icons.cjs`. Troque pelos arquivos da logo oficial da
AACN quando disponíveis (mesmos nomes de arquivo, mesmas dimensões).
