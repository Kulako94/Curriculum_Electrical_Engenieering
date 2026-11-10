// Núcleo de cálculo eléctrico común a todos los módulos.
// Referencias: REBT (RD 842/2002) e ITC-BT-06, 07, 10, 19; UNE-HD 60364-5-52;
// Guía Técnica de Aplicación del REBT (Anexo 2: cálculo de caídas de tensión y
// Anexo 3: cálculo de corrientes de cortocircuito).
//
// IMPORTANTE: las tablas son valores de referencia para predimensionado. El
// proyectista debe verificarlas con la norma vigente y los datos del fabricante.

export const SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];

// Intensidades admisibles (A) para Cu, 3 conductores cargados, temperatura de
// referencia 30 °C en aire (UNE-HD 60364-5-52, tablas B.52.x).
const AIR_CU = {
  XLPE: {
    A1: [17, 23, 31, 40, 54, 73, 95, 117, 141, 179, 216, 249, 285, 324, 380, 435],
    A2: [16.5, 22, 30, 38, 51, 68, 89, 109, 130, 164, 197, 227, 259, 295, 346, 396],
    B1: [20, 28, 37, 48, 66, 88, 117, 144, 175, 222, 269, 312, 355, 417, 490, 565],
    B2: [19.5, 26, 35, 44, 60, 80, 105, 128, 154, 194, 233, 268, 300, 340, 398, 455],
    C: [22, 30, 40, 51, 70, 94, 119, 148, 180, 232, 282, 328, 379, 434, 514, 593],
    E: [23, 32, 42, 54, 75, 100, 127, 158, 192, 246, 298, 346, 399, 456, 538, 621],
  },
  PVC: {
    A1: [13.5, 18, 24, 31, 42, 56, 73, 89, 108, 136, 164, 188, 216, 245, 286, 328],
    A2: [13, 17.5, 23, 29, 39, 52, 68, 83, 99, 125, 150, 172, 196, 223, 261, 298],
    B1: [15.5, 21, 28, 36, 50, 68, 89, 110, 134, 171, 207, 239, 275, 314, 370, 426],
    B2: [15, 20, 27, 34, 46, 62, 80, 99, 118, 149, 179, 206, 236, 268, 313, 358],
    C: [17.5, 24, 32, 41, 57, 76, 96, 119, 144, 184, 223, 259, 299, 341, 403, 464],
    E: [18.5, 25, 34, 43, 60, 80, 101, 126, 153, 196, 238, 276, 319, 364, 430, 497],
  },
};

// Redes subterráneas (ITC-BT-07, tabla de cables 0,6/1 kV directamente
// enterrados, 25 °C terreno, 1 K·m/W, 0,70 m). null = sección no tabulada.
const BURIED = {
  Cu: {
    XLPE: [null, null, null, 72, 96, 125, 160, 190, 230, 280, 335, 380, 425, 480, 550, 620],
    PVC: [null, null, null, 63, 85, 110, 140, 170, 200, 245, 290, 335, 375, 425, 490, 550],
  },
  Al: {
    XLPE: [null, null, null, null, null, 97, 125, 150, 180, 220, 260, 295, 330, 375, 430, 485],
    PVC: [null, null, null, null, null, 83, 105, 125, 150, 180, 220, 250, 280, 320, 370, 425],
  },
};

export const METHODS = {
  A1: 'A1 - Unipolares en tubo empotrado en pared aislante',
  A2: 'A2 - Multipolar en tubo empotrado en pared aislante',
  B1: 'B1 - Unipolares en tubo sobre pared / en canal',
  B2: 'B2 - Multipolar en tubo sobre pared / en canal',
  C: 'C - Directamente sobre pared',
  E: 'E - Multipolar al aire / bandeja perforada',
  D: 'D - Enterrado directamente (ITC-BT-07)',
  DT: 'D - Enterrado bajo tubo (ITC-BT-07, ×0,8)',
};

export const METHOD_OPTIONS = Object.entries(METHODS).map(([value, label]) => ({ value, label }));

export const MAX_TEMP = { PVC: 70, XLPE: 90 };

