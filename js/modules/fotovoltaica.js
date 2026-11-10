// Instalación solar fotovoltaica (autoconsumo / conectada a red / aislada).
// RD 244/2019, ITC-BT-40, Pliego de Condiciones Técnicas IDAE.
import { sizeCircuit, fmt, num, check } from '../calc/common.js';
import { cableFields } from './shared.js';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_SHARE = [0.055, 0.065, 0.085, 0.093, 0.104, 0.108, 0.114, 0.107, 0.091, 0.074, 0.056, 0.048];

// Pérdidas por orientación e inclinación (PCT IDAE, Anexo II)
export function orientationLoss(beta, alpha, lat) {
  const b = num(beta), a = num(alpha), phi = num(lat);
  let loss;
  if (b > 15) loss = 1.2e-4 * Math.pow(b - phi + 10, 2) + 3.5e-5 * a * a;
  else loss = 1.2e-4 * Math.pow(b - phi + 10, 2);
  return Math.min(Math.max(loss, 0), 0.6);
}

export function stringCheck(d) {
  const ns = num(d.ns);
  const Tmin = num(d.tmin), Tamb = num(d.tmax);
  const Tcell = Tamb + ((num(d.noct, 45) - 20) / 800) * 1000;
  const bv = num(d.beta_voc) / 100, bm = num(d.beta_vmp) / 100;
  const VocMax = num(d.voc) * (1 + bv * (Tmin - 25));
  const VmpMin = num(d.vmp) * (1 + bm * (Tcell - 25));
  const VmpMax = num(d.vmp) * (1 + bm * (Tmin - 25));
  const nsMax = Math.floor(num(d.inv_vmax) / VocMax);
  const nsMaxMppt = Math.floor(num(d.inv_mppt_max) / VmpMax);
  const nsMin = Math.ceil(num(d.inv_mppt_min) / VmpMin);
  return {
    Tcell, VocMax, VmpMin, VmpMax, nsMax: Math.min(nsMax, nsMaxMppt), nsMin,
    VocString: VocMax * ns, VmpStringMin: VmpMin * ns, VmpStringMax: VmpMax * ns,
    okVoc: VocMax * ns <= num(d.inv_vmax),
    okMin: VmpMin * ns >= num(d.inv_mppt_min),
    okMax: VmpMax * ns <= num(d.inv_mppt_max),
  };
}

