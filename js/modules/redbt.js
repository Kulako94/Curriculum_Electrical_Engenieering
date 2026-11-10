// Red de distribución en baja tensión (ITC-BT-06 aérea, ITC-BT-07 subterránea).
import { ampacity, conductivity, simultaneity, GRADES, fmt, num, check, FUSES_GG, esc } from '../calc/common.js';

// Cables trenzados RZ 0,6/1 kV Al (ITC-BT-06, posados/tensados, 40 °C)
const AERIAL = { 25: 100, 50: 150, 95: 230, 150: 305 };

function newNode(i) {
  return { name: `Tramo ${i}`, L: 40, viv_b: 0, viv_e: 4, P: 0 };
}

/**
 * Calcula una línea radial con cargas al final de cada tramo (orden: desde el CT).
 * Devuelve por tramo la potencia aguas abajo con simultaneidad ITC-BT-10 y la ΔU acumulada.
 */
export function feeder({ nodes, S, material = 'Al', U = 400, cosphi = 0.9, x = 0.08e-3, theta = 70 }) {
  const gamma = conductivity(material, theta);
  const n = nodes.length;
  const down = [];
  for (let i = n - 1; i >= 0; i--) {
    const nd = nodes[i];
    const prev = down[0] || { vb: 0, ve: 0, P: 0 };
    down.unshift({ vb: prev.vb + num(nd.viv_b), ve: prev.ve + num(nd.viv_e), P: prev.P + num(nd.P) * 1000 });
  }
  let acc = 0;
  const sin = Math.sqrt(1 - cosphi * cosphi);
  return nodes.map((nd, i) => {
    const { vb, ve, P } = down[i];
    const nv = vb + ve;
    const pm = nv ? (vb * GRADES.basica + ve * GRADES.elevada) / nv : 0;
    const Ptot = simultaneity(nv) * pm + P;
    const I = Ptot / (Math.sqrt(3) * U * cosphi);
    const L = num(nd.L);
    const du = Math.sqrt(3) * I * (L / (gamma * S) * cosphi + x * L * sin);
    acc += (du / U) * 100;
    return { name: nd.name, L, nv, Ptot, I, dropPct: (du / U) * 100, acc };
  });
}

