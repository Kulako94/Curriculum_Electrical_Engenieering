// Infraestructura Común de Telecomunicaciones (RD 346/2011, Orden ITC/1644/2011).
import { fmt, num, check } from '../calc/common.js';

const FIBER_SIZES = [8, 16, 24, 32, 48, 64, 96, 128, 144, 256];

export function ictDims(nPAU) {
  const arqueta = nPAU <= 20 ? '400×400×600 mm' : nPAU <= 100 ? '600×600×800 mm' : '800×700×820 mm';
  const externa = nPAU <= 4 ? 3 : nPAU <= 20 ? 4 : nPAU <= 40 ? 5 : 6;
  const principal = nPAU <= 10 ? 5 : nPAU <= 20 ? 6 : nPAU <= 30 ? 7 : null;
  const recinto = nPAU <= 20 ? '2000×1000×500 mm' : nPAU <= 30 ? '2000×1500×500 mm' : '2000×2000×500 mm';
  return { arqueta, externa, principal, recinto };
}

export function levelBudget(d) {
  // Niveles en la toma de usuario (planta más cercana y más lejana a la cabecera)
  const floors = Math.max(1, num(d.plantas));
  const head = num(d.nivel_cabecera);
  const att = num(d.aten_cable) / 100; // dB/m
  const res = [];
  for (let f = 1; f <= floors; f++) {
    const cable = (num(d.dist_cab) + f * num(d.altura_planta)) * att;
    const insert = (f - 1) * num(d.perd_paso);
    const lvl = head - cable - insert - num(d.perd_deriv) - num(d.perd_pau) - num(d.long_usuario) * att;
    res.push({ floor: f, lvl });
  }
  return res;
}

