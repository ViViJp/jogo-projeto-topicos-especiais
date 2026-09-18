# Arquitetura AWS — microsserviços, escalabilidade e custo

**Diretriz do responsável:** priorizar microsserviços e serviços terceirizados/gerenciados disponíveis na AWS, com escalabilidade e economia. **Conta AWS ainda não criada**, conforme informação recebida nesta revisão. Esta é a arquitetura de referência para implementação futura; nenhum recurso foi provisionado.

## 1. Decisão de arquitetura

Adotar microsserviços serverless por domínio, executados em AWS Lambda, com implantação, permissões e dados próprios. O mesmo repositório pode conter vários serviços; uma única função com todos os domínios e acesso irrestrito às tabelas não atende à separação planejada.

Usar componentes gerenciados para identidade, CDN, banco, filas, e-mail e observabilidade. A equipe implementa regras da campanha, coordenação de partidas e integrações específicas do jogo. Google continua como provedor externo de login, federado pelo Amazon Cognito.

Um API Gateway HTTP API por ambiente pode encaminhar rotas REST aos diferentes serviços. A escolha de **HTTP API** preserva o requisito de API RESTful; é o produto mais simples do API Gateway, projetado para custo menor quando os recursos adicionais de REST API não são necessários. [Comparação oficial](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html).

O [diagrama de blocos AWS](../imagens/diagrama-aws-microsservicos.svg) mostra entrada e serviços. O [diagrama de eventos](../imagens/diagrama-aws-eventos.svg) detalha filas, persistência de auditoria e comunicações. As duas figuras são geradas da mesma fonte dos blocos Mermaid no documento 05.

## 2. Microsserviços e propriedade dos dados

| Serviço | Responsabilidade | Recursos próprios / contrato |
| --- | --- | --- |
| Conta | Perfil, associação ao `sub` do Cognito, bootstrap de usuário e eventos de acesso | Lambda Conta; tabela `accounts`; `/me` e integração `/auth/*`. Credenciais/login social ficam no Cognito. |
| Campanha | Save, revisões, checkpoints, Portão, descida, reset e restauração | Lambda Campanha; tabela `campaigns`; `/me/campaign*`. Nunca escreve resultado multiplayer. |
| Partidas | Salas, prontidão, participantes autenticados, conexões, resultado/classificação e auditoria da corrida | Lambdas do mesmo serviço Partidas; tabela `matches`; `/matches*`. Gateway WebSocket candidato para tempo real, sujeito à prova D04. |
| Comunicações | Notificação no jogo, estado de leitura, envio de e-mail e retentativas | Lambdas HTTP/consumidora; tabela `communications`; SQS própria + DLQ; SES; `/me/notifications*`. |
| Auditoria | Receber eventos críticos, deduplicar, persistir e consultar eventos autorizados | Lambdas HTTP/consumidora; tabela `audit`; SQS própria + DLQ; `/me/audit-events`. |

Os cinco serviços têm pacotes e IAM roles próprios e podem escalar/publicar separadamente. Partidas possui handlers REST e WebSocket dentro do mesmo domínio; resultado/classificação não exige outro microsserviço só para calcular uma fórmula. Publicadores de eventos são componentes dos serviços produtores.

Nenhum serviço consulta ou altera diretamente a tabela de outro. Referências como `userId` são identificadores; dados necessários de outro domínio chegam por contrato/evento. Não criar joins entre serviços. Cosméticos continuam opcionais, mas a sincronização por conta foi aprovada em D11. Proposta técnica: o serviço Campanha possui aquisições em itens próprios por conta na tabela `campaigns`, fora do estado/reset da campanha, permitindo transação de saldo, desbloqueio e outbox. Isso não muda propriedade ao escolher/importar save. Ver documentos 08/09; não há novo serviço obrigatório nem gateway de pagamento real.

## 3. Serviços AWS selecionados como base

