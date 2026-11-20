# Flesh to Chrome — nuvem

Infraestrutura das sprints de nuvem. O cliente do jogo continua em `flesh-to-chrome/`. A stack dev não abre zona DNS. A stack prod publica o domínio `nihil-legere-possum.lat`.

## O que a stack cria

Nas stacks `dev` e `prod`, em `sa-east-1`:

- tabelas DynamoDB `accounts`, `campaigns`, `matches`, `communications` e `audit`, uma por serviço
- Lambdas Node `conta`, `campanha`, `partidas`, `comunicacoes` e `auditoria`, cada uma com papel próprio e acesso só à sua tabela

Nas duas stacks, também:

- bucket S3 privado com o build Parcel de `flesh-to-chrome/` e distribuição CloudFront com Origin Access Control
- HTTP API com as rotas já implementadas pelas Lambdas: Conta, Campanha, Partidas, Comunicações e Auditoria
- User Pool Cognito, cliente e authorizer JWT nas rotas privadas; o provedor Google só entra se `googleClientId` e `googleClientSecret` estiverem configurados
- permissão para o API Gateway invocar cada função, no formato de evento HTTP API v2
- permissão da Conta para invocar Comunicações, e da Comunicações para enviar e-mail pelo SES

Na stack `prod`, também:

- zona pública Route 53 de `nihil-legere-possum.lat`, com NS e SOA exportados em `nameservers`
- CORS limitado a `https://nihil-legere-possum.lat` e `https://www.nihil-legere-possum.lat`

Com `flesh-to-chrome:publishDomain` em `false`, a prod para aí e publica CloudFront e HTTP API nos hostnames gerados pela AWS. Com `publishDomain` em `true`, depois da delegação do domínio, a mesma stack acrescenta:

- certificado ACM em `us-east-1` para o apex e `www`, usado pela CloudFront
- certificado ACM em `sa-east-1` para `api.nihil-legere-possum.lat`, usado pelo domínio regional da HTTP API
- aliases A e AAAA do apex e de `www` para a CloudFront, e alias A de `api` para o API Gateway
- identidade SES do domínio, com os registros DKIM na zona, e remetente `noreply@nihil-legere-possum.lat`

A stack dev usa o HTTPS dos hostnames gerados pela AWS. O CORS dela aceita qualquer origem, para o teste local. Ela não pede certificado do domínio e não cria zona.

Não há stack com outro nome. AWS SAM não está na especificação da sprint 1; o desenvolvimento em nuvem desta entrega é Pulumi.

## Ambiente

Variáveis no shell ou no Codespace:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_DEFAULT_REGION=sa-east-1`
- `PULUMI_ACCESS_TOKEN`

Também é preciso Pulumi CLI, Python 3, Node.js e `pulumi login`.

## Rodar

```bash
cd pulumi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pulumi stack select dev --create
pulumi preview
pulumi up
```

Na stack dev, o preview instala e gera o build do jogo antes de mostrar o plano. Se a stack já existir, as tabelas e as Lambdas permanecem. O plano acrescenta o Cognito, o authorizer e os arquivos do build, e atualiza as rotas privadas para exigir JWT. Não deve aparecer zona nova nem remoção da tabela `flesh-to-chrome-campanha`, da Lambda antiga ou da zona `flesh-to-chrome.negoci.online`.

Depois do `pulumi up` da dev, o output `frontend` é o host da CloudFront. Abra `https://` mais esse host: o jogo publicado tem de carregar. O bucket S3 não tem site público. No output `http_api`:

```bash
curl -sS -D - -o /dev/null "$HTTP_API/me"
curl -sS "$HTTP_API/auth/google/start"
```

A primeira resposta é 401 do API Gateway, porque a rota agora tem authorizer. A segunda traz `NOT_READY`, até existirem `googleClientId` e o segredo `googleClientSecret` nesta stack. Sem esses dois valores o login Google não é criado e nenhuma senha é aceita.

Produção segue em quatro passos. Antes do primeiro, confirme no registrador que `nihil-legere-possum.lat` está sob controle de quem vai delegar. O arquivo `Pulumi.prod.yaml` começa com `publishDomain: false`.

