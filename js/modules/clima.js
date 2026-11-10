// Climatización: predimensionado de cargas térmicas por ratios, ventilación (RITE IT 1.1.4.2)
// y alimentación eléctrica de equipos.
import { sizeCircuit, fmt, num, check, esc } from '../calc/common.js';

export const USES = {
  vivienda: { label: 'Vivienda', frio: 90, calor: 70, ida: 'IDA2', occ: 20 },
  oficina: { label: 'Oficina', frio: 110, calor: 70, ida: 'IDA2', occ: 10 },
  comercio: { label: 'Comercio', frio: 140, calor: 80, ida: 'IDA3', occ: 5 },
  restaurante: { label: 'Restaurante / cafetería', frio: 200, calor: 100, ida: 'IDA3', occ: 1.5 },
  aula: { label: 'Aula / docente', frio: 130, calor: 90, ida: 'IDA2', occ: 2 },
  reuniones: { label: 'Sala de reuniones', frio: 170, calor: 90, ida: 'IDA2', occ: 2.5 },
  gimnasio: { label: 'Gimnasio', frio: 180, calor: 70, ida: 'IDA3', occ: 5 },
  hospital: { label: 'Sanitario', frio: 130, calor: 90, ida: 'IDA1', occ: 10 },
};
const IDA = { IDA1: 20, IDA2: 12.5, IDA3: 8, IDA4: 5 }; // l/s·persona
const ZONA_INV = { A: 0.65, B: 0.8, C: 1, D: 1.2, E: 1.4 };
const ZONA_VER = { 1: 0.85, 2: 0.95, 3: 1, 4: 1.15 };
const TEXT_INV = { A: 4, B: 2, C: 0, D: -3, E: -6 };
const TEXT_VER = { 1: 30, 2: 32, 3: 35, 4: 39 };
const ORIENT = { N: 0.9, E: 1, S: 1.05, O: 1.15, INT: 0.85 };
export const CAPACITIES = [2.5, 3.5, 5, 6, 7.1, 8.5, 10, 12.5, 14, 16, 20, 22.4, 25, 28, 33.5, 40, 45, 50, 56];

function newRoom(i) {
  return { name: `Estancia ${i}`, uso: 'oficina', area: 25, occ: 0, orient: 'S' };
}

export function roomLoad(room, d) {
  const u = USES[room.uso] || USES.oficina;
  const area = num(room.area);
  const occ = num(room.occ) || Math.ceil(area / u.occ);
  const f = ORIENT[room.orient] ?? 1;
  const qv = (IDA[d.ida || u.ida] * occ) / 1000; // m³/s
  const rec = num(d.recuperador) / 100;
  const dTv = TEXT_VER[d.zona_v] - 25;
  const dTi = 21 - TEXT_INV[d.zona_i];
  const ventFrio = 1.2 * qv * dTv * 1.6 * (1 - rec); // kW (sensible + latente aprox.)
  const ventCalor = 1.2 * qv * dTi * (1 - rec);
  const frio = (area * u.frio * f * ZONA_VER[d.zona_v]) / 1000 + ventFrio;
  const calor = (area * u.calor * ZONA_INV[d.zona_i]) / 1000 + ventCalor;
  return { occ, qv, frio, calor };
}

