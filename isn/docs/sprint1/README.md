# Sprint 1 — Especificação do sistema

Projeto **Flesh to Chrome**, ISN 2026.2. Equipe ISN: João Pedro e Victor Blum. Domínio previsto: `nihil-legere-possum.lat`.

Esta entrega documenta o jogo completo planejado e os serviços de nuvem. Implementação e implantação são etapas posteriores. Referência: [GDD 1.0.0](../../../gdd.md). 

| Documento | Conteúdo | Issue original |
| --- | --- | --- |
| [01 — Resumo](01-resumo-do-projeto.md) | Produto, narrativa, prioridades e arquitetura | #18 |
| [02 — Requisitos](02-requisitos.md) | Disciplina, produto e critérios de validação | #19 |
| [03 — Regras de negócio](03-regras-de-negocio.md) | Campanha, save, finais, multiplayer e serviços | #20 |
| [04 — Casos de uso](04-casos-de-uso.md) | UC01–UC15, incluindo gamepad e multiplayer | #21 |
| [05 — Diagramas](05-diagramas-de-blocos.md) | Arquitetura, entrada, multiplayer e dados | #22 |
| [06 — Fluxogramas](06-fluxogramas.md) | Campanha completa, serviços, gamepad e corrida | #23 |
| [07 — Decisões pendentes](07-decisoes-pendentes.md) | O que precisa ser verificado pela equipe | — |
| [08 — Modelagem de dados](08-modelagem-de-dados.md) | Entidades, campos e invariantes | — |
| [09 — API REST](09-api-rest.md) | Contrato inicial proposto | — |
| [10 — Rastreabilidade](10-rastreabilidade.md) | Relação entre requisitos, GDD e documentos | — |
| [12 — AWS e microsserviços](12-arquitetura-aws-microsservicos.md) | Arquitetura gerenciada, escalabilidade, Free Tier e custos | — |
| [13 — Transporte multiplayer](13-transporte-multiplayer.md) | Comparação MQTT, WebTransport e WebSocket; timeouts, custos e plano de validação | — |
| [14 — Salas e notificações](14-salas-e-notificacoes.md) | D03/D07 aprovadas, modelagem, eventos e custos | — |

## Diagramas e versões estáticas

A fonte única é [diagramas.json](../diagramas.json). Para atualizar Mermaid e os 18 SVGs juntos, executar a partir da raiz do repositório:

```bash
python3 isn/scripts/gerar_diagramas.py
```

Editar a fonte JSON para alterar os diagramas, não os SVGs ou os blocos gerados isoladamente. As figuras em [imagens](../imagens/) são SVG/XML UTF-8. Elementos pendentes/propostos usam rótulos Dxx e tracejado; ver documento 07.
