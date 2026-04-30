export function formatFocusMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m this week`;
}

export function formatSessionsToday(count: number): string {
  return `${count} ${count === 1 ? "session" : "sessions"} today`;
}
