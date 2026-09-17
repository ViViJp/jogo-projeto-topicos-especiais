# Requisitos funcionais e não funcionais

Esta especificação mantém os requisitos da disciplina e acrescenta os requisitos do produto. **Documentado não significa implementado.** Critérios numéricos novos são propostas de validação, identificadas em [D09](07-decisoes-pendentes.md).

## Requisitos funcionais da disciplina

A numeração abaixo corresponde a RF-ISN-01 até RF-ISN-12.

1. O sistema deve ser uma aplicação cliente-servidor sobre plataforma Web.
2. O sistema deve ter aplicação a ser executada no navegador do cliente, o *frontend*, cujo código deve ser descarregado sob demanda.
3. O sistema deve ter aplicação na nuvem, o *backend*, para atender às requisições do *frontend*.
4. O sistema deve ter documentação de API RESTful para comunicação entre *frontend* e *backend*.
5. O sistema deve ter acesso controlado por esquema de autenticação e autorização via provedores externos, como por exemplo Google, Apple e outros.
6. O sistema deve possuir persistência de dados de usuários em banco de dados.
7. O sistema deve ter documentação de modelagem de dados e de arquitetura do sistema.
8. O sistema deve ser capaz de enviar email e notificações para os usuários.
9. O sistema deve registrar todas as operações críticas dos usuários no sistema para posterior análise.
10. O sistema deve possuir cenários de desenvolvimento e de produção.
11. O sistema deve ser implantado em nuvem, em qualquer cenário, com o uso de IaC.
12. O sistema deve ser implantado automaticamente em ambiente de produção com o uso de CI/CD.

| ID | Aplicação e evidência de especificação |
| --- | --- |
| RF-ISN-01 | Navegador e backend separados; diagrama de visão geral. |
| RF-ISN-02 | HTML/JS/assets carregados sob demanda; UC01. |
| RF-ISN-03 | Microsserviços Lambda/API Gateway e serviços gerenciados AWS no documento 12; quotas/plano/custos em D08. |
| RF-ISN-04 | [Contrato REST inicial](09-api-rest.md), incluindo autenticação, dados e erros. |
| RF-ISN-05 | Cognito federado com Google para autenticação; autorização por proprietário no backend; RN01, UC02/04/08. |
| RF-ISN-06 | Conta, campanha, notificações e auditoria; [modelo de dados](08-modelagem-de-dados.md). |
| RF-ISN-07 | Modelo lógico, dicionário de dados e [arquitetura](05-diagramas-de-blocos.md). |
| RF-ISN-08 | E-mail e notificação dentro do jogo como canais distintos; UC07, D07 aprovada; compra gera aviso apenas no jogo. |
| RF-ISN-09 | Catálogo de eventos críticos e persistência de auditoria; RN10. |
| RF-ISN-10 | Desenvolvimento local e produção separados; recursos dev em nuvem, quando usados, isolados de prod. |
| RF-ISN-11 | Todo recurso implantado na nuvem, em dev ou prod, definido em Pulumi. |
| RF-ISN-12 | Pipeline de produção: validação, build, IaC, publicação e verificação. |

## Requisitos funcionais do produto

