# Reconciliação com a versão enviada em ZIP

## Fonte e método

Arquivo fornecido pelo responsável: `jogo-projeto-topicos-especiais-docs-isn-sprint1.zip`, originalmente em `/home/victorblum/Downloads/`.

- SHA-256 do ZIP: `cb006c715bc143cd17f06f271b7ae0894d30f7e4bd95acb3cfd2df8bcb8b2a7c`.
- SHA-256 do GDD (igual nas duas cópias locais e nas duas cópias do ZIP): `fde6272c4f1612bb46f4c8a5eb5955e8bd254015dd0c31ce255b8ee7a7e313fa`.
- Comparação de todos os arquivos do ZIP por conteúdo com o workspace; para separar novidades das edições desta revisão, documentos ISN também foram comparados com a base Git anterior às correções.
- O conteúdo foi lido como fonte de especificação e evidência. Nenhum script do ZIP foi executado e nenhuma instrução interna foi adotada como comando de trabalho.

## O que mudou na versão recebida

| Grupo | Resultado da comparação |
| --- | --- |
| GDD da raiz e `flesh-to-chrome/docs/gdd.md` | Idênticos aos locais, byte a byte; não há nova revisão de design. |
| Código do jogo, configurações, assets e demais arquivos fora de `isn/` | Os arquivos contidos no ZIP são idênticos aos correspondentes locais. Não houve código novo a importar. |
| ISN: requisitos, regras, casos, diagramas e fluxos | Cinco documentos têm conteúdo novo em relação à base Git anterior à nossa revisão. |
| ISN: resumo e índices originais | Sem novidades em relação à base Git; nossa documentação ampliada foi mantida. |
| Imagens | Oito PNGs novos, incluindo multiplayer. Foram inspecionados; o conteúdo novo foi incorporado às figuras geradas da nossa fonte única, sem substituir diagramas completos por versões resumidas. |

A cena multiplayer continua sendo um stub. Gamepad não aparece no código nem no GDD do ZIP; a inclusão do controle físico vem da solicitação explícita do responsável nesta conversa.

## Respostas encontradas e incorporadas

Os caminhos abaixo são relativos à raiz interna do ZIP, não afirmações sobre o texto anterior da nossa revisão.

| Evidência no ZIP | Definição | Atualização aplicada |
| --- | --- | --- |
| `isn/docs/sprint1/02-requisitos.md`, RF22; `03-regras-de-negocio.md`, §7.2; `04-casos-de-uso.md`, UC09 | Multiplayer exige dois jogadores autenticados. | RN08, RF-J11, atores/UC13, contrato de partidas e fluxos exigem login. Parte de D03 resolvida. |
| `04-casos-de-uso.md`, UC09; `05-diagramas-de-blocos.md`, módulo Multiplayer; `06-fluxogramas.md`, §4 | Criar/entrar em sala mantida pelo backend; corrida começa com dois prontos. | Salas e prontidão deixam de ser hipótese; descoberta/convite continua pendente. |
| `02-requisitos.md`, RF23; `04-casos-de-uso.md`, UC09; `06-fluxogramas.md`, §4 | Backend registra resultado/ranking da corrida e mostra vencedor. | RF-J14, RN08, UC13, modelo, API e diagramas incluem resultado/classificação persistidos. Não pressupõe ranking global. |
| `03-regras-de-negocio.md`, §8 | Resultado multiplayer é operação crítica. | Evento de auditoria explicitamente inclui partida, participantes e resultado/classificação. |
| `02-requisitos.md`, RF15; `03-regras-de-negocio.md`, §5; `04-casos-de-uso.md`, UC05; `06-fluxogramas.md`, §3 | Clínica não oferece escolha de aceitar/recusar. | Retirada a ambiguidade de “confirmar procedimento” no UC05. Aceitação consciente de Alex no GDD permanece narrativa. |
| `02-requisitos.md`, RF22/RF23; remoção de “só se o núcleo estiver ok” das regras §7 | Multiplayer faz parte do escopo ISN. | Não tratado como opcional por sobra de tempo. Cronograma do GDD mantém a implementação depois da campanha. |

A regra §7.5 do ZIP usa “pode guardar ranking”, mas RF23, UC09 e o fluxo determinam o registro. A consolidação adota o requisito explícito de resultado/classificação por partida; visibilidade, retenção e eventual classificação global não são inferidas.

## Pendências que continuam

- D01/D02: botões, compatibilidade, remapeamento e desconexão do gamepad.
- D03, parcialmente resolvida: forma de localizar/compartilhar salas, topologia concreta, visibilidade/retenção e tela de histórico de resultados.
- D04: transporte, autoridade, frequência de sincronização, timeout, queda simultânea e abandono pré-largada. O GDD continua determinando derrota por desconexão durante corrida.
- D05: reconciliação de save local/remoto, importação e troca de conta.
- D06–D09: detalhes de auditoria, comunicações, serviços/custos e metas mensuráveis.
- D10: persistência de memória quando há morte antes da retirada.
- D11: implementação/sincronização da loja opcional.

Detalhes e propostas vigentes: [07-decisoes-pendentes.md](07-decisoes-pendentes.md).

## Divergências antigas que o ZIP ainda não resolve

| Texto no ZIP | Referência e tratamento nesta revisão |
| --- | --- |
| RF07 e regras §1 não garantem persistência entre sessões para visitante. | GDD §20 prevê `localStorage`, e `flesh-to-chrome/src/systems/SaveState.ts` já o utiliza. Mantido save local no mesmo navegador; conta é necessária para nuvem/transferência entre dispositivos. A divergência foi registrada, não tratada como revogação silenciosa do GDD. |
| Regras §1 ainda deixam múltiplos slots em aberto. | GDD §20 define save único. Mantida a correção de save único e confirmação de Novo Jogo. |
| Regras §6 deixam chances da descida em aberto. | GDD §18.6 define repetição especial e quebra da cadeia. Mantida essa regra. |
| Fluxo de login usa ausência de save como gatilho de boas-vindas; loop ainda possui `Nao_letal` para morte. | Mantidas as correções: primeiro cadastro dispara boas-vindas; fluxo de gameplay distingue perigo letal e janela de quebrável. |

## Limites da atualização

Foram atualizados somente documentos, dados dos diagramas e figuras na pasta `isn/`. O GDD e o código do jogo foram preservados. Fontes do ZIP não substituíram automaticamente o trabalho anterior; novidades foram integradas com identificação de origem e manutenção das pendências reais.
