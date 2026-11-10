// Registro de módulos de cálculo disponibles.
import bt from './bt.js';
import alumbrado from './alumbrado.js';
import ve from './ve.js';
import fotovoltaica from './fotovoltaica.js';
import ct from './ct.js';
import cs from './cs.js';
import redbt from './redbt.js';
import redmt from './redmt.js';
import clima from './clima.js';
import teleco from './teleco.js';

export const MODULES = [bt, alumbrado, ve, fotovoltaica, ct, cs, redbt, redmt, clima, teleco];
export const MODULE_MAP = Object.fromEntries(MODULES.map((m) => [m.id, m]));
