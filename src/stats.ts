/** Tile primary value for sessions today count */
export function statSessionsTodayValue(count: number): string {
  return String(count);
}

/** Tile primary value for focus minutes today */
export function statFocusTodayValue(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

/** Tile primary value for streak (em dash when none) */
export function statStreakValue(days: number): string {
  if (days === 0) return "—";
  return String(days);
}

/** Tile primary value for this week's focus time */
export function statWeekValue(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
