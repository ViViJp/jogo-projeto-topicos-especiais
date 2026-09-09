# Mapas Tiled — Flesh to Chrome

**Perspectiva:** side-view (Mario/Celeste). **Perfil:** montanha / ascensão (GDD).

## Art upgrade (#7 #8)

| Setor | Tileset | Parallax |
| --- | --- | --- |
| Esgoto | `tileset-sideview.png` (MrBeast CC-BY) | `esgoto/parallax/` |
| Meio Urbano | Future City 27 (CC0) | `meio-urbano/parallax/` |
| Industrial / Corp / Topo | Atomic Realm + Bulkhead | `*/parallax/bg-*.png` |

## Regenerar

```bash
python3 scripts/import_art_upgrade.py
python3 scripts/generate_fase1_map.py
python3 scripts/generate_tiled_maps.py
```

Previews: `esgoto/preview-*.png`

Issues: #3 #4 #7 #8 #9 #6
