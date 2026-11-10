import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ampacity, conductivity, current, voltageDrop, sizeCircuit, simultaneity, shortCircuitEnd, tempFactor,
} from '../js/calc/common.js';
import { earthing, trafoCurrents, ventilation, uca, mtFuse } from '../js/calc/mt.js';
import { lightingCalc, energyClass, distributedDrop } from '../js/modules/alumbrado.js';
import { orientationLoss, stringCheck } from '../js/modules/fotovoltaica.js';
import { feeder } from '../js/modules/redbt.js';
import { ictDims } from '../js/modules/teleco.js';
import { MODULES } from '../js/modules/index.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= Math.abs(b) * tol, `${a} ≉ ${b}`);

test('coeficiente de simultaneidad ITC-BT-10', () => {
  assert.equal(simultaneity(1), 1);
  assert.equal(simultaneity(4), 3.8);
  assert.equal(simultaneity(21), 15.3);
  assert.equal(simultaneity(25), 17.3);
});

test('conductividad según temperatura (Guía-BT)', () => {
  close(conductivity('Cu', 20), 56);
  close(conductivity('Cu', 70), 48);
  close(conductivity('Cu', 90), 44);
  close(conductivity('Al', 90), 28);
});

test('intensidad admisible y correcciones', () => {
  assert.equal(ampacity({ section: 2.5, insulation: 'XLPE', method: 'C', phases: 3, ambient: 30 }), 30);
  close(tempFactor('XLPE', 40), 0.912);
  close(ampacity({ section: 95, material: 'Al', insulation: 'XLPE', method: 'D', phases: 3, ambient: 25 }), 260);
  close(ampacity({ section: 95, material: 'Al', insulation: 'XLPE', method: 'DT', phases: 3, ambient: 25 }), 208);
  assert.equal(ampacity({ section: 2.5, material: 'Al', method: 'B1' }), 0);
});

test('intensidad y caída de tensión', () => {
  close(current({ P: 10000, U: 400, phases: 3, cosphi: 1 }), 14.43);
  // 230 V, 16 A, 30 m, 2,5 mm² Cu a 56: ΔU = 2·16·30/(56·2,5) = 6,857 V
  const r = voltageDrop({ I: 16, U: 230, phases: 1, L: 30, S: 2.5, gamma: 56, cosphi: 1 });
  close(r.volts, 6.857);
});

test('dimensionado de circuito: térmico y caída de tensión', () => {
  const r = sizeCircuit({ P: 3450, U: 230, phases: 1, cosphi: 1, L: 20, method: 'B1', insulation: 'PVC', minSection: 1.5 });
  assert.ok(r.ok);
  assert.equal(r.S, 2.5);
  assert.equal(r.In, 16);
  const long = sizeCircuit({ P: 3450, U: 230, phases: 1, cosphi: 1, L: 120, method: 'B1', insulation: 'PVC', maxDropPct: 3 });
  assert.ok(long.S > 2.5);
  assert.equal(long.governing, 'caída de tensión');
});

test('cortocircuito al final de línea', () => {
  const icc = shortCircuitEnd({ U0: 230, IccOrigin: 6000, L: 20, S: 2.5 });
  assert.ok(icc > 500 && icc < 1500);
});

test('transformador: intensidades y cortocircuito', () => {
  const t = trafoCurrents(630, 20, 420, 4, 1e9);
  close(t.I1, 18.19);
  close(t.I2, 866);
  close(t.Icc2inf, 21650);
  assert.equal(mtFuse(t.I1), 40);
  close(ventilation({ Wcu: 4600, Wfe: 540, h: 1.5 }), 0.50, 0.03);
});

test('puesta a tierra UNESA', () => {
  close(uca(0.5), 204);
  close(uca(1), 107);
  const e = earthing({ Un: 20, Rn: 0, Xn: 25, rho: 150, Kr: 0.0897, Kp: 0.0201, Kc: 0.0441, t: 0.7, Ia: 50 });
  close(e.Rt, 13.455);
  close(e.Id, 488, 0.01);
  assert.ok(e.checks.every((c) => c.ok));
});

test('alumbrado: método del flujo y calificación', () => {
  const l = lightingCalc({ width: 9, spacing: 25, flux: 9000, cu: 0.45, fm: 0.85, arrangement: 'unilateral', power: 60 });
  close(l.Em, 15.3);
  assert.equal(energyClass(1.2), 'A');
  assert.equal(energyClass(0.5), 'F');
  const d = distributedDrop({ n: 3, Pload: 100, first: 10, spacing: 10, U: 230, phases: 1, S: 6, gamma: 48 });
  // Σ P·L = 100·(10+20+30) = 6000 W·m → ΔU = 2·6000/(48·6·230)
  close(d.volts, (2 * 6000) / (48 * 6 * 230));
});

test('fotovoltaica: pérdidas de orientación y strings', () => {
  assert.ok(orientationLoss(30, 0, 40) < 0.01);
  assert.ok(orientationLoss(30, 90, 40) > 0.25);
  const s = stringCheck({ ns: 10, voc: 41.5, vmp: 34.6, beta_voc: -0.27, beta_vmp: -0.35, noct: 45, tmin: -5, tmax: 40, inv_vmax: 600, inv_mppt_min: 90, inv_mppt_max: 560 });
  close(s.VocString, 448.6, 0.005);
  assert.ok(s.okVoc && s.okMin && s.okMax);
});

test('red BT radial con simultaneidad', () => {
  const r = feeder({ nodes: [{ L: 100, viv_e: 2 }, { L: 100, viv_e: 2 }], S: 95 });
  close(r[0].Ptot, 3.8 * 9200);
  close(r[1].Ptot, 2 * 9200);
  assert.ok(r[1].acc > r[0].acc);
});

test('ICT: dimensiones según nº de PAU', () => {
  assert.equal(ictDims(8).principal, 5);
  assert.equal(ictDims(25).externa, 5);
  assert.equal(ictDims(40).principal, null);
});

test('todos los módulos calculan con valores por defecto', () => {
  for (const m of MODULES) {
    const d = m.defaults();
    const r = m.calculate(d);
    assert.ok(Array.isArray(r.summary) && r.summary.length, m.id);
    assert.ok(Array.isArray(r.checks), m.id);
    assert.equal(typeof m.memoria(d, r), 'string');
    assert.ok(Array.isArray(m.budget(d, r)));
    const json = JSON.stringify(r.summary);
    assert.ok(!/NaN|undefined/.test(json), `${m.id}: ${json}`);
  }
});
