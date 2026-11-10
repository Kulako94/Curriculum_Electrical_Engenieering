// Aplicación principal: enrutado por hash, vistas y persistencia.
import { MODULES, MODULE_MAP } from './modules/index.js';
import * as store from './store.js';
import { renderForm } from './ui/form.js';
import { renderResults, safeCalc } from './ui/results.js';
import { buildDocument, budgetTotals, generateBudgetItems } from './report.js';
import { esc, fmt, sizeCircuit, shortCircuitEnd, METHOD_OPTIONS, num } from './calc/common.js';
import { trafoCurrents, TRAFO_SIZES } from './calc/mt.js';
import { MATERIAL_OPTIONS, INSULATION_OPTIONS } from './modules/shared.js';

const $ = (s, el = document) => el.querySelector(s);
const main = $('#main');
const sidebar = $('#sidebar');

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), 1800);
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

const slug = (s) => String(s || 'proyecto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').slice(0, 60);

function debounce(fn, ms) {
  let h;
  return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}

// ---------------------------------------------------------------- Sidebar
function renderSidebar(p, active) {
  if (!p) {
    const list = store.listProjects();
    sidebar.innerHTML = `
      <nav class="nav">
        <a href="#/" class="${active === 'home' ? 'active' : ''}"><span class="ico">🏠</span>Inicio</a>
        <a href="#/tools" class="${active === 'tools' ? 'active' : ''}"><span class="ico">🧮</span>Calculadoras rápidas</a>
      </nav>
      <h3>Proyectos</h3>
      <nav class="nav">${list.map((x) => `<a href="#/p/${x.id}"><span class="ico">📁</span>${esc(x.name)}</a>`).join('') || '<div class="help" style="padding:0 10px">Aún no hay proyectos.</div>'}</nav>`;
    return;
  }
  sidebar.innerHTML = `
    <nav class="nav"><a href="#/"><span class="ico">←</span>Todos los proyectos</a></nav>
    <h3>${esc(p.name)}</h3>
    <nav class="nav">
      <a href="#/p/${p.id}" class="${active === 'general' ? 'active' : ''}"><span class="ico">📝</span>Datos generales</a>
    </nav>
    <h3>Instalaciones</h3>
    <nav class="nav">
      ${p.installs.map((i) => `<a href="#/p/${p.id}/i/${i.id}" class="${active === i.id ? 'active' : ''}"><span class="ico">${MODULE_MAP[i.module].icon}</span>${esc(i.title)}</a>`).join('')}
      <a href="#/p/${p.id}/add" class="${active === 'add' ? 'active' : ''}"><span class="ico">＋</span>Añadir instalación</a>
    </nav>
    <h3>Documentos</h3>
    <nav class="nav">
      <a href="#/p/${p.id}/budget" class="${active === 'budget' ? 'active' : ''}"><span class="ico">💶</span>Presupuesto</a>
      <a href="#/p/${p.id}/doc" class="${active === 'doc' ? 'active' : ''}"><span class="ico">📄</span>Documento del proyecto</a>
    </nav>`;
}

