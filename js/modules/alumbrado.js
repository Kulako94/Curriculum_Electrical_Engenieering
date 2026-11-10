// Alumbrado exterior / público: cálculo luminotécnico por el método del flujo,
// eficiencia energética (RD 1890/2008, ITC-EA-01/02) y red eléctrica (ITC-BT-09).
import { sizeCircuit, conductivity, fmt, num, check, interp, ampacity, esc } from '../calc/common.js';
import { cableFields } from './shared.js';

// Clases de alumbrado y niveles medios (ITC-EA-02, valores de referencia)
export const CLASSES = {
  ME1: { Em: 30, desc: 'ME1 - Vías de alta velocidad (L≈2,0 cd/m²)' },
  ME2: { Em: 25, desc: 'ME2 - Vías interurbanas / arterias (L≈1,5 cd/m²)' },
  ME3: { Em: 20, desc: 'ME3 - Vías urbanas principales (L≈1,0 cd/m²)' },
  ME4: { Em: 15, desc: 'ME4 - Vías urbanas secundarias (L≈0,75 cd/m²)' },
  ME5: { Em: 10, desc: 'ME5 - Vías locales (L≈0,5 cd/m²)' },
  CE1: { Em: 30, desc: 'CE1 - Zonas de conflicto / glorietas' },
  CE2: { Em: 20, desc: 'CE2 - Zonas comerciales, conflicto' },
  CE3: { Em: 15, desc: 'CE3 - Zonas de conflicto secundarias' },
  CE4: { Em: 10, desc: 'CE4 - Calles residenciales con conflicto' },
  S1: { Em: 15, desc: 'S1 - Peatonal / ciclista prestigio' },
  S2: { Em: 10, desc: 'S2 - Peatonal / residencial' },
  S3: { Em: 7.5, desc: 'S3 - Peatonal / residencial' },
  S4: { Em: 5, desc: 'S4 - Peatonal secundaria' },
};

// ITC-EA-01 Tabla 1 (eficiencia mínima) y Tabla 3 (eficiencia de referencia)
const EPS_MIN = [[7.5, 9.5], [10, 12], [15, 15], [20, 17.5], [25, 20], [30, 22]];
const EPS_REF = [[7.5, 14], [10, 18], [15, 23], [20, 26], [25, 29], [30, 32]];

export function energyClass(ie) {
  if (ie > 1.1) return 'A';
  if (ie > 0.92) return 'B';
  if (ie > 0.79) return 'C';
  if (ie > 0.69) return 'D';
  if (ie > 0.58) return 'E';
  if (ie > 0.46) return 'F';
  return 'G';
}

export function lightingCalc({ width, spacing, flux, cu, fm, arrangement, power }) {
  const perInterval = arrangement === 'pareada' ? 2 : 1; // tresbolillo: S entre luminarias consecutivas alternas
  const Em = (perInterval * flux * cu * fm) / (spacing * width);
  const eps = (spacing * width * Em) / (perInterval * power);
  const epsMin = interp(EPS_MIN, Em);
  const epsRef = interp(EPS_REF, Em);
  const ie = eps / epsRef;
  return { Em, eps, epsMin, epsRef, ie, cls: energyClass(ie) };
}

// Caída de tensión de una línea con n cargas iguales equidistantes (momentos eléctricos)
export function distributedDrop({ n, Pload, first, spacing, U, phases, S, gamma }) {
  // Σ Pi·Li = P·(n·first + spacing·n(n-1)/2)
  const moment = Pload * (n * first + (spacing * n * (n - 1)) / 2);
  const du = Number(phases) === 3 ? moment / (gamma * S * U) : (2 * moment) / (gamma * S * U);
  return { volts: du, pct: (du / U) * 100 };
}

