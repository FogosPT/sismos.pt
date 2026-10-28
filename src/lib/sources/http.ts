export const USER_AGENT = 'sismos.pt/1.0 (+https://sismos.pt)';

export async function fetchJson<T>(url: string, headers: Record<string, string> = {}, timeoutMs = 8000): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    // Keep a hint of the body: a WAF / bot challenge page says what blocked us.
    const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160);
    const ray = res.headers.get('cf-ray');
    throw new Error(`${new URL(url).host}: HTTP ${res.status}${ray ? ` (cf-ray ${ray})` : ''}${body ? ` — ${body}` : ''}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${new URL(url).host}: not JSON (${res.headers.get('content-type') ?? '?'}) — ${text.replace(/\s+/g, ' ').slice(0, 160)}`);
  }
}

/** "MW", "ML"… — same spelling as fogosapi (SeismicSource::magType). */
export function magType(raw: string | null | undefined): string | null {
  let s = (raw ?? '').trim();
  if (!s) return null;
  if (s.length > 1 && (s[0] === 'M' || s[0] === 'm')) s = s.slice(1);
  return 'M' + (s === 'M' || s === 'm' ? '' : s.toUpperCase());
}
