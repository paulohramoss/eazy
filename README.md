# Eazy Finance

Controle financeiro pessoal: transações, carteiras, cartões de crédito, orçamento
por categoria, objetivos, investimentos com cotações ao vivo, calendário,
recorrências e relatórios. Busca global (Ctrl/⌘+K), comprovantes anexados às
transações, interface em português, inglês e espanhol. React 19 + Vite, Firebase
(Auth/Firestore/Storage/FCM), funções serverless na Vercel. Instalável como PWA.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha os valores (veja abaixo)
npm run dev
```

As funções em `api/` não rodam no servidor do Vite. Para exercitar e-mail,
cotações e o cron, rode a Vercel em paralelo:

```bash
npx vercel dev --listen 5175
```

O front aponta para `http://localhost:5175` em dev; mude com `VITE_API_BASE`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run preview` | serve o build |
| `npm run lint` | ESLint |
| `npm test` | testes (Vitest) |
| `npm run check` | lint + testes + build, igual ao CI |

## Variáveis de ambiente

Tudo está documentado em [`.env.example`](.env.example). Em resumo:

- **`VITE_FIREBASE_*`** — config do cliente. Não são segredos: o Firebase as
  expõe no bundle por design, e quem protege os dados são as regras do
  Firestore/Storage. Ficam em env só para separar ambientes. Há fallback para o
  projeto atual, então o build funciona sem `.env`.
- **`BOLSAI_API_KEY`** — segredo. Cotações de ações e FIIs. Sem prefixo `VITE_`
  justamente para nunca entrar no bundle.
