export function daysUntil(dateIso: string) {
  const now = new Date();
  const target = new Date(dateIso);
  const delta = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(delta / 86400000));
}

export function formatDate(dateIso: string) {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