| ID | O sistema deve… | Referência / aceite documental |
| --- | --- | --- |
| RF-J01 | Executar corrida automática com pulo/slide, hazards e ações compatíveis com o estado atual. | RN02; GDD §14; UC03. |
| RF-J02 | Percorrer cinco setores e conceder quatro implantes em ordem fixa, alterando visual e habilidades. | RN04; UC05. |
| RF-J03 | Consolidar créditos por ID em checkpoint/fim de fase e evitar duplicação. | RN03; UC03/09. |
| RF-J04 | Manter um save local, continuar do checkpoint e confirmar a substituição por Novo Jogo. | RN01/03; UC04/09. |
| RF-J05 | Oferecer save vinculado à conta e acesso somente aos dados do próprio usuário. | UC02/04; D05 aprovada: escolha explícita, revisão e isolamento de cache por conta. |
| RF-J06 | Salvar o estado pré-Portão e oferecer Chrome ou descida, além de retorno ao Portão após finais. | RN05/06; UC06/12. |
| RF-J07 | Implementar quatro memórias, retry especial e retirada sequencial; morte, reinício manual e saída perdem memória ainda não consolidada, e retirada consolida memória e remove habilidade. | RN06; UC10/11. |
| RF-J08 | Concluir Flesh ou Hollow conforme o estado da cadeia, com aparência e epílogo correspondentes. | RN06; UC10/12. |
| RF-J09 | Exibir prólogo, arco de George, pai/propagandas e cenas dos finais. | GDD §§15–18; UC05/06/10/12. |
| RF-J10 | Permitir pausa e reinício da fase atual na campanha, sem seleção livre de fases concluídas. | RN07; UC09. |
| RF-J11 | Oferecer corrida multiplayer para dois jogadores autenticados, com criação/entrada em salas mantidas pelo backend e regras independentes da campanha. | RN08; UC13; D03 aprovada para salas; sincronização em D04. |
| RF-J12 | Aceitar gamepad físico no navegador para ações de jogo e navegação de menus. | UC14; D02 aprovada: queda do controle pausa campanha, não multiplayer; mapeamento/compatibilidade D01. |
| RF-J13 | Se a loja opcional for implementada, salvar e sincronizar aquisições na conta compradora, separadas do save; usar apenas compras cosméticas/simuladas. | RN09; UC15; não é requisito do núcleo. |
| RF-J14 | Registrar no backend resultado/classificação da corrida e exibir o vencedor, sem alterar campanha, implantes ou finais. | RN08; UC13; ranking global não está definido. |

A [matriz de rastreabilidade](10-rastreabilidade.md) relaciona os requisitos aos casos e diagramas. Login no multiplayer, salas e resultado persistido são requisitos definidos. O cronograma segue a campanha antes do multiplayer, sem retirar o modo do escopo ISN.

## Requisitos não funcionais da disciplina

1. O sistema deve ter boa responsividade.
2. O sistema deve rodar com baixa latência.
3. O sistema deve rodar com custo mínimo de operação.

## Critérios de validação propostos

Os valores abaixo são metas iniciais para discussão, não medições da build nem exigências numéricas do professor.

| ID | Critério | Como verificar |
| --- | --- | --- |
| RNF01 — responsividade | Resolução lógica 1280 × 720, escala proporcional, HUD/menus legíveis e sem cortes; teclado e gamepad nas ações previstas. | Validar viewports 1280 × 720, 1366 × 768 e 1920 × 1080 em Chrome/Chromium e Firefox desktop. Mobile/touch continuam fora do escopo. |
| RNF02 — gameplay | Meta proposta de 60 FPS no equipamento de referência; chamadas de save/e-mail não bloqueiam a simulação. | Registrar frame times em uma fase completa com rede lenta e indisponível; equipamento e tolerância em D09. |
| RNF03 — API | Meta proposta de p95 ≤ 500 ms para leitura/gravação de save, com 10 usuários simultâneos, excluindo redirecionamento ao provedor externo. | Medir do cliente até a resposta, registrando região, rede, tamanho do payload e eventuais cold starts. |
| RNF04 — multiplayer | Medir RTT, idade do estado, fila de envio, divergência, atraso de ações e detecção de queda; resultado deve obedecer RN08. | Comparar taxas de snapshots e testar inatividade, expiração, queda simultânea e suspensão da aba conforme documento 13. Limiares/carga seguem em D04/D09; não declarar baixa latência atendida antes das medições. |
| RNF05 — custo | Usar arquitetura serverless/gerenciada do documento 12 e estimar custo bruto, créditos e franquias separadamente; definir teto antes de provisionar. | Planilha/estimativa por carga e alarmes de orçamento; teto e carga em D08/D09. Região `sa-east-1` é previsão, não comprovação de menor custo. |
| RNF07 — microsserviços e escala | Separar implantação, IAM, contratos e dados de Conta, Campanha, Partidas, Comunicações e Auditoria; usar serviços AWS gerenciados. | Validar que pico/falha de um domínio não exige publicar os demais; testar concorrência, filas, throttling e recuperação. Documento 12; sem pressupor escala gratuita ilimitada. |
| RNF06 — integridade e acesso | Rejeitar acesso a save alheio e atualizações conflitantes; não duplicar créditos consolidados ou resultado de partida. | Cenários de autorização, reenvio e versões concorrentes descritos nos contratos. |

O [registro de decisões](07-decisoes-pendentes.md) separa critérios propostos das regras já estabelecidas no GDD.
