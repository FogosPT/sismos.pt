import { describe, expect, it } from 'vitest';
import { EXTENT } from '../src/lib/region';
import { extentWith, projectionFor } from '../src/scripts/geo';

describe('map extent', () => {
  it('keeps the fixed view when every epicentre is inside it', () => {
    expect(extentWith('acores')).toEqual(EXTENT.acores);
    expect(extentWith('acores', [[-28.0, 38.5], [-25.7, 37.7]])).toEqual(EXTENT.acores);
  });

  it('grows to include the ridge north of the Azores (M5.4, 2026-11-19)', () => {
    const [x0, y0, x1, y1] = extentWith('acores', [[-28.966, 43.799]]);
    expect([x0, y0, x1]).toEqual([EXTENT.acores[0], EXTENT.acores[1], EXTENT.acores[2]]);
    expect(y1).toBeCloseTo(44.399);
  });

  it('puts the epicentre inside the drawn area', () => {
    const [w, h] = [640, 512];
    const [x, y] = projectionFor('acores', w, h, 28, [[-28.966, 43.799]])([-28.966, 43.799])!;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(w);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(h);
  });
});
