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
- **Demais cargos (ex: tesoureiro):** o admin delega pelo app, em **Gestão → Cargos**, escolhendo o
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

**Endereço do app: https://aacn.web.app** (site `aacn` do Firebase Hosting). O endereço antigo
(`aacn-app.web.app`) só redireciona para o novo, mantendo o caminho; assim as carteirinhas já impressas, cujo QR
apontava para o endereço antigo, continuam funcionando. O `firebase.json` tem os dois sites; o antigo serve a pasta
`redirect/`. Quem instalou o app pelo endereço antigo deve instalar de novo pelo novo (e entrar de novo). O ID do
projeto (`aacn-app`) não muda: o Firebase não permite renomear o projeto.

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

**Validador do parceiro (`/validar`, sem login):** na tela inicial (login) há o botão
**"Sou parceiro: validar carteirinha"**. Ele abre a câmera, lê o QR da carteirinha do cliente e mostra na hora
foto, nome, time e se está **adimplente** (ou inadimplente/inativo) e o vencimento. Há também um campo para colar
o link/código caso a câmera não abra. A consulta usa só o cartão público (`publicCards`), sem dados pessoais.

## Mensalidade por Pix

- O admin cadastra a chave Pix, o nome/cidade do recebedor e o valor (ex: R$ 5,00)
  em **Admin: Pagamentos**.
- **A chave é normalizada** antes de ir para o código (os bancos exigem o formato exato): e-mail em **minúsculas** e sem espaços (`Fulano@Gmail.com` vira `fulano@gmail.com`; era a causa de um "copia e cola" recusado), CPF/CNPJ só com números, telefone como `+55DDDNÚMERO`, chave aleatória em minúsculas, e caracteres invisíveis (de colar do WhatsApp) removidos. Nome e cidade saem sem acento, em maiúsculas e sem espaço sobrando no corte. Em **Admin: Pagamentos** o admin vê a chave que o app envia e tem o painel **"Testar o Pix copia e cola"**: copia o código e cola no app do próprio banco para conferir antes dos jogadores usarem.
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
- **Inscrição e cobrança em dois momentos.** O jogador se inscreve em **Jogos** sem pagar nada
  (e pode cancelar enquanto não houver check-in). O débito só acontece **no dia do jogo**,
  quando a organização lê o QR da carteirinha dele (veja "Check-in por QR" abaixo). Se o saldo
  não cobre o jogo, o app avisa quanto falta e que dá para pagar em dinheiro no local.
- Admin/tesoureiro também podem inscrever alguém na hora (já com check-in) em **Gerenciar
  jogos → Inscritos**, e cancelar inscrições; ao cancelar uma presença paga com créditos, eles
  voltam (estorno) e a inscrição fica no histórico como "cancelada" (o jogador não consegue se
  reinscrever sozinho nesse jogo).
- **Extrato detalhado:** todo movimento de saldo (pagamento, inscrição, estorno, ajuste) vira
  uma linha com data, descrição, quem fez, valor e saldo após. O jogador vê o dele em **Jogos**;
  o admin vê o de qualquer um em **Admin: Créditos**. Nenhuma linha do extrato é editada (nem pelo admin) e cada uma é gravada no mesmo lote do saldo, então os
  dois nunca divergem. A única forma de apagar linhas é o **reset de dados de teste** (abaixo), só para o admin.
- **Ajuste manual:** em **Admin: Créditos**, o admin soma ou subtrai créditos de um jogador
  informando obrigatoriamente o motivo, que fica no extrato. Não deixa o saldo ficar negativo.
- Pagamento confirmado, crédito e mudança de vencimento são gravados juntos; confirmar duas
  vezes o mesmo pagamento é bloqueado.
- Segurança (`firestore.rules`): o jogador não altera o próprio saldo nem o extrato. Só
  admin e tesoureiro creditam/ajustam. O organizador só consegue debitar, no check-in: o saldo
  cai exatamente o custo do jogo e, no mesmo lote, a inscrição passa a "presente".
- Créditos não expiram.

## Cargo de tesoureiro

O admin delega o cargo em **Gestão → Cargos** (ver seção 6).

- **Vê e faz:** Pagamentos (confirmar Pix recebido), Jogos (criar jogos, inscrever e cancelar)
  e Créditos (extrato e ajuste de saldo). Confirmar pagamento, ajustar créditos e inscrever
  ficam registrados no extrato com o nome de quem fez.
