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
      Chrome → Final Chrome → Avaliação → Menu → Continuar do Portão
      Flesh  → reprovação de George → descida → glitches → ReForge
             → Final Flesh ou Hollow → Avaliação → Menu
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
- Chrome apresenta o reencontro físico com a ilustração conjunta
  `endings/chrome-father-son.png`: o pai reconhece Alex, mas Alex não o
  reconhece e continua andando.
- Flesh e Hollow usam `prologue/familia.png`, com avô e tio juntos, para
  representar a casa. O retrato do pai não pode aparecer como família nesses
  dois finais.
- Depois da última ReForge, o save mantém `epiloguePending` até Alex alcançar a
  saída do trecho jogável do Esgoto. Fechar e continuar antes disso restaura o
  corredor, em vez de saltar diretamente para o epílogo.
- O Final Chrome só é registrado em `endingReached` depois que o jogador
  confirma o último quadro. Selecionar Chrome ou apenas abrir o epílogo não é
  suficiente para marcar o final como concluído.
- Depois da última confirmação de Chrome, Flesh ou Hollow, a campanha abre a
  `FeedbackScene`. Ela preserva a música correspondente ao final, identifica o
  desfecho alcançado e oferece o formulário opcional por QR Code ou nova aba.
  Voltar ao menu, inclusive com ESC/B, não lê nem modifica o save.
- Flesh inicia com a cena em que George reprova a decisão de Alex e se recusa a
  desmontar sua obra. Cada glitch recupera uma memória/motivação, e cada
  três primeiros procedimentos ReForge mostram um operador ciborgue anônimo; o
  holograma do pai aparece somente no último, antes da retirada das pernas e da
  perda do salto duplo.
- `Continuar do Portão` restaura fase, checkpoint, créditos, carteira e os
  quatro implantes sem consumir o snapshot.
- Todas as trocas de campanha passam pela `LoadingScene`, que permanece acima
  da cena de destino até o carregamento e o `create()` terminarem. Isso cobre
  prólogo, fases, clínicas, Portão, descida, epílogos e avaliação.

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
criação/restauração real do save pré-Portão em `localStorage` simulado. Um
harness mínimo de Phaser também instancia as cenas e aciona seus handlers para
validar prévia sem escrita, retry por direção/confirmar/clique, retomada do
Esgoto, variante corporal Hollow e registro tardio de Flesh. A suíte ainda
valida glitches, retirada sequencial dos implantes, ReForge e os três finais
reproduzíveis.

## Roteiro manual

1. Selecione **Novo Jogo** e confirme que o prólogo possui quatro quadros, com
   a família, o pai antes da ascensão e o pai convertido no jornal.
2. Avance pelas quatro clínicas e observe a mudança visual e textual de George.
3. Na Fase 4, confirme que a propaganda exibe o asset do pai e o texto narrativo.
4. Complete a Fase 5 e alcance o Portão pelo fluxo normal da campanha.
5. No Portão, valide que esquerda seleciona Chrome, direita seleciona Flesh e
   que cima/baixo alternam entre as opções. Em viewport largo, o fundo deve
   ocupar toda a tela sem borda preta à direita; o subtítulo deve ficar entre
   o título e o portão, sem sobrepor a arte.
6. Selecione Flesh e confirme a cena de confronto: George chama Alex de sua
   obra, Alex explica por que abandonará o cromo e a descida começa no Topo.
7. Complete a Fase 5 na campanha e confirme a abertura normal do Portão.
8. Selecione Chrome e avance até o quarto quadro do Final Chrome sem confirmá-lo;
   valide que `endingReached` ainda não foi atualizado.
9. Confirme o último quadro e valide que o Final Chrome foi registrado somente
   nesse momento e que a tela de avaliação é aberta antes do menu.
10. No menu, selecione **Continuar do Portão**.
11. Confirme que o Portão foi restaurado com carteira e implantes preservados.
12. Siga `DESCENT_ENDINGS_PLAYTEST.md` para validar memórias, holograma do pai,
    bioprinting, perda de habilidades e finais Flesh/Hollow.
13. Nos quadros finais Flesh e Hollow, confirme que a imagem da casa mostra o
    avô e o tio juntos. O retrato ciborgue do pai deve aparecer somente em
    Chrome.
14. Durante as transições, simule cache vazio e rede lenta: a tela temática deve
    permanecer visível, informar o destino e nunca expor um canvas preto.
15. Feche o jogo imediatamente depois da quarta retirada e use **Continuar**.
    Alex deve retornar ao corredor curto do Esgoto; depois de alcançar a saída,
    um novo **Continuar** deve abrir o epílogo, sem repetir o corredor.
16. Falhe a descida depois de quantidades diferentes de retiradas. O Alex do
    Final Hollow deve manter o mesmo estágio corporal do epílogo e informar a
    quantidade correta de implantes restantes.
17. Nos três finais, valide a identificação Chrome/Flesh/Hollow, a continuidade
    da música, a leitura do QR Code e a abertura do formulário em nova aba.
    Navegue pelos dois botões com teclado, mouse e gamepad; ESC/B deve voltar ao
    menu sem exigir resposta e sem alterar o save. Repita em 16:9 e ultrawide.
