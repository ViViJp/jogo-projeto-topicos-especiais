# Validação — polimento visual e áudio

Documento da branch `feat/visual-audio-polish`.

## Cobertura audiovisual

- `AudioManager` centraliza as chaves de oito BGMs e vinte e um efeitos. Uma
  troca de cena interrompe e destrói a faixa anterior antes de iniciar a
  próxima.
- Menu/prólogo, clínica, Portão/finais e cada uma das cinco fases possuem
  roteamento explícito. O catálogo de fontes está vazio enquanto os masters
  definitivos são selecionados; a ausência de um arquivo não quebra a cena.
- Corrida, aterrissagem, pulo, pulo duplo, slide, ataque, scan, dash, morte,
  inimigos, créditos, checkpoint, conclusão de fase, implantes e interfaces
  possuem feedback sonoro.
- O slide usa dois frames dedicados; ataque, impacto, morte, pouso e derrota
  de inimigos receberam partículas/tweens curtos sem alterar hitboxes.
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
2. slide, ataque, morte e derrota dos inimigos permanecem legíveis;
3. após registrar os masters, os sons de passos não se acumulam nem continuam
   durante pausa;
4. prólogo, ReForge e finais exibem os retratos finais sem deformação.

Os fundos/parallax não pertencem a esta branch e serão tratados em um passe
separado.