- **Não vê:** a lista completa de jogadores, endereço, contato de emergência, condições médicas,
  times e cargos. Para escolher um jogador ele usa só o cartão público (nome, time e status,
  os mesmos dados do QR).
- **Não faz:** alterar a chave Pix e o valor da mensalidade (só o admin, para ninguém desviar
  os pagamentos), promover cargos, nem reativar um jogador inativo.
- Tudo isso é imposto nas regras do Firestore (`firestore.rules`), não só escondido na tela.
 

## Carteirinha impressa

- Em **Minha carteirinha**, o botão "Imprimir carteirinha" gera uma folha A4 com frente e verso lado
  a lado, cada um com **85,6 x 54 mm** (tamanho de cartão de crédito). Imprima em **tamanho real
  (100%)**, sem "ajustar à página", recorte na linha tracejada externa, dobre na linha do meio e
  plastifique. Na tela só a **frente** aparece; as instruções e o **verso** só aparecem na impressão.
- **Frente:** logo da AACN, foto 3x4, nome, nascimento, **membro desde** (data do cadastro, que é a
  data de emissão), time (com a logo do time, se houver) e o QR Code. Não há validade na carteirinha, e
  a situação da mensalidade **não** é impressa (muda com o tempo); quem lê o QR vê a situação atual.
- **Verso:** "Base legal: airsoft (armas de pressão)", para esclarecimento em caso de abordagem, com a
  norma e o artigo de cada ponto, e abaixo a conduta do associado. O texto está em
  `src/lib/regulamento.ts` e foi conferido em 10/2026 contra:
  - Portaria nº 02-COLOG/2010 (Comando Logístico do Exército), art. 2º, II e parágrafo único
    (airsoft é arma de pressão), art. 13, §§2º e 3º (comprovante de origem; não conduzir
    ostensivamente) e art. 18 (ponta do cano laranja/vermelha);
  - Decreto nº 11.615/2023, art. 11, §1º, na redação do Decreto nº 12.345/2024 (uso permitido de armas
    de pressão até 6,35 mm). Texto oficial:
    https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/decreto/d12345.htm;
  - Portaria nº 56-COLOG/2017, art. 2º (pessoa física dispensada de registro para usar armas de
    pressão). Texto no site do Exército (SGEx):
    http://www.sgex.eb.mil.br/sg8/006_outras_publicacoes/07_publicacoes_diversas/06_comando_logistico/port_n_056_colog_05jun2017.html.
  **Cuidados:** a Portaria 02/2010 foi lida em bases de legislação (não no Diário Oficial) e cita o
  R-105, que já foi substituído; não consegui abrir a página do Exército (DFPC) para confirmar se
  segue integralmente vigente. A carteirinha é um esclarecimento, **não** substitui documento oficial
  nem garante a liberação numa abordagem. A diretoria deve confirmar com advogado ou com o Exército
  (DFPC) antes de imprimir e revisar quando houver norma nova. O texto precisa caber no cartão
  (a ~5 pt, 5 pontos legais e 6 regras curtas).

## Cadastro obrigatório

Para usar a carteirinha, os jogos e a área do time, o jogador precisa preencher: nome completo,
**CPF**, foto 3x4, endereço (rua e número), **bairro**, **CEP**, data de nascimento, **celular** (com DDD), nome e telefone do contato de
emergência. Enquanto faltar algo, o app leva para **Meus dados** e lista o que falta. Condições
médicas continuam opcionais. A regra é aplicada na tela (não nas regras do banco).

**CPF:** é pedido já na tela **Criar conta** e também em **Meus dados** (e o admin edita na ficha do jogador). O app
confere os dois dígitos verificadores (não aceita CPF inventado nem números repetidos) e guarda só os 11 dígitos;
as regras do banco só aceitam esse formato. Ele fica no cadastro, que só o próprio jogador e o admin leem: **não** vai
para o cartão público, para a cópia da tesouraria nem para a carteirinha impressa; sai na planilha de associados
(admin). **CPF repetido é bloqueado**: cada CPF vira um documento `cpfs/<11 dígitos>` (o id único impede o segundo cadastro). O documento é criado/trocado no mesmo lote do cadastro (as regras amarram: só vale se o cadastro passa a ter aquele CPF, e o antigo é liberado); só o dono e o admin leem o próprio documento (ninguém consegue "sondar" quais CPFs existem). Ao criar a conta com CPF já usado, a conta de acesso recém-criada é desfeita e o app avisa; em Meus dados e na ficha do admin aparece o aviso de CPF em uso. Excluir o jogador ou a própria conta libera o CPF. Limite: o aviso de "CPF em uso" vem da recusa do banco (não dá para consultar antes sem expor a lista). Jogadores antigos, sem CPF,
são levados a Meus dados para informar. A versão do termo foi para `2026-10-v2` (o CPF entrou na lista de dados
coletados), então todos aceitam o termo de novo.

