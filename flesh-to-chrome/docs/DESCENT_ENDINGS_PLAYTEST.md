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
2. Em cada setor, atravesse o `memory_glitch` antes da saida.
3. Complete a sequencia ReForge depois de cada memoria.

| Setor | Glitch | Remocao | Habilidade que deve desaparecer |
| --- | --- | --- | --- |
| Topo | quem Alex era | propulsores | dash |
| Corporativo | voz da rua | olhos | scan |
| Meio Urbano | amigos | bracos | ataque |
| Industrial | familia | pernas | salto duplo |

4. Resultado esperado: epilogo no Esgoto, `FINAL FLESH` e as quatro
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
