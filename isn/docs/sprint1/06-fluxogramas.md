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

![Fluxo login](../imagens/fluxo-login.png)

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

![Fluxo gameplay](../imagens/fluxo-gameplay.png)

---

## 3. Clínica → implante → habilidade (sem escolha)

O jogador **não escolhe** se coloca o implante. Depois da fase 1–4 o procedimento acontece e a habilidade é liberada.

```mermaid
flowchart TD
  fimFase([Concluiu fase 1-4]) --> clinica[Cena da clinica]
  clinica --> marca[Implante instalado]
  marca --> libera[Libera habilidade nova]
  libera --> auth{Jogador autenticado?}
  auth -->|Sim| save[Salva no backend]
  save --> audit[Registra na auditoria]
  audit --> proxima[Segue pra proxima fase]
  auth -->|Nao| proxima
```

![Fluxo clínica](../imagens/fluxo-clinica.png)

---

## 4. Multiplayer competitivo

```mermaid
flowchart TD
  menu([Menu multiplayer]) --> login{Autenticado?}
  login -->|Nao| auth[Faz login]
  auth --> sala
  login -->|Sim| sala[Cria ou entra na sala]
  sala --> prontos{2 jogadores prontos?}
  prontos -->|Nao| espera[Aguarda / cancela]
  espera --> sala
  prontos -->|Sim| corrida[Corrida tempo + creditos]
  corrida --> resultado[Calcula vencedor]
  resultado --> rank[Grava ranking da partida]
  rank --> fim([Volta ao menu])
  rank -.-> saveCampanha[Nao altera save da campanha]
```

![Fluxo multiplayer](../imagens/fluxo-multiplayer.png)

---

## 5. Deploy em produção (alto nível)

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

![Fluxo deploy](../imagens/fluxo-deploy.png)

Esse fluxo é o alvo da disciplina (CI/CD + IaC). Na Sprint 1 a gente só especifica; a implementação vem depois.
