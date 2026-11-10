// Persistencia local de proyectos (localStorage) e importación/exportación JSON.
import { MODULE_MAP } from './modules/index.js';

const KEY = 'proyectos-electricos-v1';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

let memory = null; // respaldo si localStorage no está disponible

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return memory || [];
  }
}

function writeAll(list) {
  memory = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* sin almacenamiento persistente */ }
}

export function listProjects() {
  return readAll().sort((a, b) => (b.updated || 0) - (a.updated || 0));
}

export function getProject(id) {
  return readAll().find((p) => p.id === id) || null;
}

export function saveProject(p) {
  p.updated = Date.now();
  const all = readAll();
  const i = all.findIndex((x) => x.id === p.id);
  if (i >= 0) all[i] = p; else all.push(p);
  writeAll(all);
  return p;
}

export function deleteProject(id) {
  writeAll(readAll().filter((p) => p.id !== id));
}

export function newProject(over = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: uid(),
    name: 'Nuevo proyecto',
    tipo_doc: 'Proyecto técnico',
    titular: '', nif: '', domicilio_titular: '',
    emplazamiento: '', municipio: '', provincia: '', refcat: '', coordenadas: '',
    autor: '', titulacion: 'Ingeniero/a Técnico/a Industrial', colegiado: '', colegio: '',
    fecha: today,
    objeto: '',
    planos: 'Situación y emplazamiento\nPlanta general de la instalación\nEsquema unifilar\nDetalles constructivos',
    installs: [],
    budget: { items: [], gg: 13, bi: 6, iva: 21 },
    created: Date.now(),
    updated: Date.now(),
    ...over,
  };
}

export function addInstall(p, moduleId) {
  const m = MODULE_MAP[moduleId];
  const inst = { id: uid(), module: moduleId, title: m.name, data: m.defaults() };
  p.installs.push(inst);
  return inst;
}

export function duplicateProject(id) {
  const p = getProject(id);
  if (!p) return null;
  const copy = JSON.parse(JSON.stringify(p));
  copy.id = uid();
  copy.name = `${p.name} (copia)`;
  copy.created = Date.now();
  return saveProject(copy);
}

export function exportProject(p) {
  return new Blob([JSON.stringify({ format: 'proyectos-electricos', version: 1, project: p }, null, 2)], { type: 'application/json' });
}

export function importProject(text) {
  const obj = JSON.parse(text);
  const p = obj.project || obj;
  if (!p || !Array.isArray(p.installs)) throw new Error('El archivo no contiene un proyecto válido.');
  p.installs = p.installs.filter((i) => MODULE_MAP[i.module]);
  // completar campos que falten con valores por defecto
  for (const i of p.installs) i.data = { ...MODULE_MAP[i.module].defaults(), ...i.data };
  const base = newProject();
  const merged = { ...base, ...p, budget: { ...base.budget, ...(p.budget || {}) } };
  if (getProject(merged.id)) merged.id = uid();
  return saveProject(merged);
}
