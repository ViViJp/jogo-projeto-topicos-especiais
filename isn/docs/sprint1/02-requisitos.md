# Requisitos funcionais e não funcionais

**Projeto:** Flesh to Chrome  
**Sprint 1:** só documentação (implementação nas próximas sprints)

---

## 1. Requisitos obrigatórios da disciplina

Essa lista é do professor (`requisitos.md`). Todo projeto da ISN precisa atender.  
Não é “requisito do jogo” — é o que a matéria exige do sistema.

### Funcionais (disciplina)

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

### Não funcionais (disciplina)

1. O sistema deve ter boa responsividade.
2. O sistema deve rodar com baixa latência.
3. O sistema deve rodar com custo mínimo de operação.

---

## 2. Requisitos funcionais do nosso projeto (Flesh to Chrome)

Aqui entram os requisitos **do sistema que a gente está construindo**.  
Eles detalham o jogo + como a gente cumpre a lista da disciplina no nosso contexto.

### 2.1 Plataforma, conta e nuvem

| ID | Requisito |
| --- | --- |
| RF01 | O sistema deve disponibilizar o jogo Flesh to Chrome via Web no domínio de produção `nihil-legere-possum.lat`. |
| RF02 | O frontend (Phaser + HTML/JS) deve ser carregado no navegador sob demanda, sem instalação. |
| RF03 | O backend deve expor uma API REST na nuvem (AWS) para atender o frontend. |
| RF04 | O sistema deve documentar a API REST (auth, save, progresso, auditoria, notificações). |
| RF05 | O jogador deve poder autenticar com provedor externo (Google; Apple se for viável). |
| RF06 | O sistema deve persistir em banco: dados do usuário e save da campanha. |
| RF07 | O sistema deve permitir jogar como visitante, mas só deve garantir save entre sessões/dispositivos para usuário autenticado. |
| RF08 | O sistema deve enviar e-mail/notificação em eventos relevantes (ex.: boas-vindas no primeiro login). |
| RF09 | O sistema deve registrar operações críticas: login, logout, criar/atualizar save, escolha do Portão (e compra cosmética se existir). |
| RF10 | O sistema deve ter ambientes de desenvolvimento e de produção. |
| RF11 | O sistema deve ser implantado com IaC (Pulumi). |
| RF12 | O ambiente de produção deve ser implantado automaticamente com CI/CD. |

### 2.2 Gameplay e campanha

| ID | Requisito |
| --- | --- |
| RF13 | O jogo deve ser um auto-runner 2D: Alex corre automaticamente; o jogador controla pulo e slide desde a Fase 1. |
| RF14 | A campanha de ascensão deve ter 5 fases (setores) em Glitch City. |
| RF15 | Ao concluir as Fases 1–4, o jogador deve acessar a clínica e poder aceitar um implante. |
| RF16 | Os implantes devem seguir a ordem: pernas (salto duplo), braços (ataque), olhos (scan), propulsores (dash). |
| RF17 | Cada implante aceito deve liberar a habilidade correspondente e ficar registrado no save. |
| RF18 | Perigos letais devem matar em 1 hit e reiniciar do último checkpoint. |
| RF19 | O jogador deve poder coletar créditos; checkpoint consolida a pontuação da campanha. |
| RF20 | Na Fase 5 (Portão), o jogador deve escolher entre Final Chrome (aceitar) ou iniciar a descida (recusar). |
| RF21 | O save autenticado deve guardar no mínimo: fase/setor, implantes, créditos consolidados e caminho escolhido. |
| RF22 | Multiplayer competitivo é secundário: só entra se o núcleo (campanha + save + requisitos de nuvem) estiver ok. |

Obs.: números de balanceamento / level design o Victor ainda pode ajustar nas regras de negócio e no GDD.

---

## 3. Requisitos não funcionais do nosso projeto

Além dos 3 da disciplina, para o Flesh to Chrome:

| ID | Requisito |
| --- | --- |
| RNF01 | Boa responsividade: UI e jogo usáveis em desktop (Chrome/Firefox). |
| RNF02 | Baixa latência: login/save pela API sem travar a sessão de jogo. |
| RNF03 | Custo mínimo: preferir serviços sob demanda na AWS (região `sa-east-1`). |
| RNF04 | Resolução lógica alvo do jogo: 1280×720, com scaling no browser. |

---

## 4. Rastreio rápido (disciplina → nosso RF)

| Disciplina | Nosso RF |
| --- | --- |
| Cliente-servidor Web | RF01, RF02, RF03 |
| Frontend sob demanda | RF02 |
| Backend na nuvem | RF03 |
| API REST documentada | RF04 |
| Auth provedor externo | RF05 |
| Persistência em banco | RF06, RF21 |
| Docs modelagem/arquitetura | docs desta sprint (+ próximas) |
| E-mail/notificações | RF08 |
| Auditoria | RF09 |
| Dev e prod | RF10 |
| IaC | RF11 |
| CI/CD produção | RF12 |
| Responsividade / latência / custo | RNF01–RNF03 |

---

## Sobre esta entrega

Sprint 1 = especificação. Código, Pulumi e CI/CD vêm depois pra ir fechando RF01–RF12 e a lista do professor.
