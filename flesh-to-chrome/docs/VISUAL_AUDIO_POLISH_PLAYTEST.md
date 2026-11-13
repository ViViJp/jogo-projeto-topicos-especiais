# Validação — polimento visual e áudio

Documento da branch `feat/visual-audio-polish`.

## Cobertura audiovisual

- `AudioManager` centraliza oito chaves de BGM e trinta e quatro chaves de SFX.
  Os cinco masters musicais existentes pertencem às fases e são carregados sob
  demanda: o Boot registra apenas os efeitos pequenos, e `GameScene` solicita
  somente a faixa da fase atual. Uma troca de cena interrompe e destrói a faixa
  anterior antes de iniciar a próxima.
- Menu/prólogo, clínica e Portão/finais mantêm roteamento explícito, mas ficam
  silenciosos enquanto não tiverem masters aprovados. As trinta e duas fontes
  de SFX existentes estão registradas; chaves ainda sem arquivo permanecem
  como no-op sem quebrar a cena.
- Corrida, aterrissagem, pulo, pulo duplo, slide, ataque, scan, dash, morte,
  inimigos, créditos, checkpoint, conclusão de fase, implantes e interfaces
  possuem feedback sonoro.
- Passos e slide usam loops associados ao estado de Alex; scan termina junto
  do pulso visual. Os loops pausam com o jogo e são destruídos no shutdown da
  cena, evitando caudas e sobreposição entre tentativas.
- As cinco fases usam músicas fornecidas pela equipe. Na Fase 1,
  água tóxica e fios elétricos respondem à proximidade. Na Fase 2, esteiras
  soam somente durante o contato, o bip de aviso fica restrito às prensas e
  prensa, vapor e braço mecânico disparam seus efeitos somente ao entrar no
  estado ativo e visível. Passos, slide, esteira e máquinas tiveram volumes
  reduzidos para evitar mascaramento quando eventos coincidem.
- O braço extensível da Fase 2 usa carcaça e garra de 64 px sem deformação; um
  `TileSprite` repete o eixo conforme o curso. Sua base permanece fixa, a garra
  acompanha a extensão e a colisão continua usando a geometria do mapa. Braço
  e prensa exibem luz laranja intermitente durante `warning`.
- O slide usa quatro frames dedicados a 10 FPS para cada estado de implante.
  A entrada não repete: ao manter o comando, Alex conserva o quarto frame.
  O checkpoint usa cinco frames dedicados para cada estado de implante,
  separados em sentar, interagir e levantar; a sequência completa dura 1,5 s.
  A televisão sincroniza com pulsos e varredura em ciano/verde.
- O crédito coletável usa o spritesheet cyberpunk final de quatro frames em
  todas as cinco fases e no multiplayer, preservando a flutuação existente.
  Ataque, impacto, morte, pouso e derrota de inimigos receberam
  partículas/tweens curtos sem alterar hitboxes.
- O HUD ganhou painel, hierarquia e nomenclatura consistentes com a interface
  diegética do jogo.

## Assets narrativos finalizados

Família, pai humano, pai convertido, jornal, propaganda, unidade ReForge e os
dois hologramas foram substituídos por pixel art final e registrados em
`docs/ASSET_REGISTRY.md`. O Portão, George e os inimigos já possuíam arte
coerente e foram preservados.

## Verificação

Execute:

```bash
npm run typecheck
npm run validate:assets
npm run test:gameplay
npm run test:narrative
npm run test:multiplayer
npm run build
```

No playtest manual, confirme em 16:9 e ultrawide:

1. nenhuma BGM continua tocando sobre a cena seguinte;
   ao entrar em uma fase, a rede solicita somente o respectivo
   `bgm-phase-N.ogg`, sem baixar as outras quatro faixas;
2. o slide executa quatro poses uma vez, mantém a base alinhada e atravessa
   corretamente os obstáculos baixos das Fases 1 e 2;
3. passos, esteira e slide não se acumulam nem continuam durante pausa; os
   efeitos industriais tocam uma vez por transição de estado e somente quando
   o obstáculo está próximo da câmera;
4. prólogo, ReForge e finais exibem os retratos finais sem deformação.
5. em cada fase, Alex permanece à esquerda da TV, conclui a animação de
   levantar antes de correr e pausa/salva/retorna sem atravessar o gabinete.
6. os três braços mecânicos da Fase 2 mantêm a carcaça no teto, repetem o eixo
   sem esticar os pixels, alinham a garra à hitbox durante extensão/retração e
   piscam a luz laranja no aviso; as prensas também piscam sem adicionar um
   segundo alarme aos demais hazards.