// ---------------------------------------------------------------- Vistas
function viewHome() {
  renderSidebar(null, 'home');
  const list = store.listProjects();
  main.innerHTML = `
    <h1>Proyectos eléctricos</h1>
    <p class="sub">Cálculo, justificación reglamentaria, presupuesto y generación de la memoria técnica de instalaciones eléctricas.</p>
    <div class="card">
      <div class="row" style="justify-content:space-between;margin-bottom:8px">
        <h2 style="margin:0">Mis proyectos</h2>
        <div class="row">
          <button class="btn primary" id="new">＋ Nuevo proyecto</button>
          <label class="btn">⬆ Importar<input type="file" id="imp" accept=".json,application/json" hidden></label>
        </div>
      </div>
      <div class="project-list">${list.map((p) => `
        <div class="item">
          <div><a href="#/p/${p.id}"><b>${esc(p.name)}</b></a>
            <div class="meta">${esc(p.titular || 'Sin titular')} · ${p.installs.map((i) => MODULE_MAP[i.module]?.icon).join(' ')} · modificado ${new Date(p.updated).toLocaleString('es-ES')}</div></div>
          <div class="row">
            <button class="btn sm" data-dup="${p.id}">Duplicar</button>
            <button class="btn sm danger" data-del="${p.id}">Eliminar</button>
          </div>
        </div>`).join('') || '<div class="empty">Cree su primer proyecto o comience desde una plantilla de instalación.</div>'}</div>
    </div>
    <h2>Comenzar un proyecto por tipo de instalación</h2>
    <div class="grid cards">${MODULES.map((m) => `
      <div class="card module-card" data-mod="${m.id}" tabindex="0" role="button">
        <div class="ico">${m.icon}</div><div class="t">${esc(m.name)}</div><div class="d">${esc(m.description)}</div>
      </div>`).join('')}</div>`;

  $('#new').onclick = () => { const p = store.saveProject(store.newProject()); location.hash = `#/p/${p.id}`; };
  $('#imp').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { const p = store.importProject(await f.text()); toast('Proyecto importado'); location.hash = `#/p/${p.id}`; } catch (err) { alert(`No se pudo importar: ${err.message}`); }
  };
  main.querySelectorAll('[data-dup]').forEach((b) => { b.onclick = () => { store.duplicateProject(b.dataset.dup); route(); toast('Proyecto duplicado'); }; });
  main.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => { if (confirm('¿Eliminar definitivamente el proyecto?')) { store.deleteProject(b.dataset.del); route(); } };
  });
  main.querySelectorAll('[data-mod]').forEach((c) => {
    const go = () => {
      const m = MODULE_MAP[c.dataset.mod];
      const p = store.newProject({ name: `Proyecto de ${m.name.toLowerCase()}` });
      const inst = store.addInstall(p, m.id);
      store.saveProject(p);
      location.hash = `#/p/${p.id}/i/${inst.id}`;
    };
    c.onclick = go;
    c.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  });
}

const GENERAL_SECTIONS = [
  { title: 'Proyecto', fields: [
    { key: 'name', label: 'Título del proyecto', type: 'text', wide: true },
    { key: 'tipo_doc', label: 'Tipo de documento', type: 'select', options: ['Proyecto técnico', 'Memoria técnica de diseño', 'Anteproyecto', 'Proyecto de ejecución', 'Separata'].map((v) => ({ value: v, label: v })) },
    { key: 'fecha', label: 'Fecha', type: 'date' },
    { key: 'objeto', label: 'Objeto del proyecto (opcional; si se deja vacío se genera automáticamente)', type: 'textarea' },
  ] },
  { title: 'Titular', fields: [
    { key: 'titular', label: 'Nombre o razón social', type: 'text' },
    { key: 'nif', label: 'NIF / CIF', type: 'text' },
    { key: 'domicilio_titular', label: 'Domicilio', type: 'text', wide: true },
  ] },
  { title: 'Emplazamiento', fields: [
    { key: 'emplazamiento', label: 'Dirección', type: 'text', wide: true },
    { key: 'municipio', label: 'Municipio', type: 'text' },
    { key: 'provincia', label: 'Provincia', type: 'text' },
    { key: 'refcat', label: 'Referencia catastral', type: 'text' },
    { key: 'coordenadas', label: 'Coordenadas UTM / geográficas', type: 'text' },
  ] },
  { title: 'Autor', fields: [
    { key: 'autor', label: 'Nombre del técnico', type: 'text' },
    { key: 'titulacion', label: 'Titulación', type: 'text' },
    { key: 'colegiado', label: 'Nº de colegiado', type: 'text' },
    { key: 'colegio', label: 'Colegio profesional', type: 'text' },
  ] },
  { title: 'Planos', fields: [
    { key: 'planos', label: 'Relación de planos (uno por línea)', type: 'textarea', rows: 6 },
  ] },
];

