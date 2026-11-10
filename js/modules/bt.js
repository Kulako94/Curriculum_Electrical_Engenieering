// Instalación de baja tensión: previsión de cargas (ITC-BT-10), instalación de
// enlace (ITC-BT-14/15) y circuitos interiores (ITC-BT-19, 25, 44, 47).
import {
  sizeCircuit, shortCircuitEnd, magneticTrip, simultaneity, GRADES, fmt, num, check,
  METHOD_OPTIONS, esc,
} from '../calc/common.js';
import { cableFields, circuitColumns } from './shared.js';

const VIVIENDA_TIPO = [
  { name: 'C1 Alumbrado', type: 'alumbrado', P: 2300, phases: 1, cosphi: 1, L: 25, smin: 1.5, curve: 'C' },
  { name: 'C2 Tomas de uso general', type: 'fuerza', P: 3450, phases: 1, cosphi: 1, L: 25, smin: 2.5, curve: 'C' },
  { name: 'C3 Cocina y horno', type: 'fuerza', P: 5400, phases: 1, cosphi: 1, L: 15, smin: 6, curve: 'C' },
  { name: 'C4 Lavadora, lavavajillas y termo', type: 'fuerza', P: 3450, phases: 1, cosphi: 1, L: 15, smin: 4, curve: 'C' },
  { name: 'C5 Tomas baño y cocina', type: 'fuerza', P: 3450, phases: 1, cosphi: 1, L: 15, smin: 2.5, curve: 'C' },
];

function newCircuit(over = {}) {
  return {
    name: 'Circuito', type: 'fuerza', P: 3450, phases: 1, cosphi: 0.9, L: 20, material: 'Cu',
    insulation: 'PVC', method: 'B1', smin: 2.5, curve: 'C', ...over,
  };
}

