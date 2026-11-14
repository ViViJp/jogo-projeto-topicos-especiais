# Validação — polimento visual e áudio

Documento da branch `feat/visual-audio-polish`.

## Cobertura audiovisual

- `AudioManager` centraliza onze chaves de BGM e trinta e quatro chaves de SFX.
  As músicas das cinco fases, menu/prólogo, clínica/ReForge, Portão e finais
  Chrome, Flesh e Hollow são carregadas sob demanda: o Boot registra apenas os
  efeitos pequenos, e cada cena solicita somente sua faixa. Uma troca de cena
  interrompe e destrói a música anterior antes de iniciar a próxima.
- As trinta e duas fontes de SFX existentes estão registradas; chaves ainda sem
  arquivo permanecem como no-op sem quebrar a cena.
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
- O menu principal reutiliza as camadas urbanas da Fase 3 em um fundo animado,
  coberto por degradê escuro. Título, painel tecnológico e indicador amarelo de
  seleção se reposicionam a partir das dimensões atuais da tela. A opção de
  seleção de fases fica disponível apenas no ambiente de desenvolvimento.
- A nova tela de controles apresenta teclado/mouse, gamepad e os implantes que
  liberam cada habilidade. Ela reutiliza a música do menu sem reiniciá-la. Ao
  abrir a partir de **Novo Jogo**, o save só é substituído ao confirmar
  **Iniciar Campanha**; a opção permanente **Controles** é somente consultiva.
  Ao confirmar, a `LoadingScene` central assume a transferência, mostra o
  progresso e só revela o prólogo quando ele estiver criado, evitando a tela
  preta observada em servidores remotos.
- O master original de 17 MB da Fase 1 foi convertido de Vorbis 450 kbps para
  128 kbps, mantendo os 5min06s, estéreo e 44,1 kHz em um arquivo de 4,6 MB.
  Ao terminar o prólogo, essa música é carregada e decodificada por trás da
  `LoadingScene`; a `GameScene` só assume a tela depois de emitir `CREATE`.
- A conclusão de cada clínica apresenta um tutorial do implante adquirido. O
  painel reutiliza a variante atual de Alex e demonstra salto duplo, ataque,
  scan ou dash, deriva os comandos da configuração central e exige confirmação
  explícita em **Continuar** antes de salvar e avançar.

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
   ao entrar em uma fase ou cena narrativa, a rede solicita somente o master
   correspondente, sem baixar o restante do catálogo;
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
7. em 16:9 e ultrawide, o menu preenche toda a área visível, mantém título e
   opções legíveis sobre Glitch City e não contém o seletor temporário de fases;
8. a tela de controles mantém os dois painéis, implantes e botões dentro da
   moldura; teclado, mouse e gamepad conseguem iniciar a campanha e voltar;
9. abrir **Controles** pelo menu e voltar não altera o save; abrir **Novo Jogo**,
   voltar e cancelar também preserva o save, enquanto **Iniciar Campanha** o
   substitui e segue para o prólogo.
   Em rede lenta, a tela de controles deve permanecer visível com o estado
   **Preparando Prólogo**, sem apagar o save ou exibir um quadro preto;
   ao confirmar a última página, ela deve permanecer visível com
   **Preparando/Inicializando Primeiro Setor** até a Fase 1 estar pronta;
10. as quatro clínicas mostram nome, habilidade, descrição e comandos corretos;
    a animação corresponde ao implante recém-adquirido, o clique fora de
    **Continuar** não pula o painel e a confirmação salva uma única vez antes
    de abrir a próxima fase;
11. execute `npm run dev:movement-debug`, deixe Alex correr em um trecho plano
    da Fase 1 e depois realize slides consecutivos. O painel deve ser atualizado
    depois da física e manter `sprite.x`, `body.x`, velocidade, câmera, posição
    aparente, bloqueios laterais, estado, frame e FPS estáveis. A fila dos 180
    quadros mais recentes pode ser consultada no console com
    `game.scene.getScene("GameScene").getMovementDebugSamples()`;
12. repita uma corrida no multiplayer: câmera, oponente e parallax devem seguir
    a mesma referência visual, sem alterar snapshots, largada ou cronômetro.

Se apenas o desenho do slide oscilar enquanto `sprite.x`, `body.x` e a posição
aparente permanecem contínuos, o próximo ajuste deve ser feito nos spritesheets.
Se `body.x` recuar ou `blocked.left/right` mudar, a investigação deve seguir
para as trocas de hitbox e colisões, sem recalibrar gravidade ou `tileBias`.