| Necessidade | Serviço escolhido / perfil inicial | Motivo e limite |
| --- | --- | --- |
| DNS público | Route 53: uma hosted zone pública para `nihil-legere-possum.lat` | Registros Alias para CloudFront/API Gateway, validações de certificado e registros de e-mail. Avaliar associação ao plano CloudFront Free. |
| HTTPS | AWS Certificate Manager (ACM) | Certificados para os nomes publicados; CloudFront usa certificado em `us-east-1`, API Gateway regional usa certificado na região da API. |
| Frontend Phaser e assets | S3 privado + CloudFront, acesso à origem via OAC | Cache e distribuição do build; simulação permanece no navegador. Avaliar plano CloudFront Free separado do Free Plan da conta. |
| Login externo | Cognito User Pools Lite + Google como provedor social | Terceirizar identidade; autorização de proprietário/participante permanece nas Lambdas. |
| API RESTful | API Gateway HTTP API + authorizer JWT do Cognito | Um endpoint com rotas por serviço; validar `issuer`, audiência, expiração e escopos aplicáveis. |
| Código de domínio | Lambda com runtime Node suportado na implementação | Execução por demanda; concorrência e limites por serviço; sem servidor ocioso permanente. |
| Banco | DynamoDB Standard; uma tabela por domínio e ambiente | Escritas condicionais para revisões/resultado único. Perfil acadêmico provisionado baixo; crescimento pode usar on-demand. |
| Eventos duráveis | Outbox em DynamoDB + Streams + publicador Lambda + SQS Standard e DLQs | Desacoplar auditoria e comunicação; falha de e-mail não interrompe campanha. |
| E-mail | SES à la carte | Envio transacional; verificar domínio e solicitar saída do sandbox antes de atender destinatários não verificados. |
| Notificações no jogo | Serviço Comunicações + DynamoDB; consulta por REST ao abrir menu/evento relevante | Sem push do navegador ou polling de alta frequência como dependência inicial. |
| Tempo real multiplayer | API Gateway WebSocket + Lambdas Partidas — **candidato D04** | Gerenciamento terceirizado de conexões; validar custo/latência antes de fechar transporte. |
| Feedback de e-mail — D07 aprovada | SES → SNS Standard → SQS de feedback → Lambda Comunicações | Entrega/bounce/reclamação e supressão; componente aprovado, sem SMS ou assinatura SNS por e-mail. Documento 14. |
| Logs e métricas | CloudWatch, com retenção explícita e sem log de cada frame | Diagnóstico operacional; não substitui eventos de auditoria do produto. |
| Implantação | Pulumi + pipeline CI/CD com credenciais temporárias via federação OIDC | Recursos na AWS definidos em IaC; publicar apenas serviços alterados e dependências necessárias. |

Serviços gerenciados escolhidos são direção técnica desta revisão; disponibilidade, quotas, modalidade de cobrança e elegibilidade serão confirmadas ao criar a conta. Não há orçamento pago ou migração de plano autorizados por esta documentação.

