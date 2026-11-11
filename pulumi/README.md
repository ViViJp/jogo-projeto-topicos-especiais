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

- zona pública Route 53 de `nihil-legere-possum.lat`
- certificado ACM em `us-east-1` para o apex e `www`, usado pela CloudFront
- certificado ACM em `sa-east-1` para `api.nihil-legere-possum.lat`, usado pelo domínio regional da HTTP API
- aliases A e AAAA do apex e de `www` para a CloudFront, e alias A de `api` para o API Gateway
- os registros NS e SOA da zona, exportados em `nameservers`

A stack dev usa o HTTPS que a CloudFront e o API Gateway já entregam nos hostnames gerados pela AWS. Ela não pede certificado do domínio e não cria zona.

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

Produção usa a outra stack:

```bash
pulumi stack select prod --create
pulumi up
```

As funções esperam o evento HTTP API v2 com `requestContext.authorizer.jwt.claims.sub`. Sem esse sujeito respondem 401. As rotas de Google em Conta respondem 503: Cognito não faz parte desta entrega.

`pulumi up` na stack prod cria a zona do domínio, a US$ 0,50 por mês, e fica esperando a delegação dos nameservers para emitir os certificados. Não rode prod sem ler o preview. A zona `flesh-to-chrome.negoci.online` não entra nesta stack.

## O que esta entrega não publica

- Cognito, login Google e authorizer JWT. A documentação deixa a identidade para a integração de login; as rotas privadas continuam recusando chamada sem `sub`.
- API Gateway WebSocket, ticket de conexão e o transporte da corrida. Continuam condicionados à decisão D04.
- Loja e rotas `/me/cosmetics`. O cronograma da loja segue pendente.
- O barramento do documento 12 (DynamoDB Streams, publicador e SQS). A campanha já grava o outbox na mesma transação do save. A Lambda de auditoria deduplica e persiste o evento quando recebe `{ "action": "ingest", "events": [...] }` por invocação direta. Essa invocação não está ligada a uma fila.
- E-mail SES. Falha de e-mail não bloqueia save nem partida.
- O build do jogo. A CDN publica só a página em `frontend/index.html`.