function viewGeneral(p) {
  renderSidebar(p, 'general');
  main.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div><h1>Datos generales</h1><p class="sub" style="margin:0">Información común a todo el documento del proyecto.</p></div>
      <div class="row">
        <button class="btn" id="exp">⬇ Exportar proyecto</button>
        <button class="btn danger" id="del">Eliminar</button>
      </div>
    </div>
    <div class="card"><div id="form"></div></div>
    <div class="card">
      <h2>Instalaciones del proyecto</h2>
      <div class="grid cards">${p.installs.map((i) => {
        const r = safeCalc(MODULE_MAP[i.module], i.data);
        const ok = r.checks.filter((c) => c.ok).length;
        return `<a class="card module-card" href="#/p/${p.id}/i/${i.id}" style="text-decoration:none;color:inherit">
          <div class="ico">${MODULE_MAP[i.module].icon}</div><div class="t">${esc(i.title)}</div>
          <div class="d">${ok}/${r.checks.length} comprobaciones correctas</div></a>`;
      }).join('')}
        <a class="card module-card" href="#/p/${p.id}/add" style="text-decoration:none;color:inherit"><div class="ico">＋</div><div class="t">Añadir instalación</div><div class="d">BT, alumbrado, VE, FV, CT, MT, clima, ICT…</div></a>
      </div>
    </div>`;
  const save = debounce(() => { store.saveProject(p); renderSidebar(p, 'general'); }, 400);
  renderForm($('#form'), GENERAL_SECTIONS, p, save);
  $('#exp').onclick = () => download(store.exportProject(p), `${slug(p.name)}.json`);
  $('#del').onclick = () => { if (confirm('¿Eliminar definitivamente el proyecto?')) { store.deleteProject(p.id); location.hash = '#/'; } };
}

function viewAdd(p) {
  renderSidebar(p, 'add');
  main.innerHTML = `<h1>Añadir instalación</h1><p class="sub">Seleccione el tipo de instalación que forma parte del proyecto. Puede añadir varias del mismo tipo.</p>
    <div class="grid cards">${MODULES.map((m) => `<div class="card module-card" data-mod="${m.id}" tabindex="0" role="button"><div class="ico">${m.icon}</div><div class="t">${esc(m.name)}</div><div class="d">${esc(m.description)}</div></div>`).join('')}</div>`;
  main.querySelectorAll('[data-mod]').forEach((c) => {
    const go = () => { const inst = store.addInstall(p, c.dataset.mod); store.saveProject(p); location.hash = `#/p/${p.id}/i/${inst.id}`; };
    c.onclick = go;
    c.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  });
}

function viewInstall(p, iid) {
  const inst = p.installs.find((i) => i.id === iid);
  if (!inst) { location.hash = `#/p/${p.id}`; return; }
  const mod = MODULE_MAP[inst.module];
  renderSidebar(p, iid);
  main.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:12px;align-items:flex-start">
      <div style="flex:1;min-width:240px">
        <div class="help">${mod.icon} ${esc(mod.name)}</div>
        <input class="inp" id="title" value="${esc(inst.title)}" style="font-size:20px;font-weight:650;border-color:transparent;padding-left:0;background:transparent" aria-label="Nombre de la instalación">
      </div>
      <div class="row">
        <button class="btn" id="norm">📚 Normativa</button>
        <button class="btn" id="reset">↺ Valores por defecto</button>
        <button class="btn danger" id="remove">Eliminar</button>
      </div>
    </div>
    <div class="two-col">
      <div class="card"><div id="form"></div></div>
      <div class="card sticky"><h2>Resultados</h2><div id="results"></div></div>
    </div>
    <dialog id="dlg"><h2>Normativa de aplicación</h2><ul>${mod.normativa.map((n) => `<li>${esc(n)}</li>`).join('')}</ul><div class="row" style="justify-content:flex-end"><button class="btn" onclick="this.closest('dialog').close()">Cerrar</button></div></dialog>`;
  const results = $('#results');
  const recalc = () => { results.innerHTML = renderResults(safeCalc(mod, inst.data)); };
  const save = debounce(() => store.saveProject(p), 300);
  const recalcSoon = debounce(recalc, 120);
  renderForm($('#form'), mod.sections, inst.data, () => { recalcSoon(); save(); });
  recalc();
  $('#title').oninput = (e) => { inst.title = e.target.value; save(); renderSidebarSoon(); };
  const renderSidebarSoon = debounce(() => renderSidebar(p, iid), 400);
  $('#norm').onclick = () => $('#dlg').showModal();
  $('#reset').onclick = () => { if (confirm('¿Restablecer todos los datos de esta instalación?')) { inst.data = mod.defaults(); store.saveProject(p); viewInstall(p, iid); } };
  $('#remove').onclick = () => {
    if (!confirm('¿Eliminar esta instalación del proyecto?')) return;
    p.installs = p.installs.filter((i) => i.id !== iid);
    p.budget.items = (p.budget.items || []).filter((it) => it.auto !== iid);
    store.saveProject(p);
    location.hash = `#/p/${p.id}`;
  };
}

