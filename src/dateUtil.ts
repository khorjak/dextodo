const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses a strict YYYY-MM-DD date, rejecting values that overflow (e.g. 2026-02-30). */
export function parseDate(input: string): string | null {
  const m = DATE_RE.exec(input);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return input;
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatStamp(iso: string): string {
  return iso.slice(0, 10);
}