export default {
  id: 'bt',
  name: 'Instalación de baja tensión',
  short: 'Baja tensión',
  icon: '🔌',
  description: 'Previsión de cargas, derivación individual y cálculo de circuitos interiores (viviendas, locales, industria).',
  normativa: [
    'Reglamento Electrotécnico para Baja Tensión (RD 842/2002) e Instrucciones Técnicas Complementarias ITC-BT.',
    'ITC-BT-10: Previsión de cargas para suministros en baja tensión.',
    'ITC-BT-12 a ITC-BT-17: Instalaciones de enlace.',
    'ITC-BT-19: Instalaciones interiores o receptoras. Prescripciones generales.',
    'ITC-BT-25: Número de circuitos y características (viviendas).',
    'UNE-HD 60364-5-52: Selección e instalación de canalizaciones.',
    'Normas particulares de la empresa distribuidora.',
  ],
  defaults() {
    return {
      uso: 'vivienda',
      suministro: 'red',
      tension: 400,
      icc_origen: 6,
      prevision: false,
      viv_basica: 0,
      viv_elevada: 0,
      sg_kw: 0,
      locales_m2: 0,
      locales_n: 0,
      garaje_m2: 0,
      garaje_vent: 'natural',
      ve_plazas: 0,
      ve_spl: true,
      di_P: 9.2,
      di_phases: 1,
      di_L: 15,
      di_material: 'Cu',
      di_insulation: 'XLPE',
      di_method: 'B1',
      di_centr: 'unico',
      ambient: 40,
      circuits: VIVIENDA_TIPO.map((c) => newCircuit({ ...c, insulation: 'PVC', method: 'A1' })),
    };
  },
  sections: [
    {
      title: 'Datos generales',
      fields: [
        { key: 'uso', label: 'Uso de la instalación', type: 'select', options: [
          { value: 'vivienda', label: 'Vivienda' }, { value: 'edificio', label: 'Edificio de viviendas' },
          { value: 'local', label: 'Local comercial / oficinas' }, { value: 'industrial', label: 'Industrial' },
          { value: 'publica', label: 'Pública concurrencia' }] },
        { key: 'suministro', label: 'Alimentación', type: 'select', options: [
          { value: 'red', label: 'Desde red de distribución pública BT' },
          { value: 'ct', label: 'Desde centro de transformación propio' }] },
        { key: 'tension', label: 'Tensión de suministro', type: 'select', unit: 'V', options: [{ value: 400, label: '3×400/230 V' }, { value: 230, label: '230 V' }] },
        { key: 'icc_origen', label: 'Icc en origen de la instalación', type: 'number', unit: 'kA', step: 0.5 },
        { key: 'ambient', label: 'Temperatura ambiente', type: 'number', unit: '°C' },
      ],
    },
    {
      title: 'Previsión de cargas (ITC-BT-10)',
      fields: [
        { key: 'prevision', label: 'Calcular previsión de cargas de edificio', type: 'checkbox' },
        { key: 'viv_basica', label: 'Viviendas electrificación básica (5.750 W)', type: 'number', show: (d) => d.prevision },
        { key: 'viv_elevada', label: 'Viviendas electrificación elevada (9.200 W)', type: 'number', show: (d) => d.prevision },
        { key: 'sg_kw', label: 'Servicios generales', type: 'number', unit: 'kW', show: (d) => d.prevision },
        { key: 'locales_n', label: 'Nº locales comerciales/oficinas', type: 'number', show: (d) => d.prevision },
        { key: 'locales_m2', label: 'Superficie total locales/oficinas', type: 'number', unit: 'm²', show: (d) => d.prevision },
        { key: 'garaje_m2', label: 'Superficie de garaje', type: 'number', unit: 'm²', show: (d) => d.prevision },
        { key: 'garaje_vent', label: 'Ventilación del garaje', type: 'select', options: [{ value: 'natural', label: 'Natural (10 W/m²)' }, { value: 'forzada', label: 'Forzada (20 W/m²)' }], show: (d) => d.prevision },
        { key: 've_plazas', label: 'Plazas con recarga VE (esquema colectivo)', type: 'number', show: (d) => d.prevision },
        { key: 've_spl', label: 'Con sistema de protección de la línea general (SPL)', type: 'checkbox', show: (d) => d.prevision && num(d.ve_plazas) > 0 },
      ],
    },
    {
      title: 'Derivación individual (ITC-BT-15)',
      fields: [
        { key: 'di_P', label: 'Potencia prevista', type: 'number', unit: 'kW', step: 0.1, help: 'Si se calcula la previsión de un local/vivienda, introduzca aquí su potencia.' },
        { key: 'di_phases', label: 'Sistema', type: 'select', options: [{ value: 1, label: 'Monofásico 230 V' }, { value: 3, label: 'Trifásico 400 V' }] },
        { key: 'di_L', label: 'Longitud', type: 'number', unit: 'm' },
        { key: 'di_centr', label: 'Disposición de contadores', type: 'select', options: [
          { value: 'unico', label: 'Un único usuario (ΔU ≤ 1,5 %)' },
          { value: 'total', label: 'Contadores totalmente concentrados (ΔU ≤ 1 %)' },
          { value: 'parcial', label: 'Centralizaciones parciales (ΔU ≤ 0,5 %)' }] },
        ...cableFields('di_'),
      ],
    },
    {
      title: 'Circuitos interiores',
      fields: [
        {
          key: 'circuits', type: 'table', label: 'Circuitos',
          columns: circuitColumns(),
          newRow: () => newCircuit(),
          presets: [
            { label: 'Cargar circuitos tipo vivienda (ITC-BT-25)', rows: () => VIVIENDA_TIPO.map((c) => newCircuit({ ...c, insulation: 'PVC', method: 'A1' })) },
          ],
        },
      ],
    },
  ],

  calculate(d) {
    const summary = [];
    const tables = [];
    const checks = [];
    const notes = [];
    const ownCT = d.suministro === 'ct';
    const amb = num(d.ambient, 40);

    // ---- Previsión de cargas
    let Ptotal = null;
    if (d.prevision) {
      const nb = num(d.viv_basica), ne = num(d.viv_elevada);
      const n = nb + ne;
      const pmed = n ? (nb * GRADES.basica + ne * GRADES.elevada) / n : 0;
      const coef = simultaneity(n);
      const Pviv = coef * pmed;
      const Psg = num(d.sg_kw) * 1000;
      const Ploc = num(d.locales_m2) ? Math.max(num(d.locales_m2) * 100, 3450 * num(d.locales_n)) : 0;
      const Pgar = num(d.garaje_m2) ? Math.max(num(d.garaje_m2) * (d.garaje_vent === 'forzada' ? 20 : 10), 3450) : 0;
      const Pve = num(d.ve_plazas) * 3680 * (d.ve_spl ? 0.3 : 1);
      Ptotal = Pviv + Psg + Ploc + Pgar + Pve;
      tables.push({
        title: 'Previsión de cargas del edificio (ITC-BT-10)',
        columns: ['Concepto', 'Criterio', 'Potencia (kW)'],
        rows: [
          ['Viviendas', `${n} viv. · Pmedia ${fmt(pmed / 1000)} kW · coef. ${fmt(coef, 1)}`, fmt(Pviv / 1000)],
          ['Servicios generales', 'Según receptores', fmt(Psg / 1000)],
          ['Locales comerciales / oficinas', '100 W/m² (mín. 3.450 W/local)', fmt(Ploc / 1000)],
          ['Garaje', `${d.garaje_vent === 'forzada' ? 20 : 10} W/m² (mín. 3.450 W)`, fmt(Pgar / 1000)],
          ['Recarga vehículo eléctrico', `3.680 W/plaza × ${d.ve_spl ? '0,3 (con SPL)' : '1,0 (sin SPL)'}`, fmt(Pve / 1000)],
          [{ b: 'TOTAL' }, '', { b: fmt(Ptotal / 1000) }],
        ],
      });
      summary.push({ label: 'Previsión total edificio', value: fmt(Ptotal / 1000), unit: 'kW' });
    }

    // ---- Derivación individual
    const diLimit = { unico: 1.5, total: 1, parcial: 0.5 }[d.di_centr] ?? 1.5;
    const diPh = num(d.di_phases, 1);
    const diU = diPh === 3 ? 400 : 230;
    const di = sizeCircuit({
      P: num(d.di_P) * 1000, U: diU, phases: diPh, cosphi: 1, L: num(d.di_L),
      material: d.di_material, insulation: d.di_insulation, method: d.di_method,
      ambient: amb, maxDropPct: diLimit, minSection: 6, sections: [6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240],
    });
    tables.push({
      title: 'Derivación individual',
      columns: ['P (kW)', 'Ib (A)', 'Sección (mm²)', 'Iz (A)', 'In (A)', 'ΔU (%)', 'Límite (%)', 'Criterio'],
      rows: [[fmt(num(d.di_P)), fmt(di.Ib, 1), `${diPh === 3 ? '4' : '2'}×${di.S} + TT×${di.S}`, fmt(di.Iz, 1), di.In, fmt(di.dropPct), fmt(diLimit, 1), di.governing]],
    });
    checks.push(check('Derivación individual: sección mínima 6 mm² y ΔU admisible', di.ok, `S = ${di.S} mm², ΔU = ${fmt(di.dropPct)} %`));
    summary.push({ label: 'Derivación individual', value: `${di.S}`, unit: 'mm²' });
    summary.push({ label: 'IGA propuesto', value: `${di.In}`, unit: 'A' });

    // ---- Circuitos
    const iccOrigin = num(d.icc_origen, 6) * 1000;
    const rows = [];
    let allOk = true;
    let Pinst = 0;
    for (const c of d.circuits || []) {
      const ph = num(c.phases, 1);
      const U = ph === 3 ? 400 : 230;
      const isLight = c.type === 'alumbrado' || c.type === 'descarga';
      const ibFactor = c.type === 'descarga' ? 1.8 : c.type === 'motor' ? 1.25 : 1;
      let limit = isLight ? 3 : 5;
      let prev = 0;
      if (ownCT) { limit = isLight ? 4.5 : 6.5; prev = di.dropPct || 0; }
      const r = sizeCircuit({
        P: num(c.P), U, phases: ph, cosphi: num(c.cosphi, 1), L: num(c.L), material: c.material,
        insulation: c.insulation, method: c.method, ambient: amb, maxDropPct: limit, prevDropPct: prev,
        minSection: num(c.smin, 1.5), ibFactor,
      });
      Pinst += num(c.P);
      const icc = r.S ? shortCircuitEnd({ U0: 230, IccOrigin: iccOrigin, L: num(c.L), S: r.S, material: c.material }) : 0;
      const im = r.In ? magneticTrip(c.curve, r.In) : 0;
      const sccOk = icc >= im;
      const ok = r.ok && sccOk;
      allOk = allOk && ok;
      rows.push([
        esc(c.name), fmt(num(c.P) / 1000), ph === 3 ? '3F' : '1F', fmt(r.Ib, 1), r.S ?? '—', fmt(r.Iz, 1),
        r.In ? `${r.In} (${c.curve})` : '—', fmt(r.dropPct), fmt(limit, 1), fmt(icc / 1000), { ok, t: ok ? 'Cumple' : 'Revisar' },
      ]);
      if (r.ok && !sccOk) notes.push(`${c.name}: la Icc mínima al final de la línea (${fmt(icc)} A) no alcanza el disparo magnético (${fmt(im, 0)} A). Aumente sección o cambie curva.`);
    }
    tables.push({
      title: 'Cálculo de circuitos interiores',
      columns: ['Circuito', 'P (kW)', 'Sist.', 'Ib (A)', 'S (mm²)', 'Iz (A)', 'PIA (A)', 'ΔU (%)', 'Lím. (%)', 'Icc mín (kA)', 'Estado'],
      rows,
    });
    checks.push(check('Todos los circuitos cumplen intensidad admisible, caída de tensión y poder de corte', allOk));
    checks.push(check('Protección diferencial 30 mA en circuitos de tomas y locales húmedos (ITC-BT-24/25)', true, 'Prevista en el diseño'));
    summary.push({ label: 'Potencia instalada', value: fmt(Pinst / 1000), unit: 'kW' });
    summary.push({ label: 'Nº de circuitos', value: String((d.circuits || []).length) });
    if (ownCT) notes.push('Alimentación desde CT propio: caídas de tensión máximas acumuladas 4,5 % alumbrado y 6,5 % resto (ITC-BT-19 §2.2.2).');
    notes.push('Factor 1,8 aplicado a alumbrado con lámparas de descarga (ITC-BT-44) y 1,25 a motores (ITC-BT-47).');
    return { summary, tables, checks, notes, di, Ptotal, Pinst };
  },

  memoria(d, r) {
    const usos = { vivienda: 'una vivienda', edificio: 'un edificio de viviendas', local: 'un local comercial / oficinas', industrial: 'una nave o establecimiento industrial', publica: 'un local de pública concurrencia' };
    return `
      <p>La instalación objeto de este apartado corresponde a ${usos[d.uso] || 'una instalación receptora'}, alimentada
      ${d.suministro === 'ct' ? 'desde un centro de transformación propio' : 'desde la red de distribución pública de baja tensión de la empresa distribuidora'}
      a la tensión de ${d.tension == 230 ? '230 V' : '3×400/230 V'}, 50 Hz.</p>
      <p>La instalación de enlace estará formada por la caja general de protección (CGP) o caja de protección y medida (CPM),
      ${d.prevision ? 'la línea general de alimentación (LGA), la centralización de contadores,' : 'el equipo de medida,'}
      la derivación individual y el cuadro general de mando y protección. La derivación individual se ejecutará con conductores
      de ${d.di_material === 'Al' ? 'aluminio' : 'cobre'} aislados ${d.di_insulation === 'XLPE' ? 'en XLPE, no propagadores del incendio y con emisión de humos y opacidad reducida (H07Z1-K / RZ1-K)' : 'en PVC'}
      de ${r.di?.S ?? '—'} mm² de sección.</p>
      <p>El cuadro general de mando y protección dispondrá de interruptor general automático de ${r.di?.In ?? '—'} A,
      interruptores diferenciales de alta sensibilidad (30 mA) y pequeños interruptores automáticos para cada uno de los
      ${(d.circuits || []).length} circuitos interiores proyectados. Todas las masas se conectarán a la red de tierra mediante
      conductores de protección de igual sección que los activos.</p>
      <p>Los conductores se dimensionan por intensidad máxima admisible (UNE-HD 60364-5-52), caída de tensión (ITC-BT-19)
      y protección frente a cortocircuitos, según los resultados que se detallan a continuación.</p>`;
  },

  budget(d, r) {
    const items = [];
    items.push({ code: 'BT01', desc: 'Caja general de protección / CPM homologada por la compañía distribuidora', unit: 'ud', qty: 1, price: 280 });
    items.push({ code: 'BT02', desc: `Derivación individual ${r.di?.S ?? ''} mm² ${d.di_material}, bajo tubo, incluido hilo de mando`, unit: 'm', qty: num(d.di_L), price: 12 + (r.di?.S || 6) * 0.9 });
    items.push({ code: 'BT03', desc: 'Cuadro general de mando y protección completo (IGA, diferenciales, PIAs, envolvente)', unit: 'ud', qty: 1, price: 350 + 45 * (d.circuits || []).length });
    for (const [i, c] of (d.circuits || []).entries()) {
      items.push({ code: `BT${10 + i}`, desc: `Circuito ${c.name}, conductor ${c.material} bajo tubo, incluido mecanismos`, unit: 'm', qty: num(c.L), price: 6.5 });
    }
    items.push({ code: 'BT90', desc: 'Red de tierra: pica de acero-cobre 2 m, conductor Cu desnudo 35 mm², arqueta y borne', unit: 'ud', qty: 1, price: 220 });
    return items;
  },
};
