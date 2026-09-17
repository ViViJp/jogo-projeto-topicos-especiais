# Regras de negócio

Referências: [GDD 1.0.0](../../../gdd.md) e especificação ISN do [ZIP reconciliado](11-reconciliacao-zip.md). RN01–RN09 distinguem regras do jogo e extensões ISN. Novas escolhas técnicas ficam em [decisões pendentes](07-decisoes-pendentes.md), sem reabrir decisões fechadas pelo GDD.

## RN01 — Conta, save e autorização

- Visitante pode jogar a campanha completa e manter um único save local em `localStorage` entre sessões do mesmo navegador, conforme GDD §20. Não há garantia de transferência entre dispositivos sem conta.
- Autenticação externa acrescenta um único save de campanha por conta na nuvem. Backend identifica o proprietário pela sessão e valida leitura, atualização e reinício; o cliente não escolhe outro proprietário.
- Persistir fase, checkpoint, carteira, IDs de créditos consolidados, implantes atuais, ramo narrativo, estado da descida, fragmentos, retry especial, finais e snapshot pré-Portão. O estado corporal deve ser reconstruível após recarregar.
- Checkpoint ativado leva o Continue ao checkpoint; sem checkpoint, ao início da fase. Créditos não consolidados são descartados na retomada.
- Novo Jogo exige confirmação antes de substituir a campanha e zerar carteira/progresso. Não cria outro slot. Cosméticos opcionais permanecem separados.
- Login não deve sobrescrever silenciosamente uma campanha local ou remota. Conflito/importação e troca de conta seguem a proposta D05; detalhes da sincronização não vêm do GDD.

## RN02 — Movimento e ações

- Corrida da esquerda para a direita, velocidade-base fixa; dificuldade por level design. Pulo e slide estão disponíveis desde o início. Não há HUB, sistema de vidas ou chefe no Topo.
- Slide tem duração fixa, reduz hitbox e não pode ser cancelado por pulo; impede ataque, scan e dash.
- Salto duplo exige pernas; ataque/quebra exige braços; scan exige olhos; dash exige propulsores.
- Ataque funciona no ar. Bandido morre com um golpe; drone é indestrutível; contato com ambos é letal. Ataque tem recuperação inicial de 0,3 s após a animação.
- Quebrável para Alex e permite apenas atacar durante a janela inicial de 0,5 s; sem reação, há morte. Essa exceção não altera a regra dos hazards letais.
- Scan manual funciona no chão/no ar sem parar a corrida; pulso inicial de 0,75 s, sem sobreposição. Revela rotas, paredes falsas e armadilhas até sair do trecho. Morte oculta novamente os elementos.
- Dash funciona no chão/no ar, inclusive em queda; não concede invencibilidade; cooldown inicial de 2 s com feedback sonoro. Durante dash não há pulo, slide, ataque ou scan.
- Valores de movimento e combate permanecem sujeitos aos playtests do GDD §26. A matriz completa de compatibilidade é a do GDD §14.11.
- Teclado e gamepad físico devem gerar as mesmas ações e respeitar as mesmas restrições; gamepad não acrescenta poderes, aceleração ou vantagens. Mapeamento e comportamento ao desconectar estão em D01/D02.

## RN03 — Créditos, morte e checkpoints

- Hazard letal causa morte em um hit. Antes do checkpoint, retornar ao início da fase; depois, ao checkpoint.
- Na campanha, checkpoint e fim de fase consolidam créditos. Morte, saída e reinício manual descartam somente os não consolidados, que reaparecem.
- Crédito consolidado tem ID estável por fase/mapa e não pode pontuar novamente no mesmo save, inclusive após reinício manual.
- Reiniciar Fase volta ao início da fase atual e preserva créditos consolidados. Não habilita seleção de fases concluídas.
- Fases 1–4 têm um checkpoint; a Fase 5 começa com um checkpoint sujeito a validação por playtest.
- Checkpoint diegético: videogame e TV de tubo, parada breve segura, animação/feedback, consolidação, save e retomada automática.
- HUD apresenta créditos da fase X/Y e total da campanha. Na descida não há créditos comuns.

## RN04 — Ascensão e clínica

| Fase concluída | Próximo implante | Habilidade liberada |
| --- | --- | --- |
| 1 — Esgoto | Pernas | Salto duplo |
| 2 — Industrial | Braços | Ataque/quebra |
| 3 — Meio Urbano | Olhos | Scan |
| 4 — Corporativo | Propulsores | Dash |

A campanha inclui aceitação consciente de Alex na narrativa e transformação visual. O ZIP esclarece a interface: o procedimento acontece sem opção de aceitar/recusar. Não há decisão sim/não do jogador nem ramo alternativo por recusar os quatro implantes. A recusa narrativa de George acontece na descida, quando Alex pede a remoção. O Topo exige domínio do conjunto e termina no Portão.

