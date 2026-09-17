#!/usr/bin/env python3
"""Gera Mermaid e SVG a partir de docs/diagramas.json, sem dependências externas."""
from pathlib import Path
import html
import json
import textwrap

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/diagramas.json'
IMAGES = ROOT / 'docs/imagens'
DOCS = ROOT / 'docs/sprint1'


def esc(value):
    return html.escape(str(value), quote=True)


def mermaid(graph):
    lines = ['flowchart TD']
    for node in graph['nodes']:
        label = node['label'].replace('"', '&quot;')
        if node['shape'] == 'decision':
            body = '{"' + label + '"}'
        elif node['shape'] == 'end':
            body = '(["' + label + '"])'
        else:
            body = '["' + label + '"]'
        lines.append(f"  {node['id']}{body}")
    for edge in graph['edges']:
        arrow = '-.->' if edge['pending'] else '-->'
        label = f'|"{edge["label"]}"|' if edge['label'] else ''
        lines.append(f"  {edge['source']} {arrow}{label} {edge['target']}")
    proposed = [n['id'] for n in graph['nodes'] if n['pending']]
    if proposed:
        lines += ['  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4',
                  '  class ' + ','.join(proposed) + ' pending']
    return '\n'.join(lines)


def svg(graph):
    nodes = {n['id']: n for n in graph['nodes']}
    width = (max(n['col'] for n in nodes.values()) + 1) * 430 + 250
    height = (max(n['row'] for n in nodes.values()) + 1) * 190 + 190
    centers = {key: (260 + n['col'] * 430, 170 + n['row'] * 190) for key, n in nodes.items()}
    def boundary(key, direction):
        x, y = centers[key]
        h = 66 if nodes[key]['shape'] == 'decision' else 44
        return (x, y + h) if direction == 'bottom' else (x, y - h)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
             f'<title id="title">{esc(graph["title"])}</title>',
             '<desc id="desc">Diagrama gerado da mesma fonte do bloco Mermaid. Laranja e tracejado indicam propostas ou decisões pendentes.</desc>',
             '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#52657c"/></marker></defs>',
             f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
             f'<text x="32" y="40" font-family="sans-serif" font-size="25" font-weight="700" fill="#10253f">{esc(graph["title"])}</text>',
             '<text x="32" y="70" font-family="sans-serif" font-size="16" fill="#52657c">Flesh to Chrome · Sprint 1 · Propostas/pendências em laranja e tracejado</text>']
    labels = []
    for idx, edge in enumerate(graph['edges']):
        a, b = edge['source'], edge['target']
        ax, ay = centers[a]
        bx, by = centers[b]
        dr = nodes[b]['row'] - nodes[a]['row']
        dc = nodes[b]['col'] - nodes[a]['col']
        if dr == 0 and abs(dc) == 1:
            direction = 1 if dc > 0 else -1
            points = [(ax + 158 * direction, ay), (bx - 158 * direction, by)]
            lx, ly = (ax + bx) / 2, ay - 12
        elif dr == 1 and dc == 0:
            points = [boundary(a, 'bottom'), boundary(b, 'top')]
            lx, ly = ax + 48, (points[0][1] + points[-1][1]) / 2
        elif dr == 1:
            p, q = boundary(a, 'bottom'), boundary(b, 'top')
            mid = (p[1] + q[1]) / 2
            points = [p, (ax, mid), (bx, mid), q]
            lx, ly = (ax + bx) / 2, mid - 9
        else:
            # Use outside lanes for long/back edges so arrows do not cross node boxes.
            left = dc < 0 or (dc == 0 and dr < 0)
            lane = 30 + (idx % 9) * 10 if left else width - 30 - (idx % 9) * 10
            p = boundary(a, 'bottom')
            q = boundary(b, 'top')
            sy = p[1] + 20 + (idx % 3) * 8
            ty = q[1] - 20 - (idx % 3) * 8
            points = [p, (ax, sy), (lane, sy), (lane, ty), (bx, ty), q]
            lx, ly = (ax + lane) / 2, sy - 8
        coords = ' '.join(f'{x:g},{y:g}' for x, y in points)
        dash = ' stroke-dasharray="7 5"' if edge['pending'] else ''
        parts.append(f'<polyline points="{coords}" fill="none" stroke="#52657c" stroke-width="1.7"{dash} marker-end="url(#arrow)"/>')
        if edge['label']:
            labels.append(f'<text x="{lx:g}" y="{ly:g}" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#243f5d" stroke="white" stroke-width="5" paint-order="stroke">{esc(edge["label"])}</text>')
    parts += labels
    for key, node in nodes.items():
        x, y = centers[key]
        fill = '#fff7ed' if node['pending'] else '#edf4fc'
        stroke = '#b45309' if node['pending'] else '#315b85'
        style = f'fill="{fill}" stroke="{stroke}" stroke-width="2"'
        if node['pending']:
            style += ' stroke-dasharray="6 4"'
        if node['shape'] == 'decision':
            parts.append(f'<polygon points="{x},{y-66} {x+158},{y} {x},{y+66} {x-158},{y}" {style}/>')
            rows = textwrap.wrap(node['label'], width=22)
        else:
            radius = 38 if node['shape'] == 'end' else 12
            parts.append(f'<rect x="{x-158}" y="{y-44}" width="316" height="88" rx="{radius}" {style}/>')
            rows = textwrap.wrap(node['label'], width=33)
        assert len(rows) <= 4, f'Texto longo demais: {key}'
        for i, line in enumerate(rows):
            ty = y - (len(rows)-1)*10 + i*20 + 6
            parts.append(f'<text x="{x}" y="{ty}" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#10253f">{esc(line)}</text>')
    parts.append('</svg>')
    return '\n'.join(parts) + '\n'


def main():
    graphs = json.loads(SOURCE.read_text(encoding='utf-8'))
    assert len({g['file'] for g in graphs}) == len(graphs)
    for graph in graphs:
        ids = {n['id'] for n in graph['nodes']}
        assert len(ids) == len(graph['nodes']), graph['file']
        assert len({(n['col'],n['row']) for n in graph['nodes']}) == len(ids), graph['file']
        for edge in graph['edges']:
            assert edge['source'] in ids and edge['target'] in ids, edge
        (IMAGES / (graph['file'] + '.svg')).write_text(svg(graph), encoding='utf-8')
    for group, filename, title in [('architecture','05-diagramas-de-blocos.md','Diagramas de arquitetura e dados'),('flow','06-fluxogramas.md','Fluxogramas')]:
        text = [f'# {title}', '', 'Projeto: **Flesh to Chrome** — especificação da Sprint 1.', '',
                'Fonte única: [`../diagramas.json`](../diagramas.json). Mermaid e SVG abaixo são gerados por `python3 isn/scripts/gerar_diagramas.py` a partir da raiz do repositório. Não editar as versões geradas separadamente.', '',
                'Os diagramas descrevem o sistema planejado, não comprovam implementação. Propostas e decisões pendentes têm rótulo Dxx e/ou traço pontilhado; ver [registro de decisões](07-decisoes-pendentes.md).', '']
        for i, graph in enumerate((g for g in graphs if g['group'] == group),1):
            text += [f'## {i}. {graph["title"]}', '', graph['intro'], '', '```mermaid', mermaid(graph), '```', '', f'![{graph["title"]}](../imagens/{graph["file"]}.svg)', '']
        (DOCS / filename).write_text('\n'.join(text), encoding='utf-8')
    print(f'Gerados {len(graphs)} SVGs e 2 documentos Mermaid da mesma fonte.')


if __name__ == '__main__':
    main()