export default {
  id: 'fotovoltaica',
  name: 'Instalación solar fotovoltaica',
  short: 'Fotovoltaica',
  icon: '☀️',
  description: 'Configuración de strings, compatibilidad módulo-inversor, producción estimada, cableado DC/AC y estudio económico.',
  normativa: [
    'RD 244/2019, condiciones administrativas, técnicas y económicas del autoconsumo.',
    'RD 1183/2020 de acceso y conexión a las redes, y RD 413/2014 (cuando proceda).',
    'ITC-BT-40 del REBT: Instalaciones generadoras de baja tensión.',
    'Pliego de Condiciones Técnicas de instalaciones conectadas a red (IDAE, PCT-C-REV).',
    'UNE-HD 60364-7-712: Instalaciones fotovoltaicas.',
    'Código Técnico de la Edificación DB HE-5 (cuando sea exigible) y DB SE (cargas en cubierta).',
  ],
  defaults() {
    return {
      modalidad: 'compensacion',
      conexion: 400,
      lat: 40.4,
      beta: 30,
      alpha: 0,
      yield_ref: 1600,
      pr: 0.8,
      mod_p: 450, voc: 41.5, vmp: 34.6, isc: 13.9, imp: 13.0, beta_voc: -0.27, beta_vmp: -0.35, noct: 45,
      inv_p: 5, inv_n: 1, inv_vmax: 600, inv_mppt_min: 90, inv_mppt_max: 560, inv_imax: 16, inv_mppt: 2,
      ns: 7, np: 2,
      tmin: -5, tmax: 40,
      l_dc: 25, l_ac: 15,
      material: 'Cu', insulation: 'XLPE', method: 'C',
      consumo: 6000, autoconsumo: 55, precio_compra: 0.16, precio_venta: 0.06, coste_wp: 1.1,
      co2: 0.25,
    };
  },
  sections: [
    {
      title: 'Emplazamiento y modalidad',
      fields: [
        { key: 'modalidad', label: 'Modalidad', type: 'select', options: [
          { value: 'sin_excedentes', label: 'Autoconsumo sin excedentes (antivertido)' },
          { value: 'compensacion', label: 'Autoconsumo con excedentes acogido a compensación' },
          { value: 'venta', label: 'Autoconsumo con excedentes no acogido / venta' },
          { value: 'aislada', label: 'Instalación aislada' }] },
        { key: 'conexion', label: 'Conexión', type: 'select', options: [{ value: 230, label: 'Monofásica 230 V' }, { value: 400, label: 'Trifásica 400 V' }] },
        { key: 'lat', label: 'Latitud', type: 'number', unit: '°', step: 0.1 },
        { key: 'beta', label: 'Inclinación de módulos β', type: 'number', unit: '°' },
        { key: 'alpha', label: 'Azimut α (0 = Sur)', type: 'number', unit: '°' },
        { key: 'yield_ref', label: 'Producción específica óptima', type: 'number', unit: 'kWh/kWp·año', help: 'Obtener de PVGIS para el emplazamiento (≈1.400 norte – 1.800 sur peninsular).' },
        { key: 'pr', label: 'Performance ratio', type: 'number', step: 0.01 },
        { key: 'tmin', label: 'Temperatura mínima ambiente', type: 'number', unit: '°C' },
        { key: 'tmax', label: 'Temperatura máxima ambiente', type: 'number', unit: '°C' },
      ],
    },
    {
      title: 'Módulo fotovoltaico',
      fields: [
        { key: 'mod_p', label: 'Potencia pico', type: 'number', unit: 'Wp' },
        { key: 'voc', label: 'Voc', type: 'number', unit: 'V', step: 0.1 },
        { key: 'vmp', label: 'Vmp', type: 'number', unit: 'V', step: 0.1 },
        { key: 'isc', label: 'Isc', type: 'number', unit: 'A', step: 0.01 },
        { key: 'imp', label: 'Imp', type: 'number', unit: 'A', step: 0.01 },
        { key: 'beta_voc', label: 'Coef. temperatura Voc', type: 'number', unit: '%/°C', step: 0.01 },
        { key: 'beta_vmp', label: 'Coef. temperatura Vmp (≈Pmax)', type: 'number', unit: '%/°C', step: 0.01 },
        { key: 'noct', label: 'NOCT', type: 'number', unit: '°C' },
      ],
    },
    {
      title: 'Inversor y configuración',
      fields: [
        { key: 'inv_p', label: 'Potencia nominal AC del inversor', type: 'number', unit: 'kW', step: 0.1 },
        { key: 'inv_n', label: 'Nº de inversores', type: 'number' },
        { key: 'inv_vmax', label: 'Tensión máxima DC', type: 'number', unit: 'V' },
        { key: 'inv_mppt_min', label: 'Rango MPPT mínimo', type: 'number', unit: 'V' },
        { key: 'inv_mppt_max', label: 'Rango MPPT máximo', type: 'number', unit: 'V' },
        { key: 'inv_imax', label: 'Corriente máx. por MPPT', type: 'number', unit: 'A' },
        { key: 'inv_mppt', label: 'Nº de MPPT por inversor', type: 'number' },
        { key: 'ns', label: 'Módulos en serie por string', type: 'number' },
        { key: 'np', label: 'Nº de strings por inversor', type: 'number' },
      ],
    },
    {
      title: 'Cableado',
      fields: [
        { key: 'l_dc', label: 'Longitud string → inversor', type: 'number', unit: 'm' },
        { key: 'l_ac', label: 'Longitud inversor → cuadro/CGMP', type: 'number', unit: 'm' },
        ...cableFields(''),
      ],
    },
    {
      title: 'Datos económicos',
      fields: [
        { key: 'consumo', label: 'Consumo anual del suministro', type: 'number', unit: 'kWh' },
        { key: 'autoconsumo', label: 'Fracción de la producción autoconsumida', type: 'number', unit: '%' },
        { key: 'precio_compra', label: 'Precio energía comprada', type: 'number', unit: '€/kWh', step: 0.01 },
        { key: 'precio_venta', label: 'Precio compensación / venta excedentes', type: 'number', unit: '€/kWh', step: 0.01 },
        { key: 'coste_wp', label: 'Coste de la instalación', type: 'number', unit: '€/Wp', step: 0.05 },
        { key: 'co2', label: 'Factor de emisión evitado', type: 'number', unit: 'kg CO₂/kWh', step: 0.01 },
      ],
    },
  ],

  calculate(d) {
    const nInv = Math.max(1, num(d.inv_n, 1));
    const ns = num(d.ns), np = num(d.np);
    const nMod = ns * np * nInv;
    const Pp = (nMod * num(d.mod_p)) / 1000;
    const Pac = num(d.inv_p) * nInv;
    const ratio = Pac ? Pp / Pac : 0;
    const sc = stringCheck(d);
    const stringsPerMppt = Math.ceil(np / Math.max(1, num(d.inv_mppt, 1)));
    const IscMppt = stringsPerMppt * num(d.isc);
    const ImpMppt = stringsPerMppt * num(d.imp);
    const okI = ImpMppt <= num(d.inv_imax) + 1e-9;

    const loss = orientationLoss(d.beta, d.alpha, d.lat);
    const yieldSpec = num(d.yield_ref) * (1 - loss) * (num(d.pr, 0.8) / 0.8);
    // yield_ref se interpreta con PR 0,8 de referencia (como PVGIS con 14 % pérdidas aprox.)
    const E = Pp * yieldSpec;
    const autoc = E * num(d.autoconsumo) / 100;
    const exced = E - autoc;
    const ahorro = autoc * num(d.precio_compra) + (d.modalidad === 'sin_excedentes' || d.modalidad === 'aislada' ? 0 : Math.min(exced * num(d.precio_venta), d.modalidad === 'compensacion' ? (num(d.consumo) - autoc) * num(d.precio_compra) : Infinity));
    const inversion = Pp * 1000 * num(d.coste_wp);
    const payback = ahorro > 0 ? inversion / ahorro : Infinity;
    const cobertura = num(d.consumo) ? (autoc / num(d.consumo)) * 100 : 0;

    // Cableado DC: por string, I = 1,25·Isc (ITC-BT-40 / UNE-HD 60364-7-712), ΔU ≤ 1,5 %
    const Vstring = num(d.vmp) * ns;
    const dc = sizeCircuit({
      Ib: num(d.isc) * 1.25, U: Vstring, phases: 1, dc: true, L: num(d.l_dc), material: d.material,
      insulation: 'XLPE', method: d.method, ambient: 60, maxDropPct: 1.5, minSection: 4, sections: [4, 6, 10, 16, 25],
    });
    // Para la caída de tensión usamos Imp (corriente de funcionamiento)
    const dcDrop = dc.S ? (2 * num(d.l_dc) * num(d.imp)) / (dc.gamma * dc.S) / Vstring * 100 : 0;
    const ph = num(d.conexion) === 400 ? 3 : 1;
    const Uac = ph === 3 ? 400 : 230;
    const ac = sizeCircuit({
      P: Pac * 1000, U: Uac, phases: ph, cosphi: 1, L: num(d.l_ac), material: d.material, insulation: d.insulation,
      method: d.method, ambient: 40, maxDropPct: 1.5, minSection: 2.5, ibFactor: 1.25,
    });

    const monthly = MONTH_SHARE.map((s, i) => [MONTHS[i], fmt(E * s, 0)]);
    const summary = [
      { label: 'Potencia pico', value: fmt(Pp, 2), unit: 'kWp' },
      { label: 'Potencia nominal (AC)', value: fmt(Pac, 2), unit: 'kW' },
      { label: 'Ratio DC/AC', value: fmt(ratio, 2), status: ratio >= 0.9 && ratio <= 1.35 ? 'ok' : 'warn' },
      { label: 'Nº de módulos', value: String(nMod) },
      { label: 'Producción anual', value: fmt(E, 0), unit: 'kWh' },
      { label: 'Producción específica', value: fmt(yieldSpec, 0), unit: 'kWh/kWp' },
      { label: 'Cobertura del consumo', value: fmt(cobertura, 1), unit: '%' },
      { label: 'Ahorro anual estimado', value: fmt(ahorro, 0), unit: '€' },
      { label: 'Retorno simple', value: fmt(payback, 1), unit: 'años' },
      { label: 'CO₂ evitado', value: fmt(E * num(d.co2) / 1000, 2), unit: 't/año' },
    ];
    const tables = [
      {
        title: 'Compatibilidad módulo – inversor (por temperatura)',
        columns: ['Parámetro', 'Valor', 'Límite', 'Estado'],
        rows: [
          ['T. célula máxima (G=1000 W/m²)', `${fmt(sc.Tcell, 1)} °C`, '', ''],
          [`Voc string a ${num(d.tmin)} °C`, `${fmt(sc.VocString, 1)} V`, `≤ ${num(d.inv_vmax)} V`, { ok: sc.okVoc, t: sc.okVoc ? 'Cumple' : 'No cumple' }],
          [`Vmp string a Tcélula máx.`, `${fmt(sc.VmpStringMin, 1)} V`, `≥ ${num(d.inv_mppt_min)} V`, { ok: sc.okMin, t: sc.okMin ? 'Cumple' : 'No cumple' }],
          [`Vmp string a ${num(d.tmin)} °C`, `${fmt(sc.VmpStringMax, 1)} V`, `≤ ${num(d.inv_mppt_max)} V`, { ok: sc.okMax, t: sc.okMax ? 'Cumple' : 'No cumple' }],
          ['Imp por MPPT', `${fmt(ImpMppt, 2)} A (${stringsPerMppt} string/MPPT; Isc ${fmt(IscMppt, 2)} A)`, `≤ ${num(d.inv_imax)} A`, { ok: okI, t: okI ? 'Cumple' : 'Revisar' }],
          ['Rango admisible de módulos en serie', `${sc.nsMin} – ${sc.nsMax}`, `Proyectado: ${ns}`, { ok: ns >= sc.nsMin && ns <= sc.nsMax, t: ns >= sc.nsMin && ns <= sc.nsMax ? 'Cumple' : 'No cumple' }],
        ],
      },
      {
        title: 'Producción y pérdidas',
        columns: ['Parámetro', 'Valor'],
        rows: [
          ['Pérdidas por orientación e inclinación (IDAE)', `${fmt(loss * 100, 1)} %`],
          ['Performance ratio', fmt(num(d.pr), 2)],
          ['Energía anual producida', `${fmt(E, 0)} kWh`],
          ['Energía autoconsumida / excedentes', `${fmt(autoc, 0)} / ${fmt(exced, 0)} kWh`],
          ['Inversión estimada', `${fmt(inversion, 0)} €`],
        ],
      },
      { title: 'Producción mensual estimada (kWh)', columns: ['Mes', 'kWh'], rows: monthly, chart: MONTH_SHARE.map((s, i) => ({ label: MONTHS[i], value: E * s })) },
      {
        title: 'Cableado',
        columns: ['Tramo', 'I cálculo (A)', 'Sección (mm²)', 'Iz (A)', 'Protección', 'ΔU (%)', 'Estado'],
        rows: [
          ['String → inversor (DC, por string)', fmt(dc.Ib, 2), dc.S ? `2×${dc.S} (H1Z2Z2-K)` : '—', fmt(dc.Iz, 1), `Fusible gPV ${Math.max(10, Math.ceil(num(d.isc) * 1.5))} A (si >2 strings en paralelo)`, fmt(dcDrop), { ok: dc.ok && dcDrop <= 1.5, t: dc.ok && dcDrop <= 1.5 ? 'Cumple' : 'Revisar' }],
          ['Inversor → cuadro (AC)', fmt(ac.Ib, 2), ac.S ? `${ph === 3 ? '4' : '2'}×${ac.S}` : '—', fmt(ac.Iz, 1), `Magnetotérmico ${ac.In ?? '—'} A + diferencial`, fmt(ac.dropPct), { ok: ac.ok, t: ac.ok ? 'Cumple' : 'Revisar' }],
        ],
      },
    ];
    const checks = [
      check('Tensión máxima del string inferior a la máxima del inversor', sc.okVoc),
      check('String dentro del rango de seguimiento MPPT', sc.okMin && sc.okMax),
      check('Ratio DC/AC entre 0,9 y 1,35', ratio >= 0.9 && ratio <= 1.35, fmt(ratio, 2)),
      check('Caída de tensión DC ≤ 1,5 % (PCT IDAE)', dcDrop <= 1.5, `${fmt(dcDrop)} %`),
      check('Caída de tensión AC ≤ 1,5 % (ITC-BT-40)', ac.ok, `${fmt(ac.dropPct)} %`),
      check('Pérdidas por orientación e inclinación ≤ 10 % (caso general IDAE)', loss <= 0.10, `${fmt(loss * 100, 1)} %`),
    ];
    if (ph === 1 && Pac > 5) checks.push(check('Conexión monofásica ≤ 5 kW (ITC-BT-40 / normas distribuidora)', false, 'Conexión trifásica obligatoria por encima de 5 kW'));
    const notes = [
      d.modalidad === 'sin_excedentes' ? 'Se instalará sistema antivertido conforme a la ITC-BT-40 Anexo I (UNE 217001).' : '',
      Pp <= 15 && d.modalidad !== 'venta' ? 'Instalación ≤ 15 kW en suelo urbanizado sin excedentes o con compensación: exenta de permisos de acceso y conexión (RD 244/2019 art. 7).' : '',
      'Se recomienda verificar la producción con PVGIS (JRC) para la ubicación exacta y el estudio de sombras.',
    ].filter(Boolean);
    return { summary, tables, checks, notes, Pp, Pac, nMod, E, dc, ac, inversion };
  },

  memoria(d, r) {
    const mod = { sin_excedentes: 'autoconsumo sin excedentes', compensacion: 'autoconsumo con excedentes acogida a compensación simplificada', venta: 'autoconsumo con excedentes no acogida a compensación', aislada: 'aislada de red' };
    return `
      <p>Se proyecta una instalación solar fotovoltaica en modalidad de <b>${mod[d.modalidad]}</b>, con una potencia pico de
      <b>${fmt(r.Pp, 2)} kWp</b> y una potencia nominal de <b>${fmt(r.Pac, 2)} kW</b>, conectada a la red interior del consumidor
      en ${num(d.conexion) === 400 ? 'trifásica 3×400/230 V' : 'monofásica 230 V'}.</p>
      <p>El generador está formado por ${r.nMod} módulos de ${num(d.mod_p)} Wp, montados con una inclinación de ${num(d.beta)}° y
      azimut ${num(d.alpha)}°, distribuidos en ${num(d.np) * Math.max(1, num(d.inv_n, 1))} strings de ${num(d.ns)} módulos en serie conectados a
      ${Math.max(1, num(d.inv_n, 1))} inversor(es) de ${num(d.inv_p)} kW con ${num(d.inv_mppt)} seguidores MPPT.</p>
      <p>La producción anual estimada es de <b>${fmt(r.E, 0)} kWh</b>. El cableado de corriente continua será de tipo H1Z2Z2-K
      (UNE-EN 50618) de ${r.dc?.S ?? '—'} mm², y el de alterna de ${r.ac?.S ?? '—'} mm². Se dispondrán protecciones de corriente continua
      (seccionador, descargadores de sobretensión tipo 2 y fusibles cuando proceda) y en alterna interruptor magnetotérmico,
      diferencial y protecciones de interconexión integradas en el inversor según ITC-BT-40.</p>
      <p>Las masas metálicas de la estructura y los marcos de los módulos se conectarán a la red de tierra de la instalación.</p>`;
  },

  budget(d, r) {
    return [
      { code: 'FV01', desc: `Módulo fotovoltaico ${num(d.mod_p)} Wp monocristalino`, unit: 'ud', qty: r.nMod, price: num(d.mod_p) * 0.22 },
      { code: 'FV02', desc: `Inversor ${num(d.inv_p)} kW con ${num(d.inv_mppt)} MPPT`, unit: 'ud', qty: Math.max(1, num(d.inv_n, 1)), price: 250 + num(d.inv_p) * 120 },
      { code: 'FV03', desc: 'Estructura de soporte de aluminio para cubierta, incluso anclajes', unit: 'ud', qty: r.nMod, price: 38 },
      { code: 'FV04', desc: `Cable solar H1Z2Z2-K ${r.dc?.S ?? 6} mm²`, unit: 'm', qty: num(d.l_dc) * 2 * num(d.np) * Math.max(1, num(d.inv_n, 1)), price: 1.6 },
      { code: 'FV05', desc: 'Cuadro de protecciones DC/AC (seccionador, SPD, magnetotérmico, diferencial)', unit: 'ud', qty: 1, price: 450 },
      { code: 'FV06', desc: `Línea AC ${r.ac?.S ?? ''} mm² hasta CGMP`, unit: 'm', qty: num(d.l_ac), price: 9 },
      { code: 'FV07', desc: 'Legalización, tramitación y certificado de instalación', unit: 'ud', qty: 1, price: 600 },
    ];
  },
};