## Recuperar senha

Na tela de login, "Esqueci minha senha" envia o link de redefinição pelo Firebase Auth (e-mail em
português, `auth.languageCode = 'pt-BR'`). A mensagem de confirmação é a mesma exista ou não a
conta. O texto/remetente do e-mail pode ser personalizado em Authentication → Templates no console.

## Termo de responsabilidade e LGPD

- No cadastro é obrigatório aceitar o **termo de responsabilidade** e a **política de privacidade**
  (página pública `/termos`). O aceite grava a versão (`VERSAO_TERMOS`, em `src/lib/termos.ts`) e a
  data do servidor (as regras do banco impedem datar para trás). O admin vê o aceite no cadastro do
  jogador.
- Se o texto mudar, altere `VERSAO_TERMOS`: todos precisam aceitar de novo (o app bloqueia a
  carteirinha, os jogos e o time até aceitarem).
- **Menores de 18 anos:** o cadastro pede nome e telefone do responsável legal e a autorização dele
  (marcada por quem cadastra).
- **Os textos são um modelo geral.** A diretoria deve revisar com um advogado antes de usar. O aceite
  eletrônico de menores pode não bastar juridicamente; considere também um termo impresso assinado
  pelo responsável.

## Carteirinha sem internet

O app guarda um cache dos dados no aparelho (cache persistente do Firestore) e o service worker
guarda o próprio app. Depois de abrir a carteirinha com internet pelo menos uma vez, ela e o QR abrem
sem sinal (aparece um aviso "Sem conexão"). Alterações feitas offline são enviadas quando a internet
volta. O check-in da organização e a leitura do QR por parceiros continuam precisando de internet.
Não foi possível testar o modo offline de ponta a ponta no ambiente de desenvolvimento; teste no
celular (abra a carteirinha, ative o modo avião e abra de novo).

## Jogos completos: local, horário, vagas e lista de espera

- Ao criar/editar um jogo (**Gestão → Gerenciar jogos**) dá para informar horário, local, link do mapa
  (só http/https), descrição e **vagas** (vazio = sem limite). O jogador vê tudo em **Jogos**, com
  "Ver no mapa" e "12/20 vagas preenchidas".
- **Limite de vagas sem servidor:** o jogo guarda contadores (`inscritos`, `espera`) que o jogador só
  consegue mexer de um em um, junto com a própria inscrição, e nunca acima do limite (regras do banco,
  conferidas por teste). Se o jogo lota, o botão vira **Entrar na lista de espera**.
- Quem desiste (ou sai da espera) devolve a vaga. **Chamar da lista de espera** é manual: em
  Gerenciar jogos → Inscritos, "Chamar para o jogo" (admin, tesoureiro ou organizador). O check-in só vale
  para inscritos, não para quem está na espera.
- **Lista para WhatsApp** (Gestão → Gerenciar jogos → Inscritos, para admin, tesoureiro e organizador): gera o texto
  com nome, local, data, "chegada às", valor em dinheiro, valor em créditos e a "Lista de operadores" numerada na
  ordem das inscrições (nome primeiro e time depois: "Nome - Time", para quem tem time aprovado) (a lista de espera vem separada, se houver). No fim vai "Se inscreva pelo link:" com o endereço do jogo (`/jogos?jogo=<id>`): quem abre já cai na tela de Jogos, rolada até aquele jogo e destacada. Quem não está logado entra (ou se cadastra) e volta para o jogo; se as inscrições já fecharam, aparece um aviso. O texto pode ser editado; "Copiar texto" ou
  "Enviar no WhatsApp" (abre o WhatsApp para escolher o grupo; o WhatsApp não permite escolher o grupo por link).
- **Exportar inscritos (CSV)** por jogo: jogador, situação, forma de pagamento, créditos, quando e por quem
  fez o check-in (abre no Excel/Sheets).
- Se uma disputa de última vaga acontecer ao mesmo tempo, quem perde recebe um aviso e pode entrar na espera.

## Painel e relatórios

