/**
 * Sistema de créditos - GDD seção 14.4.
 *
 * A carteira (`total`) é a pontuação persistente da campanha e nunca
 * diminui (exceto em Novo Jogo). Créditos coletados só entram na carteira
 * quando "consolidados" (ao cruzar um checkpoint ou terminar a fase).
 * Créditos coletados depois do último checkpoint são perdidos ao morrer,
 * e cada crédito tem um id único para impedir duplicação (anti-farming).
 */
export class CreditsSystem {
  private total: number;
  private consolidatedIds: Set<string>;
  private sessionUncollectedValue = 0;
  private sessionUncollectedIds = new Set<string>();

  constructor(initialTotal: number, initialConsolidatedIds: string[]) {
    this.total = initialTotal;
    this.consolidatedIds = new Set(initialConsolidatedIds);
  }

  isConsolidated(id: string): boolean {
    return this.consolidatedIds.has(id);
  }

  /** Chamado quando o jogador toca em um crédito ainda não consolidado. */
  collect(id: string, value: number): void {
    if (this.consolidatedIds.has(id) || this.sessionUncollectedIds.has(id)) return;
    this.sessionUncollectedIds.add(id);
    this.sessionUncollectedValue += value;
  }

  /** Checkpoint atravessado ou fase concluída: consolida os créditos da sessão. */
  consolidate(): void {
    this.sessionUncollectedIds.forEach((id) => this.consolidatedIds.add(id));
    this.total += this.sessionUncollectedValue;
    this.sessionUncollectedIds.clear();
    this.sessionUncollectedValue = 0;
  }

  /** Morte antes do checkpoint: créditos não consolidados são perdidos. */
  discardUncollected(): void {
    this.sessionUncollectedIds.clear();
    this.sessionUncollectedValue = 0;
  }

  getTotal(): number {
    return this.total;
  }

  getConsolidatedIds(): string[] {
    return Array.from(this.consolidatedIds);
  }

  /** Valor exibido no HUD como "Créditos da fase": consolidados desta fase + ainda não consolidados. */
  getPhaseDisplayValue(phaseConsolidatedValue: number): number {
    return phaseConsolidatedValue + this.sessionUncollectedValue;
  }
}
