// Motor de formularios declarativos: renderiza secciones de campos y tablas
// editables a partir de la definición del módulo y mantiene el objeto de datos.
import { esc } from '../calc/common.js';

function coerce(field, raw) {
  if (field.type === 'number') {
    if (raw === '' || raw == null) return '';
    const n = parseFloat(String(raw).replace(',', '.'));
    return Number.isFinite(n) ? n : '';
  }
  if (field.type === 'select' && field.options) {
    const opt = field.options.find((o) => String(o.value) === String(raw));
    return opt ? opt.value : raw;
  }
  return raw;
}

function optionsHtml(field, value) {
  return (field.options || []).map((o) =>
    `<option value="${esc(o.value)}"${String(o.value) === String(value ?? '') ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
}

function controlHtml(field, value, attrs) {
  switch (field.type) {
    case 'select':
      return `<select ${attrs}>${optionsHtml(field, value)}</select>`;
    case 'textarea':
      return `<textarea ${attrs} rows="${field.rows || 4}">${esc(value)}</textarea>`;
    case 'checkbox':
      return `<input type="checkbox" ${attrs}${value ? ' checked' : ''}>`;
    case 'number':
      return `<input type="number" step="${field.step ?? 'any'}" ${attrs} value="${esc(value)}">`;
    case 'date':
      return `<input type="date" class="inp" ${attrs} value="${esc(value)}">`;
    default:
      return `<input type="text" ${attrs} value="${esc(value)}" placeholder="${esc(field.placeholder || '')}">`;
  }
}

function fieldHtml(field, data, uid) {
  const id = `${uid}-${field.key}`;
  const attrs = `id="${id}" data-key="${esc(field.key)}"`;
  const hidden = field.show && !field.show(data) ? ' hidden' : '';
  if (field.type === 'checkbox') {
    return `<div class="field check" data-field="${esc(field.key)}"${hidden}>${controlHtml(field, data[field.key], attrs)}<label for="${id}">${esc(field.label)}</label></div>`;
  }
  if (field.type === 'table') {
    return `<div class="field wide" data-field="${esc(field.key)}"${hidden}>${tableHtml(field, data[field.key] || [])}</div>`;
  }
  const unit = field.unit ? `<span class="unit">${esc(field.unit)}</span>` : '';
  return `<div class="field${field.wide || field.type === 'textarea' ? ' wide' : ''}" data-field="${esc(field.key)}"${hidden}>
    <label for="${id}">${esc(field.label)}</label>
    <div class="ctl${unit ? ' has-unit' : ''}">${controlHtml(field, data[field.key], attrs)}${unit}</div>
    ${field.help ? `<div class="help">${esc(field.help)}</div>` : ''}
  </div>`;
}

function tableHtml(field, rows) {
  const head = field.columns.map((c) => `<th>${esc(c.label)}</th>`).join('') + '<th></th>';
  const body = rows.map((row, r) => `<tr>${field.columns.map((c) => {
    const attrs = `data-table="${esc(field.key)}" data-row="${r}" data-col="${esc(c.key)}"${c.width ? ` style="min-width:${c.width}px"` : ''}`;
    return `<td>${controlHtml(c, row[c.key], attrs)}</td>`;
  }).join('')}<td style="white-space:nowrap">
      <button type="button" class="btn icon sm" title="Duplicar" data-act="dup" data-table="${esc(field.key)}" data-row="${r}">⧉</button>
      <button type="button" class="btn icon sm danger" title="Eliminar" data-act="del" data-table="${esc(field.key)}" data-row="${r}">✕</button>
    </td></tr>`).join('');
  const presets = (field.presets || []).map((p, i) => `<button type="button" class="btn sm" data-act="preset" data-table="${esc(field.key)}" data-preset="${i}">${esc(p.label)}</button>`).join('');
  return `<div class="table-wrap"><table class="edit"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${field.columns.length + 1}" class="empty">Sin elementos</td></tr>`}</tbody></table></div>
    <div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-act="add" data-table="${esc(field.key)}">＋ Añadir fila</button>${presets}</div>`;
}

let counter = 0;

/**
 * Renderiza el formulario y conecta los eventos.
 * @param {HTMLElement} el contenedor
 * @param {Array} sections [{title, fields}]
 * @param {object} data objeto de datos (se modifica in situ)
 * @param {Function} onChange llamado tras cada modificación
 */
export function renderForm(el, sections, data, onChange) {
  const uid = `f${++counter}`;
  const allFields = sections.flatMap((s) => s.fields);
  const byKey = Object.fromEntries(allFields.map((f) => [f.key, f]));
  el.innerHTML = sections.map((s) => `<fieldset class="form-section">${s.title ? `<h3>${esc(s.title)}</h3>` : ''}
    <div class="fields">${s.fields.map((f) => fieldHtml(f, data, uid)).join('')}</div></fieldset>`).join('');

  const refreshVisibility = () => {
    for (const f of allFields) {
      if (!f.show) continue;
      const w = el.querySelector(`[data-field="${CSS.escape(f.key)}"]`);
      if (w) w.hidden = !f.show(data);
    }
  };
  const rerenderTable = (key) => {
    const w = el.querySelector(`[data-field="${CSS.escape(key)}"]`);
    if (w) w.innerHTML = tableHtml(byKey[key], data[key] || []);
  };

  const handle = (e) => {
    const t = e.target;
    if (t.dataset.table && t.dataset.col) {
      const f = byKey[t.dataset.table];
      const col = f.columns.find((c) => c.key === t.dataset.col);
      const row = data[t.dataset.table][Number(t.dataset.row)];
      row[col.key] = col.type === 'checkbox' ? t.checked : coerce(col, t.value);
    } else if (t.dataset.key) {
      const f = byKey[t.dataset.key];
      if (!f) return;
      data[f.key] = f.type === 'checkbox' ? t.checked : coerce(f, t.value);
    } else return;
    refreshVisibility();
    onChange?.(data);
  };
  el.addEventListener('input', handle);
  el.addEventListener('change', handle);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const key = b.dataset.table;
    const f = byKey[key];
    const rows = (data[key] = data[key] || []);
    const r = Number(b.dataset.row);
    if (b.dataset.act === 'add') rows.push(f.newRow ? f.newRow(rows) : {});
    if (b.dataset.act === 'del') rows.splice(r, 1);
    if (b.dataset.act === 'dup') rows.splice(r + 1, 0, JSON.parse(JSON.stringify(rows[r])));
    if (b.dataset.act === 'preset') {
      const p = f.presets[Number(b.dataset.preset)];
      if (rows.length && !confirm('¿Reemplazar las filas actuales?')) return;
      data[key] = p.rows();
    }
    rerenderTable(key);
    onChange?.(data);
  });
}