// Factor de corrección por temperatura ambiente (aire ref. 30 °C, terreno 25 °C).
export function tempFactor(insulation, ambient, buried = false) {
  const tmax = MAX_TEMP[insulation] ?? 90;
  const tref = buried ? 25 : 30;
  if (ambient >= tmax) return 0;
  return Math.sqrt((tmax - ambient) / (tmax - tref));
}

/**
 * Intensidad máxima admisible Iz (A) ya corregida.
 * @param {object} o section, material(Cu|Al), insulation(PVC|XLPE), method, phases(1|3),
 *                   ambient (°C), grouping (factor), extra (factor adicional)
 */
export function ampacity(o) {
  const { section, material = 'Cu', insulation = 'XLPE', method = 'B1', phases = 1,
    ambient, grouping = 1, extra = 1 } = o;
  const idx = SECTIONS.indexOf(Number(section));
  if (idx < 0) return 0;
  const buried = method === 'D' || method === 'DT';
  let base;
  if (buried) {
    base = BURIED[material]?.[insulation]?.[idx];
    if (base == null) return 0;
    if (method === 'DT') base *= 0.8;
  } else {
    base = AIR_CU[insulation]?.[method]?.[idx];
    if (base == null) return 0;
    if (material === 'Al') {
      if (section < 16) return 0; // Al no admitido por debajo de 16 mm² en estas tablas
      base *= 0.78;
    }
    if (Number(phases) === 1) base *= method === 'E' ? 1.14 : 1.12; // 2 conductores cargados
  }
  const amb = ambient ?? (buried ? 25 : 30);
  return base * tempFactor(insulation, amb, buried) * grouping * extra;
}

// Conductividad γ (m/Ω·mm²) en función de la temperatura del conductor
// (Guía-BT Anexo 2: Cu 56/48/44 y Al 35/30/28 a 20/70/90 °C).
export function conductivity(material, theta) {
  const pts = material === 'Al' ? [[20, 35], [70, 30], [90, 28]] : [[20, 56], [70, 48], [90, 44]];
  // interpolación lineal de la resistividad
  const rho = pts.map(([t, g]) => [t, 1 / g]);
  let r;
  if (theta <= 70) r = rho[0][1] + (rho[1][1] - rho[0][1]) * (theta - 20) / 50;
  else r = rho[1][1] + (rho[2][1] - rho[1][1]) * (theta - 70) / 20;
  return 1 / r;
}

// Temperatura estimada del conductor: θ = θa + (θmax - θa)·(I/Iz)²
export function conductorTemp(insulation, ambient, I, Iz) {
  const tmax = MAX_TEMP[insulation] ?? 90;
  if (!Iz) return tmax;
  return Math.min(tmax, ambient + (tmax - ambient) * Math.pow(I / Iz, 2));
}

export function current({ P, U, phases, cosphi = 1 }) {
  if (!P || !U) return 0;
  return Number(phases) === 3 ? P / (Math.sqrt(3) * U * cosphi) : P / (U * cosphi);
}

/**
 * Caída de tensión de una línea con carga en extremo.
 * x en Ω/m (por defecto 0,08 Ω/km). Para continua usar phases='dc'.
 * Devuelve { volts, pct }.
 */
export function voltageDrop({ I, U, phases, L, S, gamma, cosphi = 1, x = 0.08e-3 }) {
  const R = L / (gamma * S);
  const X = x * L;
  const sin = Math.sqrt(Math.max(0, 1 - cosphi * cosphi));
  let du;
  if (phases === 'dc') du = 2 * I * R;
  else if (Number(phases) === 3) du = Math.sqrt(3) * I * (R * cosphi + X * sin);
  else du = 2 * I * (R * cosphi + X * sin);
  return { volts: du, pct: (du / U) * 100 };
}

export const BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600];
export const FUSES_GG = [2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 355, 400, 500, 630];

export function nextStandard(list, value) {
  return list.find((v) => v >= value - 1e-9) ?? null;
}

const CURVE_MAG = { B: 5, C: 10, D: 20 };

/**
 * Dimensionado completo de un circuito: criterio térmico, protección y caída de tensión.
 * Recorre las secciones normalizadas desde minSection hasta encontrar una que cumpla.
 */