## RN05 — Portão e Chrome

- Criar snapshot narrativo automático imediatamente antes da escolha, separado do estado corrente.
- Aceitar conversão leva ao Chrome: Alex encontra fisicamente o pai, que o reconhece, mas não é reconhecido de volta.
- Recusar recarrega o Topo no contexto de descida, com o primeiro glitch. Escolha e progresso subsequente não apagam o snapshot pré-Portão.
- Depois dos créditos, oferecer Continuar do Portão, Novo Jogo, Multiplayer e Menu Principal. Continuar do Portão restaura integralmente a campanha anterior à escolha.

## RN06 — Descida, ReForge, Flesh e Hollow

| Ordem | Setor | Memória | Remoção / perda |
| --- | --- | --- | --- |
| D1 | Topo | Quem Alex era | Propulsores / dash |
| D2 | Corporativo | Rua/voz | Olhos / scan |
| D3 | Meio Urbano | Amigos | Braços / ataque aumentado |
| D4 | Industrial | Família | Pernas / salto duplo |
| Epílogo | Esgoto | Retorno ao lar | Estado humano ou implantes restantes |

- Os glitches são manifestações neurológicas em rotas secretas; não objetos físicos comuns. Recuperar uma memória habilita a próxima da cadeia.
- Mesmos mapas-base, direção horizontal e câmera da subida; ajustes de rotas/obstáculos devem permitir avançar com as habilidades restantes.
- Após a primeira memória, Alex pede ajuda a George, que se recusa. A ReForge recolhe o implante e reconstrói tecido orgânico por bioprinting; remove a habilidade e altera a aparência.
- Na unidade Industrial, o rosto do pai aparece como holograma/interface, não encontro físico.
- Concluir um setor sem memória oferece uma única repetição especial daquele setor. Aceitar reinicia do começo com a cadeia ativa; recusar ou concluir novamente sem a memória quebra a cadeia.
- Reinício manual durante a tentativa permanece disponível e não consome o retry especial por si só. Morte também não equivale a concluir o setor sem memória.
- Recuperação da memória e retirada são eventos distintos: guardar ambos para não repetir nem pular um procedimento após recarregar. O ponto exato de consolidação da memória em morte/checkpoint é uma lacuna do GDD registrada em D10.
- Cadeia quebrada implica Hollow: futuros glitches desaparecem, cessam as retiradas e o corpo preserva exatamente os implantes restantes. Transições/cutscenes abreviam os setores restantes e conduzem ao epílogo.
- Quatro retiradas levam ao Flesh: retorno humano à família, com marcas do bioprinting. Hollow retorna com implantes restantes e incapacidade emocional de reconexão.

## RN07 — Menu, pausa e replay

- Pausa da campanha congela movimento, física, obstáculos, inimigos, animações relevantes e cooldown de dash.
- Reinício é permitido apenas na fase atual. Não há replay livre de fases concluídas; as exceções narrativas são descida, retry especial e retorno ao Portão.
- A corrida multiplayer não pausa. Perder o gamepad não deve ser confundido com desconectar da partida; proposta de fallback em D02.

<<<<<<< HEAD
## RN08 — Multiplayer
=======
1. Ao concluir as Fases 1–4, Alex passa pela clínica do George Vektor.
2. O implante **não é opcional**: o procedimento acontece e a campanha segue. O jogador não escolhe “sim/não”.
3. Ordem fixa:
   - Fase 1 → pernas → salto duplo  
   - Fase 2 → braços → ataque/quebra  
   - Fase 3 → olhos → scan  
   - Fase 4 → propulsores → dash  
4. Implante fica registrado no save e altera o visual/moveset.
>>>>>>> refs/remotes/origin/docs/isn-sprint1

Modo incluído no escopo ISN pelo ZIP RF22/RF23; desenvolvimento após o núcleo narrativo conforme GDD §24.5. O ZIP resolve login, salas e persistência do resultado; D03/D04 mantêm somente os detalhes ainda não definidos.

- Exige dois jogadores autenticados. Visitante deve concluir login antes de criar/entrar em sala ou participar da corrida.
- Backend mantém sala/partida; o jogador cria ou entra em uma sala e a largada exige dois participantes prontos. Código, convite ou descoberta pública ainda não foram escolhidos (D03).
- Backend registra resultado/classificação de cada corrida e o sistema mostra o vencedor. Isso não estabelece ranking global, temporadas ou placar público; visibilidade e retenção estão em D03.

