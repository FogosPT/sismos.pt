import { describe, expect, it, vi } from 'vitest';
import { onceAsync } from '../src/lib/once';

describe('onceAsync (detailed map initialisation)', () => {
  it('shares one run between calls made before it finishes', async () => {
    let resolve!: (v: string) => void;
    const fn = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const init = onceAsync(fn);

    // Open, close and reopen while MapLibre is still downloading.
    const a = init();
    const b = init();
    resolve('map');

    expect(await a).toBe('map');
    expect(await b).toBe('map');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(await init()).toBe('map');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries after a failure', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('map');
    const init = onceAsync(fn);

    await expect(init()).rejects.toThrow('offline');
    expect(await init()).toBe('map');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
