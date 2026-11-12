# Flesh to Chrome — nuvem

Infraestrutura das sprints de nuvem. O cliente do jogo continua em `flesh-to-chrome/`. A stack dev não abre zona DNS. A stack prod publica o domínio `nihil-legere-possum.lat`.

## O que a stack cria

Nas stacks `dev` e `prod`, em `sa-east-1`:

- tabelas DynamoDB `accounts`, `campaigns`, `matches`, `communications` e `audit`, uma por serviço
- Lambdas Node `conta`, `campanha`, `partidas`, `comunicacoes` e `auditoria`, cada uma com papel próprio e acesso só à sua tabela

Nas duas stacks, também:

- bucket S3 privado com o `index.html` de `frontend/` e distribuição CloudFront com Origin Access Control
- HTTP API com as rotas já implementadas pelas Lambdas: Conta, Campanha, Partidas, Comunicações e Auditoria
- permissão para o API Gateway invocar cada função, no formato de evento HTTP API v2

Na stack `prod`, também:

- zona pública Route 53 de `nihil-legere-possum.lat`, com NS e SOA exportados em `nameservers`
- CORS limitado a `https://nihil-legere-possum.lat` e `https://www.nihil-legere-possum.lat`

Com `flesh-to-chrome:publishDomain` em `false`, a prod para aí e publica CloudFront e HTTP API nos hostnames gerados pela AWS. Com `publishDomain` em `true`, depois da delegação do domínio, a mesma stack acrescenta:

- certificado ACM em `us-east-1` para o apex e `www`, usado pela CloudFront
- certificado ACM em `sa-east-1` para `api.nihil-legere-possum.lat`, usado pelo domínio regional da HTTP API
- aliases A e AAAA do apex e de `www` para a CloudFront, e alias A de `api` para o API Gateway

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

Na stack dev, o preview pode criar as tabelas, as Lambdas e os papéis IAM se essa stack ainda estiver vazia. Se ela já existir, esses recursos permanecem e o plano acrescenta o bucket, a CloudFront e a HTTP API. Não deve aparecer zona nova nem remoção da tabela `flesh-to-chrome-campanha`, da Lambda antiga ou da zona `flesh-to-chrome.negoci.online`.

Depois do `pulumi up` da dev, o output `frontend` é o host da CloudFront. Abra `https://` mais esse host: a página HTML tem de carregar. O bucket S3 não tem site público. No output `http_api`:

```bash
curl -sS "$HTTP_API/me"
curl -sS "$HTTP_API/auth/google/start"
```

A primeira resposta traz `UNAUTHENTICATED`. A segunda traz `NOT_READY`.

Produção segue em quatro passos. Antes do primeiro, confirme no registrador que `nihil-legere-possum.lat` está sob controle de quem vai delegar. O arquivo `Pulumi.prod.yaml` começa com `publishDomain: false`.

```bash
pulumi stack select prod --create
pulumi preview
pulumi up
pulumi stack output nameservers
```

Esse primeiro `up` cria a zona, a US$ 0,50 por mês, e não pede certificado. Copie os nameservers e delegue o domínio no registrador. Quando a delegação responder, mude `publishDomain` para `true` e rode `pulumi up` de novo. Aí entram os certificados, a validação DNS e os aliases. Não ligue `publishDomain` antes da delegação: o `up` fica esperando o certificado e estoura o tempo. A zona `flesh-to-chrome.negoci.online` não entra nesta stack.

As funções esperam o evento HTTP API v2 com `requestContext.authorizer.jwt.claims.sub`. Sem esse sujeito respondem 401. As rotas de Google em Conta respondem 503: Cognito não faz parte desta entrega.

## O que esta entrega não publica

- Cognito, login Google e authorizer JWT. A documentação deixa a identidade para a integração de login; as rotas privadas continuam recusando chamada sem `sub`.
- API Gateway WebSocket, ticket de conexão e o transporte da corrida. Continuam condicionados à decisão D04.
- Loja e rotas `/me/cosmetics`. O cronograma da loja segue pendente.
- O barramento do documento 12 (DynamoDB Streams, publicador e SQS). A campanha já grava o outbox na mesma transação do save. A Lambda de auditoria deduplica e persiste o evento quando recebe `{ "action": "ingest", "events": [...] }` por invocação direta. Essa invocação não está ligada a uma fila.
- E-mail SES. Falha de e-mail não bloqueia save nem partida.
- O build do jogo. A CDN publica só a página em `frontend/index.html`.
