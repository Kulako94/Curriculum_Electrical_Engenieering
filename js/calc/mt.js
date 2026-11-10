// Cálculos de media tensión: cortocircuitos, transformadores y puesta a tierra
// por el método UNESA (ITC-RAT 13, RD 337/2014).
import { interp, fmt, check } from './common.js';

// Tensión más elevada de la red Us (kV) para cada tensión nominal
export const US_MAX = { 6: 7.2, 10: 12, 11: 12, 13.2: 17.5, 15: 17.5, 20: 24, 25: 36, 30: 36, 45: 52, 66: 72.5 };

// ITC-RAT 13 Tabla 1: tensión de contacto aplicada admisible Uca(t)
export const UCA = [[0.05, 735], [0.1, 633], [0.2, 528], [0.3, 420], [0.4, 310], [0.5, 204], [1, 107], [2, 90], [5, 81], [10, 80]];
export function uca(t) {
  if (t > 10) return 50;
  return interp(UCA, t);
}

// Pérdidas de transformadores de distribución (Reglamento UE 548/2014, Tier 2: Ak y A0-10 %), W
export const TRAFO_LOSSES = {
  50: [81, 750], 100: [130, 1250], 160: [189, 1750], 250: [270, 2350], 315: [324, 2800],
  400: [387, 3250], 500: [459, 3900], 630: [540, 4600], 800: [585, 6000], 1000: [693, 7600],
  1250: [855, 9500], 1600: [1080, 12000], 2000: [1305, 15000], 2500: [1575, 18500],
};
export const TRAFO_SIZES = Object.keys(TRAFO_LOSSES).map(Number);
export const MT_FUSES = [6.3, 10, 16, 20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200];

export function ccMT(Scc_MVA, U_kV) {
  return (Scc_MVA * 1e6) / (Math.sqrt(3) * U_kV * 1e3); // A
}

export function trafoCurrents(S_kVA, U1_kV, U2_V, ucc_pct, Scc_MVA) {
  const I1 = (S_kVA * 1e3) / (Math.sqrt(3) * U1_kV * 1e3);
  const I2 = (S_kVA * 1e3) / (Math.sqrt(3) * U2_V);
  // Impedancia de red referida a BT + impedancia del transformador
  const Zt = (ucc_pct / 100) * (U2_V * U2_V) / (S_kVA * 1e3);
  const Zr = Scc_MVA ? (U2_V * U2_V) / (Scc_MVA * 1e6) : 0;
  const Icc2 = U2_V / (Math.sqrt(3) * (Zt + Zr));
  const Icc2inf = (S_kVA * 1e3) / (Math.sqrt(3) * U2_V * ucc_pct / 100);
  return { I1, I2, Icc2, Icc2inf };
}

// Fusible de MT orientativo: In fusible ≈ 2 × I1 (selección definitiva según tabla del fabricante)
export function mtFuse(I1) {
  return MT_FUSES.find((f) => f >= I1 * 2) ?? MT_FUSES[MT_FUSES.length - 1];
}

// Superficie mínima de rejillas de ventilación natural (método clásico UNESA)
// Sr = (Wcu + Wfe) / (0,24·K·√(h·ΔT³)), W en kW, h en m
export function ventilation({ Wcu, Wfe, K = 0.6, h = 1.5, dT = 15 }) {
  return (Wcu + Wfe) / 1000 / (0.24 * K * Math.sqrt(h * dT ** 3));
}

/**
 * Puesta a tierra de protección (UNESA) para centros de transformación/seccionamiento.
 * @param o { Un (kV), Rn, Xn (Ω, neutro de la red), rho (Ω·m), Kr, Kp, Kc,
 *            t (s, tiempo de despeje), Ia (A, umbral de relé), Vbt (V, aislamiento BT),
 *            rhoH (Ω·m, hormigón), KrN (Ω/Ω·m tierra de servicio) }
 */
