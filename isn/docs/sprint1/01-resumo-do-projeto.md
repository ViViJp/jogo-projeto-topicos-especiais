# Resumo do projeto

**Projeto:** Flesh to Chrome

**Disciplina:** ISN 75620501 — 2026.2

**Domínio previsto:** https://nihil-legere-possum.lat

**Equipe ISN:** João Pedro, Victor Blum

**Referência de produto:** [GDD 1.0.0](../../../gdd.md), setembro de 2026. As definições ISN complementam o GDD e estão registradas nesta documentação.

## Produto e narrativa

Flesh to Chrome é um auto-runner 2D cyberpunk para navegador desktop. Alex Murphy vive com os avós e o tio nos níveis inferiores de Glitch City. Ao reconhecer no jornal o pai que abandonou a família e ascendeu socialmente, decide chegar ao topo. A ascensão atravessa Esgoto, Industrial, Meio Urbano, Corporativo e Topo.

Ao concluir cada uma das quatro primeiras fases, George Vektor instala, nesta ordem, pernas, braços, olhos e propulsores. Cada implante acrescenta uma habilidade e transforma Alex visualmente. A confiança de George também se transforma em orgulho e ganância.

No Portão, aceitar a conversão leva ao Final Chrome: o pai reconhece Alex, mas Alex já não o reconhece. Recusar inicia a descida. Quatro memórias permitem retirar os implantes na ReForge Industries, com substituição por tecido bioprintado e perda das habilidades. Completar a cadeia leva ao Flesh; quebrá-la leva ao Hollow. Ambos terminam no retorno à família no Esgoto, em estados corporais e emocionais diferentes.

## Escopo e prioridades

| Camada | Conteúdo | Origem |
| --- | --- | --- |
| Campanha núcleo | Cinco fases, quatro implantes, créditos, checkpoints, save, prólogo, Portão e Chrome | GDD §§7, 14–20 |
| MVP narrativo completo | Descida, quatro memórias, ReForge, bioprinting, Flesh, Hollow e epílogo | Meta principal do GDD §7.7 |
| Multiplayer planejado | Corrida simultânea para dois jogadores autenticados, salas, resultado/classificação persistidos, pista própria, tempo ajustado e créditos individuais | Incluído no escopo ISN; sequência de desenvolvimento após campanha conforme GDD §24.5 |
| Gamepad físico | Controle conectado ao navegador, além do teclado; mesmas ações do jogo | Adição solicitada e esclarecida pelo responsável nesta revisão; não consta no GDD 1.0.0 |
| Conteúdo opcional | Skins, Mercador, loja e pagamento simulado; parallax e áudio adicionais | GDD §§5, 24–25; sem pagamento real |
| Serviços ISN | Conta externa, save em nuvem, REST, banco, e-mail, notificações, auditoria, IaC e CI/CD | Requisitos da disciplina |

O multiplayer integra o escopo ISN; a ordem de desenvolvimento continua posterior à estabilização da campanha, conforme GDD. Não é tratado como funcionalidade opcional que só entra se sobrar tempo. O fallback de descida substituída por Hollow em cutscene é contingência do GDD §7.9, não a meta assumida nesta documentação.

## Arquitetura prevista

- Frontend: TypeScript, Phaser, Parcel e mapas Tiled/JSON, no projeto existente `flesh-to-chrome/`.
- Entrada: teclado e adaptador de gamepad físico, convergindo para as mesmas ações. Não há controle remoto por celular neste escopo.
- Campanha: simulação no navegador e save local em `localStorage`, inclusive para visitante.
- Nuvem: microsserviços Conta, Campanha, Partidas, Comunicações e Auditoria em AWS Lambda, publicados independentemente por domínio; API Gateway HTTP expõe RESTful, com tabelas DynamoDB próprias e IAM separado.
- Serviços gerenciados: Cognito + Google para identidade, Route 53 para DNS público, ACM para HTTPS, S3/CloudFront para frontend, SQS para eventos assíncronos, SES para e-mail e CloudWatch para operação.
- Multiplayer: backend mantém salas/partidas para dois jogadores autenticados e grava resultado/classificação de cada corrida, separado do save da campanha. Salas privadas são encontradas por código/link (D03 aprovada); a autoridade da simulação continua em D04; WSS é o transporte recomendado para o protótipo após comparação com MQTT e WebTransport no [estudo de transportes](13-transporte-multiplayer.md). API Gateway WebSocket com Lambda continua candidato a hospedagem, condicionado a testes de custo, latência e desconexão.
- Operação: Pulumi por ambiente/serviço e deploy automático por CI/CD; desenvolvimento local por padrão. Conta AWS ainda não criada; perfil inicial com Free Plan/franquias elegíveis e crescimento acompanhado de orçamento.

Decisões, diagrama AWS, custos e limites: [12-arquitetura-aws-microsservicos.md](12-arquitetura-aws-microsservicos.md).

A nuvem acrescenta persistência entre dispositivos ao save local previsto no GDD. A resolução de conflitos entre cópias foi aprovada em D05 no [registro de decisões](07-decisoes-pendentes.md), como extensão ISN ao GDD.

## Limite desta entrega

Esta sprint entrega especificação, diagramas e contratos iniciais; não comprova implementação ou implantação. O protótipo está neste mesmo repositório. A cena multiplayer existente é um stub, não evidência de modo online funcional.

As regras do GDD são a referência vigente. Novas decisões técnicas e de produto estão explicitamente distinguidas em [07-decisoes-pendentes.md](07-decisoes-pendentes.md). A rastreabilidade está em [10-rastreabilidade.md](10-rastreabilidade.md).

Decisões aprovadas em 17/09/2026: desconectar gamepad pausa campanha e mantém multiplayer em andamento; sincronização de campanha exige escolha explícita em conflito/importação e cache por conta; memória só se consolida na retirada do implante e se perde por morte, reinício manual ou saída anterior; cosméticos adquiridos ficam salvos/sincronizados na conta. Detalhes e pendências restantes no [registro de decisões](07-decisoes-pendentes.md).
