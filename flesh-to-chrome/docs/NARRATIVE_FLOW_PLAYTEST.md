# Validação — fluxo narrativo até o Final Chrome

Documento da branch `feat/campaign-gate-chrome`.

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
      Flesh  → aviso de conteúdo em desenvolvimento
```

## Regras narrativas

- O prólogo apresenta a família, a ausência do pai, a precariedade, o jornal e
  a motivação de Alex.
- George começa nervoso e atento aos riscos, ganha confiança, passa a falar em
  reputação e termina tratando Alex como sua grande obra.
- A propaganda da Fase 4 utiliza `propaganda-pai.png` e deixa explícito que
  Alex reconhece o rosto da campanha.
- O Portão cria um snapshot independente antes de qualquer escolha.
- Chrome apresenta o reencontro físico: o pai reconhece Alex, mas Alex não o
  reconhece e continua andando.
- Flesh não altera o save e permanece marcado como conteúdo em desenvolvimento.
- `Continuar do Portão` restaura fase, checkpoint, créditos, carteira e os
  quatro implantes sem consumir o snapshot.

## Validação automatizada

Execute na raiz:

```bash
npm test
npm run build
```

O teste `test:narrative` valida cenas registradas, assets narrativos, arco das
quatro clínicas, transição da Fase 5, escolha Chrome, placeholder Flesh e a
criação/restauração real do save pré-Portão em `localStorage` simulado.

## Roteiro manual

1. Selecione **Novo Jogo** e confirme que o prólogo possui três quadros.
2. Avance pelas quatro clínicas e observe a mudança visual e textual de George.
3. Na Fase 4, confirme que a propaganda exibe o asset do pai e o texto narrativo.
4. Complete a Fase 5 e confirme a abertura do Portão.
5. Selecione Flesh e confirme o aviso sem perder a possibilidade de escolha.
6. Selecione Chrome e assista aos quatro quadros do Final Chrome.
7. No menu, selecione **Continuar do Portão**.
8. Confirme que o Portão foi restaurado com carteira e implantes preservados.
