/** Formats a number with a pt-BR decimal comma. */
function num(value: number, decimals: number): string {
  return value.toFixed(decimals).replace('.', ',');
}

/**
 * Human duration for the ⌀ time chips (matches the prototype: "40 s", "6,4 h",
 * "31 h", "1,8 dias"). Sub-10 hours keep one decimal; days always do.
 */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 90) return `${num(seconds, 0)} s`;
  const minutes = seconds / 60;
  if (minutes < 90) return `${num(minutes, 0)} min`;
  const hours = minutes / 60;
  if (hours < 36) return `${num(hours, hours < 10 ? 1 : 0)} h`;
  const days = hours / 24;
  return `${num(days, 1)} dias`;
}

/** Heatmap stroke width from a frequency, √-scaled to a 2–8px band. */
export function heatWidth(count: number, maxCount: number): number {
  if (maxCount <= 0) return 2;
  return 2 + 6 * Math.sqrt(Math.min(count, maxCount) / maxCount);
}
