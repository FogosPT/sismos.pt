import { describe, expect, it } from 'vitest';
import { clipLine, clipSegment, preferred, round, simplify } from '../scripts/lib/geom.mjs';
import { eruptionLabel, FAULTS, faultsIn, rateLabel, slipLabel, VOLCANOES, volcanoesIn } from '../src/lib/faults';

const box: [number, number, number, number] = [0, 0, 10, 10];

describe('build geometry', () => {
  it('clips a segment to a box', () => {
    expect(clipSegment([-5, 5], [5, 5], box)).toEqual([[0, 5], [5, 5]]);
    expect(clipSegment([-5, -5], [-1, -1], box)).toBeNull();
    expect(clipSegment([2, 2], [3, 3], box)).toEqual([[2, 2], [3, 3]]);
  });

  it('splits a polyline where it leaves and re-enters the box', () => {
    const pieces = clipLine([[1, 1], [5, 5], [15, 5], [5, 8], [6, 9]], box);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toEqual([[1, 1], [5, 5], [10, 5]]);
    expect(pieces[1][0][0]).toBeCloseTo(10);
    expect(pieces[1].at(-1)).toEqual([6, 9]);
    expect(clipLine([[20, 20], [30, 30]], box)).toEqual([]);
  });

  it('simplifies with Douglas–Peucker and rounds', () => {
    const line = [[0, 0], [1, 0.001], [2, 0], [3, 5], [4, 0]];
    expect(simplify(line, 0.01)).toEqual([[0, 0], [2, 0], [3, 5], [4, 0]]);
    expect(round([[1.23456, -9.87654]])).toEqual([[1.235, -9.877]]);
  });

  it('reads GEM preferred values', () => {
    expect(preferred('(0.2,0.07,0.32)')).toBe(0.2);
    expect(preferred('None')).toBeNull();
    expect(preferred(undefined)).toBeNull();
  });
});

describe('labels (PT-PT)', () => {
  it('names slip types', () => {
    expect(slipLabel('Normal')).toBe('falha normal');
    expect(slipLabel('Reverse')).toBe('falha inversa');
    expect(slipLabel('Sinistral')).toBe('falha de desligamento esquerdo');
    expect(slipLabel('Dextral-Reverse')).toBe('desligamento direito com componente inversa');
    expect(slipLabel('Something_New')).toBe('falha ativa');
    expect(slipLabel(null)).toBe('falha ativa');
  });

  it('formats slip rates and eruptions', () => {
    expect(rateLabel(0.1)).toBe('0,10 mm/ano');
    expect(rateLabel(1.5)).toBe('1,5 mm/ano');
    expect(rateLabel(null)).toBeNull();
    expect(eruptionLabel(1958)).toBe('última erupção em 1958');
    expect(eruptionLabel(-4500)).toBe('última erupção por volta de 4500 a.C.');
    expect(eruptionLabel(null)).toBe('última erupção desconhecida');
  });
});

describe('generated data', () => {
  it('has mainland faults but none in the Azores (plate boundaries are drawn separately)', () => {
    expect(faultsIn('continente').length).toBeGreaterThan(20);
    expect(FAULTS.acores).toHaveLength(0);
    expect(faultsIn('acores')).toHaveLength(0);
    for (const f of FAULTS.continente) for (const l of f.lines) expect(l.length).toBeGreaterThan(1);
  });

  it('has the GVP volcanoes of the Azores and Madeira, none on the mainland', () => {
    expect(VOLCANOES.map((v) => v.gvp)).toContain(382010); // Faial
    expect(volcanoesIn('acores').length).toBe(12);
    expect(volcanoesIn('madeira').map((v) => v.name)).toEqual(['Madeira']);
    expect(volcanoesIn('continente')).toHaveLength(0);
    const faial = VOLCANOES.find((v) => v.gvp === 382010)!;
    expect(faial).toMatchObject({ name: 'Faial', lastEruption: 1958, lat: 38.576, lon: -28.713 });
  });
});