export default {
  id: 'clima',
  name: 'Climatización y ventilación',
  short: 'Climatización',
  icon: '❄️',
  description: 'Predimensionado de cargas térmicas por estancias, caudales de ventilación RITE, selección de equipos y alimentación eléctrica.',
  normativa: [
    'RD 1027/2007, Reglamento de Instalaciones Térmicas en los Edificios (RITE) y sus modificaciones (RD 178/2021).',
    'Código Técnico de la Edificación DB HE-1, HE-2 y DB HS-3 (calidad del aire interior en viviendas).',
    'Reglamento (UE) 517/2014 y RD 115/2017 sobre gases fluorados.',
    'UNE-EN 16798-1 y UNE-EN 13779 (ventilación de edificios no residenciales).',
    'REBT para la alimentación eléctrica de los equipos.',
  ],
  defaults() {
    return {
      zona_i: 'D', zona_v: 3, ida: 'IDA2', recuperador: 0, eer: 3.2, cop: 3.5, tipo_sist: 'split', L: 20,
      rooms: [newRoom(1), { ...newRoom(2), uso: 'reuniones', area: 18, orient: 'O' }],
    };
  },
  sections: [
    {
      title: 'Condiciones generales',
      fields: [
        { key: 'zona_i', label: 'Zona climática de invierno (CTE)', type: 'select', options: Object.keys(ZONA_INV).map((v) => ({ value: v, label: v })) },
        { key: 'zona_v', label: 'Zona climática de verano (CTE)', type: 'select', options: Object.keys(ZONA_VER).map((v) => ({ value: Number(v), label: v })) },
        { key: 'ida', label: 'Calidad de aire interior (RITE)', type: 'select', options: Object.entries(IDA).map(([v, q]) => ({ value: v, label: `${v} (${q} l/s·persona)` })) },
        { key: 'recuperador', label: 'Eficiencia del recuperador de calor', type: 'number', unit: '%' },
        { key: 'tipo_sist', label: 'Sistema', type: 'select', options: [{ value: 'split', label: 'Expansión directa (split / multisplit)' }, { value: 'vrf', label: 'Caudal variable de refrigerante (VRF)' }, { value: 'agua', label: 'Bomba de calor aire-agua + fancoils' }] },
        { key: 'eer', label: 'EER (refrigeración)', type: 'number', step: 0.1 },
        { key: 'cop', label: 'COP (calefacción)', type: 'number', step: 0.1 },
        { key: 'L', label: 'Longitud media de alimentación eléctrica', type: 'number', unit: 'm' },
      ],
    },
    {
      title: 'Estancias',
      fields: [{
        key: 'rooms', type: 'table', label: 'Estancias',
        columns: [
          { key: 'name', label: 'Estancia', type: 'text', width: 150 },
          { key: 'uso', label: 'Uso', type: 'select', options: Object.entries(USES).map(([value, u]) => ({ value, label: u.label })) },
          { key: 'area', label: 'Sup. (m²)', type: 'number' },
          { key: 'occ', label: 'Ocupantes (0=auto)', type: 'number' },
          { key: 'orient', label: 'Orientación', type: 'select', options: [{ value: 'N', label: 'Norte' }, { value: 'E', label: 'Este' }, { value: 'S', label: 'Sur' }, { value: 'O', label: 'Oeste' }, { value: 'INT', label: 'Interior' }] },
        ],
        newRow: (rows) => newRoom((rows?.length || 0) + 1),
      }],
    },
  ],
  calculate(d) {
    const rooms = d.rooms || [];
    let F = 0, C = 0, Q = 0, A = 0, eqTotal = 0;
    const rows = rooms.map((r) => {
      const l = roomLoad(r, d);
      const cap = CAPACITIES.find((c) => c >= l.frio) ?? Math.ceil(l.frio);
      F += l.frio; C += l.calor; Q += l.qv; A += num(r.area); eqTotal += cap;
      return [esc(r.name), USES[r.uso]?.label, fmt(num(r.area), 1), l.occ, fmt(l.qv * 3600, 0), fmt(l.frio, 2), fmt(l.calor, 2), fmt(cap, 1)];
    });
    const centralized = d.tipo_sist !== 'split';
    const Pel = Math.max(eqTotal / num(d.eer, 3.2), C / num(d.cop, 3.5)); // kW eléctricos
    const ph = Pel > 5.75 ? 3 : 1;
    const elec = sizeCircuit({ P: Pel * 1000, U: ph === 3 ? 400 : 230, phases: ph, cosphi: 0.9, L: num(d.L), material: 'Cu', insulation: 'XLPE', method: 'B1', maxDropPct: 5, minSection: 2.5, ibFactor: 1.25 });
    const recReq = Q > 0.5;
    return {
      summary: [
        { label: 'Superficie climatizada', value: fmt(A, 0), unit: 'm²' },
        { label: 'Carga de refrigeración', value: fmt(F, 1), unit: 'kW' },
        { label: 'Carga de calefacción', value: fmt(C, 1), unit: 'kW' },
        { label: 'Caudal de aire exterior', value: fmt(Q * 3600, 0), unit: 'm³/h' },
        { label: 'Potencia frigorífica instalada', value: fmt(centralized ? CAPACITIES.find((c) => c >= F * 0.9) ?? F : eqTotal, 1), unit: 'kW' },
        { label: 'Potencia eléctrica absorbida', value: fmt(Pel, 2), unit: 'kW' },
        { label: 'Línea de alimentación', value: `${elec.S ?? '—'} mm² · ${elec.In ?? '—'} A`, unit: '' },
      ],
      tables: [{ title: 'Cargas térmicas por estancia (predimensionado por ratios)', columns: ['Estancia', 'Uso', 'm²', 'Ocup.', 'Aire ext. (m³/h)', 'Frío (kW)', 'Calor (kW)', 'Equipo (kW)'], rows }],
      checks: [
        check('Recuperación de calor obligatoria si el caudal de expulsión > 0,5 m³/s (RITE IT 1.2.4.5.2)', !recReq || num(d.recuperador) >= 50, recReq ? `Caudal ${fmt(Q, 2)} m³/s: se requiere recuperador` : `Caudal ${fmt(Q, 2)} m³/s: no obligatorio`),
        check('Línea de alimentación de equipos: ΔU ≤ 5 % e Iz ≥ 1,25·Ib', elec.ok),
        check('Potencia térmica nominal > 70 kW requiere proyecto (RITE art. 16)', true, (Math.max(F, C) > 70 ? 'Requiere proyecto técnico' : 'Basta memoria técnica (5–70 kW)')),
      ],
      notes: [
        'Cálculo de predimensionado por ratios; para el proyecto definitivo debe realizarse el cálculo detallado hora a hora (cerramientos, radiación, infiltraciones y cargas internas).',
        `Factor de simultaneidad no aplicado entre estancias: con sistema ${centralized ? 'centralizado se ha aplicado diversidad 0,9' : 'individual cada equipo se dimensiona para su estancia'}.`,
      ],
      F, C, Q, A, Pel, elec, eqTotal, centralized,
    };
  },
  memoria(d, r) {
    const s = { split: 'sistema de expansión directa con unidades split', vrf: 'sistema de caudal variable de refrigerante (VRF) con unidades interiores por estancia', agua: 'bomba de calor aire-agua con red hidráulica y unidades terminales fancoil' };
    return `
      <p>Se proyecta la instalación de climatización y ventilación de ${(d.rooms || []).length} estancias con una superficie total de ${fmt(r.A, 0)} m²,
      situadas en zona climática ${d.zona_i}${d.zona_v} del CTE, mediante ${s[d.tipo_sist]}.</p>
      <p>La carga de refrigeración estimada es de <b>${fmt(r.F, 1)} kW</b> y la de calefacción de <b>${fmt(r.C, 1)} kW</b>. La ventilación
      se dimensiona para calidad de aire ${d.ida} con un caudal de aire exterior de ${fmt(r.Q * 3600, 0)} m³/h${num(d.recuperador) ? `, con recuperador de calor de eficiencia ${num(d.recuperador)} %` : ''}.</p>
      <p>Los equipos tendrán una potencia eléctrica absorbida de ${fmt(r.Pel, 2)} kW, y se alimentarán desde el cuadro general mediante
      línea de ${r.elec.S ?? '—'} mm² protegida con interruptor automático de ${r.elec.In ?? '—'} A y diferencial.</p>`;
  },
  budget(d, r) {
    const items = (d.rooms || []).map((room, i) => {
      const l = roomLoad(room, d);
      const cap = CAPACITIES.find((c) => c >= l.frio) ?? Math.ceil(l.frio);
      return { code: `CL${String(i + 1).padStart(2, '0')}`, desc: `Equipo de climatización bomba de calor ${cap} kW para ${room.name}`, unit: 'ud', qty: 1, price: 450 + cap * 280 };
    });
    items.push({ code: 'CL90', desc: 'Línea frigorífica y desagües, incluido aislamiento', unit: 'm', qty: (d.rooms || []).length * 10, price: 32 });
    items.push({ code: 'CL91', desc: `Ventilación: unidad de tratamiento de aire / recuperador ${fmt(r.Q * 3600, 0)} m³/h y conductos`, unit: 'ud', qty: 1, price: 1500 + r.Q * 3600 * 2.5 });
    return items;
  },
};
