// Centro de seccionamiento (ITC-RAT).
import { fmt, num, check } from '../calc/common.js';
import { ccMT, earthing, earthingTable, EARTHING_FIELDS, EARTHING_DEFAULTS, US_MAX } from '../calc/mt.js';

const RATED_STC = [12.5, 16, 20, 25]; // kA corta duración

export default {
  id: 'cs',
  name: 'Centro de seccionamiento',
  short: 'C. seccionamiento',
  icon: '🎛️',
  description: 'Celdas de línea, protección y medida; intensidades, cortocircuito, selección de aparamenta y puesta a tierra.',
  normativa: [
    'RD 337/2014 e ITC-RAT 01 a 23.',
    'RD 223/2008 e ITC-LAT 06 para las líneas subterráneas de acometida.',
    'UNE-EN 62271-200 / 62271-103 / 62271-105: aparamenta bajo envolvente metálica.',
    'Método UNESA para puesta a tierra.',
    'Normas particulares de la empresa distribuidora (frontera de propiedad y celdas de compañía).',
  ],
  defaults() {
    return {
      Un: 20, Scc: 500, P: 1500, fp: 0.9,
      celdas_linea: 2, celda_proteccion: 1, celda_medida: true, celda_remonte: 0,
      telemando: true, ...EARTHING_DEFAULTS,
    };
  },
  sections: [
    {
      title: 'Red y potencia',
      fields: [
        { key: 'Un', label: 'Tensión nominal', type: 'select', unit: 'kV', options: [10, 11, 13.2, 15, 20, 25, 30].map((v) => ({ value: v, label: `${v} kV` })) },
        { key: 'Scc', label: 'Potencia de cortocircuito', type: 'number', unit: 'MVA' },
        { key: 'P', label: 'Potencia a suministrar', type: 'number', unit: 'kW' },
        { key: 'fp', label: 'Factor de potencia', type: 'number', step: 0.01 },
      ],
    },
    {
      title: 'Celdas',
      fields: [
        { key: 'celdas_linea', label: 'Celdas de línea (entrada/salida)', type: 'number' },
        { key: 'celda_proteccion', label: 'Celdas de protección general (interruptor automático)', type: 'number' },
        { key: 'celda_remonte', label: 'Celdas de remonte', type: 'number' },
        { key: 'celda_medida', label: 'Celda de medida', type: 'checkbox' },
        { key: 'telemando', label: 'Celdas de compañía telemandadas', type: 'checkbox' },
      ],
    },
    { title: 'Puesta a tierra', fields: EARTHING_FIELDS },
  ],
  calculate(d) {
    const Un = num(d.Un, 20);
    const I = (num(d.P) / num(d.fp, 0.9)) / (Math.sqrt(3) * Un);
    const Icc = ccMT(num(d.Scc), Un);
    const stc = RATED_STC.find((v) => v * 1000 >= Icc) ?? 25;
    const Ur = (US_MAX[Un] ?? 24);
    const ratedU = Ur <= 24 ? 24 : 36;
    const e = earthing({ Un, Rn: num(d.Rn), Xn: num(d.Xn), rho: num(d.rho), Kr: num(d.Kr), Kp: num(d.Kp), Kc: num(d.Kc), t: num(d.t), Ia: num(d.Ia), Vbt: num(d.Vbt), KrN: num(d.KrN) });
    // Ajuste orientativo de la protección general (relé 50/51): 1,2·I y tiempo
    const Iset = I * 1.2;
    const nCeldas = num(d.celdas_linea) + num(d.celda_proteccion) + num(d.celda_remonte) + (d.celda_medida ? 1 : 0);
    return {
      summary: [
        { label: 'Intensidad nominal', value: fmt(I, 2), unit: 'A' },
        { label: 'Icc trifásica', value: fmt(Icc / 1000, 2), unit: 'kA' },
        { label: 'Icc cresta', value: fmt(2.5 * Icc / 1000, 2), unit: 'kA' },
        { label: 'Aparamenta', value: `${ratedU} kV · 630 A · ${stc} kA`, unit: '' },
        { label: 'Nº de celdas', value: String(nCeldas) },
        { label: 'Rt protección', value: fmt(e.Rt, 2), unit: 'Ω' },
      ],
      tables: [
        {
          title: 'Dimensionado de la aparamenta',
          columns: ['Magnitud', 'Valor'],
          rows: [
            ['Intensidad nominal I = P/(√3·U·cosφ)', `${fmt(I, 2)} A`],
            ['Intensidad asignada de embarrado y celdas', '630 A'],
            ['Intensidad de cortocircuito Icc = Scc/(√3·U)', `${fmt(Icc / 1000, 2)} kA`],
            ['Intensidad de corta duración admisible (1 s)', `${stc} kA`],
            ['Valor de cresta admisible', `${fmt(stc * 2.5, 1)} kA`],
            ['Tensión asignada', `${ratedU} kV`],
            ['Ajuste orientativo protección de sobreintensidad (50/51)', `I> ≈ ${fmt(Iset, 1)} A`],
            ['Ajuste orientativo protección homopolar (50N/51N)', `Io> ≈ ${fmt(num(d.Ia) * 0.8, 0)} A`],
          ],
        },
        earthingTable(e),
      ],
      checks: [
        check('Intensidad nominal < 630 A', I < 630),
        check('Icc ≤ intensidad de corta duración de las celdas', Icc <= stc * 1000),
        ...e.checks,
      ],
      notes: [
        'La disposición y el tipo de celdas de compañía deberán ajustarse a las normas particulares de la empresa distribuidora.',
        'Los coeficientes UNESA (Kr, Kp, Kc) por defecto son un ejemplo; seleccionar la configuración real.',
      ],
      I, Icc, e, nCeldas, stc, ratedU,
    };
  },
  memoria(d, r) {
    return `
      <p>Se proyecta un centro de seccionamiento para la conexión a la red de ${num(d.Un)} kV de la empresa distribuidora de una potencia de
      ${fmt(num(d.P), 0)} kW. Estará constituido por ${r.nCeldas} celdas modulares bajo envolvente metálica de ${r.ratedU} kV, 630 A y ${r.stc} kA,
      con aislamiento integral en SF₆: ${num(d.celdas_linea)} celdas de línea${d.telemando ? ' telemandadas' : ''},
      ${num(d.celda_proteccion)} celda(s) de protección general con interruptor automático y relé de protección 50/51-50N/51N${d.celda_medida ? ', celda de medida' : ''}
      ${num(d.celda_remonte) ? ` y ${num(d.celda_remonte)} celda(s) de remonte` : ''}.</p>
      <p>El centro se alojará en envolvente prefabricada con acceso independiente para la compañía, y dispondrá de instalación de puesta a tierra
      de protección según el método UNESA (configuración ${d.conf}).</p>`;
  },
  budget(d, r) {
    return [
      { code: 'CS01', desc: 'Envolvente prefabricada para centro de seccionamiento', unit: 'ud', qty: 1, price: 7500 },
      { code: 'CS02', desc: `Celda de línea ${r.ratedU} kV 630 A${d.telemando ? ' telemandada' : ''}`, unit: 'ud', qty: num(d.celdas_linea), price: d.telemando ? 6500 : 3200 },
      { code: 'CS03', desc: 'Celda de protección general con interruptor automático y relé 50/51-50N/51N', unit: 'ud', qty: num(d.celda_proteccion), price: 9800 },
      ...(d.celda_medida ? [{ code: 'CS04', desc: 'Celda de medida con transformadores de tensión e intensidad', unit: 'ud', qty: 1, price: 5200 }] : []),
      ...(num(d.celda_remonte) ? [{ code: 'CS05', desc: 'Celda de remonte', unit: 'ud', qty: num(d.celda_remonte), price: 2400 }] : []),
      { code: 'CS06', desc: 'Instalación de puesta a tierra', unit: 'ud', qty: 1, price: 1800 },
    ];
  },
};
