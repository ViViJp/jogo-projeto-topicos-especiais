# Flesh to Chrome — nuvem

Infraestrutura da sprint 1 que cabe nas entregas de ambiente, domínio, banco e Lambda. O cliente do jogo continua em `flesh-to-chrome/`. CDN, API Gateway, certificado e a integração HTTP ficam para a sprint seguinte: a sprint 1 define esses registros DNS como alias para CloudFront e API Gateway, e esses serviços ainda não existem.

## O que a stack cria

Nas stacks `dev` e `prod`, em `sa-east-1`:

- tabelas DynamoDB `accounts`, `campaigns`, `matches`, `communications` e `audit`, uma por serviço
- Lambdas Node `conta`, `campanha`, `partidas`, `comunicacoes` e `auditoria`, cada uma com papel próprio e acesso só à sua tabela

Na stack `prod`, também:

- zona pública Route 53 de `nihil-legere-possum.lat`
- os registros NS e SOA dessa zona, exportados em `nameservers`

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

As funções esperam o evento HTTP API v2 com `requestContext.authorizer.jwt.claims.sub`. Sem esse sujeito respondem 401. O encaminhamento HTTP entra quando houver API Gateway.

## O que esta entrega não publica

- Registros alias de `nihil-legere-possum.lat`, `www` e `api`. A sprint 1 aponta esses nomes para CloudFront e API Gateway. Eles entram com a CDN, o certificado e o API Gateway.
- O barramento do documento 12 (DynamoDB Streams, publicador e SQS). A campanha já grava o outbox na mesma transação do save. A Lambda de auditoria deduplica e persiste o evento quando recebe `{ "action": "ingest", "events": [...] }` por invocação direta. Essa invocação não está ligada a uma fila.
- E-mail SES. A sprint 1 deixa o envio para depois; falha de e-mail não bloqueia save nem partida.
- Prova de `pulumi up`. Este repositório não executa a implantação. Quem tiver as credenciais da conta precisa rodar o comando acima e guardar a saída. `pulumi preview` não substitui isso.
