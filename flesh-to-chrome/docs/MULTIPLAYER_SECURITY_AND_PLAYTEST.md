# Multiplayer WebRTC: confiança, recuperação e playtest

## Limites de confiança da arquitetura P2P

O multiplayer é cliente-autoritativo: posição, créditos, checkpoint, tempo e
resultado são produzidos pelo navegador de cada jogador e enviados diretamente
ao oponente. O protocolo rejeita valores malformados ou incompatíveis com a
corrida atual, mas isso **não transforma o outro cliente em uma fonte
confiável**. Um cliente modificado ainda pode simular movimentos possíveis,
omitir mortes ou informar um resultado falso dentro dos limites aceitos.

As proteções atuais têm o objetivo de evitar corrupção acidental, pacotes
atrasados e abusos triviais:

- toda mensagem de jogo informa `protocolVersion`;
- cada largada cria um `raceId`, usado para descartar mensagens de corridas
  anteriores;
- sequências, timestamps, coordenadas, velocidades, créditos e duração têm
  limites explícitos;
- snapshots precisam ser monotônicos em sequência, horário, créditos e
  checkpoint;
- `race-start` só é aceito do peer determinístico que coordena a sala e dentro
  da janela esperada da contagem regressiva;
- `race-finish` precisa ser coerente com o início, o tempo decorrido, o total de
  créditos do mapa e o deadline de 20 segundos;
- SDP, ICE, IDs de sala e peer também são validados antes de chegar ao WebRTC.

Uma modalidade competitiva com premiação ou ranking exige servidor
autoritativo (ou validação/replay no servidor). O servidor de sinalização atual
apenas encaminha presença, SDP e ICE e não pode certificar o resultado.

## Largada em duas fases

O coordenador envia `race-prepare` somente depois de receber `peer-state` pronto.
O oponente responde `race-ready`; só então é enviado `race-start` com quatro
segundos de antecedência. Preparação e confirmação precisam ter o mesmo
`raceId`. Se qualquer etapa não for concluída em oito segundos, a tentativa é
cancelada, o lobby mostra a falha e uma nova tentativa só pode começar depois de
um pequeno intervalo.

## Reconexão

A reconexão do WebSocket não reaproveita automaticamente os DataChannels:

1. a fila antiga de SDP e ICE é descartada;
2. os `RTCPeerConnection` antigos são fechados sem declarar derrota imediata;
3. uma nova presença dispara negociação completa e cria novos DataChannels;
4. o peer tem dez segundos para se recuperar;
5. após a recuperação, o cliente reenvia largada, snapshot e eventual
   resultado/DNF da corrida atual;
6. se o prazo expirar, a desconexão é definitiva e o oponente vence.

Mensagens antigas que ainda alcancem o cliente são rejeitadas por versão,
`raceId`, sequência e consistência temporal.

## Restauração após morte

O respawn preserva créditos, checkpoint e cronômetro, mas restaura os elementos
mutáveis da pista:

- barricadas destruídas são recriadas por ID;
- o collider antigo é destruído junto da barricada;
- uma restauração repetida nunca cria uma segunda barricada/collider para o
  mesmo ID;
- grupos revelados por scan voltam ao estado oculto;
- portas reutilizam as zonas existentes e recalculam o estado pelo relógio da
  corrida, sem recriar corpos físicos;
- ao final da restauração, o runtime verifica quantidade de barricadas,
  colliders ativos e grupos de scan. Uma inconsistência gera erro explícito.

## Testes automatizados

Execute na pasta `flesh-to-chrome`:

```bash
npm run test:multiplayer
npm run typecheck
npm run build
npm run validate:assets
```

`test:multiplayer` cobre mensagens válidas e inválidas, versão, IDs, limites de
snapshot, largada, resultado, SDP/ICE e o descarte da fila obsoleta após a
reconexão do WebSocket. O teste também simula a reabertura da sinalização e
confirma que o `RTCPeerConnection` antigo é fechado e substituído por uma nova
negociação.

## Evidência de integração local

Em 5 de novembro de 2026 foi executado um teste com dois Firefox 158 headless,
em perfis isolados, conectados por WebRTC ao servidor local:

| Cenário | Resultado |
| --- | --- |
| Entrada de dois peers na mesma sala | aprovado |
| Handshake `prepare → ready → start` | aprovado |
| Diferença observada entre HUDs após a largada | aproximadamente 70 ms |
| Snapshots, progresso e créditos remotos | aprovado |
| Coleta independente de crédito | aprovado |
| Mortes e respawns repetidos com cronômetro contínuo | aprovado |
| Invariantes de barricadas/colliders/scan após respawn | aprovado |
| Saída abrupta de um peer | aprovado; vitória após a tolerância de 10 s |

Esse teste valida a integração entre dois processos, mas não substitui o teste
em dois dispositivos físicos e redes/NATs distintos.

## Roteiro de aceite em dois dispositivos

Use dois dispositivos reais e marque cada item no comentário do PR:

- [ ] ambos entram pelo mesmo convite e veem IDs distintos;
- [ ] a contagem regressiva só aparece depois de ambos estarem prontos;
- [ ] os dois cronômetros iniciam juntos;
- [ ] posição, animação, progresso e créditos do oponente são atualizados;
- [ ] cada jogador coleta créditos de forma independente;
- [ ] o checkpoint central muda o local de respawn;
- [ ] antes e depois do checkpoint, destruir/revelar obstáculos e morrer os
      restaura sem objetos sobrepostos nem colisão invisível;
- [ ] portas continuam sincronizadas após o respawn;
- [ ] interromper a sinalização por menos de dez segundos renegocia os
      DataChannels e mantém a corrida;
- [ ] desconectar um dispositivo por mais de dez segundos concede vitória;
- [ ] ambos concluem a pista e exibem o mesmo vencedor, tempos e créditos;
- [ ] o segundo colocado recebe DNF quando ultrapassa o limite de 20 segundos.

Registre navegador, sistema, tipo de rede, uso de STUN/TURN e, se possível,
vídeo ou screenshots dos dois HUDs. Para testar redes diferentes, configure TURN
conforme o README.
