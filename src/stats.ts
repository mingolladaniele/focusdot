export function formatFocusMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m this week`;
}

export function formatSessionsToday(count: number): string {
  return `${count} ${count === 1 ? "session" : "sessions"} today`;
}

export function formatFocusMinutesToday(minutes: number): string {
  if (minutes < 60) return `${minutes}m today`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m today`;
}

export function formatStreakDays(days: number): string {
  if (days === 0) return "No streak yet";
  return `${days} day streak`;
}
