# Registro de assets visuais integrados

Este registro cobre as artes acrescentadas durante a descida e o polimento.
Assets gerados com assistência do OpenAI Imagegen e arquivos fornecidos pela
equipe são identificados individualmente; materiais com licença externa ainda
não confirmada não devem ser distribuídos publicamente antes dessa validação.

| Asset | Origem e referência visual | Uso autorizado no jogo | Estado |
| --- | --- | --- | --- |
| `src/assets/npcs/george/george-angry/george-angry.png` | Geração autoral baseada no design já estabelecido de George | Retrato irritado exclusivo de `GeorgeRefusalScene`, antes da primeira fase da descida | Integrado ao MVP; arte definitiva para esta branch |
| `src/assets/narrative/recycling/holograma-ciborgue.png` | Geração autoral de operador anônimo ReForge, refinada na Branch 4 | Holograma das três primeiras vendas; nunca representa o pai de Alex | Arte final otimizada em 160×192 |
| `src/assets/narrative/recycling/holograma-pai.png` | Variante holográfica baseada no retrato final do pai convertido | Holograma exclusivo da retirada das pernas/salto duplo | Arte final otimizada em 160×192 |
| `src/assets/narrative/recycling/unidade-reciclagem.png` | Terminal industrial ReForge gerado para receber os avatares sobrepostos | Fundo das quatro sequências de bioprinting | Arte final otimizada em 240×320 |
| `src/assets/narrative/prologue/familia.png` | Retrato autoral do avô e do tio no lar do nível inferior | Prólogo | Arte final otimizada em 512×320 |
| `src/assets/narrative/endings/chrome-father-son.png` | Gerado com a ferramenta integrada de imagem da OpenAI em 12/11/2026, usando o retrato do pai e o design Chrome de Alex como referências locais | Ilustração conjunta das quatro páginas do Final Chrome: o pai chama e Alex segue sem reconhecê-lo | Arte narrativa final em 1672×941; exibida com filtragem linear |
| `src/assets/narrative/endings/flesh/ending-flesh-*.png` | Três ilustrações 1280×720 fornecidas pela equipe em 14/11/2026 | Sequência do Final Flesh: renúncia ao cromo, retorno ao lar e abraço da família | Artes finais sem texto; exibidas com filtragem linear |
| `src/assets/narrative/endings/hollow/ending-hollow-*.png` | Três ilustrações 1280×720 fornecidas pela equipe em 14/11/2026 | Sequência compartilhada por todas as combinações do Final Hollow: ecos, casa fechada e partida | Solução visual atual; variantes por combinação de implantes foram adiadas |
| `src/assets/narrative/father/pai-antes.png` | Retrato humano do pai, alinhado à família | Prólogo anterior à ascensão | Arte final otimizada em 256×256 |
| `src/assets/narrative/father/pai-portrait.png` | Transformação ciborgue preservando a identidade do retrato humano | Referência de identidade do pai e derivados narrativos | Arte final otimizada em 256×256 |
| `src/assets/narrative/prologue/jornal-pai.png` | Painel de notícia corporativa derivado do retrato convertido | Prólogo, anúncio da ascensão | Arte final otimizada em 480×256 |
| `src/assets/narrative/father/propaganda-pai.png` | Variante compacta do painel corporativo | Propaganda da Fase 4 e início de seu retorno na descida | Arte final otimizada em 320×192 |
| `src/assets/narrative/reforge-door/reforge-door-closed.png` | Geração autoral de porta industrial cyberpunk | Estado fechado quando o fragmento de memória ainda não foi recuperado | Integrado ao MVP; arte definitiva para esta branch |
| `src/assets/narrative/reforge-door/reforge-door-open.png` | Variante autoral da mesma porta | Estado aberto depois de validar o fragmento de memória | Integrado ao MVP; arte definitiva para esta branch |
| `src/assets/props/hazards/urban-electric-floor.png` | Geração autoral alinhada à paleta do Meio Urbano | Piso elétrico animado e letal, exclusivo da terceira fase da descida | Integrado ao MVP; arte definitiva para esta branch |
| `src/assets/props/hazards/rotating-energy-barrier.png` | Gerado com a ferramenta integrada de imagem da OpenAI em 12/11/2026 | Braço mecânico simétrico com energia magenta e núcleo central, usado nas barreiras giratórias da Fase 5 | Arte final em PNG RGBA transparente; rotação e colisão controladas pelo runtime |
| `src/assets/props/hazards/mech-arm-{housing,shaft,claw}.png` | Três componentes PNG fornecidos pela equipe em 13/11/2026; autoria/licença externa não informada | Composição do braço extensível da Fase 2: base fixa, eixo repetível e garra móvel | Integrado em 64 px; confirmar licença antes de distribuição pública; detalhes em `mech-arm-credits.txt` |
| `src/assets/props/obstacles/reforge-security-seal.png` | Geração autoral de lacre mecânico ReForge | Barreira atacável do setor Corporativo; fragmentada pela animação de quebra | Integrado ao MVP; arte definitiva para esta branch |
| `src/assets/player/alex-checkpoint/alex-checkpoint-*.png` | Geração assistida baseada nas cinco variantes oficiais de Alex; TV usada apenas como referência de orientação | Sequências dedicadas de sentar, sincronizar e levantar nos checkpoints | Arte final em cinco folhas de 320×64 |
| `src/assets/props/collectibles/credit-cyberpunk.png` | Spritesheet de quatro frames fornecido pela equipe | Substitui o círculo provisório dos créditos em todas as fases | Arte final em 128×32 |
| `src/assets/props/collectibles/memory-fragment-64.png` | PNG de 64×64 fornecido pela equipe em 13/11/2026 | Representação física unificada dos quatro fragmentos da descida; retratos narrativos continuam separados | Arte final RGBA, com flutuação, halo, partículas digitais e dissipação controlados pelo runtime |
| `src/assets/ui/qr-avaliacao-flesh-to-chrome.png` | QR Code fornecido pela equipe em 13/11/2026; codifica o Google Forms oficial com `entry.52413313=FleshtoChrome` | Tela opcional de avaliação exibida depois dos finais Chrome, Flesh e Hollow | Asset final em 732×732; manter fundo branco, margem e imagem estática |

As portas, o piso e o lacre não devem ser reutilizados fora das condições
acima sem atualização do level design. O arquivo `holograma-pai.png` permanece
reservado à última remoção, enquanto `holograma-ciborgue.png` cobre as demais.
