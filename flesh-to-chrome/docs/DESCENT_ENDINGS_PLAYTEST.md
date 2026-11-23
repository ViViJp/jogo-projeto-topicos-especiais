# Playtest — Descida e finais alternativos

## Preparacao

1. Inicie um Novo Jogo e conclua as cinco fases.
2. No Portao, confirme que as opcoes Chrome e Flesh estao disponiveis.
3. O save pre-Portao deve criar a opcao `Continuar do Portao` no menu.

## Final Chrome

1. Escolha Chrome.
2. Avance as quatro paginas do final.
3. Resultado esperado: `FINAL CHROME`; o save registra `endingReached = chrome`
   e a confirmação final abre a avaliação antes do retorno ao menu.

## Final Flesh

1. Use `Continuar do Portao`, escolha Flesh e percorra Topo, Corporativo,
   Meio Urbano e Industrial.
2. Antes do Topo, confirme a cena em que George reprova a decisao, recusa a
   retirada e Alex afirma que nao e uma obra.
3. Em cada setor, atravesse o `memory_glitch` antes da saida e confirme que a
   lembranca explica um motivo humano para abandonar o cromo.
   Antes da coleta, a porta ReForge no final deve aparecer fechada e indicar
   acesso bloqueado. Depois da coleta, deve trocar imediatamente para o sprite
   aberto e indicar acesso autorizado. Repita nas quatro fases da descida.
4. Complete a sequencia ReForge depois de cada memoria. Confirme que as três
   primeiras retiradas mostram o operador ciborgue anônimo. O rosto do pai deve
   aparecer somente na última retirada, quando as pernas mecânicas são vendidas
   e o salto duplo deixa de existir.

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
   atrás do spawn. A metade esquerda da tela deve continuar preenchida apenas
   por piso plano, sem vazio nem obstáculo antes de Alex. O lacre da ReForge
   deve usar o sprite metálico próprio e, ao ser atacado, quebrar em seis
   fragmentos que se espalham, giram, caem e desaparecem. A propaganda do pai
   deve aparecer no início deste recorte, enquanto o fragmento permanece no
   final. No Meio Urbano, o primeiro bandido deve estar à frente, com tempo de
   reação, e nunca sobreposto a Alex no início. A travessia de salto duplo deve
   usar a grade elétrica urbana ciano/azul, sem o retângulo vermelho de
   blockout. No Industrial, Alex deve começar vivo em piso neutro: o teto baixo
   que antes sobrepunha o spawn não pode aparecer nem manter colisão letal. A
   fase deve usar seus gaps naturais e não pode exibir o piso elétrico da D3.
   No Topo, quebrar qualquer barricada deve reproduzir a mesma leitura da Fase
   3: seis fragmentos se espalham, giram, caem e desaparecem.
   Depois da porta ReForge do Topo não deve permanecer visível nenhum conteúdo
   do trecho contemplativo usado pela subida. O piso deve continuar sob toda a
   largura da porta, sem deixar sua metade direita suspensa sobre o vazio.
6. Depois da última retirada, confirme o trecho do Esgoto com cerca de 5
   segundos, sem implantes, tutorial, hazards ou vãos. Alex deve apenas correr
   sobre chão contínuo antes da casa da família e do Final Flesh.
7. Resultado esperado: epilogo no Esgoto, `FINAL FLESH`, as quatro habilidades
   em `false` e a tela opcional de avaliação antes do retorno ao menu.

## Final Hollow e retry especial

1. Use `Continuar do Portao`, escolha Flesh e termine um setor sem tocar no glitch.
2. Resultado esperado na primeira falha: tela `MEMORIA PERDIDA`, com as opcoes
   de repetir ou aceitar Hollow e o nome da memória correspondente ao setor.
   Esquerda sempre seleciona repetir, direita sempre seleciona Hollow e ambas
   as opções aceitam clique.
3. Escolha repetir e termine novamente sem o glitch.
4. Resultado esperado: a cadeia quebra sem uma terceira tentativa; o epilogo
   mostra o corpo correspondente aos implantes ainda presentes e leva a
   `FINAL HOLLOW`.
5. Repita a verificacao escolhendo `CONTINUAR` na primeira oferta; o resultado
   tambem deve ser Hollow.
6. Repita as cenas de retry, epílogo e finais em uma janela ultrawide. Painéis,
   escolhas, porta, personagem, textos e rodapé devem permanecer centralizados
   na área lógica expandida, sem se prender aos 1280 px da resolução-base.
7. Depois de `FINAL HOLLOW`, confirme que a avaliação identifica Hollow em
   roxo, preserva sua música e permite voltar ao menu sem alterar o save.

## Verificacao automatica

```sh
npm run typecheck
npm run validate:assets
npm run test:narrative
npm run test:gameplay
npm run build
```
