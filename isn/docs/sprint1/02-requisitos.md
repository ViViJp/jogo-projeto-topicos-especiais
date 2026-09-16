# Requisitos funcionais e não funcionais

**Projeto:** Flesh to Chrome  
**Sprint 1:** só documentação (a implementação desses itens vem nas próximas sprints)

---

## Importante

Os requisitos abaixo **não são inventados pelo nosso time**.  
São a lista oficial da disciplina (`requisitos.md` do repositório ISN): **todo projeto** precisa atender.

O Flesh to Chrome é o *tema* do sistema. A arquitetura (frontend web + backend na nuvem + auth + banco + etc.) existe pra **cumprir** essa lista.

---

## Requisitos funcionais (disciplina)

Lista do professor:

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

### Como o Flesh to Chrome pretende atender (visão da Sprint 1)

| # | Como encaixa no nosso projeto |
| --- | --- |
| 1 | Site + API: cliente no browser, servidor na AWS. |
| 2 | Jogo Phaser (HTML/JS) servido sob demanda em `nihil-legere-possum.lat`. |
| 3 | Backend REST (Node) na nuvem respondendo login, save, etc. |
| 4 | Vamos documentar a API REST (endpoints de auth, save, auditoria…). |
| 5 | Login com provedor externo (ex.: Google; Apple se der). |
| 6 | Banco com dados de usuário e save da campanha. |
| 7 | Docs de modelagem/arquitetura (esta pasta `docs/` + próximas entregas). |
| 8 | E-mail/notificação (ex.: boas-vindas após primeiro login). |
| 9 | Log de operações críticas (login, save, escolha do Portão…). |
| 10 | Ambiente de desenvolvimento e de produção. |
| 11 | Implantação com IaC (Pulumi, como a disciplina usa). |
| 12 | Produção sobe com CI/CD. |

---

## Requisitos não funcionais (disciplina)

Lista do professor:

1. O sistema deve ter boa responsividade.
2. O sistema deve rodar com baixa latência.
3. O sistema deve rodar com custo mínimo de operação.

### Como pensamos isso no projeto

| # | Aplicação no Flesh to Chrome |
| --- | --- |
| 1 | Interface e jogo usáveis no desktop (alvo principal do runner). |
| 2 | Login/save pela API sem travar a sessão de jogo. |
| 3 | Preferir serviços baratos / sob demanda na AWS; região `sa-east-1`. |

---

## Contexto do nosso sistema (não é requisito do professor)

Isso aqui é só pra explicar **o que** o sistema faz. Não substitui a lista de cima.

- Jogo: auto-runner cyberpunk *Flesh to Chrome* (Alex, Glitch City, implantes, Portão).
- Domínio de produção: `nihil-legere-possum.lat`.
- Stack prevista: Phaser (frontend) + API Node + banco + OAuth + AWS/Pulumi.
- Detalhes de gameplay (fases, créditos, clínica, finais) estão nas regras de negócio e no GDD; o Victor ainda pode ajustar.

---

## Sobre esta entrega

Na Sprint 1 a gente **especifica** (resumo, requisitos, regras, casos de uso, diagramas, fluxogramas).  
Cumprir de fato cada item da lista do professor (código, IaC, CI/CD, e-mail…) é trabalho das sprints seguintes.
