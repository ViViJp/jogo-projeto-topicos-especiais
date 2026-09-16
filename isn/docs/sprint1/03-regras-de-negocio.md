# Regras de negócio

Projeto: Flesh to Chrome  
Fonte: GDD do time (pode ser ajustado pelo Victor ao longo do semestre)

---

## 1. Conta e persistência

1. Visitante pode abrir o site e jogar sem login, mas o progresso **não** fica garantido entre dispositivos/sessões.
2. Jogador autenticado (OAuth, ex. Google) tem save vinculado à conta.
3. O save guarda no mínimo: fase/setor atual, implantes aceitos, créditos consolidados, caminho (ascensão / Chrome / descida), checkpoints relevantes.
4. **Novo Jogo** reinicia a carteira de créditos e o progresso da campanha daquela conta (ou cria um novo slot, se a gente decidir ter mais de um save — ainda em aberto).

---

## 2. Loop de gameplay

1. Alex corre sozinho da esquerda pra direita. O jogador não controla velocidade.
2. Ações básicas desde o início: **pulo** e **slide**.
3. Habilidades extras só existem depois do implante correspondente.
4. Dificuldade cresce pelo level design (espaçamento e combinação de obstáculos), não por acelerar a corrida.

---

## 3. Morte e checkpoint

1. Perigos letais (espinho, laser, queda, inimigo, etc.): **1 hit = morte**.
2. Ao morrer, o jogador volta ao **último checkpoint**.
3. Créditos já consolidados no checkpoint **permanecem**.
4. Créditos pegos depois do último checkpoint **são perdidos** na morte e voltam a aparecer no trecho.
5. Objetos quebráveis (caixa/barricada) não matam na hora: tem uma janela curta pra atacar; se não reagir, morre.

---

## 4. Créditos

1. Crédito é pontuação da campanha no MVP.
2. Checkpoint consolida o que foi coletado até ali.
3. Fim da fase consolida o restante.
4. Cada crédito tem id próprio no save pra não farmar o mesmo item várias vezes (anti-farming).
5. Na descida (caminho Flesh/Hollow) **não** tem crédito comum — o foco são glitches/memórias.

Se no futuro existir loja de skin:

- **pontuação total** não diminui;
- **saldo** pode ser gasto só em cosmético;
- gastar não muda dificuldade nem finais.

---

## 5. Clínica e implantes

1. Ao concluir as Fases 1–4, Alex passa pela clínica do George Vektor.
2. Aceitar o implante é necessário pra liberar a habilidade e seguir a campanha como desenhado.
3. Ordem fixa:
   - Fase 1 → pernas → salto duplo  
   - Fase 2 → braços → ataque/quebra  
   - Fase 3 → olhos → scan  
   - Fase 4 → propulsores → dash  
4. Implante aceito fica registrado no save e altera o visual/moveset.

---

## 6. Portão e finais

1. A Fase 5 termina no **Portão**.
2. **Aceitar** conversão → Final Chrome (chegou no topo, mas perdeu a humanidade).
3. **Recusar** → inicia a descida (caminho Flesh).
4. Na descida, recuperar memórias/glitches permite tirar implantes em sequência e voltar humano (Final Flesh).
5. Falhar de forma definitiva na cadeia da descida pode levar ao **Hollow** (volta parcial, sem reconectar de verdade).
6. Detalhes exatos de quantas chances na descida ainda podem ser afinados no GDD; a regra de negócio pra sistema é: a escolha do Portão define o ramo narrativo persistido no save.

---

## 7. Multiplayer (secundário)

1. Não altera save da campanha nem finais.
2. É uma corrida separada (tempo + créditos da partida).
3. Só entra no escopo se o núcleo (campanha + save + requisitos de nuvem) estiver ok.

---

## 8. Auditoria e comunicação

1. Operações críticas devem gerar registro: login, logout, criação/atualização de save, escolha do Portão, (e compra cosmética se existir).
2. O sistema pode enviar e-mail/notificação (ex.: boas-vindas após primeiro login, ou aviso de progresso relevante).
3. Logs de auditoria servem pra análise posterior, não pra gameplay.

---

## 9. Ambientes

1. Existe ambiente de **desenvolvimento** e de **produção**.
2. Produção usa o domínio `nihil-legere-possum.lat`.
3. Implantação em nuvem via IaC; produção sobe com CI/CD.
