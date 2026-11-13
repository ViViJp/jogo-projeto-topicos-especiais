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

As rotas privadas exigem `Authorization` com o JWT do Cognito. As duas rotas de Google continuam públicas. No primeiro cadastro, a Conta pede à Comunicações o aviso de boas-vindas. O e-mail sai pelo SES só quando há remetente configurado; se o envio falhar, o cadastro permanece. Na dev, o remetente opcional é `flesh-to-chrome:sesFromEmail`. Na prod, o remetente `noreply@nihil-legere-possum.lat` e a identidade SES só entram com `publishDomain` em `true`, no mesmo passo dos certificados.

## O que esta entrega não publica

- API Gateway WebSocket, ticket de conexão e o transporte da corrida. Continuam condicionados à decisão D04.
- Loja e rotas `/me/cosmetics`. O cronograma da loja segue pendente.
- O barramento do documento 12 (DynamoDB Streams, publicador e SQS). A campanha já grava o outbox na mesma transação do save. A Lambda de auditoria deduplica e persiste o evento quando recebe `{ "action": "ingest", "events": [...] }` por invocação direta. Essa invocação não está ligada a uma fila.
- Suíte de testes, integração contínua e deploy contínuo. Ficam para a entrega seguinte.
