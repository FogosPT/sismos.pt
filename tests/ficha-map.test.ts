import { describe, expect, it } from 'vitest';
import { detailZoom, placeFrom } from '../src/lib/mapframe';

describe('detailed map framing', () => {
  it('walks back from the epicentre to the place (bearing is place → epicentre)', () => {
    // Fossa de Hirondelle: 39 km W of Ginetes, i.e. Ginetes is ~39 km east.
    const [lon, lat] = placeFrom(37.854, -26.272, 39, 'O')!;
    expect(lat).toBeCloseTo(37.854, 1);
    expect(lon).toBeGreaterThan(-26.272 + 0.4);
    expect(lon).toBeLessThan(-26.272 + 0.5);
  });

  it('ignores unknown bearings and zero distances', () => {
    expect(placeFrom(38, -9, 10, 'X')).toBeNull();
    expect(placeFrom(38, -9, 0, 'N')).toBeNull();
  });

  it('zooms out for distant or foreign events', () => {
    expect(detailZoom('continente', 5)).toBe(10);
    expect(detailZoom('acores', 120)).toBe(7);
    expect(detailZoom('outro', 5)).toBe(7);
  });
});
