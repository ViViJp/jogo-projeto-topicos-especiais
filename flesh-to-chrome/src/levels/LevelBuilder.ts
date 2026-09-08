import {
  GroundSegment,
  SurfaceHazard,
  OverheadObstacle,
  CreditEntry,
  CheckpointEntry,
} from "./LevelTypes";

/**
 * Builder sequencial usado para descrever fases a partir de um cursor de
 * posição X, na mesma ordem em que os nós aparecem nos fluxogramas de
 * `levelDesign.md`. Compartilhado entre todas as fases para manter a
 * mesma linguagem de construção de nível.
 */
export class LevelBuilder {
  private cursor = 0;
  readonly groundSegments: GroundSegment[] = [];
  readonly surfaceHazards: SurfaceHazard[] = [];
  readonly overheadObstacles: OverheadObstacle[] = [];
  readonly credits: CreditEntry[] = [];
  readonly checkpoints: CheckpointEntry[] = [];
  private idCounter = 0;

  constructor(readonly groundY: number) {}

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter}`;
  }

  ground(width: number): this {
    const x0 = this.cursor;
    const x1 = this.cursor + width;
    this.groundSegments.push({ x0, x1 });
    this.cursor = x1;
    return this;
  }

  gap(width: number, note?: string, hazardKind: "water" | null = null): this {
    if (hazardKind) {
      this.surfaceHazards.push({
        id: this.nextId("hazard"),
        kind: hazardKind,
        x: this.cursor,
        width,
        note,
      });
    }
    this.cursor += width;
    return this;
  }

  overhead(kind: "pipe" | "wire", width: number, note?: string): this {
    const x = this.cursor + width / 2;
    this.overheadObstacles.push({ id: this.nextId("overhead"), kind, x, width, note });
    return this;
  }

  creditAt(offsetFromCursor: number, y: number, value = 10, risky = false): this {
    this.credits.push({
      id: this.nextId("credit"),
      x: this.cursor + offsetFromCursor,
      y,
      value,
      risky,
    });
    return this;
  }

  checkpointHere(): this {
    this.checkpoints.push({ id: this.nextId("checkpoint"), x: this.cursor });
    return this;
  }

  get position(): number {
    return this.cursor;
  }
}