- **`SMTP_USER` / `SMTP_PASS`** — segredo. Use uma
  [App Password do Google](https://myaccount.google.com/apppasswords), nunca a
  senha da conta.
- **`FIREBASE_SERVICE_ACCOUNT`** — segredo. JSON da service account, numa linha.
  Usado para validar o ID token nas funções e pelos jobs agendados.
- **`CRON_SECRET`** — segredo. Protege `/api/cron/daily`.
- **`ALLOWED_ORIGINS`** — origens aceitas pelas funções. Em dev, `localhost`
  entra automaticamente.

> **Atenção:** versões anteriores deste repositório traziam a senha do Gmail em
> `api/send-email.js` e a chave da Bolsai em `vite.config.js`. Ambas continuam no
> histórico do git — **troque as duas credenciais** se ainda não trocou.

## Arquitetura

```
src/
  context/     AuthContext (login) e AppContext (dados + regras de negócio)
  components/  uma tela por arquivo, carregadas sob demanda
  styles/      CSS por área, importado em ordem por App.css
  utils/       funções puras: saldos, datas, parcelas, CSV, roteador
  i18n/        dicionários pt-BR / en-US / es e os formatadores
  __tests__/   smoke test de render de todas as telas
api/
  _lib/        Firebase Admin, CORS+auth, mailer, datas do servidor
  cron/        job diário
scripts/       auditoria de documentos legados
```

**Estado.** `AppContext` assina as coleções do Firestore e expõe dados e ações.
O provider é montado com `key={user.uid}`: trocar de conta desmonta tudo, então
nada da conta anterior sobrevive em memória.

**Saldos.** A regra vive em `src/utils/balances.js`, fora do React, e é a mesma
em toda tela. Por padrão o saldo para em hoje — parcela ou recorrência com data
futura só aparece quando a tela pede uma projeção explícita.

**Rotas.** Roteador por hash em `src/utils/router.js` (~40 linhas, sem
dependência). Cada tela tem URL, botão voltar e deep link — de que as
notificações dependem.

**Recorrências.** Uma regra em `recurrences`, não N cópias. O job diário gera as
ocorrências; as transações apontam de volta por `recurrenceId`. Parcelamento
continua materializado, porque é um conjunto fechado desde o início.

**Idiomas.** `settings.language` decide os textos E o locale de datas, números e
moeda — que são coisas separadas de `settings.currency`, porque acompanhar uma
carteira em dólar morando no Brasil é legítimo. O tradutor é a função `t` do
`useApp()`; o `pt.js` é a referência e um teste garante que `en` e `es` nunca
fiquem com chave faltando. A tela de login e os toasts ficam fora do
`AppProvider` e usam `createTranslator(detectLanguage())`.

**CSS.** `App.css` só faz `@import` dos arquivos em `src/styles/`, na ordem
original — a cascata depende dela, então arquivos novos entram no fim.

**Gráficos.** Vivem em `src/components/charts/`. A matemática (escala, ticks,
geometria de arco) fica isolada em `geometry.js`, sem React, porque é ali que
nascem NaN e fatia degenerada — e assim dá para testar sem montar a árvore.

Para conferir o visual sem precisar logar e semear dados, `npm run dev` serve
**`/preview.html`**: todos os gráficos, skeletons e estados vazios numa página
só, com os casos-limite que já quebraram algo (mês único, tudo zero, fatia de
0,03%, valor de sete dígitos). Aceita `?theme=dark` e `?lang=en-US`. É dev-only
— o build de produção tem uma entrada só, `index.html`.

As cores de dados são tokens em `styles/charts.css` e **não são escolha de
gosto**: passaram pelo validador de paletas (banda de luminosidade, piso de
croma, separação para daltonismo, contraste contra a superfície). A paleta
anterior reprovava — tinha um lima com 1,27:1 de contraste e o par
verde/vermelho a ΔE 6,1 sob deuteranopia, quase indistinguível justamente nas
duas cores mais importantes do app. Hoje o par está em ΔE 9,2 (claro) e 9,7
(escuro). Se for mexer nelas, rode o validador de novo.

Cuidado com uma distinção: as listas `COLORS`/`PRESET_COLORS` nos formulários
são **seletores** de cor para o usuário decorar uma carteira ou um ativo. Não
são codificação de dados e não seguem as mesmas regras.

## Segurança

- Regras do Firestore validam **quem** escreve (`allowedUsers`) e **o quê**:
  tipo dos campos, faixa dos valores, tamanho das strings. `userId` e
  `allowedUsers` são imutáveis depois da criação.
- As funções serverless exigem Firebase ID token, restringem CORS a
  `ALLOWED_ORIGINS` e têm rate limit por usuário.
- `/api/send-email` só envia para o e-mail da própria conta — sem isso era um
  relay aberto.
- O cadeado biométrico é uma trava local de conveniência, **não** uma camada de
  segurança: quem controla o navegador contorna. Os dados são protegidos pelo
  login e pelas regras.

## Notificações

Em primeiro plano, `src/notifications.js` dispara na hora do evento (transação,
orçamento estourado, limite do cartão). O que não depende do app aberto —
fechamento e vencimento de fatura, lembrete de objetivos, relatório semanal e
mensal — roda em `api/cron/daily.js`, agendado pelo bloco `crons` do
`vercel.json`.

O job é idempotente: cada envio grava uma marca em
`users/{uid}/notificationLog`, então reexecutar não duplica aviso. Para testar à
mão:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://SEU-APP/api/cron/daily
```

O plano Hobby da Vercel permite um cron por dia; o job faz tudo numa passada só.

## Deploy

Firebase (regras):

```bash
npx firebase deploy --only firestore:rules,storage
```

Vercel: conecte o repositório e cadastre as variáveis de ambiente em Settings →
Environment Variables. `vercel.json` cuida do rewrite do proxy e do agendamento.

## Testes

Vitest cobre a matemática que mais dói quando erra: saldos, divisão de parcelas
(a sobra de centavos), aritmética de datas com meses curtos e ano bissexto,
parsing de CSV e completude dos dicionários de tradução.

```bash
npm test
```

As regras do Firestore têm suíte própria, rodada contra o emulador — 39 casos
cobrindo isolamento entre contas, imutabilidade do dono e validação de conteúdo,
incluindo os formatos exatos que cada formulário do app grava. Exige Java:

```bash
npm run test:rules
```

## Manutenção

Documentos gravados antes da validação de campos nas regras (por exemplo com
`amount` em texto) continuam legíveis, mas qualquer update passa a ser negado.
Para descobrir e corrigir:

```bash
npm run audit:legacy          # só relata
npm run audit:legacy -- --fix # corrige o que dá para converter
```

## Limitações conhecidas

- O rate limit das funções é por isolate, em memória. Corta abuso simples, mas
  um limite global exigiria um store compartilhado.
- O canal de SMS aparece nas preferências mas não tem entrega implementada — só
  push e e-mail funcionam de fato.
- Os comprovantes só podem ser anexados a uma transação já salva, porque o
  caminho no Storage é derivado do id dela.
- Os gráficos são SVG próprio, sem biblioteca. Cobrem o que o app precisa
  (barras agrupadas, linha com área, donut); qualquer forma nova — dispersão,
  candle, mapa — pede uma biblioteca em vez de crescer isto.
- A importação de CSV assume dia antes de mês em datas ambíguas (`03/04/2026` é
  3 de abril), que é a convenção local.