**Gestão → Painel e relatórios** (admin e tesoureiro): total de associados, em dia, inadimplentes (e % dos
ativos), receita do mês, receita dos últimos 6 meses, presença nos últimos jogos e membros por time.
**Exportar planilhas (CSV)** (abrem no Excel/Planilhas): pagamentos, presença por jogo e, só para o admin,
associados (nome, e-mail, celular, nascimento, time, situação, vencimento; pede confirmação por conter
dados pessoais, não inclui endereço nem dados de saúde). As planilhas neutralizam fórmulas para evitar
injeção quando abertas no Excel.

## Parceiros com desconto

- **Gestão → Parceiros** (admin): cadastra estabelecimentos com logo, categoria, benefício (ex: "10% em
  BBs"), condições, endereço, telefone/WhatsApp, link (Instagram/site, só http/https) e se a parceria
  está ativa.
- **Aba Parceiros** (todos os logados): lista com busca e filtro por categoria e aviso se a mensalidade do
  associado está em dia (benefício vale para quem está em dia; o parceiro confere lendo o QR).

## Resetar dados de um jogador (testes)

Na **ficha do jogador** (Admin: Jogadores > clicar no jogador), no fim da página, o painel **Resetar dados (testes)**
deixa o **admin** apagar, parte por parte, os dados que sobraram de testes. Cada parte vem com uma caixa para marcar
(e há "Marcar tudo"); antes de apagar o app pede confirmação, e não dá para desfazer:

- **Extrato e saldo de créditos:** apaga todos os lançamentos (inclusive bônus) e zera o saldo.
- **Conquistas (selos):** apaga os selos. Se as metas ainda forem atingidas, o jogador resgata de novo (e recebe o
  bônus de novo) ao abrir o app. Para recomeçar do zero, marque também o extrato e os jogos/mensalidades.
- **Inscrições e presenças em jogos:** apaga as inscrições/check-ins, ajusta as vagas dos jogos e zera os
  contadores de jogos e de jogos noturnos.
- **Pagamentos e mensalidade:** apaga os pagamentos Pix, volta para inadimplente (sem vencimento) e zera o
  contador de mensalidades.

Cadastro, foto, cargo e time **não** são tocados. As regras do banco só deixam o admin apagar extrato, conquistas e
pagamentos (tesoureiro, organizador e jogador não).

## Ver e imprimir a carteirinha de outros jogadores

**Admin e tesoureiro** têm o item **Carteirinhas** (menu de gestão, em Tesouraria): buscam o jogador por nome ou time,
veem a carteirinha dele (a mesma da impressão) e imprimem. No admin também há o atalho **"Ver e imprimir a
carteirinha"** na ficha do jogador. O tesoureiro não lê o cadastro, então o **nascimento** e o **membro desde**
vêm de uma cópia (`contatos/{uid}`, a mesma do celular de cobrança), que o jogador atualiza ao abrir o app e que o
admin repõe sozinho ao abrir as telas Cobranças ou Carteirinhas. Se a cópia ainda não existe, o tesoureiro vê um
aviso para o jogador abrir o app uma vez. As regras exigem que a cópia seja igual ao cadastro (ninguém inventa a
data de nascimento ou o "membro desde").

## Excluir jogador, excluir a própria conta e excluir jogo

**Admin exclui um jogador** (ficha do jogador, painel "Excluir jogador", confirmando com o nome): apaga cadastro,
cartão público, contato, carteira, contadores, conquistas, inscrições/presenças (as vagas dos jogos voltam) e pedidos
de time; se era representante, o time fica sem representante. Há a opção **"Manter registros financeiros"**
(marcada por padrão): pagamentos Pix e extrato ficam guardados. Admins (cargo definido no console) não são excluídos
pelo app. **Limite:** o app não consegue apagar o e-mail/senha do jogador no Firebase Authentication (isso exige
servidor ou o console). Se ele entrar de novo, vê a tela **"Cadastro excluído"**, que oferece criar o cadastro do
zero; para bloquear de vez, apague o usuário em Authentication no console do Firebase.

**O jogador exclui a própria conta** (Meus dados, no fim da página): pede a senha de novo e uma confirmação. Cancela
as inscrições ainda sem check-in, apaga cadastro, foto, contato e cartão público e, por fim, a conta de acesso.
Pagamentos, extrato e presenças em jogos já realizados ficam com a associação (registro financeiro/histórico).
Quem é representante de time precisa pedir ao admin para trocar o representante antes. Admin não exclui a própria
conta pelo app.

**Excluir jogo** (Admin: Jogos, botão "Excluir", só admin e tesoureiro; o organizador não vê): apaga o jogo e todas as
inscrições; quem já jogou e pagou com créditos recebe o **estorno** no extrato e a presença sai dos contadores
(jogos e jogos noturnos). Os bônus de conquista já pagos não são retirados.

## Meu histórico e conquistas

**Histórico** (todos): jogos jogados, frequência (presenças ÷ presenças + faltas em jogos já passados),
mensalidades pagas e total, créditos recebidos/usados e as **conquistas**. Ranking entre associados não foi
feito (precisaria de contadores públicos de presença).

**Conquistas com bônus de créditos.** Cada conquista paga um bônus **único** em créditos de jogo, que cai sozinho
na carteira (e aparece no extrato como "Bônus") assim que ela é atingida:

| Conquista | Meta | Bônus |
| --- | --- | --- |
| Primeiro jogo | 1 jogo | 5 |
| Em campo | 5 jogos | 10 |
| Veterano | 10 jogos | 15 |
| Lenda | 25 jogos | 20 |
| Assíduo | frequência ≥ 80% (a partir de 5 jogos) | 20 |
| Em dia | 3 mensalidades pagas | 30 |
| 1 ano de AACN | 1 ano de associado | 100 |
| Parte de um time | membro aprovado de um time | 5 |
| Primeiro noturno | 1 jogo noturno | 5 |
| Na penumbra | 5 jogos noturnos | 5 |
| Na escuridão | 10 jogos noturnos | 10 |
| Senhor das sombras | 25 jogos noturnos | 20 |

Jogo **noturno** = jogo com horário de início **às 18:00 ou depois** (jogo sem horário não conta como noturno).
Conta como "jogo jogado" quem teve o **check-in** feito.

Os selos das conquistas aparecem em **Minha carteirinha**, em **Meus dados** e na ficha do jogador (admin).

Como é seguro sem servidor: o app só soma os bônus se as regras do banco confirmarem. Os contadores
(`stats/{uid}`: jogos, noturnos, mensalidades) só são incrementados pela organização/tesouraria, no mesmo lote do
check-in e da confirmação de mensalidade (o organizador só pode somar 1 jogo por check-in, com a presença
passando de "ativa" para "presente"). O resgate cria o documento `conquistas/{uid}_{id}` (um por jogador e conquista,
nunca editado nem apagado), soma exatamente o bônus na carteira e lança no extrato, tudo em um lote que as regras
amarram. Os valores e metas estão em `src/lib/conquistas.ts` **e** em `firestore.rules` (mude nos dois).
Se a diretoria remover uma presença, o contador desce, mas bônus já pagos continuam com o jogador.
Limite conhecido: o banco não consegue contar **faltas**, então no **Assíduo** ele confere só os 5 jogos; o
percentual de 80% é calculado no app.

## Barra de navegação

A aba **Solicitações do time** só aparece para quem é representante de algum time.

## Cobrança pelo WhatsApp

- Em **Gestão → Cobranças** (admin e tesoureiro) aparecem os associados com a mensalidade vencida
  ou que vence em até 7 dias (filtros Todos/Vencidos/Vencendo). O botão **Cobrar no WhatsApp** abre
  a conversa com a mensagem pronta (nome, valor, data e o caminho para pagar) e registra a
  "última cobrança" (data e quem cobrou).
- Para isso a tesouraria enxerga o **celular** dos associados em uma coleção separada (`contatos`),
  que é um espelho do celular do cadastro, gravado só pelo próprio jogador. Endereço, saúde e
  contato de emergência continuam fora do alcance da tesouraria.
- No perfil do jogador, se o time tem WhatsApp cadastrado, aparece **Avisar o time pelo WhatsApp**
  enquanto o pedido de entrada está pendente (não depende do e-mail automático, que exige o Blaze).

## Mural de avisos e lembrete de mensalidade

- **Gestão → Avisos** (admin, tesoureiro e organizador): publica avisos (título, texto, fixar no
  topo) e apaga. Todos os logados veem os avisos no topo de **Minha carteirinha** (fixados primeiro).
- A carteirinha mostra um lembrete quando a mensalidade venceu ou vence em até 7 dias, com o botão
  "Pagar agora".

## Times: perfil, logo e membros

- **Aba "Times"** (barra de cima, para todos os logados): mostra os times com logo, cidade e número
  de membros. Ao clicar, abre o **perfil do time**: logo, cidade, data de criação (com há quantos
  anos), responsável, redes sociais (botões que abrem o perfil) e a lista de membros com foto.
- **Botão "Editar time":** no perfil do time, em **Gestão → Times** (admin) e em **Solicitações do
  time** (representante). Campos: logo, data de criação, cidade, nome do responsável e redes sociais.
  Nas redes, o time marca só as que tem (Instagram, Facebook, YouTube, TikTok, WhatsApp, X, Discord,
  site) e informa o @usuário, o número (WhatsApp) ou o link; só aparecem no perfil as marcadas.
- **Responsável:** o campo sugere os jogadores cadastrados (digite para escolher; também aceita texto
  livre). Se o time não tem responsável, entra automaticamente o representante; ao definir um
  representante em Gestão → Times, ele já vira o responsável se o campo estiver vazio.
- **Representante vale na hora:** quando o admin escolhe o representante em Gestão → Times, ele passa a ter acesso
  imediato (aba Solicitações do time, aprovar/recusar, Editar time), sem aceitar nada e mesmo com o cadastro
  incompleto ou o termo pendente (isso só bloqueia a carteirinha, os jogos e o time dele como jogador). Quem
  deixa de ser representante perde o acesso na hora. **O representante também vira membro do time que lidera**
  (aprovado automaticamente, e o pedido pendente dele, se houver, é aprovado), a menos que já seja membro de
  outro time; nesse caso ele continua no outro time, mas aparece no perfil do time que lidera com a etiqueta
  "Representante" e conta na lista de membros.
- **Quem edita:** o admin edita tudo (inclusive o nome do time); o representante edita só o perfil do
  próprio time. A logo é reduzida (até 192 px, ~10–40 KB) e guardada no Firestore.
- **Links seguros:** só são aceitos endereços http/https (ou @usuário/número); `javascript:`, `data:`
  e similares são recusados.
- **Membros** são os jogadores com o time aprovado pelo representante. A lista vem do cartão público
  (nome e foto), que agora guarda o `timeId` do time aprovado. Quem já era membro antes desta versão
  aparece na lista no próximo login. **Mudança de privacidade:** listar todos os cartões públicos agora
  exige estar logado; abrir **um** cartão pelo QR continua sem login.

## Check-in por QR (dia do jogo)

Disponível em **Gestão → Check-in por QR** para admin, tesoureiro e organizador.

1. Escolha o jogo (por padrão vem o mais próximo de hoje).
2. Toque em "Ligar câmera e ler QR" e aponte para o QR da carteirinha do jogador (no celular
   dele ou impressa). Se a câmera não funcionar, cole o link/código no campo ao lado ou use
   "Fazer check-in" na lista de inscritos.
3. Aparecem foto, nome, situação da mensalidade e saldo. Confira a foto e o nome com a pessoa e
   toque em **Debitar X créditos e confirmar presença** (ou **Recebi em dinheiro**, quando o saldo
   não cobre). O débito, o extrato e a presença são gravados juntos, uma única vez por jogador.
4. A lista de inscritos mostra quem já está presente e como pagou.

O QR da carteirinha é público (é o mesmo link de verificação dos parceiros). Por isso o app
mostra a foto e o nome para conferência visual antes de cobrar. A câmera exige HTTPS (o site
publicado já é).

## Cargo de organizador

O admin delega em **Gestão → Cargos**.

- **Faz:** criar jogos, editar nome/data e os valores cobrados (em dinheiro e em créditos),
  abrir/encerrar inscrições, ver quem está inscrito e fazer o **check-in por QR** no dia do jogo
  (marca presença e debita os créditos, ou registra que recebeu em dinheiro). Vê o saldo da pessoa
  no momento do check-in.
- **Não faz:** inscrever ou cancelar jogadores, ajustar saldo, confirmar pagamentos Pix, ver o
  extrato, alterar a chave Pix, ver dados pessoais, apagar jogos nem alterar cargos.
- Alterar o valor de um jogo vale para as próximas inscrições; quem já se inscreveu mantém o que
  foi cobrado.

## Testes das regras do Firestore

As regras foram verificadas contra o Firebase com a API de testes de regras (311 casos: o que
organizador, tesoureiro, admin e jogador podem e não podem fazer, incluindo o check-in e a
proteção do saldo). O script é descartável e não está no repositório; refaça-o ao mudar
permissões.

## Ícones do app

Os ícones em `public/pwa-192x192.png`, `public/pwa-512x512.png`,
`public/apple-touch-icon.png` e `public/favicon.svg` são placeholders sólidos
gerados por `scripts/gen-icons.cjs`. Troque pelos arquivos da logo oficial da
AACN quando disponíveis (mesmos nomes de arquivo, mesmas dimensões).
