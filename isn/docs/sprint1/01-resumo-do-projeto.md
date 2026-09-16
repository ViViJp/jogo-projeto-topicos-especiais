# Resumo do projeto

**Projeto:** Flesh to Chrome  
**Disciplina:** ISN 75620501 — 2026.2  
**Domínio:** https://nihil-legere-possum.lat  
**Equipe:** João Pedro, Victor Blum

## O que é

Flesh to Chrome é um jogo 2D de auto-runner cyberpunk no navegador. O jogador controla Alex Murphy, que mora nos níveis mais baixos de Glitch City e quer chegar no topo da sociedade. Pra subir, ele vai trocando partes do corpo por implantes (pernas, braços, olhos, propulsores). Cada upgrade libera uma habilidade nova, mas ele vai ficando menos humano.

A ideia em uma frase: quanto mais poderoso o personagem fica no gameplay, menos humano ele fica na história.

## Por que precisa de nuvem / backend

A disciplina exige (pra todo projeto) cliente-servidor web, frontend sob demanda, backend na nuvem, API REST documentada, auth com provedor externo, banco, e-mail/notificação, auditoria, ambientes dev/prod, IaC e CI/CD. Ver `02-requisitos.md`.

No Flesh to Chrome isso aparece assim:

- login com provedor externo (Google, por exemplo)
- salvar progresso entre sessões (fase, implantes, créditos, escolha do Portão)
- mandar e-mail / notificação pro usuário
- registrar operações críticas (auditoria)

O jogo em si (Phaser) roda no browser; o backend existe pra atender esses requisitos e persistir a campanha.

## Como o sistema funciona (visão geral)

- **Frontend:** jogo Phaser baixado sob demanda no navegador
- **Backend:** API REST na AWS (Node)
- **Banco:** persistência de usuário e save
- **Auth:** OAuth (Google)
- **Infra:** AWS + Pulumi (IaC) + CI/CD em produção

O jogador abre o site, carrega o frontend, autentica se quiser salvar, e o jogo conversa com a API quando precisa persistir dados.

## Escopo desta sprint

Sprint 1 = **só documentação** (resumo, requisitos, regras, casos de uso, diagramas e fluxogramas).  
Ainda não implementamos API, Pulumi nem CI/CD — isso vem depois, pra ir fechando a lista obrigatória da disciplina.

O jogo já tem GDD/protótipo em outro repo (tópicos especiais). Aqui na ISN o foco é a infraestrutura em nuvem em volta desse produto.
