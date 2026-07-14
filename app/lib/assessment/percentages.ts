export function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Les scores et confiances internes de Preuvance sont des entiers sur 0-100
 * (schémas Zod `int().min(0).max(100)`, `computeReadinessScore`). La valeur
 * entière 1 signifie donc toujours 1/100, jamais 100 %. Seule une fraction
 * strictement comprise entre 0 et 1 (ex. 0.85 issu d’une source externe) est
 * interprétée comme un ratio à convertir.
 */
export function toPercentage(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const percentage = value > 0 && value < 1 ? value * 100 : value;
  return clampPercentage(percentage);
}

export function ratioToPercentage(value: number, max: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return null;
  return clampPercentage((value / max) * 100);
}
