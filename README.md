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

> **Foto 3x4 adiada.** O Firebase Storage passou a exigir o plano pago Blaze
> (cartão vinculado) para criar um bucket novo, mesmo dentro da faixa
> gratuita de uso. Por decisão da associação, o upload de foto fica desligado
> por enquanto — o campo `fotoUrl` já existe no cadastro do jogador e a
> carteirinha/painel admin mostram a foto se ela existir, então é só reativar
> depois: reinstalar `firebase/storage`, restaurar `storage.rules` no
> `firebase.json` e recriar o componente de upload (havia um em
> `src/components/PhotoUploader.tsx`, removido neste commit).

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

## 6. Criar o primeiro administrador

Não existe convite de admin pelo app (por segurança). Depois que alguém se
cadastrar normalmente pelo app, abra o Firestore no console do Firebase,
encontre o documento em `players/{uid}` dessa pessoa e mude o campo `role` de
`"player"` para `"admin"`. A partir daí, essa pessoa também pode promover
outros admins pela própria tela **Admin: Jogadores**.

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

## Ícones do app

Os ícones em `public/pwa-192x192.png`, `public/pwa-512x512.png`,
`public/apple-touch-icon.png` e `public/favicon.svg` são placeholders sólidos
gerados por `scripts/gen-icons.cjs`. Troque pelos arquivos da logo oficial da
AACN quando disponíveis (mesmos nomes de arquivo, mesmas dimensões).
