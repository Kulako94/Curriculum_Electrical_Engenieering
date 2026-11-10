// Definiciones de campos reutilizables entre módulos.
import { METHOD_OPTIONS, SECTIONS } from '../calc/common.js';

export const MATERIAL_OPTIONS = [{ value: 'Cu', label: 'Cobre' }, { value: 'Al', label: 'Aluminio' }];
export const INSULATION_OPTIONS = [{ value: 'PVC', label: 'PVC (70 °C)' }, { value: 'XLPE', label: 'XLPE/EPR (90 °C)' }];
export const SECTION_OPTIONS = SECTIONS.map((s) => ({ value: s, label: `${s} mm²` }));

export function cableFields(prefix = '', { method = true } = {}) {
  const f = [
    { key: `${prefix}material`, label: 'Material conductor', type: 'select', options: MATERIAL_OPTIONS },
    { key: `${prefix}insulation`, label: 'Aislamiento', type: 'select', options: INSULATION_OPTIONS },
  ];
  if (method) f.push({ key: `${prefix}method`, label: 'Método de instalación', type: 'select', options: METHOD_OPTIONS });
  return f;
}

export function circuitColumns() {
  return [
    { key: 'name', label: 'Nombre', type: 'text', width: 180 },
    { key: 'type', label: 'Tipo', type: 'select', options: [
      { value: 'alumbrado', label: 'Alumbrado' }, { value: 'descarga', label: 'Alumbrado descarga (×1,8)' },
      { value: 'fuerza', label: 'Fuerza' }, { value: 'motor', label: 'Motor (×1,25)' }] },
    { key: 'P', label: 'P (W)', type: 'number' },
    { key: 'phases', label: 'Fases', type: 'select', options: [{ value: 1, label: '1F' }, { value: 3, label: '3F' }] },
    { key: 'cosphi', label: 'cos φ', type: 'number', step: 0.01 },
    { key: 'L', label: 'L (m)', type: 'number' },
    { key: 'material', label: 'Mat.', type: 'select', options: MATERIAL_OPTIONS },
    { key: 'insulation', label: 'Aisl.', type: 'select', options: INSULATION_OPTIONS },
    { key: 'method', label: 'Método', type: 'select', options: METHOD_OPTIONS.map((o) => ({ value: o.value, label: o.value })) },
    { key: 'smin', label: 'S mín', type: 'select', options: SECTION_OPTIONS },
    { key: 'curve', label: 'Curva', type: 'select', options: ['B', 'C', 'D'].map((v) => ({ value: v, label: v })) },
  ];
}
