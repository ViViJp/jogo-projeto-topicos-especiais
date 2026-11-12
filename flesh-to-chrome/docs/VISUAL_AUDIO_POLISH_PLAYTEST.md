# Validação — polimento visual e áudio

Documento da branch `feat/visual-audio-polish`.

## Cobertura audiovisual

- `AudioManager` centraliza as chaves de oito BGMs/ambientes e vinte e sete efeitos. Uma
  troca de cena interrompe e destrói a faixa anterior antes de iniciar a
  próxima.
- Menu/prólogo, clínica, Portão/finais e cada uma das cinco fases possuem
  roteamento explícito. A seleção atual de vinte e quatro SFX está registrada; chaves
  ainda sem master permanecem silenciosas sem quebrar a cena.
- Corrida, aterrissagem, pulo, pulo duplo, slide, ataque, scan, dash, morte,
  inimigos, créditos, checkpoint, conclusão de fase, implantes e interfaces
  possuem feedback sonoro.
- Passos e slide usam loops associados ao estado de Alex; scan termina junto
  do pulso visual. Os loops pausam com o jogo e são destruídos no shutdown da
  cena, evitando caudas e sobreposição entre tentativas.
- Esgoto e Industrial usam os ambientes fornecidos pela equipe. Na Fase 1,
  água tóxica e fios elétricos respondem à proximidade. Na Fase 2, esteiras
  soam somente durante o contato, o aviso usa um bip próprio e prensa, vapor e
  braço mecânico disparam seus efeitos ao entrar no estado ativo e visível.
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
2. o slide executa quatro poses uma vez, mantém a base alinhada e atravessa
   corretamente os obstáculos baixos das Fases 1 e 2;
3. após registrar os masters, os sons de passos não se acumulam nem continuam
   durante pausa;
4. prólogo, ReForge e finais exibem os retratos finais sem deformação.
5. em cada fase, Alex permanece à esquerda da TV, conclui a animação de
   levantar antes de correr e pausa/salva/retorna sem atravessar o gabinete.

Os fundos/parallax não pertencem a esta branch e serão tratados em um passe
separado.