export default {
  id: 'teleco',
  name: 'Telecomunicaciones (ICT)',
  short: 'ICT',
  icon: '📡',
  description: 'Dimensionado de la ICT: canalizaciones, recintos, red de cables (pares trenzados, coaxial, fibra), tomas y niveles de señal RTV.',
  normativa: [
    'RD-ley 1/1998 sobre infraestructuras comunes en los edificios para el acceso a los servicios de telecomunicación.',
    'RD 346/2011, Reglamento regulador de las ICT.',
    'Orden ITC/1644/2011 por la que se desarrolla el Reglamento de ICT.',
    'Ley 11/2022 General de Telecomunicaciones.',
    'UNE 133100 (canalizaciones), UNE-EN 50173 (cableado estructurado), UNE-EN 60728 (redes coaxiales).',
    'Código Técnico de la Edificación (DB SI, DB HR) en lo que afecte a la ICT.',
  ],
  defaults() {
    return {
      plantas: 5, viv_planta: 4, locales: 2, oficinas: 0, estancias: 5,
      nivel_cabecera: 100, aten_cable: 18, dist_cab: 10, altura_planta: 3, perd_paso: 2, perd_deriv: 20, perd_pau: 10, long_usuario: 15,
    };
  },
  sections: [
    {
      title: 'Edificio',
      fields: [
        { key: 'plantas', label: 'Nº de plantas con viviendas', type: 'number' },
        { key: 'viv_planta', label: 'Viviendas por planta', type: 'number' },
        { key: 'locales', label: 'Nº de locales comerciales', type: 'number' },
        { key: 'oficinas', label: 'Nº de oficinas', type: 'number' },
        { key: 'estancias', label: 'Estancias por vivienda (sin baños ni trasteros)', type: 'number' },
      ],
    },
    {
      title: 'Red de radiodifusión (RTV) · balance de niveles a 790 MHz',
      fields: [
        { key: 'nivel_cabecera', label: 'Nivel de salida de cabecera', type: 'number', unit: 'dBµV' },
        { key: 'aten_cable', label: 'Atenuación del cable coaxial', type: 'number', unit: 'dB/100 m' },
        { key: 'dist_cab', label: 'Distancia cabecera – primera planta', type: 'number', unit: 'm' },
        { key: 'altura_planta', label: 'Altura entre plantas', type: 'number', unit: 'm' },
        { key: 'perd_paso', label: 'Pérdida de paso del derivador', type: 'number', unit: 'dB' },
        { key: 'perd_deriv', label: 'Pérdida de derivación', type: 'number', unit: 'dB' },
        { key: 'perd_pau', label: 'Pérdida del PAU / distribuidor', type: 'number', unit: 'dB' },
        { key: 'long_usuario', label: 'Longitud red interior de usuario', type: 'number', unit: 'm' },
      ],
    },
  ],
  calculate(d) {
    const nViv = num(d.plantas) * num(d.viv_planta);
    const nPAU = nViv + num(d.locales) + num(d.oficinas);
    const dims = ictDims(nPAU);
    const fibers = FIBER_SIZES.find((s) => s >= Math.ceil(nPAU * 2 * 1.2)) ?? Math.ceil(nPAU * 2 * 1.2);
    const pt = nPAU; // 1 cable de 4 pares por PAU (Cat 6)
    const coax = nPAU * 2; // red de distribución de TBA, 2 cables por PAU
    const tomasPT = Math.max(2, num(d.estancias)) * nViv;
    const tomasRTV = Math.max(2, num(d.estancias)) * nViv;
    const levels = levelBudget(d);
    const minL = Math.min(...levels.map((l) => l.lvl));
    const maxL = Math.max(...levels.map((l) => l.lvl));
    const okLvl = minL >= 47 && maxL <= 70;
    return {
      summary: [
        { label: 'Nº de PAU', value: String(nPAU) },
        { label: 'Canalización externa', value: `${dims.externa} tubos Ø63`, unit: '' },
        { label: 'Canalización principal', value: dims.principal ? `${dims.principal} tubos Ø50` : 'Canal / estudio', unit: '' },
        { label: 'RITI / RITS', value: dims.recinto, unit: '' },
        { label: 'Cable de fibra óptica', value: `${fibers}`, unit: 'fibras' },
        { label: 'Nivel en toma (mín./máx.)', value: `${fmt(minL, 1)} / ${fmt(maxL, 1)}`, unit: 'dBµV', status: okLvl ? 'ok' : 'bad' },
      ],
      tables: [
        {
          title: 'Dimensionado de canalizaciones y recintos',
          columns: ['Elemento', 'Dimensión'],
          rows: [
            ['Arqueta de entrada', dims.arqueta],
            ['Canalización externa', `${dims.externa} tubos Ø63 mm`],
            ['Canalización de enlace', `${dims.externa} tubos Ø40 mm (o canal equivalente)`],
            ['Canalización principal', dims.principal ? `${dims.principal} tubos Ø50 mm` : 'Canal o estudio específico (> 30 PAU)'],
            ['Recintos RITI y RITS', dims.recinto],
            ['Registro secundario (por planta)', '450×450×150 mm'],
            ['Registro de terminación de red (RTR)', '500×600×80 mm (integrado)'],
            ['Canalización interior de usuario', 'Tubos Ø20 mm (mínimo 3 por estancia: PT, coaxial, reserva)'],
          ],
        },
        {
          title: 'Red de cables',
          columns: ['Red', 'Cálculo', 'Resultado'],
          rows: [
            ['Pares trenzados (Cat. 6 F/UTP)', '1 cable de 4 pares por PAU', `${pt} cables`],
            ['Cable coaxial (TBA)', '2 cables por PAU', `${coax} cables`],
            ['Fibra óptica (ITU-T G.657)', '2 fibras/PAU × 1,2 (reserva)', `Cable de ${fibers} fibras`],
            ['Tomas RJ45 (pares trenzados)', '1 por estancia (mín. 2)', `${tomasPT} tomas`],
            ['Tomas RTV / coaxial', '1 por estancia (mín. 2)', `${tomasRTV} tomas`],
          ],
        },
        {
          title: 'Niveles de señal RTV en toma de usuario (790 MHz)',
          columns: ['Planta', 'Nivel (dBµV)', 'Rango 47–70 dBµV'],
          rows: levels.map((l) => [l.floor, fmt(l.lvl, 1), { ok: l.lvl >= 47 && l.lvl <= 70, t: l.lvl >= 47 && l.lvl <= 70 ? 'Cumple' : 'No cumple' }]),
        },
      ],
      checks: [
        check('Niveles de señal TDT en tomas entre 47 y 70 dBµV', okLvl),
        check('Dimensiones de canalización principal según Orden ITC/1644/2011', !!dims.principal, dims.principal ? '' : 'Requiere estudio específico'),
      ],
      notes: [
        'Dimensionado basado en las tablas de la Orden ITC/1644/2011; verificar con el Anexo IV para casos singulares (conjuntos de viviendas unifamiliares, edificios con varias escaleras).',
        'El proyecto técnico de ICT debe ser firmado por ingeniero de telecomunicación o ingeniero técnico de telecomunicación competente.',
      ],
      nPAU, nViv, dims, fibers, tomasPT,
    };
  },
  memoria(d, r) {
    return `
      <p>El edificio cuenta con ${r.nViv} viviendas distribuidas en ${num(d.plantas)} plantas, ${num(d.locales)} locales y ${num(d.oficinas)} oficinas,
      lo que supone un total de <b>${r.nPAU} PAU</b>. La ICT proyectada permite el acceso a los servicios de radiodifusión sonora y televisión,
      y a los servicios de telecomunicaciones de banda ancha mediante redes de pares trenzados, cable coaxial y fibra óptica.</p>
      <p>La infraestructura se compone de arqueta de entrada (${r.dims.arqueta}), canalización externa de ${r.dims.externa} tubos Ø63 mm,
      recintos de instalaciones de telecomunicación inferior y superior (${r.dims.recinto}), canalización principal
      ${r.dims.principal ? `de ${r.dims.principal} tubos Ø50 mm` : 'mediante canal'}, registros secundarios en cada planta y red interior de usuario
      hasta el registro de terminación de red de cada vivienda.</p>`;
  },
  budget(d, r) {
    return [
      { code: 'TC01', desc: `Arqueta de entrada ${r.dims.arqueta} con tapa`, unit: 'ud', qty: 1, price: 380 },
      { code: 'TC02', desc: 'Equipo de cabecera RTV (antenas, amplificadores monocanal, mezclador)', unit: 'ud', qty: 1, price: 2200 },
      { code: 'TC03', desc: 'RITI y RITS equipados (armarios, cuadro eléctrico, toma de tierra)', unit: 'ud', qty: 2, price: 950 },
      { code: 'TC04', desc: 'Canalización principal y registros secundarios', unit: 'planta', qty: num(d.plantas), price: 260 },
      { code: 'TC05', desc: `Cable de fibra óptica de ${r.fibers} fibras y regletas`, unit: 'm', qty: num(d.plantas) * num(d.altura_planta) + 20, price: 3.5 },
      { code: 'TC06', desc: 'Red interior de usuario por vivienda (RTR, cableado Cat 6 y coaxial, tomas)', unit: 'viv', qty: r.nViv, price: 420 },
      { code: 'TC07', desc: 'Proyecto técnico, certificación y boletín de ICT', unit: 'ud', qty: 1, price: 900 },
    ];
  },
};