const BUDGET_SECTIONS = [
  { title: 'Partidas', fields: [{
    key: 'items', type: 'table', label: 'Partidas',
    columns: [
      { key: 'chapter', label: 'Capítulo', type: 'text', width: 120 },
      { key: 'code', label: 'Código', type: 'text', width: 70 },
      { key: 'desc', label: 'Descripción', type: 'text', width: 380 },
      { key: 'unit', label: 'Ud', type: 'text', width: 45 },
      { key: 'qty', label: 'Medición', type: 'number' },
      { key: 'price', label: 'Precio (€)', type: 'number' },
    ],
    newRow: (rows) => ({ chapter: rows.at(-1)?.chapter || 'Varios', code: '', desc: '', unit: 'ud', qty: 1, price: 0 }),
  }] },
  { title: 'Porcentajes', fields: [
    { key: 'gg', label: 'Gastos generales', type: 'number', unit: '%' },
    { key: 'bi', label: 'Beneficio industrial', type: 'number', unit: '%' },
    { key: 'iva', label: 'IVA', type: 'number', unit: '%' },
  ] },
];

function viewBudget(p) {
  renderSidebar(p, 'budget');
  main.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div><h1>Presupuesto</h1><p class="sub" style="margin:0">Mediciones generadas a partir de los cálculos. Los precios son orientativos: ajústelos a su base de precios.</p></div>
      <div class="row"><button class="btn primary" id="gen">⟳ Generar mediciones desde cálculos</button><button class="btn" id="csv">⬇ CSV</button></div>
    </div>
    <div class="card"><div id="form"></div></div>
    <div class="card"><h2>Resumen</h2><div id="totals"></div></div>`;
  const showTotals = () => {
    const T = budgetTotals(p.budget);
    $('#totals').innerHTML = `<div class="table-wrap"><table class="res"><tbody>
      <tr><td>Presupuesto de ejecución material (PEM)</td><td class="num"><b>${fmt(T.pem)} €</b></td></tr>
      <tr><td>Gastos generales</td><td class="num">${fmt(T.gg)} €</td></tr>
      <tr><td>Beneficio industrial</td><td class="num">${fmt(T.bi)} €</td></tr>
      <tr><td>Presupuesto de ejecución por contrata</td><td class="num"><b>${fmt(T.pec)} €</b></td></tr>
      <tr><td>IVA</td><td class="num">${fmt(T.iva)} €</td></tr>
      <tr class="totals"><td>TOTAL</td><td class="num">${fmt(T.total)} €</td></tr></tbody></table></div>`;
  };
  const draw = () => renderForm($('#form'), BUDGET_SECTIONS, p.budget, () => { showTotals(); save(); });
  const save = debounce(() => store.saveProject(p), 300);
  draw();
  showTotals();
  $('#gen').onclick = () => {
    const manual = (p.budget.items || []).filter((it) => !it.auto);
    if ((p.budget.items || []).some((it) => it.auto) && !confirm('Se sustituirán las partidas generadas automáticamente (las añadidas a mano se conservan). ¿Continuar?')) return;
    p.budget.items = [...generateBudgetItems(p), ...manual];
    store.saveProject(p);
    draw();
    showTotals();
    toast('Mediciones generadas');
  };
  $('#csv').onclick = () => {
    const rows = [['Capítulo', 'Código', 'Descripción', 'Ud', 'Medición', 'Precio', 'Importe'], ...(p.budget.items || []).map((it) => [it.chapter, it.code, it.desc, it.unit, num(it.qty), num(it.price), num(it.qty) * num(it.price)])];
    const csv = rows.map((r) => r.map((c) => typeof c === 'number' ? String(c).replace('.', ',') : `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `${slug(p.name)}_presupuesto.csv`);
  };
}

