// Representación HTML de los resultados de cálculo de un módulo.
import { esc, fmt } from '../calc/common.js';

export function cell(c) {
  if (c == null) return '';
  if (typeof c === 'object') {
    if ('ok' in c) return `<span class="badge ${c.ok ? 'ok' : 'bad'}">${esc(c.t ?? (c.ok ? 'Cumple' : 'No cumple'))}</span>`;
    if ('b' in c) return `<b>${c.b}</b>`;
  }
  return String(c);
}

export function tableHtml(t, cls = 'res') {
  return `<table class="${cls}"><thead><tr>${t.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function chartHtml(data) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return `<div class="chart-wrap"><div class="chart">${data.map((d) =>
    `<div class="bar" style="height:${(d.value / max) * 100}%" title="${esc(d.label)}: ${fmt(d.value, 0)}"><span>${esc(d.label)}</span></div>`).join('')}</div></div>`;
}

export function renderResults(r) {
  if (r.error) return `<div class="card"><b>Error de cálculo:</b> ${esc(r.error)}</div>`;
  const ok = r.checks.filter((c) => c.ok).length;
  return `
    <div class="summary">${r.summary.map((s) => `<div class="kpi ${s.status || ''}"><div class="l">${esc(s.label)}</div>
      <div class="v">${esc(s.value)}<span class="u">${esc(s.unit || '')}</span></div></div>`).join('')}</div>
    <div class="res-block"><h4>Comprobaciones reglamentarias (${ok}/${r.checks.length})</h4>
      <ul class="checks">${r.checks.map((c) => `<li class="${c.ok ? 'ok' : 'bad'}"><span class="mk">${c.ok ? '✔' : '✖'}</span>
        <div>${esc(c.label)}${c.detail ? `<div class="det">${esc(c.detail)}</div>` : ''}</div></li>`).join('')}</ul></div>
    ${r.tables.map((t) => `<div class="res-block"><h4>${esc(t.title)}</h4>${t.chart ? chartHtml(t.chart) : ''}<div class="table-wrap">${tableHtml(t)}</div></div>`).join('')}
    ${r.notes?.length ? `<div class="res-block"><h4>Observaciones</h4><ul class="notes">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}`;
}

export function safeCalc(mod, data) {
  try {
    return mod.calculate(data);
  } catch (e) {
    console.error(e);
    return { error: e.message, summary: [], tables: [], checks: [], notes: [] };
  }
}
