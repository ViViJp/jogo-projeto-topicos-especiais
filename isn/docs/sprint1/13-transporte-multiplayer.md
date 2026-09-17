# Multiplayer — comparação de transportes e recomendação

Estudo documental em **17/09/2026**. Referências: [GDD §21](../../../gdd.md), [arquitetura AWS](12-arquitetura-aws-microsservicos.md) e decisões D04/D09. Não houve benchmark, implantação nem implementação de rede nesta revisão.

## 1. Recomendação para este jogo

**Usar WebSocket seguro (WSS) como transporte de referência do primeiro protótipo.** Validar inicialmente API Gateway WebSocket + Lambda Partidas. A escolha do protocolo não aprova automaticamente essa hospedagem para qualquer frequência de atualização. MQTT não é recomendado como troca motivada por timeout; WebTransport fica como alternativa se os testes demonstrarem necessidade de datagramas e houver orçamento para outro servidor de tempo real.

Esta é uma conclusão de engenharia para o escopo atual: dois jogadores, sem colisão entre si/PvP, créditos individuais e duração-alvo de aproximadamente 120 s. A simulação local responde imediatamente ao teclado/gamepad; a representação do adversário pode usar interpolação. Backend mantém regras, marcos e resultado. Nenhum transporte resolve sozinho fraude, validação de trajetória ou justiça do cronômetro.

**120 s é duração-alvo, não limite máximo.** Mortes mantêm o cronômetro e o GDD não encerra a corrida se nenhum jogador chegar. É necessário fechar esse limite em D04 antes de considerar resolvido o risco de expiração de conexão.

## 2. Avaliação da frase sobre timeout

A grafia correta é **MQTT**. A preocupação com desconexões é válida; a conclusão de substituir WebSocket por causa de timeout não é suficiente.

| Limite no API Gateway WebSocket | Significado | Tratamento proposto |
| --- | --- | --- |
| 10 minutos de inatividade | Conexão sem tráfego | Heartbeat de aplicação quando não houver mensagens úteis; testar envio e resposta. |
| 2 horas de conexão | Duração máxima, mesmo com tráfego | Renovar conexão no lobby/entre partidas; abrir conexão recente antes da largada e conferir margem para toda a corrida. Heartbeat não remove esse limite. |
| Até 29 segundos de integração | Prazo de execução da integração de uma mensagem | Handlers curtos; não é a duração do socket nem o tempo disponível para jogar. |

Esses números são limites do **serviço API Gateway**, não uma duração universal imposta pelo protocolo WebSocket. [Quotas oficiais](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-execution-service-websocket-limits-table.html).

