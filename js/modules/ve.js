// Infraestructura de recarga de vehículo eléctrico (ITC-BT-52, RD 1053/2014; CTE DB HE-6).
import { sizeCircuit, fmt, num, check, esc } from '../calc/common.js';
import { MATERIAL_OPTIONS, INSULATION_OPTIONS } from './shared.js';
import { METHOD_OPTIONS } from '../calc/common.js';

export const CHARGERS = {
  '3.7': { P: 3680, phases: 1, label: '3,7 kW · 16 A monofásico (Modo 3)' },
  '7.4': { P: 7360, phases: 1, label: '7,4 kW · 32 A monofásico (Modo 3)' },
  '11': { P: 11000, phases: 3, label: '11 kW · 16 A trifásico (Modo 3)' },
  '22': { P: 22000, phases: 3, label: '22 kW · 32 A trifásico (Modo 3)' },
  '50': { P: 50000, phases: 3, label: '50 kW DC (Modo 4)' },
  '150': { P: 150000, phases: 3, label: '150 kW DC (Modo 4)' },
};

const ESQUEMAS = {
  '1a': 'Esquema 1a: colectivo o troncal con un contador principal en el origen (contadores secundarios)',
  '2': 'Esquema 2: individual con un contador común para la vivienda y la estación de recarga',
  '3a': 'Esquema 3a: individual con contador para cada estación de recarga desde centralización',
  '4a': 'Esquema 4a: circuito adicional desde la instalación interior (sin contador específico)',
};

function newPoint(i = 1) {
  return { name: `Punto ${i}`, power: '7.4', L: 30, material: 'Cu', insulation: 'XLPE', method: 'B1' };
}