export function earthing(o) {
  const { Un, Rn = 0, Xn = 25, rho = 150, Kr, Kp, Kc, t = 0.5, Ia = 50, Vbt = 10000, rhoH = 3000, KrN = 0.135, Ra1 = 2000 } = o;
  const Us = (US_MAX[Un] ?? Un * 1.2) * 1000;
  const Rt = Kr * rho;
  const Id = Us / (Math.sqrt(3) * Math.sqrt((Rn + Rt) ** 2 + Xn ** 2));
  const Vd = Rt * Id;
  const Vp = Kp * rho * Id;
  const Vpacc = Kc * rho * Id;
  const Uc = uca(t);
  const VpAdm = 10 * Uc * (1 + (2 * Ra1 + 6 * rho) / 1000);
  const VpaccAdm = 10 * Uc * (1 + (2 * Ra1 + 3 * rho + 3 * rhoH) / 1000);
  const D = (rho * Id) / (2000 * Math.PI);
  const RtN = KrN * rho;
  const checks = [
    check('Tensión de defecto Vd ≤ nivel de aislamiento BT', Vd <= Vbt, `${fmt(Vd, 0)} V ≤ ${fmt(Vbt, 0)} V`),
    check('Intensidad de defecto superior al umbral de la protección', Id >= Ia, `${fmt(Id, 1)} A ≥ ${fmt(Ia, 0)} A`),
    check('Tensión de paso exterior ≤ admisible (ITC-RAT 13)', Vp <= VpAdm, `${fmt(Vp, 0)} V ≤ ${fmt(VpAdm, 0)} V`),
    check('Tensión de paso en el acceso ≤ admisible', Vpacc <= VpaccAdm, `${fmt(Vpacc, 0)} V ≤ ${fmt(VpaccAdm, 0)} V`),
    check('Resistencia de tierra de servicio (neutro BT) ≤ 37 Ω', RtN <= 37, `${fmt(RtN, 1)} Ω`),
  ];
  return { Us, Rt, Id, Vd, Vp, Vpacc, Uc, VpAdm, VpaccAdm, D, RtN, checks };
}

export function earthingTable(e) {
  return {
    title: 'Puesta a tierra (método UNESA · ITC-RAT 13)',
    columns: ['Magnitud', 'Valor'],
    rows: [
      ['Tensión más elevada de la red Us', `${fmt(e.Us / 1000, 1)} kV`],
      ['Resistencia de puesta a tierra de protección Rt = Kr·ρ', `${fmt(e.Rt, 2)} Ω`],
      ['Intensidad de defecto Id', `${fmt(e.Id, 1)} A`],
      ['Tensión de defecto Vd = Rt·Id', `${fmt(e.Vd, 0)} V`],
      ['Tensión de contacto aplicada admisible Uca(t)', `${fmt(e.Uc, 0)} V`],
      ['Tensión de paso exterior V\'p = Kp·ρ·Id / admisible', `${fmt(e.Vp, 0)} V / ${fmt(e.VpAdm, 0)} V`],
      ['Tensión de paso en acceso V\'p(acc) = Kc·ρ·Id / admisible', `${fmt(e.Vpacc, 0)} V / ${fmt(e.VpaccAdm, 0)} V`],
      ['Distancia mínima tierra protección – servicio D = ρ·Id/(2000π)', `${fmt(e.D, 2)} m`],
      ['Resistencia tierra de servicio Rtn = Kr·ρ', `${fmt(e.RtN, 2)} Ω`],
    ],
  };
}

export const EARTHING_FIELDS = [
  { key: 'rho', label: 'Resistividad del terreno ρ', type: 'number', unit: 'Ω·m' },
  { key: 'Rn', label: 'Resistencia de puesta a tierra del neutro de la red Rn', type: 'number', unit: 'Ω', help: 'Dato facilitado por la compañía distribuidora.' },
  { key: 'Xn', label: 'Reactancia de puesta a tierra del neutro Xn', type: 'number', unit: 'Ω' },
  { key: 'Ia', label: 'Intensidad de arranque de la protección homopolar', type: 'number', unit: 'A' },
  { key: 't', label: 'Tiempo de eliminación del defecto', type: 'number', unit: 's', step: 0.05 },
  { key: 'Vbt', label: 'Nivel de aislamiento de las instalaciones BT del CT', type: 'number', unit: 'V' },
  { key: 'conf', label: 'Configuración del electrodo (UNESA)', type: 'text', help: 'Código de la configuración del Método UNESA, p. ej. 40-30/5/42.' },
  { key: 'Kr', label: 'Coeficiente Kr', type: 'number', unit: 'Ω/Ω·m', step: 0.0001 },
  { key: 'Kp', label: 'Coeficiente Kp', type: 'number', unit: 'V/(Ω·m·A)', step: 0.0001 },
  { key: 'Kc', label: 'Coeficiente Kc = Kp(acc)', type: 'number', unit: 'V/(Ω·m·A)', step: 0.0001 },
  { key: 'KrN', label: 'Kr de la tierra de servicio', type: 'number', unit: 'Ω/Ω·m', step: 0.0001 },
];

export const EARTHING_DEFAULTS = {
  rho: 150, Rn: 0, Xn: 25, Ia: 50, t: 0.7, Vbt: 10000, conf: '40-30/5/42', Kr: 0.0897, Kp: 0.0201, Kc: 0.0441, KrN: 0.135,
};