```bash
pulumi stack select prod --create
pulumi preview
pulumi up
pulumi stack output nameservers
```

Esse primeiro `up` cria a zona, a US$ 0,50 por mês, e não pede certificado. Copie os nameservers e delegue o domínio no registrador. Quando a delegação responder, mude `publishDomain` para `true` e rode `pulumi up` de novo. Aí entram os certificados, a validação DNS e os aliases. Não ligue `publishDomain` antes da delegação: o `up` fica esperando o certificado e estoura o tempo. A zona `flesh-to-chrome.negoci.online` não entra nesta stack.

As rotas privadas exigem o access token do Cognito, com escopo `openid`. ID token não passa. O início e o callback do Google, e a troca do ticket em `POST /auth/session`, continuam públicos. O `state` do login é aleatório, expira, só vale uma vez e precisa coincidir com o cookie da tentativa. O destino de retorno tem de ser a origem da CloudFront ou, na dev, `localhost:1234`.

No primeiro cadastro, a Conta grava o pedido de boas-vindas e só enfileira a Lambda de comunicações. O login não espera o SES. A nota do jogo e o e-mail têm estados separados. O envio reserva a tentativa antes de chamar o SES. Se a resposta ficar incerta, não há segundo envio até a reconciliação. Sem remetente, o e-mail fica pendente e o login segue. Na dev, o remetente opcional é `flesh-to-chrome:sesFromEmail`. Na prod, o remetente `noreply@nihil-legere-possum.lat` e a identidade SES só entram com `publishDomain` em `true`, no mesmo passo dos certificados. A permissão de envio aponta só para essa identidade.

O jogo publicado usa só o `cloud-config.json`. O parâmetro `?api=` só vale em `localhost` ou `127.0.0.1`, e só para uma API local ou a origem publicada. O ticket sai da URL antes da troca. Visitante não grava campanha no `localStorage` e não entra no multiplayer. O progresso de cada conta fica numa chave própria, mesmo se o token expirar no meio da fase. Se a sessão, a conta e a nuvem divergem, o menu pede escolha. Conflito 409 não sobrescreve. Se a nuvem não responder, as cópias locais ficam e a sincronização fica pendente.

## Google e remetente

O login Google só sai de `NOT_READY` com os dois valores abaixo. O segredo fica no Pulumi e não entra no Git.

No Google Cloud, crie um cliente OAuth do tipo aplicação web. Em URIs de redirecionamento autorizados, coloque somente:

`https://ftc-dev-legere.auth.sa-east-1.amazoncognito.com/oauth2/idpresponse`

Na pasta `pulumi`, com a stack `dev` selecionada:

```bash
pulumi config set flesh-to-chrome:googleClientId COLE_O_ID
pulumi config set --secret flesh-to-chrome:googleClientSecret
```

O callback da aplicação já é a rota `/auth/google/callback` da HTTP API. Não cole o segredo no chat nem no PR.

Para o e-mail na dev, use um endereço que você possa abrir e confirme o pedido de verificação no SES. O sandbox só entrega para destinatários verificados.

```bash
pulumi config set flesh-to-chrome:sesFromEmail seu-email@exemplo.com
```

## O que esta entrega não publica

- API Gateway WebSocket, ticket de conexão e o transporte da corrida. Continuam condicionados à decisão D04.
- Loja e rotas `/me/cosmetics`. O cronograma da loja segue pendente.
- O barramento do documento 12 (DynamoDB Streams, publicador, SQS e o feedback SNS). A boas-vindas fica gravada na conta e a Lambda de comunicações é chamada de forma assíncrona, com reserva da tentativa antes do SES. A campanha já grava o outbox na mesma transação do save. A Lambda de auditoria deduplica e persiste o evento quando recebe `{ "action": "ingest", "events": [...] }` por invocação direta. Essa invocação não está ligada a uma fila.
- Suíte de testes, integração contínua e deploy contínuo. Ficam para a entrega seguinte.