export default {
  id: 've',
  name: 'Puntos de recarga de vehículo eléctrico',
  short: 'Recarga VE',
  icon: '🚗',
  description: 'Esquema de instalación, previsión de cargas, dotación mínima (CTE HE-6) y dimensionado de circuitos de recarga.',
  normativa: [
    'ITC-BT-52 del REBT: Instalaciones con fines especiales. Infraestructura para la recarga de vehículos eléctricos (RD 1053/2014).',
    'ITC-BT-10 (modificada por RD 1053/2014): previsión de cargas de recarga en edificios.',
    'Código Técnico de la Edificación, DB HE-6: Dotaciones mínimas para la infraestructura de recarga de vehículos eléctricos.',
    'UNE-EN IEC 61851: Sistema conductivo de carga para vehículos eléctricos.',
    'UNE-EN IEC 62196: Bases, clavijas y conectores de vehículo.',
    'RD 184/2022 (actividad de recarga) cuando se trate de recarga de acceso público.',
  ],
  defaults() {
    return {
      ubicacion: 'residencial',
      plazas: 20,
      esquema: '1a',
      spl: true,
      fs: 1,
      tension: 400,
      ambient: 40,
      ub_publico: false,
      points: [newPoint(1), newPoint(2)],
    };
  },
  sections: [
    {
      title: 'Datos del aparcamiento',
      fields: [
        { key: 'ubicacion', label: 'Tipo de aparcamiento', type: 'select', options: [
          { value: 'unifamiliar', label: 'Vivienda unifamiliar' },
          { value: 'residencial', label: 'Edificio residencial (aparcamiento colectivo)' },
          { value: 'no_residencial', label: 'Edificio no residencial privado' },
          { value: 'admin', label: 'Edificio de la Administración Pública' },
          { value: 'via_publica', label: 'Vía pública / estación de servicio' }] },
        { key: 'plazas', label: 'Nº total de plazas de aparcamiento', type: 'number' },
        { key: 'esquema', label: 'Esquema de instalación (ITC-BT-52)', type: 'select', options: Object.entries(ESQUEMAS).map(([value, label]) => ({ value, label })) },
        { key: 'spl', label: 'Sistema de protección de la línea general de alimentación (SPL)', type: 'checkbox' },
        { key: 'fs', label: 'Factor de simultaneidad entre puntos', type: 'number', step: 0.05, help: '1 sin gestión de carga; < 1 con sistema de gestión dinámica.' },
        { key: 'ambient', label: 'Temperatura ambiente', type: 'number', unit: '°C' },
        { key: 'ub_publico', label: 'Recarga de acceso público (exterior: IP54 / IK08, modo 3 o 4)', type: 'checkbox' },
      ],
    },
    {
      title: 'Puntos de recarga',
      fields: [
        {
          key: 'points', type: 'table', label: 'Estaciones',
          columns: [
            { key: 'name', label: 'Identificación', type: 'text', width: 140 },
            { key: 'power', label: 'Potencia', type: 'select', options: Object.entries(CHARGERS).map(([value, c]) => ({ value, label: c.label })) },
            { key: 'L', label: 'L (m)', type: 'number' },
            { key: 'material', label: 'Mat.', type: 'select', options: MATERIAL_OPTIONS },
            { key: 'insulation', label: 'Aisl.', type: 'select', options: INSULATION_OPTIONS },
            { key: 'method', label: 'Método', type: 'select', options: METHOD_OPTIONS.map((o) => ({ value: o.value, label: o.value })) },
          ],
          newRow: (rows) => newPoint((rows?.length || 0) + 1),
        },
      ],
    },
  ],

  calculate(d) {
    const pts = d.points || [];
    const plazas = num(d.plazas);
    const amb = num(d.ambient, 40);
    const rows = [];
    let Pinst = 0;
    let allOk = true;
    const results = [];
    for (const p of pts) {
      const c = CHARGERS[p.power] || CHARGERS['7.4'];
      Pinst += c.P;
      const U = c.phases === 3 ? 400 : 230;
      const r = sizeCircuit({
        P: c.P, U, phases: c.phases, cosphi: 1, L: num(p.L), material: p.material, insulation: p.insulation,
        method: p.method, ambient: amb, maxDropPct: 5, minSection: 2.5,
      });
      // ITC-BT-52: interruptor magnetotérmico por punto; diferencial 30 mA clase A (B si el punto no detecta DC 6 mA)
      allOk = allOk && r.ok;
      results.push(r);
      rows.push([esc(p.name), c.label, fmt(num(p.L), 0), fmt(r.Ib, 1), r.S ?? '—', fmt(r.Iz, 1), r.In ?? '—', fmt(r.dropPct), { ok: r.ok, t: r.ok ? 'Cumple' : 'Revisar' }]);
    }
    const fs = num(d.fs, 1);
    const Pdem = Pinst * fs;
    // Previsión ITC-BT-10 para edificios residenciales
    const Pprev = d.ubicacion === 'residencial' ? plazas * 3680 * (d.spl ? 0.3 : 1) : Pdem;

    // CTE DB HE-6 (dotaciones mínimas)
    let dotacion = '';
    let minPoints = 0;
    if (d.ubicacion === 'residencial') dotacion = 'Preinstalación (conducción principal y derivaciones) en el 100 % de las plazas.';
    else if (d.ubicacion === 'no_residencial') { minPoints = plazas > 20 ? Math.ceil(plazas / 40) : 0; dotacion = `1 estación por cada 40 plazas (o fracción) y preinstalación en el 20 % de las plazas.`; }
    else if (d.ubicacion === 'admin') { minPoints = plazas > 20 ? Math.ceil(plazas / 20) : 0; dotacion = '1 estación por cada 20 plazas (o fracción) y preinstalación en el 20 % de las plazas.'; }
    else dotacion = 'Sin dotación mínima del CTE; según ordenanzas y RD 184/2022.';

    const summary = [
      { label: 'Puntos de recarga', value: String(pts.length) },
      { label: 'Potencia instalada', value: fmt(Pinst / 1000, 1), unit: 'kW' },
      { label: 'Potencia demandada', value: fmt(Pdem / 1000, 1), unit: 'kW' },
      { label: 'Previsión de cargas VE', value: fmt(Pprev / 1000, 1), unit: 'kW' },
    ];
    if (minPoints) summary.push({ label: 'Estaciones mínimas CTE HE-6', value: String(minPoints), status: pts.length >= minPoints ? 'ok' : 'bad' });

    const IbGen = Pdem / (Math.sqrt(3) * 400);
    const checks = [
      check('Caída de tensión en circuitos de recarga ≤ 5 % (ITC-BT-52 §5)', allOk),
      check('Dotación mínima CTE DB HE-6', !minPoints || pts.length >= minPoints, dotacion),
      check('Protección diferencial individual 30 mA por punto de conexión, clase A (o B si no hay detección DC 6 mA)', true),
      check('Protección contra sobretensiones transitorias y permanentes en el origen', true, 'Prevista según ITC-BT-52 §5.2'),
      check('Grado de protección mínimo en exterior IP54 / IK08', true),
    ];
    const notes = [
      `${ESQUEMAS[d.esquema] || ''}.`,
      d.spl ? 'Se instala SPL que regula la potencia de recarga para no superar la potencia de la LGA/DI.' : 'Sin SPL: la previsión de cargas considera simultaneidad 1 para la recarga.',
      `Intensidad total demandada en cabecera del cuadro de recarga: ${fmt(IbGen, 1)} A (trifásico).`,
      'Las bases de toma de corriente o conectores serán tipo 2 (UNE-EN 62196-2) en modo 3; los circuitos de recarga serán dedicados.',
    ];
    return {
      summary,
      tables: [{ title: 'Circuitos de recarga', columns: ['Punto', 'Tipo', 'L (m)', 'Ib (A)', 'S (mm²)', 'Iz (A)', 'PIA (A)', 'ΔU (%)', 'Estado'], rows }],
      checks, notes, Pinst, Pdem, results,
    };
  },

  memoria(d, r) {
    const ub = { unifamiliar: 'una vivienda unifamiliar', residencial: 'el aparcamiento colectivo de un edificio residencial', no_residencial: 'un aparcamiento de edificio no residencial', admin: 'un aparcamiento de edificio de la Administración', via_publica: 'la vía pública' };
    return `
      <p>Se proyecta la infraestructura de recarga de vehículos eléctricos en ${ub[d.ubicacion] || 'el emplazamiento'}, con un total de
      ${num(d.plazas)} plazas de aparcamiento, de las que <b>${(d.points || []).length}</b> se dotan de estación de recarga, con una potencia instalada de
      <b>${fmt(r.Pinst / 1000, 1)} kW</b>.</p>
      <p>Se adopta el <b>${ESQUEMAS[d.esquema] || 'esquema indicado'}</b> de los previstos en la ITC-BT-52 ${d.spl ? ', con sistema de protección de la línea general (SPL)' : ''}.
      Cada estación dispondrá de circuito exclusivo protegido mediante interruptor automático y diferencial individual de 30 mA,
      y se instalará protección contra sobretensiones en el cuadro de recarga.</p>
      <p>Las estaciones serán de modo de carga ${(d.points || []).some((p) => num(p.power) >= 50) ? '3 y 4' : '3'}, con conector tipo 2, y contarán con sistema de comunicación
      que permita la gestión de la carga. Los conductores serán de cobre, no propagadores del incendio y con emisión de humos y opacidad reducida.</p>`;
  },

  budget(d, r) {
    const items = [];
    const byType = {};
    for (const p of d.points || []) byType[p.power] = (byType[p.power] || 0) + 1;
    const price = { '3.7': 650, '7.4': 900, '11': 1300, '22': 1700, '50': 22000, '150': 65000 };
    for (const [k, n] of Object.entries(byType)) items.push({ code: `VE0${k.length}`, desc: `Estación de recarga ${CHARGERS[k]?.label}`, unit: 'ud', qty: n, price: price[k] || 1000 });
    const totalL = (d.points || []).reduce((s, p) => s + num(p.L), 0);
    items.push({ code: 'VE10', desc: 'Circuito de recarga, conductor Cu RZ1-K (AS) bajo tubo/bandeja, incluso tendido y conexionado', unit: 'm', qty: totalL, price: 14 });
    items.push({ code: 'VE11', desc: 'Protección individual: magnetotérmico + diferencial 30 mA clase A por punto', unit: 'ud', qty: (d.points || []).length, price: 160 });
    items.push({ code: 'VE12', desc: 'Cuadro de recarga con protección contra sobretensiones y SPL/gestor de carga', unit: 'ud', qty: 1, price: 1500 });
    return items;
  },
};
