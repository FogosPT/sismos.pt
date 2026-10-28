/** Month/year bucket keys ("1969", "2024-03"): the total is only known at the bucket's end. */
export const isBucket = (t: string) => /^\d{4}(-\d{2})?$/.test(t);

export function bucketEnd(t: string): Date {
  return t.length === 4 ? new Date(Date.UTC(+t + 1, 0, 1)) : new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7), 1));
}

export function bucketLabel(t: string): string {
  if (t.length === 4) return `até ao fim de ${t}`;
  const d = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, 1));
  return `até ao fim de ${new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)}`;
}

