// Línea de media tensión subterránea (ITC-LAT 06) o aérea (ITC-LAT 07).
import { fmt, num, check } from '../calc/common.js';
import { ccMT } from '../calc/mt.js';

// Cables HEPRZ1 12/20 kV Al (valores orientativos de fabricante / ITC-LAT 06)
// R a 105 °C (Ω/km), X (Ω/km), I enterrado directo, I bajo tubo (A)
export const MT_CABLES = {
  95: { R: 0.403, X: 0.119, Id: 205, It: 190 },
  150: { R: 0.262, X: 0.112, Id: 260, It: 245 },
  240: { R: 0.161, X: 0.105, Id: 345, It: 320 },
  400: { R: 0.102, X: 0.098, Id: 445, It: 415 },
};
// Conductores aéreos Al-Ac (UNE-EN 50182): R a 20 °C, X aprox., I admisible
export const MT_AERIAL = {
  '47-AL1/8-ST1A (LA-56)': { R: 0.6129, X: 0.40, I: 199 },
  '94-AL1/22-ST1A (LA-110)': { R: 0.3067, X: 0.38, I: 317 },
  '147-AL1/34-ST1A (LA-180)': { R: 0.1962, X: 0.37, I: 425 },
};
const K_SC = 94; // A·s½/mm² Al HEPR (ITC-LAT 06)