export default {
  id: 'redbt',
  name: 'Red de distribución en baja tensión',
  short: 'Red BT',
  icon: '🔀',
  description: 'Líneas radiales subterráneas o aéreas con cargas por tramos, simultaneidad ITC-BT-10, sección, caída de tensión y protección.',
  normativa: [
    'ITC-BT-06: Redes aéreas para distribución en baja tensión.',
    'ITC-BT-07: Redes subterráneas para distribución en baja tensión.',
    'ITC-BT-10: Previsión de cargas.',
    'ITC-BT-11: Acometidas.',
    'Normas particulares de la empresa distribuidora (secciones normalizadas, fusibles de cabecera).',
  ],
  defaults() {
    return {
      tipo: 'subterranea',
      material: 'Al',
      instal: 'DT',
      cosphi: 0.9,
      limite: 5,
      fixed: '',
      nodes: [newNode(1), newNode(2), newNode(3)],
    };
  },
  sections: [
    {
      title: 'Características de la red',
      fields: [
        { key: 'tipo', label: 'Tipo de red', type: 'select', options: [{ value: 'subterranea', label: 'Subterránea XZ1 0,6/1 kV Al' }, { value: 'aerea', label: 'Aérea trenzada RZ 0,6/1 kV Al' }] },
        { key: 'instal', label: 'Instalación (subterránea)', type: 'select', options: [{ value: 'D', label: 'Directamente enterrada' }, { value: 'DT', label: 'Bajo tubo (×0,8)' }], show: (d) => d.tipo === 'subterranea' },
        { key: 'cosphi', label: 'Factor de potencia', type: 'number', step: 0.01 },
        { key: 'limite', label: 'Caída de tensión máxima admisible', type: 'number', unit: '%', help: 'Habitualmente 5 % según normas de la distribuidora.' },
        { key: 'fixed', label: 'Sección impuesta (vacío = automática)', type: 'select', options: [{ value: '', label: 'Automática' }, ...[25, 50, 95, 150, 240].map((v) => ({ value: v, label: `${v} mm²` }))] },
      ],
    },
    {
      title: 'Tramos (desde el CT hacia el final de línea)',
      fields: [{
        key: 'nodes', type: 'table', label: 'Tramos',
        columns: [
          { key: 'name', label: 'Tramo / nudo', type: 'text', width: 140 },
          { key: 'L', label: 'L (m)', type: 'number' },
          { key: 'viv_b', label: 'Viv. básica', type: 'number' },
          { key: 'viv_e', label: 'Viv. elevada', type: 'number' },
          { key: 'P', label: 'Otras cargas (kW)', type: 'number' },
        ],
        newRow: (rows) => newNode((rows?.length || 0) + 1),
      }],
    },
  ],

  calculate(d) {
    const nodes = d.nodes || [];
    const aerial = d.tipo === 'aerea';
    const sections = aerial ? [25, 50, 95, 150] : [50, 95, 150, 240];
    const cos = num(d.cosphi, 0.9);
    const limit = num(d.limite, 5);
    const izOf = (S) => aerial ? AERIAL[S] : ampacity({ section: S, material: 'Al', insulation: 'XLPE', method: d.instal || 'DT', phases: 3, ambient: 25 });
    let chosen = null;
    let res = null;
    const options = d.fixed ? [num(d.fixed)] : sections;
    for (const S of options) {
      const r = feeder({ nodes, S, material: 'Al', cosphi: cos });
      const Iz = izOf(S);
      const Ihead = r[0]?.I ?? 0;
      const fuse = [...FUSES_GG].reverse().find((f) => f * 1.6 <= 1.45 * Iz) ?? null;
      const ok = Ihead <= Iz && (r[r.length - 1]?.acc ?? 0) <= limit && fuse && fuse >= Ihead;
      res = { S, r, Iz, Ihead, fuse, ok };
      if (ok) { chosen = res; break; }
    }
    const final = chosen || res;
    const rows = (final?.r || []).map((t) => [esc(t.name), fmt(t.L, 0), t.nv, fmt(t.Ptot / 1000), fmt(t.I, 1), fmt(t.dropPct), fmt(t.acc), { ok: t.acc <= limit, t: t.acc <= limit ? 'OK' : '>' + limit + '%' }]);
    const Ltot = nodes.reduce((s, n) => s + num(n.L), 0);
    const cable = aerial ? `RZ 0,6/1 kV 3×${final?.S}/54,6 Alm` : `XZ1 (S) 0,6/1 kV 3×1×${final?.S} + 1×${final?.S >= 150 ? 95 : final?.S >= 95 ? 50 : final?.S} Al`;
    return {
      summary: [
        { label: 'Sección', value: `${final?.S ?? '—'}`, unit: 'mm²', status: chosen ? 'ok' : 'bad' },
        { label: 'Potencia en cabecera', value: fmt((final?.r[0]?.Ptot || 0) / 1000), unit: 'kW' },
        { label: 'Intensidad en cabecera', value: fmt(final?.Ihead, 1), unit: 'A' },
        { label: 'Iz del cable', value: fmt(final?.Iz, 0), unit: 'A' },
        { label: 'ΔU final', value: fmt(final?.r[final.r.length - 1]?.acc), unit: '%' },
        { label: 'Fusible de cabecera', value: final?.fuse ? `${final.fuse} gG` : '—', unit: 'A' },
        { label: 'Longitud total', value: fmt(Ltot, 0), unit: 'm' },
      ],
      tables: [{ title: `Cálculo de la línea · ${cable}`, columns: ['Tramo', 'L (m)', 'Nº viv. aguas abajo', 'P (kW)', 'I (A)', 'ΔU tramo (%)', 'ΔU acum. (%)', 'Estado'], rows }],
      checks: [
        check('Intensidad en cabecera ≤ intensidad admisible', final && final.Ihead <= final.Iz),
        check(`Caída de tensión en el final de línea ≤ ${limit} %`, final && (final.r[final.r.length - 1]?.acc ?? 0) <= limit),
        check('Protección por fusible: Ib ≤ In y 1,6·In ≤ 1,45·Iz', final && final.fuse && final.fuse >= final.Ihead),
      ],
      notes: [
        'Coeficientes de simultaneidad aplicados sobre el número de viviendas alimentadas aguas abajo de cada tramo (ITC-BT-10 Tabla 1).',
        aerial ? 'Red aérea: intensidades para cables trenzados posados sobre fachada o tensados, a 40 °C.' : 'Red subterránea: zanja a 0,70 m, terreno 25 °C y 1,5 K·m/W; neutro de sección según normas de la distribuidora.',
      ],
      final, cable, Ltot,
    };
  },
  memoria(d, r) {
    return `
      <p>Se proyecta una red de distribución en baja tensión ${d.tipo === 'aerea' ? 'aérea con cables trenzados' : 'subterránea'}, a la tensión de 3×400/230 V,
      de ${fmt(r.Ltot, 0)} m de longitud total, con origen en el cuadro de baja tensión del centro de transformación y que alimenta ${(d.nodes || []).length} tramos/nudos.</p>
      <p>El conductor empleado será ${r.cable}. ${d.tipo === 'aerea' ? 'Los cables se instalarán posados sobre fachada o tensados entre apoyos con las distancias reglamentarias de la ITC-BT-06.' : `Los cables se instalarán ${d.instal === 'D' ? 'directamente enterrados' : 'bajo tubo de polietileno de Ø160 mm'} en zanja de 0,70 m de profundidad mínima, con cinta de señalización y placa de protección.`}
      La línea quedará protegida en cabecera mediante fusibles gG de ${r.final?.fuse ?? '—'} A.</p>`;
  },
  budget(d, r) {
    const L = r.Ltot;
    return d.tipo === 'aerea'
      ? [{ code: 'RB01', desc: `Línea aérea ${r.cable} posada/tensada, incluso accesorios`, unit: 'm', qty: L, price: 18 + (r.final?.S || 50) * 0.05 }]
      : [
        { code: 'RB01', desc: 'Zanja en acera/calzada 0,4×0,8 m con tubo PE Ø160, señalización y reposición', unit: 'm', qty: L, price: 42 },
        { code: 'RB02', desc: `Conductor ${r.cable}`, unit: 'm', qty: L, price: 6 + (r.final?.S || 95) * 0.09 },
        { code: 'RB03', desc: 'Caja general de protección / armario de distribución', unit: 'ud', qty: (d.nodes || []).length, price: 420 },
      ];
  },
};
