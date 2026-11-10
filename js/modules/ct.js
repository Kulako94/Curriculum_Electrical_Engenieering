// Centro de transformación (RD 337/2014, ITC-RAT).
import { fmt, num, check, nextStandard, FUSES_GG } from '../calc/common.js';
import {
  ccMT, trafoCurrents, mtFuse, ventilation, earthing, earthingTable, TRAFO_LOSSES, TRAFO_SIZES,
  EARTHING_FIELDS, EARTHING_DEFAULTS,
} from '../calc/mt.js';

export default {
  id: 'ct',
  name: 'Centro de transformación',
  short: 'CT',
  icon: '⚡',
  description: 'Potencia del transformador, intensidades, cortocircuitos, protecciones, ventilación, foso de aceite y puesta a tierra (UNESA).',
  normativa: [
    'RD 337/2014, Reglamento sobre condiciones técnicas y garantías de seguridad en instalaciones eléctricas de alta tensión, e ITC-RAT 01 a 23.',
    'RD 223/2008, Reglamento de líneas eléctricas de alta tensión e ITC-LAT 01 a 09.',
    'RD 842/2002, REBT, para la parte de baja tensión.',
    'Reglamento (UE) 548/2014 de diseño ecológico de transformadores.',
    'Método de cálculo y proyecto de instalaciones de puesta a tierra para centros de transformación (UNESA).',
    'Normas particulares y condiciones técnicas de la empresa distribuidora.',
    'UNE-EN 62271-200 (aparamenta bajo envolvente metálica) y UNE-EN 62271-202 (centros prefabricados).',
  ],
  defaults() {
    return {
      tipo: 'cliente',
      envolvente: 'prefabricado',
      Un: 20,
      Scc: 500,
      demanda: 450,
      fp: 0.9,
      reserva: 20,
      S: 630,
      n_trafos: 1,
      ucc: 4,
      U2: 420,
      dielectrico: 'aceite',
      aceite_l: 600,
      h_rejillas: 1.5,
      ...EARTHING_DEFAULTS,
    };
  },
  sections: [
    {
      title: 'Características generales',
      fields: [
        { key: 'tipo', label: 'Tipo de centro', type: 'select', options: [
          { value: 'cliente', label: 'Abonado / cliente (medida en MT o BT)' }, { value: 'compania', label: 'Compañía distribuidora' }] },
        { key: 'envolvente', label: 'Envolvente', type: 'select', options: [
          { value: 'prefabricado', label: 'Prefabricado de hormigón de superficie' }, { value: 'subterraneo', label: 'Prefabricado subterráneo' },
          { value: 'interior', label: 'Local en edificio' }, { value: 'intemperie', label: 'Intemperie sobre apoyo' }] },
        { key: 'Un', label: 'Tensión nominal de la red', type: 'select', unit: 'kV', options: [6, 10, 11, 13.2, 15, 20, 25, 30].map((v) => ({ value: v, label: `${v} kV` })) },
        { key: 'Scc', label: 'Potencia de cortocircuito de la red', type: 'number', unit: 'MVA' },
      ],
    },
    {
      title: 'Transformador',
      fields: [
        { key: 'demanda', label: 'Potencia demandada prevista', type: 'number', unit: 'kW' },
        { key: 'fp', label: 'Factor de potencia', type: 'number', step: 0.01 },
        { key: 'reserva', label: 'Reserva de potencia', type: 'number', unit: '%' },
        { key: 'S', label: 'Potencia unitaria del transformador', type: 'select', unit: 'kVA', options: TRAFO_SIZES.map((v) => ({ value: v, label: `${v} kVA` })) },
        { key: 'n_trafos', label: 'Nº de transformadores', type: 'number' },
        { key: 'ucc', label: 'Tensión de cortocircuito ucc', type: 'number', unit: '%', step: 0.5 },
        { key: 'U2', label: 'Tensión secundaria en vacío', type: 'number', unit: 'V' },
        { key: 'dielectrico', label: 'Dieléctrico', type: 'select', options: [{ value: 'aceite', label: 'Aceite mineral' }, { value: 'ester', label: 'Éster vegetal' }, { value: 'seco', label: 'Seco (resina)' }] },
        { key: 'aceite_l', label: 'Volumen de dieléctrico líquido', type: 'number', unit: 'l', show: (d) => d.dielectrico !== 'seco' },
        { key: 'h_rejillas', label: 'Distancia vertical entre rejillas', type: 'number', unit: 'm', step: 0.1 },
      ],
    },
    { title: 'Puesta a tierra', fields: EARTHING_FIELDS },
  ],

  calculate(d) {
    const Un = num(d.Un, 20);
    const S = num(d.S, 630);
    const n = Math.max(1, num(d.n_trafos, 1));
    const Sreq = (num(d.demanda) / num(d.fp, 0.9)) * (1 + num(d.reserva) / 100);
    const Srec = TRAFO_SIZES.find((s) => s * n >= Sreq) ?? TRAFO_SIZES[TRAFO_SIZES.length - 1];
    const load = (num(d.demanda) / num(d.fp, 0.9)) / (S * n) * 100;
    const tc = trafoCurrents(S, Un, num(d.U2, 420), num(d.ucc, 4), num(d.Scc, 500));
    const Iccp = ccMT(num(d.Scc, 500), Un);
    const fuse = mtFuse(tc.I1);
    const [Wfe, Wcu] = TRAFO_LOSSES[S] || [0, 0];
    const Sr = ventilation({ Wcu, Wfe, h: num(d.h_rejillas, 1.5) });
    const bt = nextStandard(FUSES_GG, tc.I2) ?? '—';
    const e = earthing({
      Un, Rn: num(d.Rn), Xn: num(d.Xn), rho: num(d.rho), Kr: num(d.Kr), Kp: num(d.Kp), Kc: num(d.Kc),
      t: num(d.t), Ia: num(d.Ia), Vbt: num(d.Vbt), KrN: num(d.KrN),
    });
    // Rendimiento al 75 % de carga y cos φ = 0,9
    const eff = (x) => (x * S * 0.9) / (x * S * 0.9 + Wfe / 1000 + x * x * Wcu / 1000) * 100;

    const summary = [
      { label: 'Potencia instalada', value: `${n} × ${S}`, unit: 'kVA' },
      { label: 'Potencia recomendada', value: `${Srec}`, unit: 'kVA', status: S >= Srec ? 'ok' : 'warn' },
      { label: 'Índice de carga', value: fmt(load, 0), unit: '%', status: load <= 85 ? 'ok' : 'warn' },
      { label: 'Intensidad primaria', value: fmt(tc.I1, 2), unit: 'A' },
      { label: 'Intensidad secundaria', value: fmt(tc.I2, 0), unit: 'A' },
      { label: 'Icc en MT', value: fmt(Iccp / 1000, 2), unit: 'kA' },
      { label: 'Icc en BT', value: fmt(tc.Icc2 / 1000, 2), unit: 'kA' },
      { label: 'Fusible MT', value: `${fuse}`, unit: 'A' },
      { label: 'Superficie de rejillas', value: fmt(Sr, 2), unit: 'm²' },
      { label: 'Rt protección', value: fmt(e.Rt, 2), unit: 'Ω' },
    ];
    const tables = [
      {
        title: 'Intensidades y cortocircuitos',
        columns: ['Magnitud', 'Expresión', 'Valor'],
        rows: [
          ['Intensidad en MT', 'I1 = S / (√3·U1)', `${fmt(tc.I1, 2)} A`],
          ['Intensidad en BT', 'I2 = S / (√3·U2)', `${fmt(tc.I2, 1)} A`],
          ['Cortocircuito en MT', 'Iccp = Scc / (√3·U1)', `${fmt(Iccp / 1000, 2)} kA`],
          ['Cortocircuito en BT (red ∞)', 'Iccs = S / (√3·U2·ucc)', `${fmt(tc.Icc2inf / 1000, 2)} kA`],
          ['Cortocircuito en BT (con red)', 'Iccs = U2 / (√3·(Zt+Zr))', `${fmt(tc.Icc2 / 1000, 2)} kA`],
          ['Valor de cresta (dinámico) MT', 'Icc,din = 2,5·Iccp', `${fmt(2.5 * Iccp / 1000, 2)} kA`],
        ],
      },
      {
        title: 'Transformador, protecciones y ventilación',
        columns: ['Concepto', 'Valor'],
        rows: [
          ['Potencia aparente requerida (con reserva)', `${fmt(Sreq, 0)} kVA`],
          ['Pérdidas en vacío / en carga (UE 548/2014 Tier 2)', `${Wfe} W / ${Wcu} W`],
          ['Rendimiento a 75 % de carga, cos φ 0,9', `${fmt(eff(0.75), 2)} %`],
          ['Protección del transformador en MT', `Ruptofusibles / fusibles limitadores ${fuse} A (combinado interruptor-fusibles)`],
          ['Protección en BT (salida a cuadro)', `Fusibles gG / interruptor automático ≥ ${bt} A`],
          ['Protección térmica', 'Termómetro / DGPT2 con disparo sobre el interruptor de MT'],
          ['Superficie mínima de rejillas Sr (K = 0,6; ΔT = 15 °C)', `${fmt(Sr, 3)} m²`],
          ['Volumen mínimo del foso de recogida de aceite', d.dielectrico === 'seco' ? 'No necesario (seco)' : `${fmt(num(d.aceite_l) * 1.0, 0)} l (≥ volumen del dieléctrico)`],
          ['Puentes MT (cable seco HEPRZ1 12/20 kV)', `3×1×50 mm² Al (I adm ≫ ${fmt(tc.I1, 1)} A)`],
          ['Puentes BT', `${Math.max(1, Math.ceil(tc.I2 / 350))} ternas de 1×240 mm² Al por fase + neutro`],
        ],
      },
      earthingTable(e),
    ];
    const checks = [
      check('Potencia instalada ≥ potencia requerida', S * n >= Sreq, `${S * n} ≥ ${fmt(Sreq, 0)} kVA`),
      check('Aparamenta MT con Icc de corta duración ≥ Iccp (16/20 kA)', Iccp <= 16000, `${fmt(Iccp / 1000, 2)} kA`),
      check('Aparamenta BT con poder de corte ≥ Icc en BT', true, `Seleccionar PdC ≥ ${fmt(tc.Icc2 / 1000, 1)} kA`),
      ...e.checks,
    ];
    const notes = [
      'Los coeficientes Kr, Kp y Kc deben tomarse de las tablas del Método UNESA para la configuración elegida y la profundidad de enterramiento; los valores por defecto son un ejemplo.',
      `Las tierras de protección y de servicio se separarán al menos ${fmt(Math.max(e.D, 0), 1)} m, con conductor de unión aislado 0,6/1 kV.`,
      'Se instalarán aceras perimetrales equipotenciales de hormigón con mallazo conectado a la tierra de protección (ITC-RAT 13).',
    ];
    return { summary, tables, checks, notes, tc, Iccp, fuse, Sr, e, Srec };
  },

  memoria(d, r) {
    const env = { prefabricado: 'edificio prefabricado de hormigón de superficie', subterraneo: 'envolvente prefabricada subterránea', interior: 'local situado en el interior del edificio', intemperie: 'intemperie sobre apoyo' };
    return `
      <p>Se proyecta un centro de transformación de tipo <b>${d.tipo === 'compania' ? 'compañía' : 'abonado'}</b>, alojado en ${env[d.envolvente]},
      alimentado desde la red de media tensión de <b>${num(d.Un)} kV</b> de la empresa distribuidora, con una potencia de cortocircuito de ${num(d.Scc)} MVA.</p>
      <p>El centro albergará ${num(d.n_trafos)} transformador(es) de <b>${num(d.S)} kVA</b>, relación ${num(d.Un)} kV / ${num(d.U2)} V, grupo de conexión Dyn11,
      ucc ${num(d.ucc)} % y dieléctrico ${d.dielectrico === 'seco' ? 'seco encapsulado en resina' : d.dielectrico === 'ester' ? 'éster vegetal biodegradable' : 'aceite mineral'},
      conforme al Reglamento (UE) 548/2014.</p>
      <p>La aparamenta de media tensión estará formada por celdas modulares bajo envolvente metálica con aislamiento en SF₆ o aire,
      de tensión asignada ${num(d.Un) <= 20 ? 24 : 36} kV: celdas de línea (entrada/salida) con interruptor-seccionador y seccionador de puesta a tierra,
      ${d.tipo === 'cliente' ? 'celda de medida con transformadores de tensión e intensidad, ' : ''}y celda de protección del transformador con
      combinado interruptor-fusibles de ${r.fuse} A.</p>
      <p>La ventilación del centro será natural, con una superficie mínima de rejillas de entrada y salida de ${fmt(r.Sr, 2)} m².
      La instalación de puesta a tierra se compone de una tierra de protección (configuración ${d.conf}) y una tierra de servicio independiente
      para el neutro del transformador, separadas una distancia mínima de ${fmt(r.e.D, 1)} m.</p>`;
  },

  budget(d, r) {
    return [
      { code: 'CT01', desc: `Edificio prefabricado para centro de transformación (${d.envolvente}), incluida excavación y lecho de arena`, unit: 'ud', qty: 1, price: 9500 },
      { code: 'CT02', desc: `Transformador ${num(d.S)} kVA ${num(d.Un)} kV/${num(d.U2)} V, Ecodiseño Tier 2`, unit: 'ud', qty: num(d.n_trafos), price: 6000 + num(d.S) * 11 },
      { code: 'CT03', desc: 'Celda de línea con interruptor-seccionador (24 kV, 630 A, 16/20 kA)', unit: 'ud', qty: 2, price: 3200 },
      { code: 'CT04', desc: `Celda de protección con ruptofusibles ${r.fuse} A`, unit: 'ud', qty: num(d.n_trafos), price: 4300 },
      ...(d.tipo === 'cliente' ? [{ code: 'CT05', desc: 'Celda de medida con transformadores de tensión e intensidad', unit: 'ud', qty: 1, price: 5200 }] : []),
      { code: 'CT06', desc: 'Cuadro de baja tensión con salidas protegidas por fusibles', unit: 'ud', qty: num(d.n_trafos), price: 2800 },
      { code: 'CT07', desc: 'Puentes MT y BT, incluidos terminales', unit: 'ud', qty: num(d.n_trafos), price: 1900 },
      { code: 'CT08', desc: `Instalación de puesta a tierra de protección (${d.conf}) y de servicio`, unit: 'ud', qty: 1, price: 2100 },
      { code: 'CT09', desc: 'Equipos de seguridad y maniobra (banqueta, guantes, pértiga, carteles)', unit: 'ud', qty: 1, price: 450 },
    ];
  },
};