export default {
  id: 'redmt',
  name: 'Línea de media tensión',
  short: 'Línea MT',
  icon: '🗼',
  description: 'Línea subterránea o aérea de MT: intensidad admisible con factores de corrección, caída de tensión, pérdidas y cortocircuito.',
  normativa: [
    'RD 223/2008, Reglamento de líneas eléctricas de alta tensión, e ITC-LAT 06 (subterráneas) e ITC-LAT 07 (aéreas).',
    'RD 337/2014 e ITC-RAT para las conexiones con centros.',
    'RD 1432/2008: protección de la avifauna en líneas aéreas.',
    'UNE 211435 (guía de elección de cables de MT) y UNE-HD 620.',
    'Normas particulares de la empresa distribuidora.',
  ],
  defaults() {
    return {
      tipo: 'subterranea', Un: 20, P: 2000, fp: 0.9, L: 850, S: 240, inst: 'tubo', aereo: '94-AL1/22-ST1A (LA-110)',
      f_temp: 1, f_res: 1, f_agr: 1, f_prof: 1, Scc: 500, tcc: 0.5, limite: 5,
    };
  },
  sections: [
    {
      title: 'Datos de la línea',
      fields: [
        { key: 'tipo', label: 'Tipo de línea', type: 'select', options: [{ value: 'subterranea', label: 'Subterránea (ITC-LAT 06)' }, { value: 'aerea', label: 'Aérea (ITC-LAT 07)' }] },
        { key: 'Un', label: 'Tensión nominal', type: 'select', unit: 'kV', options: [10, 13.2, 15, 20, 25, 30].map((v) => ({ value: v, label: `${v} kV` })) },
        { key: 'P', label: 'Potencia a transportar', type: 'number', unit: 'kW' },
        { key: 'fp', label: 'Factor de potencia', type: 'number', step: 0.01 },
        { key: 'L', label: 'Longitud', type: 'number', unit: 'm' },
        { key: 'limite', label: 'Caída de tensión máxima', type: 'number', unit: '%' },
      ],
    },
    {
      title: 'Conductor',
      fields: [
        { key: 'S', label: 'Sección HEPRZ1 12/20 kV Al', type: 'select', options: Object.keys(MT_CABLES).map((v) => ({ value: Number(v), label: `3×1×${v} mm²` })), show: (d) => d.tipo !== 'aerea' },
        { key: 'inst', label: 'Instalación', type: 'select', options: [{ value: 'directo', label: 'Directamente enterrado' }, { value: 'tubo', label: 'Bajo tubo' }], show: (d) => d.tipo !== 'aerea' },
        { key: 'f_temp', label: 'Factor temperatura terreno', type: 'number', step: 0.01, show: (d) => d.tipo !== 'aerea' },
        { key: 'f_res', label: 'Factor resistividad térmica', type: 'number', step: 0.01, show: (d) => d.tipo !== 'aerea' },
        { key: 'f_agr', label: 'Factor agrupamiento', type: 'number', step: 0.01, show: (d) => d.tipo !== 'aerea' },
        { key: 'f_prof', label: 'Factor profundidad', type: 'number', step: 0.01, show: (d) => d.tipo !== 'aerea' },
        { key: 'aereo', label: 'Conductor aéreo', type: 'select', options: Object.keys(MT_AERIAL).map((v) => ({ value: v, label: v })), show: (d) => d.tipo === 'aerea' },
      ],
    },
    {
      title: 'Cortocircuito',
      fields: [
        { key: 'Scc', label: 'Potencia de cortocircuito en origen', type: 'number', unit: 'MVA' },
        { key: 'tcc', label: 'Duración del cortocircuito', type: 'number', unit: 's', step: 0.1 },
      ],
    },
  ],
  calculate(d) {
    const Un = num(d.Un, 20);
    const cos = num(d.fp, 0.9);
    const sin = Math.sqrt(1 - cos * cos);
    const I = num(d.P) / (Math.sqrt(3) * Un * cos);
    const Lkm = num(d.L) / 1000;
    let R, X, Iz, name;
    if (d.tipo === 'aerea') {
      const c = MT_AERIAL[d.aereo] || Object.values(MT_AERIAL)[1];
      R = c.R * 1.2; X = c.X; Iz = c.I; name = d.aereo;
    } else {
      const c = MT_CABLES[num(d.S, 240)];
      R = c.R; X = c.X;
      Iz = (d.inst === 'directo' ? c.Id : c.It) * num(d.f_temp, 1) * num(d.f_res, 1) * num(d.f_agr, 1) * num(d.f_prof, 1);
      name = `HEPRZ1 12/20 kV 3×1×${num(d.S)} mm² Al`;
    }
    const du = Math.sqrt(3) * I * Lkm * (R * cos + X * sin);
    const duPct = du / (Un * 1000) * 100;
    const losses = 3 * I * I * R * Lkm; // W
    const lossPct = losses / (num(d.P) * 1000) * 100;
    const Icc = ccMT(num(d.Scc), Un);
    const IccAdm = d.tipo === 'aerea' ? Infinity : (K_SC * num(d.S)) / Math.sqrt(num(d.tcc, 0.5));
    const Pmax = Math.sqrt(3) * Un * Iz * cos; // kW
    return {
      summary: [
        { label: 'Intensidad', value: fmt(I, 1), unit: 'A' },
        { label: 'Intensidad admisible', value: fmt(Iz, 0), unit: 'A', status: I <= Iz ? 'ok' : 'bad' },
        { label: 'Potencia máxima de transporte', value: fmt(Pmax / 1000, 2), unit: 'MW' },
        { label: 'Caída de tensión', value: fmt(duPct, 3), unit: '%', status: duPct <= num(d.limite, 5) ? 'ok' : 'bad' },
        { label: 'Pérdidas de potencia', value: fmt(lossPct, 3), unit: '%' },
        { label: 'Icc', value: fmt(Icc / 1000, 2), unit: 'kA' },
      ],
      tables: [{
        title: `Cálculo eléctrico · ${name}`,
        columns: ['Magnitud', 'Expresión', 'Valor'],
        rows: [
          ['Intensidad', 'I = P/(√3·U·cosφ)', `${fmt(I, 2)} A`],
          ['Resistencia / reactancia', 'R (θ servicio), X', `${fmt(R, 3)} / ${fmt(X, 3)} Ω/km`],
          ['Intensidad admisible corregida', 'Iz = Io·Π fi', `${fmt(Iz, 0)} A`],
          ['Caída de tensión', 'ΔU = √3·I·L·(R cosφ + X senφ)', `${fmt(du, 1)} V (${fmt(duPct, 3)} %)`],
          ['Pérdidas', 'Pp = 3·R·L·I²', `${fmt(losses / 1000, 2)} kW (${fmt(lossPct, 3)} %)`],
          ['Intensidad de cortocircuito', 'Icc = Scc/(√3·U)', `${fmt(Icc / 1000, 2)} kA`],
          ...(d.tipo === 'aerea' ? [] : [['Icc admisible en el conductor', `Icc = K·S/√t (K = ${K_SC})`, `${fmt(IccAdm / 1000, 2)} kA`]]),
        ],
      }],
      checks: [
        check('Intensidad de servicio ≤ intensidad admisible', I <= Iz),
        check(`Caída de tensión ≤ ${num(d.limite, 5)} %`, duPct <= num(d.limite, 5)),
        ...(d.tipo === 'aerea' ? [check('Cumplimiento RD 1432/2008 (avifauna) en zonas de protección', true, 'Verificar crucetas y aislamiento')] : [check('Icc ≤ Icc admisible del conductor', Icc <= IccAdm)]),
      ],
      notes: [
        d.tipo === 'aerea' ? 'Resistencia del conductor aéreo incrementada un 20 % para temperatura de servicio. Se debe completar con el cálculo mecánico (ITC-LAT 07).' : 'Valores de R, X e intensidad admisible orientativos; contrastar con el catálogo del fabricante. Pantalla: comprobar la intensidad de cortocircuito fase-tierra.',
      ],
      I, Iz, name, duPct,
    };
  },
  memoria(d, r) {
    return `
      <p>Se proyecta una línea ${d.tipo === 'aerea' ? 'aérea' : 'subterránea'} de media tensión a ${num(d.Un)} kV, de ${fmt(num(d.L), 0)} m de longitud,
      para el transporte de una potencia de ${fmt(num(d.P), 0)} kW. El conductor será <b>${r.name}</b>.</p>
      <p>${d.tipo === 'aerea' ? 'La línea se tenderá sobre apoyos metálicos de celosía o de hormigón, con aisladores compuestos y crucetas conforme a la normativa de protección de la avifauna.' : `Los cables se instalarán ${d.inst === 'directo' ? 'directamente enterrados' : 'en tubos de polietileno de Ø160 mm hormigonados'} a una profundidad mínima de 0,8 m (1,0 m en cruces de calzada), con placa de protección y cinta de señalización, y se dispondrá tubo para comunicaciones (tritubo).`}</p>`;
  },
  budget(d) {
    return d.tipo === 'aerea'
      ? [{ code: 'MT01', desc: `Línea aérea MT ${d.aereo} incluyendo apoyos y armados`, unit: 'm', qty: num(d.L), price: 55 }]
      : [
        { code: 'MT01', desc: 'Zanja para canalización MT con 2 tubos Ø160 y tritubo, hormigonado y reposición', unit: 'm', qty: num(d.L), price: 68 },
        { code: 'MT02', desc: `Cable HEPRZ1 12/20 kV 3×1×${num(d.S)} mm² Al`, unit: 'm', qty: num(d.L), price: 18 + num(d.S) * 0.08 },
        { code: 'MT03', desc: 'Juego de terminales/empalmes MT', unit: 'ud', qty: 2 + Math.floor(num(d.L) / 500), price: 650 },
      ];
  },
};