MQTT no navegador usa normalmente **MQTT sobre WSS**, incluindo a opção AWS IoT Core. Há keep-alive e reconexão a implementar; a quota de conexão WSS do IoT Core é de 24 h, e autenticação/rede podem encerrá-la antes. Mudar de serviço muda os limites, não elimina a necessidade de gerenciar conexões. [Protocolos IoT Core](https://docs.aws.amazon.com/iot/latest/developerguide/protocols.html), [quotas IoT Core](https://docs.aws.amazon.com/general/latest/gr/iot-core.html).

WebTransport sobre HTTP/3/QUIC também pode encerrar conexões por inatividade, erro ou indisponibilidade de rede. QUIC negocia timeout de inatividade; não é um protocolo sem timeout. [RFC 9000, §10.1](https://www.rfc-editor.org/rfc/rfc9000.html#name-idle-timeout).

## 3. Comparação para o multiplayer

| Critério | WebSocket | MQTT no navegador / IoT Core | WebTransport sobre HTTP/3 |
| --- | --- | --- | --- |
| Modelo | Canal bidirecional de mensagens; contrato do jogo próprio | Publicação/assinatura por tópicos em broker, normalmente sobre WSS | Streams confiáveis e datagramas sem garantia de entrega/ordem |
| Estado visual frequente | Fluxo confiável/ordenado pode atrasar novidades ao recuperar perdas; limitar fila e descartar estado obsoleto antes do envio | QoS 0 não remove o transporte TCP/WSS nem seu bloqueio; broker acrescenta roteamento e políticas | Datagramas permitem abandonar posições antigas; streams separados para eventos que precisam de entrega |
| Navegadores | API nativa e ecossistema consolidado | Biblioteca cliente e autenticação do broker adicionais | MDN classifica como Baseline 2026, disponível nos navegadores recentes desde março; versões antigas e recursos específicos exigem verificação |
| AWS proposta | API Gateway gerencia sockets; Lambda trata eventos | IoT Core gerencia broker/conexões; tópicos autorizados por sala/participante | Não é uma opção de protocolo da API Gateway documentada; requer endpoint/servidor compatível separado |
| Escala | Quotas e custo de mensagens, invocações e estado | Broker facilita distribuição; quotas, políticas e processamento de regras continuam necessários | Gerenciar servidores, capacidade e encaminhamento das sessões |
| Adequação inicial | **Recomendado para validar a corrida atual** | Alternativa se pub/sub ou custo medido justificarem a complexidade | Alternativa se datagramas trouxerem ganho comprovado para o jogo |

WebTransport reduz o bloqueio entre fluxos independentes e permite datagramas, mas não garante latência menor em qualquer rede. A distinção entre esses modelos é descrita pelo [Chrome Developers](https://developer.chrome.com/docs/capabilities/web-apis/webtransport); o suporte atual está na [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport).

No IoT Core, QoS 0 e 1 são suportados; QoS 1 pode entregar mensagens repetidas. Usar IDs e deduplicação em eventos de negócio, não tratar QoS como garantia de resultado único. [Semântica MQTT da AWS](https://docs.aws.amazon.com/iot/latest/developerguide/mqtt.html). Se adotado, restringir publicação/subscrição por usuário/sala, negar escrita do cliente no tópico de resultado e evitar replay de posições antigas após reconexão. O broker não substitui a autoridade do serviço Partidas.

**Hospedagem WebTransport:** a [API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html) documenta APIs REST, HTTP e WebSocket. Não foi identificado nela um endpoint gerenciado WebTransport. Inferência arquitetural: precisaríamos validar um servidor HTTP/3/WebTransport, por exemplo em compute dedicado AWS, mais exposição UDP/QUIC, TLS, roteamento e custo. Ativar HTTP/3 no CloudFront não cria esse backend: a documentação de origem personalizada informa encaminhamento HTTP/1.1. [Comportamento CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorCustomOrigin.html). Essa alternativa não integra a infraestrutura inicial a provisionar.

## 4. Conexão, presença e regra de derrota

Propostas para o protótipo, **ainda sujeitas a D04**:

1. Login via Cognito e ticket curto/descartável emitido por REST para abrir WSS. Validar participante, fase da partida, validade da sessão e permissão por mensagem. Nunca aceitar vencedor informado pelo cliente.
2. No lobby, experimentar heartbeat de aplicação a cada 30 s sem tráfego útil, com resposta contendo ID da solicitação. JavaScript não expõe envio dos frames Ping/Pong do protocolo; usar mensagens como `heartbeat`/`heartbeatAck`. [WebSockets Standard](https://websockets.spec.whatwg.org/#ping-and-pong-frames).
3. Na corrida, experimentar heartbeat após 2 s sem mensagem útil e prazo de suspeita de 10 s, medidos no backend. Esses valores não são regras aprovadas. Mensagens normais podem sinalizar atividade; respostas/acks permitem também avaliar o caminho de volta. Suspensão da aba e perda parcial de rede entram nos testes.
4. O serviço Partidas confirma a queda usando vínculo da conexão atual, último sinal e política validada. O evento `$disconnect` da AWS é entregue por melhor esforço, sem garantia; não pode ser a única evidência de presença. [Comportamento oficial](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-route-keys-connect-disconnect.html).
5. Identificar cada conexão por uma geração. Um fechamento atrasado da conexão anterior não pode invalidar a nova no lobby. A avaliação de prazos é responsabilidade do backend; mensagem do adversário não é prova de abandono. Validar mecanismo que também funcione quando ambos silenciam, sem manter Lambda esperando. DynamoDB TTL serve à limpeza, não ao cronômetro: exclusões podem demorar dias. [TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html).
6. Confirmada a desconexão durante a corrida, aplicar GDD §21.7: vitória do adversário. Reconectar pode permitir consultar o resultado; não autoriza voltar à corrida já perdida. Queda simultânea, falha geral do serviço e eventual tolerância antes da derrota dependem de decisão explícita. O prazo de detecção não deve ser apresentado como uma janela de reconexão já aprovada.
7. Renovar conexão no lobby, com nova autenticação e confirmação de estado/prontidão, antes de ela ficar sem margem de vida útil. Não rotacionar deliberadamente o socket no meio da corrida. D04 precisa definir duração máxima da corrida e tratamento de encerramento provocado pela infraestrutura; sem isso, o risco de 2 h permanece.

Resultado, abandono, chegadas e janela de 20 s devem disputar uma transição atômica/versionada no backend. Heartbeat e posição não são operações críticas para auditoria nem substituem prova de créditos/tempo. A frequência de escrita de presença, o verificador de prazos e sua latência/custo precisam caber no orçamento; não assumir que as capacidades iniciais de DynamoDB já atendem esse tráfego.

## 5. Custo comparável

Não há vencedor de custo universal. Para `M` partidas de `T` segundos, dois jogadores e `r` mensagens por segundo por jogador, com uma entrega ao adversário por entrada:

- Entradas: `2 × M × T × r`; saídas: a mesma quantidade.
- Total: `4 × M × T × r`; conexão: `2 × M × T / 60` minutos.
- Heartbeats, lobby, reenvios, respostas adicionais, tamanho e processamento devem ser somados.

Exemplo analítico: 100 partidas de 120 s, mensagens pequenas, um destinatário por envio:

| Taxa por jogador | Entradas + saídas | Minutos conectados |
| --- | --- | --- |
| 2/s | 96.000 | 400 |
| 5/s | 240.000 | 400 |
| 10/s | 480.000 | 400 |
| 20/s | 960.000 | 400 |
| 60/s | 2.880.000 | 400 |

API Gateway mede mensagens em blocos de 32 KB e minutos conectados; somar Lambda, DynamoDB e logs. IoT Core mede mensagens em blocos de 5 KB e conexão, além de regras/ações aplicáveis. Um relay direto via broker pode evitar Lambda por posição, mas não valida gameplay; para comparar justiça equivalente, incluir o custo da mesma autoridade e persistência nas duas opções. [Preços API Gateway](https://aws.amazon.com/api-gateway/pricing/), [preços IoT Core](https://aws.amazon.com/iot-core/pricing/).

WebTransport em servidor próprio exige estimar compute, rede, eventual balanceador e operação, incluindo tempo ocioso. Escala baixa pode favorecer pagamento por uso; carga sustentada pode mudar a comparação. Usar preços da região escolhida e apresentar custo bruto separado de créditos/franquias; conta AWS ainda não criada.

## 6. Prova necessária para fechar D04

Executar primeiro WebSocket/API Gateway com dois navegadores e carga adicional progressiva. Comparar snapshots a 2, 5, 10 e 20 Hz com interpolação, sem confundir essa frequência com FPS ou taxa de eventos críticos. Ações/marcos devem ser enviados prontamente; incluir esses envios extras no custo. Validar se 2–5 Hz realmente representam bem dash/pulo; não fixar taxa baixa apenas por economia.

Medir RTT p50/p95/p99, idade do estado recebido, fila de envio, atraso visual, perda de conexão, cold starts, throttling, invocações/escritas por partida e custo por 100 corridas. Simular atraso, jitter, perda de pacotes, Wi-Fi interrompido, aba suspensa, mensagem duplicada, logout, queda simultânea e chegada concorrente com desconexão. Testar lobby ocioso por mais de 10 minutos e expiração/renovação de conexão de 2 h; programar esse ensaio prolongado na etapa de implementação.

Os testes de resultado devem preservar créditos após morte sem duplicação, desempates, cronômetro contínuo, janela única de 20 s, DNF e derrota por queda confirmada. D09 define as metas numéricas e carga aceitas pela equipe; aprovar o protótipo exige esses limites e evidência, não apenas abrir um socket.

Se falhar, identificar a causa: **Lambda/estado lento** pode justificar processo dedicado ainda com WebSocket; **bloqueio por perdas e necessidade de estados descartáveis** justifica comparar WebTransport; **custo de distribuição/pub-sub** justifica comparar MQTT/IoT Core com a mesma validação. Trocar protocolo sem isolar a causa pode preservar o problema.

## 7. Decisões que precisam da equipe

- Prazo para confirmar queda e tratamento de queda simultânea/falha de infraestrutura.
- Duração máxima quando ninguém termina; 120 s não é esse limite no GDD.
- Autoridade da simulação/resultado, metas de latência e custo, carga e taxa de snapshots aceitáveis.
- Qualquer permissão para retornar à corrida após queda exige revisão explícita do GDD §21.7.

WebSocket fica recomendado para o protótipo; D04 permanece aberta para validação e regras. MQTT e WebTransport são alternativas estudadas, não novos serviços obrigatórios nem transportes a implementar simultaneamente.
