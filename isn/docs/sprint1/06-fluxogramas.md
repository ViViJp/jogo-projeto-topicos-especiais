# Fluxogramas

Projeto: Flesh to Chrome  
Sprint 1

---

## 1. Login OAuth → sessão → carregar save

```mermaid
flowchart TD
  start([Abre o site]) --> menu[Menu do jogo]
  menu --> quer{Quer salvar progresso?}
  quer -->|Nao| jogarLivre[Joga sem conta]
  quer -->|Sim| login[Entrar com Google]
  login --> okAuth{Auth ok?}
  okAuth -->|Nao| menu
  okAuth -->|Sim| criaUser[Backend cria/atualiza usuario]
  criaUser --> auditLogin[Registra login na auditoria]
  auditLogin --> temSave{Existe save?}
  temSave -->|Sim| carrega[Carrega save]
  temSave -->|Nao| novo[Cria save inicial]
  carrega --> campanha[Vai pra campanha]
  novo --> email[Envia email de boas-vindas]
  email --> campanha
  jogarLivre --> fimLivre([Joga so local])
  campanha --> fimOk([Pronto pra jogar])
```

![Fluxo login](../imagens/fluxo-login.svg)

---

## 2. Loop de gameplay (fase)

```mermaid
flowchart TD
  inicio([Inicia fase]) --> corre[Alex corre automatico]
  corre --> obstaculo{Aparece obstaculo / perigo?}
  obstaculo -->|Nao| corre
  obstaculo -->|Sim| acao[Jogador pulo / slide / habilidade]
  acao --> resultado{Deu certo?}
  resultado -->|Nao_letal| morte[Morte 1 hit]
  morte --> perdeCred[Perde creditos nao consolidados]
  perdeCred --> checkpoint[Volta ao ultimo checkpoint]
  checkpoint --> corre
  resultado -->|Sim| passouCheck{Passou checkpoint?}
  passouCheck -->|Sim| consolida[Consolida creditos]
  consolida --> corre
  passouCheck -->|Nao| fimFase{Fim da fase?}
  fimFase -->|Nao| corre
  fimFase -->|Sim| clinicaOuProximo([Clinica ou Portao])
```

![Fluxo gameplay](../imagens/fluxo-gameplay.svg)

---

## 3. Clínica → implante → habilidade

```mermaid
flowchart TD
  fimFase([Concluiu fase 1-4]) --> clinica[Cena da clinica]
  clinica --> aceita{Aceita implante?}
  aceita -->|Sim| marca[Marca implante no estado]
  marca --> libera[Libera habilidade nova]
  libera --> auth{Jogador autenticado?}
  auth -->|Sim| save[Salva no backend]
  save --> audit[Registra na auditoria]
  audit --> proxima[Segue pra proxima fase]
  auth -->|Nao| proxima
  aceita -->|Nao| bloqueio[Fica sem a habilidade / campanha incompleta]
  bloqueio --> nota[Regra final de recusa pode ser ajustada no GDD]
```

![Fluxo clínica](../imagens/fluxo-clinica.svg)

---

## 4. Deploy em produção (alto nível)

```mermaid
flowchart TD
  dev([Dev faz push no Git]) --> ci[Pipeline CI]
  ci --> testes{Build / checks ok?}
  testes -->|Nao| falha[Pipeline falha]
  falha --> corrige[Corrige e push de novo]
  corrige --> ci
  testes -->|Sim| pulumi[Pulumi aplica IaC]
  pulumi --> aws[Recursos na AWS]
  aws --> domain[Atualiza / aponta nihil-legere-possum.lat]
  domain --> prod([Producao no ar])
```

![Fluxo deploy](../imagens/fluxo-deploy.svg)

Esse fluxo é o alvo da disciplina (CI/CD + IaC). Na Sprint 1 a gente só especifica; a implementação vem depois.
