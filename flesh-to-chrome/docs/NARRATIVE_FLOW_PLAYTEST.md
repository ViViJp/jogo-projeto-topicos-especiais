# Validação — fluxo narrativo e finais

Documento atualizado para a branch de descida Flesh/Hollow.

## Fluxo implementado

```text
Novo Jogo
  → Prólogo
  → Fases 1–4 + clínicas de George
  → Propaganda do pai na Fase 4
  → Fase 5
  → Save pré-Portão
  → Escolha Chrome/Flesh
      Chrome → Final Chrome → Menu → Continuar do Portão
      Flesh  → reprovação de George → descida → glitches → ReForge
             → Final Flesh ou Hollow
```

## Regras narrativas

- O prólogo apresenta a família, a ausência do pai, a precariedade, o jornal e
  a motivação de Alex. A arte diferencia o pai humano anterior à ascensão do
  retrato ciborgue publicado no jornal.
- George começa nervoso e atento aos riscos, ganha confiança, passa a falar em
  reputação e termina tratando Alex como sua grande obra. Cada clínica usa um
  sprite próprio: uniforme humilde, profissional em ascensão, cirurgião
  ambicioso e a aparência final orgulhosa.
- A propaganda da Fase 4 utiliza `propaganda-pai.png`, identifica a campanha
  como parte do programa de ascensão da Glitch Corp e deixa explícito que Alex
  reconhece o rosto do pai.
- O Portão cria um snapshot independente antes de qualquer escolha.
- O seletor de fases permite abrir o Portão diretamente em modo de teste. Abrir
  e sair com ESC/B não cria snapshot; confirmar Flesh inicia a descida de teste
  com os quatro implantes e passa a usar o save da cadeia narrativa.
- Chrome apresenta o reencontro físico com `pai-portrait.png`: o pai reconhece
  Alex, mas Alex não o reconhece e continua andando.
- O Final Chrome só é registrado em `endingReached` depois que o jogador
  confirma o último quadro. Selecionar Chrome ou apenas abrir o epílogo não é
  suficiente para marcar o final como concluído.
- Flesh inicia com a cena em que George reprova a decisão de Alex e se recusa a
  desmontar sua obra. Cada glitch recupera uma memória/motivação, e cada
  procedimento ReForge mostra o holograma corporativo do pai antes da retirada.
- `Continuar do Portão` restaura fase, checkpoint, créditos, carteira e os
  quatro implantes sem consumir o snapshot.

## Validação automatizada

Execute na raiz:

```bash
npm run test:narrative
npm run validate:assets
npm run typecheck
npm run build
```

O teste `test:narrative` valida cenas registradas, assets narrativos, arco das
quatro clínicas, transição da Fase 5, escolhas Chrome/Flesh, recusa de George e a
criação/restauração real do save pré-Portão em `localStorage` simulado. Também
valida glitches, retirada sequencial dos implantes, retry, ReForge e os três
finais reproduzíveis.

## Roteiro manual

1. Selecione **Novo Jogo** e confirme que o prólogo possui quatro quadros, com
   a família, o pai antes da ascensão e o pai convertido no jornal.
2. Avance pelas quatro clínicas e observe a mudança visual e textual de George.
3. Na Fase 4, confirme que a propaganda exibe o asset do pai e o texto narrativo.
4. No seletor de fases, abra **Portão — escolha final (teste)**, pressione
   **ESC/B** e confirme o retorno sem criar snapshot.
5. No Portão, valide que esquerda seleciona Chrome, direita seleciona Flesh e
   que cima/baixo alternam entre as opções.
6. Selecione Flesh e confirme a cena de confronto: George chama Alex de sua
   obra, Alex explica por que abandonará o cromo e a descida começa no Topo.
7. Complete a Fase 5 na campanha e confirme a abertura normal do Portão.
8. Selecione Chrome e avance até o quarto quadro do Final Chrome sem confirmá-lo;
   valide que `endingReached` ainda não foi atualizado.
9. Confirme o último quadro, volte ao menu e valide que o Final Chrome foi
   registrado somente nesse momento.
10. No menu, selecione **Continuar do Portão**.
11. Confirme que o Portão foi restaurado com carteira e implantes preservados.
12. Siga `DESCENT_ENDINGS_PLAYTEST.md` para validar memórias, holograma do pai,
    bioprinting, perda de habilidades e finais Flesh/Hollow.