export default {
  id: 'alumbrado',
  name: 'Alumbrado exterior / público',
  short: 'Alumbrado',
  icon: '💡',
  description: 'Cálculo luminotécnico por el método del flujo, calificación energética (REEAE) y red eléctrica de alimentación.',
  normativa: [
    'RD 1890/2008, Reglamento de eficiencia energética en instalaciones de alumbrado exterior (REEAE) e ITC-EA-01 a 07.',
    'ITC-BT-09 del REBT: Instalaciones de alumbrado exterior.',
    'ITC-BT-07: Redes subterráneas para distribución en baja tensión.',
    'ITC-BT-18: Instalaciones de puesta a tierra.',
    'Ley 34/2007 de calidad del aire y normativa autonómica de contaminación lumínica.',
    'Recomendaciones del CEI (Comité Español de Iluminación) y UNE-EN 13201.',
  ],
  defaults() {
    return {
      via: 'Calle principal',
      clase: 'ME4',
      Em_obj: 15,
      ancho: 9,
      longitud: 300,
      disposicion: 'unilateral',
      interdistancia: 25,
      altura: 9,
      lum_P: 60,
      lum_flux: 9000,
      lum_cu: 0.45,
      lum_fm: 0.85,
      lum_tipo: 'led',
      cosphi: 0.95,
      horas: 4100,
      reduccion: 30,
      precio_kwh: 0.18,
      lineas: 1,
      fases: 3,
      distancia_cm: 20,
      material: 'Cu',
      insulation: 'XLPE',
      method: 'DT',
    };
  },
  sections: [
    {
      title: 'Vía y requisitos',
      fields: [
        { key: 'via', label: 'Denominación de la vía/zona', type: 'text' },
        { key: 'clase', label: 'Clase de alumbrado (ITC-EA-02)', type: 'select', options: Object.entries(CLASSES).map(([value, c]) => ({ value, label: c.desc })) },
        { key: 'Em_obj', label: 'Iluminancia media objetivo', type: 'number', unit: 'lx', help: 'Se propone la de la clase; ajústela si procede.' },
        { key: 'ancho', label: 'Anchura a iluminar', type: 'number', unit: 'm', step: 0.1 },
        { key: 'longitud', label: 'Longitud del tramo', type: 'number', unit: 'm' },
      ],
    },
    {
      title: 'Implantación y luminaria',
      fields: [
        { key: 'disposicion', label: 'Disposición', type: 'select', options: [
          { value: 'unilateral', label: 'Unilateral' }, { value: 'tresbolillo', label: 'Bilateral al tresbolillo' },
          { value: 'pareada', label: 'Bilateral pareada' }, { value: 'central', label: 'Central / doble brazo' }] },
        { key: 'interdistancia', label: 'Interdistancia entre puntos', type: 'number', unit: 'm' },
        { key: 'altura', label: 'Altura de montaje', type: 'number', unit: 'm' },
        { key: 'lum_tipo', label: 'Tecnología', type: 'select', options: [{ value: 'led', label: 'LED' }, { value: 'descarga', label: 'Descarga (VSAP/HM) ×1,8' }] },
        { key: 'lum_P', label: 'Potencia por luminaria (incl. equipo)', type: 'number', unit: 'W' },
        { key: 'lum_flux', label: 'Flujo luminoso de la luminaria', type: 'number', unit: 'lm' },
        { key: 'lum_cu', label: 'Factor de utilización', type: 'number', step: 0.01 },
        { key: 'lum_fm', label: 'Factor de mantenimiento', type: 'number', step: 0.01 },
        { key: 'cosphi', label: 'Factor de potencia', type: 'number', step: 0.01 },
      ],
    },
    {
      title: 'Funcionamiento',
      fields: [
        { key: 'horas', label: 'Horas de funcionamiento anuales', type: 'number', unit: 'h' },
        { key: 'reduccion', label: 'Ahorro por regulación de flujo', type: 'number', unit: '%' },
        { key: 'precio_kwh', label: 'Precio de la energía', type: 'number', unit: '€/kWh', step: 0.01 },
      ],
    },
    {
      title: 'Red de alimentación',
      fields: [
        { key: 'lineas', label: 'Nº de líneas (circuitos) del cuadro', type: 'number' },
        { key: 'fases', label: 'Sistema', type: 'select', options: [{ value: 3, label: 'Trifásico 400 V' }, { value: 1, label: 'Monofásico 230 V' }] },
        { key: 'distancia_cm', label: 'Distancia cuadro – primer punto', type: 'number', unit: 'm' },
        ...cableFields(''),
      ],
    },
  ],

  calculate(d) {
    const W = num(d.ancho), S = num(d.interdistancia), L = num(d.longitud);
    const P = num(d.lum_P), flux = num(d.lum_flux);
    const lc = lightingCalc({ width: W, spacing: S, flux, cu: num(d.lum_cu), fm: num(d.lum_fm), arrangement: d.disposicion, power: P });
    const perPoint = d.disposicion === 'pareada' || d.disposicion === 'central' ? 2 : 1;
    let nLum;
    if (d.disposicion === 'tresbolillo') nLum = Math.floor(L / S) + 1;
    else nLum = (Math.floor(L / S) + 1) * perPoint;
    // Para central/doble brazo, la iluminancia se reparte como pareada
    const lcFinal = d.disposicion === 'central'
      ? lightingCalc({ width: W, spacing: S, flux, cu: num(d.lum_cu), fm: num(d.lum_fm), arrangement: 'pareada', power: P })
      : lc;
    const Ptot = nLum * P;
    const Pcalc = d.lum_tipo === 'descarga' ? 1.8 : 1;
    const energy = (Ptot / 1000) * num(d.horas) * (1 - num(d.reduccion) / 100);
    const Emobj = num(d.Em_obj, CLASSES[d.clase]?.Em || 0);

    // Red eléctrica
    const lines = Math.max(1, Math.round(num(d.lineas, 1)));
    const ph = num(d.fases, 3);
    const U = ph === 3 ? 400 : 230;
    const perLine = Math.ceil(nLum / lines);
    const spacingLine = d.disposicion === 'tresbolillo' ? S / 1 : S;
    const Pline = perLine * P * Pcalc;
    const cos = num(d.cosphi, 0.95);
    const Ib = ph === 3 ? Pline / (Math.sqrt(3) * U * cos) : Pline / (U * cos);
    const sections = [6, 10, 16, 25, 35];
    let chosen = null;
    const rows = [];
    for (const s of sections) {
      const Iz = ampacity({ section: s, material: d.material, insulation: d.insulation, method: d.method, phases: ph, ambient: d.method?.startsWith('D') ? 25 : 40 });
      const gamma = conductivity(d.material, 70);
      const dd = distributedDrop({ n: perLine, Pload: P * Pcalc, first: num(d.distancia_cm), spacing: spacingLine * (d.disposicion === 'pareada' || d.disposicion === 'central' ? 1 : 1), U, phases: ph, S: s, gamma });
      // Para disposiciones con 2 luminarias por punto la potencia por punto es doble
      const ddp = (d.disposicion === 'pareada' || d.disposicion === 'central')
        ? distributedDrop({ n: Math.ceil(perLine / 2), Pload: 2 * P * Pcalc, first: num(d.distancia_cm), spacing: S, U, phases: ph, S: s, gamma })
        : dd;
      const ok = Iz >= Ib && ddp.pct <= 3;
      rows.push([`${ph === 3 ? '4' : '2'}×${s}`, fmt(Iz, 1), fmt(Ib, 2), fmt(ddp.pct), { ok, t: ok ? 'Cumple' : 'No cumple' }]);
      if (ok && !chosen) chosen = { s, Iz, drop: ddp.pct };
    }
    const sizing = sizeCircuit({ P: Pline, U, phases: ph, cosphi: cos, L: 1, material: d.material, insulation: d.insulation, method: d.method, minSection: chosen?.s || 6 });
    const nPicas = Math.ceil(Math.ceil(nLum / perPoint) / 5) + 1;

    const summary = [
      { label: 'Iluminancia media calculada', value: fmt(lcFinal.Em, 1), unit: 'lx', status: lcFinal.Em >= Emobj ? 'ok' : 'bad' },
      { label: 'Nº de luminarias', value: String(nLum) },
      { label: 'Potencia instalada', value: fmt(Ptot / 1000), unit: 'kW' },
      { label: 'Eficiencia energética ε', value: fmt(lcFinal.eps, 1), unit: 'm²·lx/W' },
      { label: 'Calificación energética', value: lcFinal.cls, status: ['A', 'B'].includes(lcFinal.cls) ? 'ok' : 'warn' },
      { label: 'Consumo anual', value: fmt(energy, 0), unit: 'kWh' },
      { label: 'Coste anual energía', value: fmt(energy * num(d.precio_kwh), 0), unit: '€' },
      { label: 'Sección de línea', value: chosen ? `${chosen.s}` : '—', unit: 'mm²' },
    ];
    const tables = [
      {
        title: 'Cálculo luminotécnico (método del flujo)',
        columns: ['Parámetro', 'Valor'],
        rows: [
          ['Clase de alumbrado', CLASSES[d.clase]?.desc || d.clase],
          ['Disposición / interdistancia / altura', `${d.disposicion} / ${fmt(S, 1)} m / ${fmt(num(d.altura), 1)} m`],
          ['Relación interdistancia/altura', fmt(S / num(d.altura, 1), 2)],
          ['Flujo × Fu × Fm', `${fmt(flux, 0)} lm × ${fmt(num(d.lum_cu))} × ${fmt(num(d.lum_fm))}`],
          ['Em = n·Φ·Fu·Fm / (S·A)', `${fmt(lcFinal.Em, 1)} lx (objetivo ${fmt(Emobj, 1)} lx)`],
          ['Eficiencia ε = S·A·Em / P', `${fmt(lcFinal.eps, 1)} m²·lx/W (mín. ${fmt(lcFinal.epsMin, 1)})`],
          ['Eficiencia de referencia εR', fmt(lcFinal.epsRef, 1)],
          ['Índice Iε = ε/εR · ICE = 1/Iε', `${fmt(lcFinal.ie)} · ${fmt(1 / lcFinal.ie)}`],
          ['Calificación energética', lcFinal.cls],
        ],
      },
      {
        title: `Red eléctrica: ${lines} línea(s) de ${perLine} luminarias · Pcálculo ${fmt(Pline / 1000)} kW`,
        columns: ['Sección (mm²)', 'Iz (A)', 'Ib (A)', 'ΔU (%)', 'Estado'],
        rows,
      },
    ];
    const checks = [
      check('Iluminancia media ≥ objetivo de la clase', lcFinal.Em >= Emobj, `${fmt(lcFinal.Em, 1)} ≥ ${fmt(Emobj, 1)} lx`),
      check('No se supera en más de un 20 % el nivel de referencia (ITC-EA-02)', lcFinal.Em <= Emobj * 1.2, `${fmt(lcFinal.Em / Emobj * 100, 0)} % del objetivo`),
      check('Eficiencia energética ≥ mínima (ITC-EA-01, Tabla 1)', lcFinal.eps >= lcFinal.epsMin),
      check('Caída de tensión ≤ 3 % y sección ≥ 6 mm² (ITC-BT-09)', !!chosen),
      check('Instalación de regulación del nivel luminoso (ITC-EA-04)', num(d.reduccion) > 0),
    ];
    const notes = [
      `Protección propuesta en cabecera de cada línea: magnetotérmico ${sizing.In ?? '—'} A y diferencial (sensibilidad ≤ 300 mA, reenganche automático recomendado).`,
      `Puesta a tierra: conductor Cu desnudo 35 mm² o aislado 16 mm² (V/A) enlazando los soportes, con pica cada 5 soportes y en el primero y último; previstas ${nPicas} picas. Resistencia de tierra < 30 Ω.`,
      'Los valores del factor de utilización deben obtenerse de las curvas del fabricante; se recomienda verificar mediante software luminotécnico (Dialux/Relux) la uniformidad y el deslumbramiento.',
    ];
    return { summary, tables, checks, notes, nLum, Ptot, chosen, nPicas, perPoint, sizing };
  },

  memoria(d, r) {
    return `
      <p>Se proyecta la instalación de alumbrado exterior de <b>${esc(d.via)}</b>, con una longitud de ${fmt(num(d.longitud), 0)} m y una
      anchura de calzada a iluminar de ${fmt(num(d.ancho), 1)} m, clasificada como clase de alumbrado <b>${esc(d.clase)}</b> según la ITC-EA-02.</p>
      <p>La implantación es <b>${esc(d.disposicion)}</b>, con puntos de luz a ${fmt(num(d.altura), 1)} m de altura e interdistancia de
      ${fmt(num(d.interdistancia), 1)} m, resultando un total de <b>${r.nLum} luminarias</b> ${d.lum_tipo === 'led' ? 'LED' : 'de descarga'} de ${fmt(num(d.lum_P), 0)} W
      y ${fmt(num(d.lum_flux), 0)} lm, con temperatura de color ≤ 3.000 K y FHSinst ≤ 1 %, de acuerdo con las exigencias de limitación del resplandor luminoso.</p>
      <p>La instalación dispondrá de sistema de regulación del flujo luminoso que reduce el consumo un ${fmt(num(d.reduccion), 0)} % en horario de madrugada,
      y de reloj astronómico para el encendido y apagado.</p>
      <p>La red de alimentación se realizará en canalización subterránea bajo tubo de polietileno corrugado de doble pared Ø 90 mm,
      con conductores ${d.material === 'Al' ? 'de aluminio' : 'de cobre'} RV-K 0,6/1 kV de ${r.chosen?.s ?? '—'} mm², arquetas de registro en cada punto de luz
      y cruces, y cuadro de mando y protección con medida, protecciones magnetotérmicas y diferenciales por línea.</p>`;
  },

  budget(d, r) {
    const nPts = Math.ceil(r.nLum / r.perPoint);
    return [
      { code: 'AE01', desc: `Luminaria ${d.lum_tipo === 'led' ? 'LED' : ''} ${num(d.lum_P)} W, ${num(d.lum_flux)} lm, con driver regulable`, unit: 'ud', qty: r.nLum, price: 320 },
      { code: 'AE02', desc: `Columna troncocónica de acero galvanizado de ${num(d.altura)} m, con cimentación y pernos`, unit: 'ud', qty: nPts, price: 480 },
      { code: 'AE03', desc: 'Arqueta de registro 40×40 cm con tapa de fundición', unit: 'ud', qty: nPts, price: 95 },
      { code: 'AE04', desc: 'Canalización subterránea 2 tubos PE Ø90 mm, zanja y reposición', unit: 'm', qty: num(d.longitud) + num(d.distancia_cm), price: 28 },
      { code: 'AE05', desc: `Conductor RV-K 0,6/1 kV ${r.chosen?.s ?? 6} mm² ${d.material}`, unit: 'm', qty: (num(d.longitud) + num(d.distancia_cm)) * (num(d.fases) === 3 ? 4 : 2), price: 1 + (r.chosen?.s || 6) * 0.35 },
      { code: 'AE06', desc: 'Conductor de tierra Cu 16 mm² V/A y picas de toma de tierra', unit: 'm', qty: num(d.longitud), price: 3.2 },
      { code: 'AE07', desc: 'Cuadro de mando y protección con medida, reloj astronómico y regulación', unit: 'ud', qty: 1, price: 2400 },
    ];
  },
};
