# Playtest — Descida e finais alternativos

## Preparacao

1. Inicie um Novo Jogo e conclua as cinco fases.
2. No Portao, confirme que as opcoes Chrome e Flesh estao disponiveis.
3. O save pre-Portao deve criar a opcao `Continuar do Portao` no menu.

## Final Chrome

1. Escolha Chrome.
2. Avance as quatro paginas do final.
3. Resultado esperado: `FINAL CHROME`; o save registra `endingReached = chrome`.

## Final Flesh

1. Use `Continuar do Portao`, escolha Flesh e percorra Topo, Corporativo,
   Meio Urbano e Industrial.
2. Antes do Topo, confirme a cena em que George reprova a decisao, recusa a
   retirada e Alex afirma que nao e uma obra.
3. Em cada setor, atravesse o `memory_glitch` antes da saida e confirme que a
   lembranca explica um motivo humano para abandonar o cromo.
4. Complete a sequencia ReForge depois de cada memoria. Confirme que o primeiro
   procedimento mostra o pai de Alex, que o segundo mostra um operador ciborgue
   diferente e que o pai retorna no terceiro e no último. Todos devem aparecer
   durante a avaliacao/venda do implante.

| Setor | Glitch | Remocao | Habilidade que deve desaparecer |
| --- | --- | --- | --- |
| Topo | quem Alex era | propulsores | dash |
| Corporativo | voz da rua | olhos | scan |
| Meio Urbano | amigos | bracos | ataque |
| Industrial | familia | pernas | salto duplo |

5. Valide os recortes sem morrer: Topo, Corporativo, Meio Urbano e Industrial
   devem levar aproximadamente 30 segundos cada. Eles começam depois das áreas
   de tutorial e exigem, respectivamente: todas as habilidades; visor + salto
   duplo + ataque; salto duplo + ataque; e salto duplo.
   No Corporativo, nenhum tile/plataforma do segmento anterior deve aparecer
   atrás do spawn. No Meio Urbano, o primeiro bandido deve estar à frente, com
   tempo de reação, e nunca sobreposto a Alex no início.
6. Depois da última retirada, confirme o trecho do Esgoto com cerca de 8
   segundos, sem implantes e sem tutorial, antes da casa da família.
7. Resultado esperado: epilogo no Esgoto, `FINAL FLESH` e as quatro
   habilidades em `false`.

## Final Hollow e retry especial

1. Use `Continuar do Portao`, escolha Flesh e termine um setor sem tocar no glitch.
2. Resultado esperado na primeira falha: tela `MEMORIA PERDIDA`, com as opcoes
   de repetir ou aceitar Hollow.
3. Escolha repetir e termine novamente sem o glitch.
4. Resultado esperado: a cadeia quebra sem uma terceira tentativa; o epilogo
   mostra o corpo correspondente aos implantes ainda presentes e leva a
   `FINAL HOLLOW`.
5. Repita a verificacao escolhendo `CONTINUAR` na primeira oferta; o resultado
   tambem deve ser Hollow.

## Verificacao automatica

```sh
npm run typecheck
npm run validate:assets
npm run test:narrative
npm run test:gameplay
npm run build
```