function viewDoc(p) {
  renderSidebar(p, 'doc');
  if (!(p.budget.items || []).length && p.installs.length) {
    p.budget.items = generateBudgetItems(p);
    store.saveProject(p);
  }
  const html = buildDocument(p);
  main.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div><h1>Documento del proyecto</h1><p class="sub" style="margin:0">Memoria, cálculos, pliego, seguridad y salud, presupuesto y planos.</p></div>
      <div class="row">
        <button class="btn primary" id="print">🖨 Imprimir / PDF</button>
        <button class="btn" id="word">⬇ Word (.doc)</button>
        <button class="btn" id="html">⬇ HTML</button>
      </div>
    </div>
    <iframe class="doc-frame" id="frame" title="Vista previa del documento"></iframe>`;
  $('#frame').srcdoc = html;
  $('#print').onclick = () => $('#frame').contentWindow.print();
  $('#word').onclick = () => {
    const doc = html.replace('<html lang="es">', '<html lang="es" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">');
    download(new Blob(['﻿' + doc], { type: 'application/msword' }), `${slug(p.name)}.doc`);
  };
  $('#html').onclick = () => download(new Blob([html], { type: 'text/html' }), `${slug(p.name)}.html`);
}

// ---------------------------------------------------------------- Calculadoras rápidas
const TOOL_LINE = [{ title: 'Línea de baja tensión', fields: [
  { key: 'P', label: 'Potencia', type: 'number', unit: 'W' },
  { key: 'phases', label: 'Sistema', type: 'select', options: [{ value: 1, label: 'Monofásico 230 V' }, { value: 3, label: 'Trifásico 400 V' }] },
  { key: 'cosphi', label: 'cos φ', type: 'number', step: 0.01 },
  { key: 'L', label: 'Longitud', type: 'number', unit: 'm' },
  { key: 'material', label: 'Material', type: 'select', options: MATERIAL_OPTIONS },
  { key: 'insulation', label: 'Aislamiento', type: 'select', options: INSULATION_OPTIONS },
  { key: 'method', label: 'Método de instalación', type: 'select', options: METHOD_OPTIONS },
  { key: 'ambient', label: 'Temperatura ambiente', type: 'number', unit: '°C' },
  { key: 'grouping', label: 'Factor de agrupamiento', type: 'number', step: 0.01 },
  { key: 'maxDrop', label: 'Caída de tensión máxima', type: 'number', unit: '%' },
  { key: 'icc', label: 'Icc en origen', type: 'number', unit: 'kA' },
] }];
const TOOL_TRAFO = [{ title: 'Cortocircuito en bornes de transformador', fields: [
  { key: 'S', label: 'Potencia', type: 'select', unit: 'kVA', options: TRAFO_SIZES.map((v) => ({ value: v, label: String(v) })) },
  { key: 'U1', label: 'Tensión primaria', type: 'number', unit: 'kV' },
  { key: 'U2', label: 'Tensión secundaria', type: 'number', unit: 'V' },
  { key: 'ucc', label: 'ucc', type: 'number', unit: '%', step: 0.5 },
  { key: 'Scc', label: 'Scc de la red', type: 'number', unit: 'MVA' },
] }];

function viewTools() {
  renderSidebar(null, 'tools');
  main.innerHTML = `<h1>Calculadoras rápidas</h1><p class="sub">Cálculos puntuales sin necesidad de crear un proyecto.</p>
    <div class="two-col"><div class="card"><div id="f1"></div></div><div class="card sticky"><h2>Resultado</h2><div id="r1"></div></div></div>
    <div class="two-col"><div class="card"><div id="f2"></div></div><div class="card"><h2>Resultado</h2><div id="r2"></div></div></div>`;
  const d1 = { P: 10000, phases: 3, cosphi: 0.9, L: 50, material: 'Cu', insulation: 'XLPE', method: 'B1', ambient: 40, grouping: 1, maxDrop: 5, icc: 6 };
  const calc1 = () => {
    const U = num(d1.phases) === 3 ? 400 : 230;
    const r = sizeCircuit({ P: num(d1.P), U, phases: num(d1.phases), cosphi: num(d1.cosphi, 1), L: num(d1.L), material: d1.material, insulation: d1.insulation, method: d1.method, ambient: num(d1.ambient, 40), grouping: num(d1.grouping, 1), maxDropPct: num(d1.maxDrop, 5) });
    const icc = r.S ? shortCircuitEnd({ IccOrigin: num(d1.icc) * 1000, L: num(d1.L), S: r.S, material: d1.material }) : 0;
    $('#r1').innerHTML = renderResults({
      summary: [
        { label: 'Intensidad Ib', value: fmt(r.Ib, 2), unit: 'A' },
        { label: 'Sección', value: String(r.S ?? '—'), unit: 'mm²', status: r.ok ? 'ok' : 'bad' },
        { label: 'Iz corregida', value: fmt(r.Iz, 1), unit: 'A' },
        { label: 'Protección', value: String(r.In ?? '—'), unit: 'A' },
        { label: 'Caída de tensión', value: fmt(r.dropPct), unit: '%' },
        { label: 'Temp. conductor', value: fmt(r.theta, 1), unit: '°C' },
        { label: 'Icc mín. final', value: fmt(icc / 1000), unit: 'kA' },
      ],
      checks: [{ label: `Sección determinada por: ${r.governing}`, ok: r.ok }], tables: [], notes: [],
    });
  };
  renderForm($('#f1'), TOOL_LINE, d1, calc1);
  calc1();
  const d2 = { S: 630, U1: 20, U2: 420, ucc: 4, Scc: 500 };
  const calc2 = () => {
    const t = trafoCurrents(num(d2.S), num(d2.U1), num(d2.U2), num(d2.ucc), num(d2.Scc));
    $('#r2').innerHTML = renderResults({
      summary: [
        { label: 'I primaria', value: fmt(t.I1, 2), unit: 'A' },
        { label: 'I secundaria', value: fmt(t.I2, 1), unit: 'A' },
        { label: 'Icc BT (red ∞)', value: fmt(t.Icc2inf / 1000, 2), unit: 'kA' },
        { label: 'Icc BT (con red)', value: fmt(t.Icc2 / 1000, 2), unit: 'kA' },
      ], checks: [], tables: [], notes: [],
    });
  };
  renderForm($('#f2'), TOOL_TRAFO, d2, calc2);
  calc2();
}

// ---------------------------------------------------------------- Router
function route() {
  sidebar.classList.remove('open');
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  window.scrollTo(0, 0);
  if (parts[0] === 'tools') return viewTools();
  if (parts[0] === 'p') {
    const p = store.getProject(parts[1]);
    if (!p) { location.hash = '#/'; return; }
    if (parts[2] === 'i') return viewInstall(p, parts[3]);
    if (parts[2] === 'add') return viewAdd(p);
    if (parts[2] === 'budget') return viewBudget(p);
    if (parts[2] === 'doc') return viewDoc(p);
    return viewGeneral(p);
  }
  return viewHome();
}

// Tema claro/oscuro
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}
let theme = null;
try { theme = localStorage.getItem('pe-theme'); } catch { /* ignore */ }
applyTheme(theme);
$('#theme').onclick = () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  theme = dark ? 'light' : 'dark';
  applyTheme(theme);
  try { localStorage.setItem('pe-theme', theme); } catch { /* ignore */ }
};
$('#menu').onclick = () => sidebar.classList.toggle('open');

window.addEventListener('hashchange', route);
route();