Cognito suporta provedores sociais como Google; HTTP API pode validar JWTs do user pool. [Cognito social](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-social-idp.html), [JWT authorizer](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html). A opção OAC deve ser configurada para acesso privado ao S3 conforme a [documentação de origem CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

## 3.1. DNS, domínio e HTTPS

**Route 53 integra a arquitetura de referência.** O sistema precisa de DNS para publicar seu domínio; o provedor DNS não é obrigatoriamente AWS, mas Route 53 atende à diretriz escolhida de serviços gerenciados AWS e permite gerenciar registros com Pulumi.

DNS informa ao navegador onde encontrar o serviço; não transporta o tráfego HTTP do jogo nem executa um microsserviço. Após a resolução, o navegador se conecta diretamente ao CloudFront ou ao API Gateway. As setas DNS nos diagramas indicam resolução/configuração de destino, não proxy ou balanceador adicional.

| Nome / registro proposto | Destino / finalidade | Situação |
| --- | --- | --- |
| `nihil-legere-possum.lat` | Alias A para CloudFront; AAAA se IPv6 habilitado | Domínio já previsto no projeto; hospedagem DNS via Route 53 agora explícita. |
| `www.nihil-legere-possum.lat` | Alias para a mesma distribuição, caso seja necessário | Nome adicional opcional; incluir no certificado se publicado. |
| `api.nihil-legere-possum.lat` | Alias para o domínio personalizado regional do API Gateway HTTP | Nome proposto; configurar domínio, certificado e API mapping antes do Alias. |
| `ws.nihil-legere-possum.lat` | Endpoint WebSocket personalizado, se D04 confirmar o transporte | Nome e configuração pendentes; inicialmente é possível usar o hostname gerado pela AWS. |
| Registros de validação ACM e SES | CNAME/TXT e outros registros exigidos pelo procedimento escolhido | Preservar validação de certificados e DKIM; configurar política DMARC e, se adotado, MAIL FROM próprio. |

A associação Alias na raiz do domínio é suportada pelo Route 53 para CloudFront. [Configuração oficial](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-cloudfront-distribution.html). Para HTTPS do frontend, o certificado ACM deve estar em `us-east-1`; para domínio regional da HTTP API, na mesma região da API. O certificado precisa cobrir o nome usado pelo cliente. [CloudFront/ACM](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html), [domínio da HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-custom-domain-names.html).

Registro do domínio e hospedagem DNS são serviços distintos. Se o domínio já estiver registrado em outro provedor, pode permanecer nele: configurar a zona pública no Route 53, preservar os registros existentes e delegar os nameservers no registrador. Não é necessário transferir o registro para usar Route 53. A titularidade, o registrador e a delegação ainda precisam ser verificados em D08; nada foi alterado no DNS real. [Domínio existente com Route 53](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/MigratingDNS.html).

**Custo:** no modelo avulso, a referência publicada é US$ 0,50 por zona/mês nas primeiras 25 zonas, mais consultas cobradas quando aplicáveis. Consultas Alias A/AAAA aos destinos AWS elegíveis, como CloudFront e API Gateway, não têm cobrança de consulta. Registro/renovação do domínio é separado. [Preços Route 53](https://aws.amazon.com/route53/pricing/).

Para economizar, avaliar anexar a zona ao plano Free do CloudFront: a cobertura exige mesma conta AWS, domínio compatível com a distribuição e respeito às franquias; o plano Free publica limite de 50 registros e franquia adicional de 1 milhão de consultas DNS mensais. A zona não anexada continua avulsa. Exceder a franquia DNS pode levar ao retorno à cobrança avulsa; registro/renovação do domínio não está incluído. [Condições DNS do plano CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html).

Começar com uma zona pública; dev local não precisa de outra. Se houver dev em nuvem, registros específicos podem coexistir na mesma zona, mantendo aplicações, dados e permissões de implantação isolados. Não provisionar Resolver endpoints, DNS privado ou health checks pagos para este desenho sem necessidade comprovada.

## 4. Eventos, falhas e consistência

Proposta de implementação para não perder operações críticas:

1. Conta, Campanha ou Partidas gravam a mudança e um item de outbox em uma transação da sua própria tabela. Eventos incluem `eventId`, versão do contrato, ator, recurso, data, correlação e metadados mínimos.
2. DynamoDB Streams, filtrado para novos itens de outbox, aciona o publicador do respectivo serviço, que encaminha o evento para a fila de Auditoria e, quando houver gatilho, para a fila de Comunicações.
3. Depois de confirmação dos destinos, marcar o evento como publicado. Em entrega parcial, repetir com o mesmo `eventId`; consumidores deduplicam. Não prometer entrega exatamente uma vez; a marcação de publicação não deve disparar novamente o filtro de novos eventos.
4. Consumidores persistem seus próprios dados. Falhas repetidas vão para DLQ; alarmes apontam itens pendentes. E-mail não está no caminho síncrono do save. Resposta incerta de envio SES exige tratamento de ambiguidade antes de repetir; deduplicar eventos não garante ausência absoluta de e-mail duplicado se o provedor aceitou o envio e a confirmação se perdeu.
5. Manter outbox até confirmação e recuperação: Streams não é arquivo permanente. Prever reconciliação de eventos pendentes por serviço e recuperação de falhas; política de retenção em D06.

O padrão outbox evita o problema de atualizar o banco e falhar antes de publicar o evento. A origem DynamoDB/Lambda pode entregar registros repetidos; processamento precisa ser idempotente. [Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html), [DynamoDB com Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html). Streams retém registros por 24 horas; conservar itens de outbox permite recuperação além dessa janela. [Componentes DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html).

D06: visitante mantém campanha somente na sessão do navegador, sem save persistente ou histórico de campanha. Após autenticação, Campanha recebe o estado atual conforme D05 e registra a importação, sem eventos retroativos anteriores ao login. Cache persistente pertence à conta identificada.

A confirmação HTTP de save significa campanha e evento durável registrados; a projeção de auditoria pode aparecer depois. O cliente não deve interpretar atraso de projeção como perda do save. Não enviar posições por frame à outbox, às filas de comunicação ou ao catálogo de auditoria.

## 5. DynamoDB: economia e crescimento

**Perfil acadêmico inicial proposto:** cinco tabelas de produção com 2 RCUs/2 WCUs cada; dev em nuvem, quando necessário, cinco tabelas com 1 RCU/1 WCU cada. Total inicial: 15 RCUs e 15 WCUs, antes de índices e outros recursos da conta. É hipótese de dimensionamento para testes pequenos, não capacidade comprovada para o jogo.

A oferta publicada inclui 25 RCUs/25 WCUs provisionadas e 25 GB em DynamoDB Standard. Essas franquias não se multiplicam por microsserviço ou ambiente; consolidar consumo e confirmar elegibilidade/âmbito regional na conta. **Requisições on-demand não ficam gratuitas por estarem abaixo de 25 RCUs/WCUs.** [Preços DynamoDB](https://aws.amazon.com/dynamodb/pricing/).

Para crescimento, medir throttling e latência e optar entre auto scaling provisionado com limites de orçamento ou on-demand para carga irregular. A franquia gratuita não é teto de escalabilidade: crescimento além dela pode gerar cobrança. Créditos da conta podem cobrir uso elegível por tempo limitado.

Escritas transacionais, tamanho de itens, índices e leituras consistentes alteram capacidade consumida. Não persistir cada frame; a tabela de Partidas guarda vínculos, marcos e resultado. Consultas por conexão/participante também consomem leituras e entram na estimativa do tempo real.

Campanha, IDs consolidados e snapshot pré-Portão não devem crescer sem limite em um único item: DynamoDB limita cada item a 400 KB. Separar snapshot e coleções por fase/fragmentos em itens do mesmo domínio; REST pode compor o objeto lógico do documento 08. [Limites DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Constraints.html).

## 6. Multiplayer: caminho de validação

A comparação de MQTT, WebTransport e WebSocket está no [estudo de transportes](13-transporte-multiplayer.md). **WebSocket seguro (WSS) é recomendado para o primeiro protótipo**; API Gateway/Lambda continua condicionado à prova de custo, latência e autoridade D04. MQTT no navegador normalmente também usa WSS; WebTransport não elimina timeouts. Nenhum dos dois foi acrescentado como serviço obrigatório.

O desenho inicial usa dois navegadores, com simulação visual local e mensagens compactas de ações/marcos. Backend controla sala, participantes, relógio de referência e resultado conforme GDD; a validação suficiente de tempo, créditos e trajetória ainda pertence a D04. Relatos do cliente não são prova de resultado legítimo.

API Gateway WebSocket é candidato para conexão e entrega de mensagens; Lambda processa eventos curtos, não hospeda uma simulação contínua por partida nem mantém a conexão aberta em memória. Não usar estado global de uma instância Lambda como única verdade compartilhada. Os limites oficiais são 10 min de inatividade, 2 h de duração da conexão e até 29 s por integração. São limites distintos do serviço, não um timeout universal do protocolo. Heartbeat de aplicação trata inatividade, mas não estende as 2 h. Renovar no lobby/antes da largada; duração máxima da corrida, detecção de queda e falhas de infraestrutura precisam ser fechadas em D04. Os 120 s do GDD são duração-alvo, não teto. [Quotas WebSocket](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-execution-service-websocket-limits-table.html).

No HTTP usar JWT authorizer. No WebSocket usar autorização no `$connect` e validar vínculo/permissão nos handlers de mensagem. A AWS só aplica o Lambda authorizer WebSocket na conexão. Proposta: ticket curto de uso único, emitido via REST autenticada, para o navegador abrir o socket sem expor token duradouro na URL; contrato detalhado em D04. [Autorização WebSocket](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-lambda-auth.html).

**Experimento de custo, não frequência aprovada:** com `M` partidas, dois jogadores, duração `T` e `r` mensagens/s por jogador, encaminhando cada entrada uma vez ao adversário:

- entradas = `M × 2 × T × r`;
- saídas = entradas;
- mensagens cobradas estimadas = `M × 4 × T × r`, antes de heartbeats, salas, reconexões e arredondamento por tamanho;
- minutos conectados aproximados = `M × 2 × T / 60`, sem espera no lobby.

Para 100 partidas de 120 s, a 2 mensagens/s: **48 mil entradas + 48 mil saídas = 96 mil mensagens**, com cerca de 400 minutos de conexão. A 60 mensagens/s seriam **2,88 milhões de mensagens**. Lambda, leituras de estado e logs têm custos adicionais. O API Gateway cobra mensagens e minutos de conexão; conferir preço regional e benefício aplicável à conta, sem presumir que ofertas legadas de 12 meses se apliquem à nova conta. [Preços API Gateway](https://aws.amazon.com/api-gateway/pricing/).

Comparar snapshots a 2, 5, 10 e 20 Hz com interpolação, latência observada, divergência e correção do resultado; ações/marcos são enviados prontamente e contados à parte. 2–5 Hz é hipótese de economia, não frequência aprovada nem taxa de todos os eventos. Medir heartbeat, detecção de queda, fila de envio e custo da presença conforme documento 13. Só adotar se a experiência e as regras forem preservadas. Caso seja necessária simulação autoritativa contínua, reavaliar **somente o componente de tempo real** para um processo de jogo dedicado, por exemplo ECS/Fargate, com estimativa de custo própria. Isso não faz parte do perfil gratuito inicial nem fica provisionado preventivamente. Não usar SQS para sincronizar pulo/colisão em tempo real.

D03 aprova salas privadas por código/link com consulta direta na tabela Partidas, sem diretório público ou servidor permanente de lobby; histórico privado de 30 dias e parâmetros definidos. D07 aprova central de notificações, preferências e e-mails para boas-vindas/finais opcionais, com SNS/SQS para feedback SES; compras notificam apenas no jogo. Modelo, retenção e estimativa no [documento 14](14-salas-e-notificacoes.md).

## 7. Free Tier para a conta que será criada

A conta ainda não existe. O plano inicial pretendido é Free Plan para desenvolvimento/demonstração, sujeito à elegibilidade do titular. A regra atual oferece US$ 100 em créditos iniciais e até US$ 100 adicionais por atividades; **US$ 200 não são saldo garantido na criação**. Free Plan termina no primeiro evento: seis meses ou esgotamento dos créditos. Não equivale a hospedagem gratuita permanente. Se houver upgrade para Paid Plan, créditos remanescentes têm validade de até 12 meses desde a criação; não trocar de plano automaticamente no projeto. [AWS Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/).

| Componente | Referência de benefício/preço | Implicação para o projeto |
| --- | --- | --- |
| Lambda | 1 milhão de requisições e 400 mil GB-s por mês na franquia publicada | Somar todos os handlers, consumidores e publicadores; medir memória × duração. [Fonte](https://aws.amazon.com/lambda/pricing/). |
| Cognito Lite | 10 mil usuários ativos mensais para login direto/social na oferta publicada | Google como integração social; não confundir com outra categoria de federação nem habilitar extras pagos sem estimativa. [Fonte](https://aws.amazon.com/cognito/pricing/). |
| SQS | 1 milhão de requisições/mês | Enviar, receber e apagar contam; mensagens não equivalem a uma única operação. [Fonte](https://aws.amazon.com/sqs/pricing/). |
| DynamoDB | Franquias e perfil da seção 5 | Capacidade provisionada baixa precisa de teste de carga; índices, transações e on-demand exigem cálculo próprio. |
| CloudFront | Plano próprio Free: US$ 0/mês, referência de 1 milhão de requisições e 100 GB/mês, com 5 GB de armazenamento S3 incluído conforme condições | É plano do serviço, diferente do plano da conta. Confirmar elegibilidade, integração Pulumi e custos S3 não cobertos. [Preços](https://aws.amazon.com/cloudfront/pricing/). |
| API Gateway | Uso por requisição HTTP, mensagem WebSocket e minuto de conexão | Prever consumo de créditos ou cobrança; não considerar universalmente gratuito. |
| SES à la carte | Referência publicada de US$ 0,10 por mil e-mails enviados, além de dados/extras aplicáveis | Sem custo fixo de IP dedicado no desenho; validar benefício da conta. Não assumir gratuidade permanente de e-mail. [Fonte](https://aws.amazon.com/ses/pricing/). |
| Route 53 | US$ 0,50/zona/mês no modelo avulso; cobertura possível com zona anexada ao plano CloudFront Free | Confirmar associação e franquias da seção 3.1; domínio/renovação separados. [Fonte](https://aws.amazon.com/route53/pricing/). |
| CloudWatch, domínio e armazenamento complementar | Dependem de uso, modalidade e cobertura do plano | Incluir logs, alarmes, S3 e renovação de domínio no orçamento; nenhum deles some por usar Lambda. |

O plano CloudFront Free não cobre toda a aplicação nem elimina custos do API Gateway. A AWS informa que ultrapassar muito a franquia do plano pode reduzir desempenho de distribuição; não tratar ausência de excedente financeiro como escala ilimitada com desempenho garantido. [Condições CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html).

Para custo de envio, confirmar plano SES: a página atual informa Essentials para novas contas desde julho de 2026 (US$ 0,16/1.000 envios) e opção à la carte (US$ 0,10/1.000), sem incluir dados/extras. D07 aprovada usa envio simples à la carte; não presumir esse plano como padrão. [Preços SES](https://aws.amazon.com/ses/pricing/).

SES inicia em sandbox: envio apenas para endereços/domínios verificados ou simulador, até 200 mensagens/24 h e 1 mensagem/s. Isso permite testes; enviar boas-vindas a qualquer jogador exige aprovação de saída do sandbox e remetente verificado. [Sandbox SES](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

## 8. Política de economia e escalabilidade

- Região inicial de referência `sa-east-1`, pela previsão já documentada; comparar custo regional e latência real antes de fechar D08. CDN global não elimina a latência do backend. Usar uma região no início, sem replicação global automática.
- Dev local por padrão; criar recursos dev em nuvem para integração e removê-los quando dispensáveis. Produção mantém dados; não aplicar limpeza automática de campanha/auditoria sem política aprovada.
- Sem EC2, EKS, ECS permanente, ALB, NAT Gateway ou banco relacional com capacidade ociosa no desenho inicial. Lambdas usam endpoints gerenciados sem VPC privada própria enquanto não houver requisito que a justifique.
- Arquivos estáticos versionados com cache; invalidar somente o necessário. Não habilitar simultaneamente dois modelos de CDN/hosting para o mesmo frontend.
- Definir limites de concorrência por microsserviço, throttling de API, retentativas com backoff e filas/DLQs. Isolamento reduz o efeito de pico multiplayer sobre save e comunicações; quotas da conta ainda são compartilhadas.
- CloudWatch com retenção inicial proposta de 7 dias para logs operacionais dev e 14 dias em prod; auditoria tem retenção própria D06. Não registrar payloads completos, tokens ou tráfego de cada frame.
- Monitorar créditos, data final do plano, chamadas, GB-s, tráfego, mensagens, throttling, DLQ e falhas de envio. Alarmes de orçamento avisam; **não são bloqueio garantido de cobrança**. [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html).
- Estimar o custo bruto além do desconto dos créditos. Teto mensal e dimensionamento permanecem em D08; a ausência da conta não permite certificar custo zero. Crescimento deve ser acompanhado de orçamento, sem habilitar serviços pagos por conveniência.

## 9. Implantação por serviço

Stacks Pulumi por ambiente: base compartilhada (Route 53/ACM/CDN/API/Cognito) e componentes com recursos/permissões por domínio. Pipeline valida contratos, builda o serviço alterado, aplica IaC, publica versão e verifica saúde. Contratos/eventos versionados permitem rollout independente; migrações de dados não podem exigir publicação simultânea de todos os serviços.

CI pode usar o executor já disponível no repositório, sem manter servidor Jenkins. A definição do executor e suporte Pulumi aos recursos/planos selecionados será validada na implementação; não há exigência de comprar CodePipeline/CodeBuild apenas para caracterizar microsserviços.

## 10. Decisões remanescentes

- D08 parcialmente resolvida: AWS gerenciada/serverless e serviços base definidos; confirmar conta, elegibilidade, região final, plano CloudFront e associação da zona DNS, registrador/delegação do domínio, capacidade/quotas e integração IaC.
- D04: WebSocket recomendado para protótipo pelo documento 13; testar hospedagem API Gateway/Lambda, autoridade, ritmo de mensagens, presença, duração máxima da corrida e desconexão. Não presumir reconexão com retorno após derrota.
- D03/D07 aprovadas: salas privadas, canais, retenção e feedback SES/SNS no documento 14; compras sem e-mail. Implementação, medições e liberação SES ainda precisam ser executadas.
- D09 resolvida: não há meta de latência/FPS exigida para a entrega final. Orçamento, carga de dimensionamento e limites operacionais ficam em D08; sincronização/carga multiplayer em D04. D02/D05/D10 foram aprovadas; D11 tem sincronização por conta aprovada e cronograma opcional pendente. D12 foi aprovada: memória após último checkpoint e antes da retirada. D01 continua pendente. D06 tem escopo aprovado: campanha persistente somente após login, sem histórico retroativo de visitante; retenção e acesso operacional ficam para detalhamento.

As fontes oficiais foram consultadas nesta revisão. Preços e condições devem ser revalidados no momento de criação da conta e antes da implantação; esta documentação não substitui a fatura/estimativa regional da AWS.