export function sizeCircuit(o) {
  const {
    P, U, phases = 1, cosphi = 1, L, material = 'Cu', insulation = 'XLPE', method = 'B1',
    ambient, grouping = 1, maxDropPct = 5, prevDropPct = 0, minSection = 1.5,
    ibFactor = 1, sections = SECTIONS, protection = 'breaker', fixedSection = null,
    dc = false, Ib: IbForced,
  } = o;
  const buried = method === 'D' || method === 'DT';
  const amb = ambient ?? (buried ? 25 : 40);
  const Ib = IbForced ?? current({ P, U, phases, cosphi }) * ibFactor;
  const list = protection === 'fuse' ? FUSES_GG : BREAKERS;
  const candidates = fixedSection ? [Number(fixedSection)] : sections.filter((s) => s >= minSection);
  let last = null;
  for (const S of candidates) {
    const Iz = ampacity({ section: S, material, insulation, method, phases: dc ? 1 : phases, ambient: amb, grouping });
    if (!Iz) continue;
    const In = nextStandard(list, Ib);
    // Fusibles gG: I2 = 1,6·In ≤ 1,45·Iz ⇒ In ≤ 0,906·Iz ; Interruptores: In ≤ Iz
    const izLimit = protection === 'fuse' ? Iz / 1.104 : Iz;
    const thermalOk = Ib <= Iz && In != null && In <= izLimit + 1e-9;
    const theta = conductorTemp(insulation, amb, Ib, Iz);
    const gamma = conductivity(material, theta);
    const dropI = IbForced ?? current({ P, U, phases, cosphi }); // la caída se calcula con la corriente real
    const drop = voltageDrop({ I: dropI, U, phases: dc ? 'dc' : phases, L, S, gamma, cosphi });
    const totalDrop = drop.pct + prevDropPct;
    const dropOk = totalDrop <= maxDropPct + 1e-9;
    last = { Ib, S, Iz, In, theta, gamma, dropPct: drop.pct, dropV: drop.volts, totalDrop, thermalOk, dropOk };
    if (thermalOk && dropOk) {
      // ¿qué criterio ha fijado la sección?
      const prevS = candidates[candidates.indexOf(S) - 1];
      let governing = 'mínima reglamentaria';
      if (prevS != null && !fixedSection) {
        const r = sizeCircuit({ ...o, fixedSection: prevS });
        governing = !r.thermalOk ? 'intensidad admisible' : 'caída de tensión';
      }
      return { ...last, ok: true, governing };
    }
  }
  return { ...(last || { Ib }), ok: false, governing: 'no cumple con las secciones disponibles' };
}

/**
 * Corriente de cortocircuito mínima al final de una línea (Guía-BT Anexo 3):
 * Icc = 0,8·U / R, con R la resistencia del bucle fase-neutro (o fase-fase) a 20 °C
 * más la impedancia equivalente aguas arriba deducida de Icc en origen.
 */
export function shortCircuitEnd({ U0 = 230, IccOrigin = 6000, L, S, material = 'Cu' }) {
  const g20 = conductivity(material, 20);
  const Rline = (2 * L) / (g20 * S);
  const Rup = IccOrigin ? (0.8 * U0) / IccOrigin : 0;
  return (0.8 * U0) / (Rline + Rup);
}

export function magneticTrip(curve, In) {
  return (CURVE_MAG[curve] ?? 10) * In;
}

// ITC-BT-10 Tabla 1: coeficiente de simultaneidad para n viviendas.
const SIMUL = [0, 1, 2, 3, 3.8, 4.6, 5.4, 6.2, 7, 7.8, 8.5, 9.2, 9.9, 10.6, 11.3, 11.9, 12.5, 13.1, 13.7, 14.3, 14.8, 15.3];
export function simultaneity(n) {
  n = Math.max(0, Math.round(n));
  if (n <= 21) return SIMUL[n];
  return 15.3 + (n - 21) * 0.5;
}

export const GRADES = { basica: 5750, elevada: 9200 };

// Utilidades de formato
export function fmt(v, d = 2) {
  if (v == null || Number.isNaN(v)) return '—';
  if (typeof v !== 'number') return String(v);
  if (!Number.isFinite(v)) return '∞';
  return v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export const num = (v, def = 0) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : def;
};

export function check(label, ok, detail = '') {
  return { label, ok: !!ok, detail };
}

// Interpolación lineal sobre tabla [[x,y],...] ordenada por x
export function interp(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