- Dois jogadores, pista própria, sem colisão entre jogadores e sem PvP, quatro implantes disponíveis, duração-alvo aproximada de 120 s e checkpoint central.
- Créditos começam em zero, são individuais e exclusivos da partida. Coleta não remove o item do adversário. Após morte, créditos permanecem e não reaparecem para quem já os coletou.
- Morte retorna ao início ou checkpoint conforme ativação; cronômetro continua.
- Tempo ajustado = tempo bruto − bônus de créditos. Valores iniciais: 20 créditos, 0,5 s por crédito e bônus máximo de 10 s; sujeitos a playtest.
- Quando o primeiro termina, abrir janela de 20 s para o segundo. Se ambos terminarem, comparar tempos ajustados; se o segundo não terminar no prazo, recebe DNF. Terminar primeiro não garante vitória.
- Desempate: mais créditos, depois menor tempo bruto, depois empate.
- Desconexão durante a corrida concede vitória ao adversário. Detecção, quedas simultâneas e abandono antes da largada estão em D04.
- Scan é individual. Não há pausa nem alteração do save, da carteira ou dos finais da campanha.
- Teclado/gamepad são alternativas de entrada; não é obrigatório possuir dois gamepads para uma partida entre dois navegadores, conforme arquitetura proposta.

## RN09 — Cosméticos opcionais

<<<<<<< HEAD
Somente após estabilização do escopo prioritário. Loja no Menu Principal, sem HUB. Separar pontuação total e saldo gastável. Skins não alteram habilidades, hitbox, dificuldade ou finais. Novo Jogo não remove desbloqueios. Vitrine em reais usa somente pagamento simulado; não há gateway real, compra de vidas ou de implantes. Créditos não compram skins da vitrine representativa. Ver GDD §25.

## RN10 — Auditoria, comunicação e operação (extensão ISN)
=======
## 7. Multiplayer

1. Modo separado da campanha: corrida competitiva (dois jogadores).
2. Exige login (pra identificar quem jogou e gravar resultado da partida).
3. Resultado combina tempo e créditos da partida.
4. **Não** altera save da campanha, implantes nem finais.
5. Backend mantém sala/partida e pode guardar ranking simples da corrida.
>>>>>>> refs/remotes/origin/docs/isn-sprint1

Catálogo inicial obrigatório para operações processadas pelo backend:

| Evento | Conteúdo específico além de ator, data UTC, resultado e identificador de correlação |
| --- | --- |
| Login/logout | Provedor e resultado; nunca token, senha ou credencial |
| Criação, sincronização e reinício de campanha | ID da campanha, revisão anterior/nova e tipo da alteração |
| Checkpoint e consolidação | Fase/checkpoint e referência da revisão salva |
| Implante, Portão, memória, retirada, retry e final | Tipo da transição e revisão salva; contemplar também restauração pré-Portão |
| Acesso negado ou conflito de versão | Recurso e motivo, sem conteúdo privado de outro usuário |
| Entrada/saída e encerramento de partida | Partida, participante autenticado, resultado/classificação, DNF ou desconexão |
| Compra simulada, se implementada | Cosmético e tipo de transação, separado da campanha |

<<<<<<< HEAD
Auditoria é persistente, consultável por autorização e não serve como armazenamento do gameplay. Ações locais de visitante não podem ser comprovadas pelo servidor; seu envio posterior é importação declarada, não evento online verificado. Escopo da auditoria offline e retenção estão em D06. Não registrar cada frame ou pressionamento como operação crítica.
=======
1. Operações críticas devem gerar registro: login, logout, criação/atualização de save, escolha do Portão, resultado de partida multiplayer (e compra cosmética se existir).
2. O sistema pode enviar e-mail/notificação (ex.: boas-vindas após primeiro login, ou aviso de progresso relevante).
3. Logs de auditoria servem pra análise posterior, não pra gameplay.
>>>>>>> refs/remotes/origin/docs/isn-sprint1

Proposta D07: primeiro cadastro gera e-mail de boas-vindas e notificação no jogo; conclusão de campanha gera notificação no jogo. Falha no provedor de e-mail não bloqueia login, save ou partida. Repetição de login não repete boas-vindas; retentativas usam uma chave do evento para evitar duplicação.

Ambientes mantêm dados e credenciais separados. Qualquer implantação em nuvem usa Pulumi; produção é publicada automaticamente por CI/CD. A base agora é microsserviços Lambda com tabelas DynamoDB próprias, Cognito, S3/CloudFront, SQS, SES e CloudWatch, conforme documento 12. Conta ainda não criada; quotas, elegibilidade Free Tier, região final e orçamento permanecem D08/D09. Eventos críticos usam registro durável no serviço produtor e projeção assíncrona em Auditoria; indisponibilidade de e-mail não bloqueia save.
