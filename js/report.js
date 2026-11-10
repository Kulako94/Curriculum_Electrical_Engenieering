// Generación del documento de proyecto: memoria, cálculos, pliego, seguridad y salud,
// presupuesto y planos. Se produce un HTML autónomo imprimible (PDF) o exportable a Word.
import { MODULE_MAP } from './modules/index.js';
import { esc, fmt, num } from './calc/common.js';
import { tableHtml } from './ui/results.js';
import { safeCalc } from './ui/results.js';

export function budgetTotals(b) {
  const items = b?.items || [];
  const pem = items.reduce((s, it) => s + num(it.qty) * num(it.price), 0);
  const gg = pem * num(b?.gg) / 100;
  const bi = pem * num(b?.bi) / 100;
  const pec = pem + gg + bi;
  const iva = pec * num(b?.iva) / 100;
  return { pem, gg, bi, pec, iva, total: pec + iva };
}

export function generateBudgetItems(project) {
  const items = [];
  project.installs.forEach((inst, k) => {
    const mod = MODULE_MAP[inst.module];
    const r = safeCalc(mod, inst.data);
    if (r.error || !mod.budget) return;
    const chapter = String(k + 1).padStart(2, '0');
    for (const it of mod.budget(inst.data, r)) {
      items.push({ ...it, chapter: `${chapter} ${inst.title}`, code: `${chapter}.${it.code}`, qty: Math.round(num(it.qty) * 100) / 100, price: Math.round(num(it.price) * 100) / 100, auto: inst.id });
    }
  });
  return items;
}

const PLIEGO = `
<h3>Condiciones generales</h3>
<p>El presente pliego tiene por objeto fijar las condiciones técnicas mínimas que deben cumplir los materiales, su ejecución, pruebas y
recepción. Las obras se ejecutarán conforme al presente proyecto, a la reglamentación vigente y a las instrucciones de la Dirección Facultativa.</p>
<h3>Calidad de los materiales</h3>
<p>Todos los materiales serán de primera calidad, dispondrán de marcado CE y cumplirán las normas UNE/UNE-EN que les sean de aplicación.
Los conductores serán de las secciones, aislamientos y tipos indicados en los cálculos; los tubos protectores cumplirán la UNE-EN 61386 y
la aparamenta de protección las UNE-EN 60898, 61008, 61009 y 60947.</p>
<h3>Ejecución de las obras</h3>
<p>La instalación será ejecutada por empresa instaladora habilitada en la categoría correspondiente. Se respetarán los trazados, distancias
y cruzamientos reglamentarios, y se señalizarán todas las canalizaciones subterráneas. Los circuitos quedarán identificados en origen y destino.</p>
<h3>Pruebas reglamentarias</h3>
<p>Antes de la puesta en servicio se realizarán, como mínimo: medida de la resistencia de aislamiento, medida de la resistencia de puesta a tierra,
comprobación de la continuidad de los conductores de protección, comprobación del funcionamiento de los dispositivos diferenciales y, en su caso,
medida de tensiones de paso y contacto e inspección inicial por Organismo de Control.</p>
<h3>Condiciones de uso, mantenimiento y seguridad</h3>
<p>El titular conservará la instalación en buen estado y realizará las revisiones e inspecciones periódicas establecidas reglamentariamente,
mediante empresa instaladora o mantenedora habilitada.</p>
<h3>Certificados y documentación</h3>
<p>A la finalización de la obra se emitirá el certificado de instalación, el certificado de dirección de obra y, en su caso, el acta de inspección inicial,
y se entregará al titular la documentación técnica y las instrucciones de uso y mantenimiento.</p>`;

const SEGURIDAD = `
<p>En cumplimiento del RD 1627/1997, de 24 de octubre, por el que se establecen las disposiciones mínimas de seguridad y salud en las obras de
construcción, se redacta el presente estudio básico de seguridad y salud.</p>
<h3>Riesgos más frecuentes</h3>
<ul><li>Contactos eléctricos directos e indirectos.</li><li>Caídas de personas a distinto y al mismo nivel.</li><li>Cortes y golpes con herramientas.</li>
<li>Atrapamientos y sobreesfuerzos en manipulación de cargas.</li><li>Proyección de partículas.</li><li>Arco eléctrico y quemaduras.</li></ul>
<h3>Medidas preventivas</h3>
<ul><li>Aplicación de las cinco reglas de oro para trabajos sin tensión (RD 614/2001): corte efectivo, bloqueo y señalización, comprobación de ausencia de tensión, puesta a tierra y en cortocircuito, y delimitación de la zona de trabajo.</li>
<li>Uso de equipos de protección individual: casco, guantes aislantes, calzado de seguridad, gafas y pantalla facial, ropa ignífuga.</li>
<li>Señalización y protección de zanjas y huecos; uso de escaleras y medios auxiliares homologados.</li>
<li>Formación e información a los trabajadores y coordinación de actividades empresariales.</li></ul>`;

const STYLE = `
  body{font-family:"Segoe UI",Arial,sans-serif;color:#111;font-size:11pt;line-height:1.45;margin:0;background:#fff}
  .doc{max-width:800px;margin:0 auto;padding:30px 40px}
  h1{font-size:20pt;margin:0 0 8px} h2{font-size:15pt;border-bottom:2px solid #1f4e9b;padding-bottom:4px;margin:28px 0 12px;color:#1f4e9b;page-break-after:avoid}
  h3{font-size:12pt;margin:18px 0 6px;page-break-after:avoid} h4{font-size:11pt;margin:14px 0 6px}
  table{border-collapse:collapse;width:100%;margin:6px 0 12px;font-size:9.5pt;page-break-inside:auto}
  th,td{border:1px solid #bbb;padding:4px 6px;text-align:left} th{background:#e9eef7}
  tr{page-break-inside:avoid}
  .cover{height:900px;display:flex;flex-direction:column;justify-content:center;text-align:center;page-break-after:always}
  .cover .t{font-size:12pt;text-transform:uppercase;letter-spacing:.1em;color:#1f4e9b}
  .cover h1{font-size:24pt;margin:12px 0 24px}
  .cover table{width:auto;margin:30px auto;font-size:11pt} .cover td{border:none;padding:4px 10px;text-align:left}
  .badge{font-weight:bold} .badge.ok{color:#1a7f37} .badge.bad{color:#c62828}
  .chk{list-style:none;padding:0} .chk li{padding:2px 0}
  .pb{page-break-before:always}
  .firma{margin-top:60px;text-align:right}
  .toc li{margin:3px 0}
  .right{text-align:right}
  @page{size:A4;margin:20mm 18mm}
  @media print{.doc{padding:0;max-width:none}}`;

export function buildDocument(p) {
  const calcs = p.installs.map((inst) => {
    const mod = MODULE_MAP[inst.module];
    return { inst, mod, r: safeCalc(mod, inst.data) };
  });
  const normativa = [...new Set([
    'Ley 21/1992, de 16 de julio, de Industria.',
    ...calcs.flatMap((c) => c.mod.normativa),
    'RD 1627/1997, disposiciones mínimas de seguridad y salud en las obras de construcción.',
    'RD 614/2001, protección de la salud y seguridad de los trabajadores frente al riesgo eléctrico.',
    'Ordenanzas municipales y normativa autonómica de aplicación.',
  ])];
  const T = budgetTotals(p.budget);
  const fecha = p.fecha ? new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const instNames = calcs.map((c) => c.inst.title).join(', ');

  const descr = calcs.map(({ inst, mod, r }, i) => `<h3>1.6.${i + 1} ${esc(inst.title)}</h3>${r.error ? '' : mod.memoria(inst.data, r, p)}`).join('');
  const calcHtml = calcs.map(({ inst, r }, i) => r.error ? `<h3>2.${i + 1} ${esc(inst.title)}</h3><p>Error en el cálculo: ${esc(r.error)}</p>` : `
    <h3>2.${i + 1} ${esc(inst.title)}</h3>
    <h4>Resumen de resultados</h4>
    ${tableHtml({ columns: ['Magnitud', 'Valor'], rows: r.summary.map((s) => [esc(s.label), `${esc(s.value)} ${esc(s.unit || '')}`]) })}
    ${r.tables.map((t) => `<h4>${esc(t.title)}</h4>${tableHtml(t)}`).join('')}
    <h4>Comprobaciones reglamentarias</h4>
    <ul class="chk">${r.checks.map((c) => `<li><span class="badge ${c.ok ? 'ok' : 'bad'}">${c.ok ? '✔ CUMPLE' : '✖ NO CUMPLE'}</span> — ${esc(c.label)}${c.detail ? ` (${esc(c.detail)})` : ''}</li>`).join('')}</ul>
    ${r.notes?.length ? `<h4>Observaciones</h4><ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}`).join('');

  // Presupuesto por capítulos
  const chapters = {};
  for (const it of p.budget?.items || []) (chapters[it.chapter || 'Varios'] ||= []).push(it);
  const budgetHtml = Object.entries(chapters).map(([ch, items]) => {
    const sub = items.reduce((s, it) => s + num(it.qty) * num(it.price), 0);
    return `<h4>${esc(ch)}</h4>${tableHtml({
      columns: ['Código', 'Descripción', 'Ud', 'Medición', 'Precio (€)', 'Importe (€)'],
      rows: [...items.map((it) => [esc(it.code), esc(it.desc), esc(it.unit), fmt(num(it.qty)), fmt(num(it.price)), fmt(num(it.qty) * num(it.price))]),
        ['', { b: 'Total capítulo' }, '', '', '', { b: fmt(sub) }]],
    })}`;
  }).join('');
  const resumen = tableHtml({
    columns: ['Concepto', 'Importe (€)'],
    rows: [
      ...Object.entries(chapters).map(([ch, items]) => [esc(ch), fmt(items.reduce((s, it) => s + num(it.qty) * num(it.price), 0))]),
      [{ b: 'PRESUPUESTO DE EJECUCIÓN MATERIAL (PEM)' }, { b: fmt(T.pem) }],
      [`Gastos generales (${fmt(num(p.budget?.gg), 0)} %)`, fmt(T.gg)],
      [`Beneficio industrial (${fmt(num(p.budget?.bi), 0)} %)`, fmt(T.bi)],
      [{ b: 'PRESUPUESTO DE EJECUCIÓN POR CONTRATA' }, { b: fmt(T.pec) }],
      [`IVA (${fmt(num(p.budget?.iva), 0)} %)`, fmt(T.iva)],
      [{ b: 'PRESUPUESTO TOTAL' }, { b: fmt(T.total) }],
    ],
  });
  const planos = String(p.planos || '').split('\n').map((s) => s.trim()).filter(Boolean);

  const body = `
  <div class="doc">
    <div class="cover">
      <div class="t">${esc(p.tipo_doc || 'Proyecto técnico')}</div>
      <h1>${esc(p.name)}</h1>
      <div>${esc(instNames)}</div>
      <table>
        <tr><td><b>Titular:</b></td><td>${esc(p.titular)} ${p.nif ? `(${esc(p.nif)})` : ''}</td></tr>
        <tr><td><b>Emplazamiento:</b></td><td>${esc(p.emplazamiento)}${p.municipio ? `, ${esc(p.municipio)}` : ''}${p.provincia ? ` (${esc(p.provincia)})` : ''}</td></tr>
        ${p.refcat ? `<tr><td><b>Ref. catastral:</b></td><td>${esc(p.refcat)}</td></tr>` : ''}
        <tr><td><b>Autor:</b></td><td>${[p.autor, p.titulacion].filter(Boolean).map(esc).join(', ')}</td></tr>
        ${p.colegiado ? `<tr><td><b>Colegiado nº:</b></td><td>${esc(p.colegiado)} ${esc(p.colegio)}</td></tr>` : ''}
        <tr><td><b>Fecha:</b></td><td>${esc(fecha)}</td></tr>
      </table>
    </div>

    <h2>Índice</h2>
    <ol class="toc"><li>Memoria descriptiva</li><li>Cálculos justificativos</li><li>Pliego de condiciones</li>
      <li>Estudio básico de seguridad y salud</li><li>Presupuesto</li><li>Planos</li></ol>

    <h2 class="pb">1. Memoria descriptiva</h2>
    <h3>1.1 Objeto del proyecto</h3>
    <p>${p.objeto ? esc(p.objeto).replace(/\n/g, '<br>') : `El presente documento tiene por objeto definir las características técnicas de las instalaciones de ${esc(instNames.toLowerCase())}, justificar su adecuación a la reglamentación vigente y servir de base para su ejecución y legalización ante el órgano competente.`}</p>
    <h3>1.2 Titular</h3>
    <p>${esc(p.titular) || '—'}${p.nif ? `, con NIF/CIF ${esc(p.nif)}` : ''}${p.domicilio_titular ? `, y domicilio en ${esc(p.domicilio_titular)}` : ''}.</p>
    <h3>1.3 Emplazamiento</h3>
    <p>${esc(p.emplazamiento) || '—'}${p.municipio ? `, término municipal de ${esc(p.municipio)}` : ''}${p.provincia ? ` (${esc(p.provincia)})` : ''}.
      ${p.refcat ? `Referencia catastral ${esc(p.refcat)}.` : ''} ${p.coordenadas ? `Coordenadas: ${esc(p.coordenadas)}.` : ''}</p>
    <h3>1.4 Autor del proyecto</h3>
    <p>${[p.autor, p.titulacion].filter(Boolean).map(esc).join(', ') || '—'}${p.colegiado ? `, colegiado nº ${esc(p.colegiado)} ${esc(p.colegio)}` : ''}.</p>
    <h3>1.5 Normativa de aplicación</h3>
    <ul>${normativa.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    <h3>1.6 Descripción de las instalaciones</h3>
    ${descr || '<p>No se han definido instalaciones.</p>'}

    <h2 class="pb">2. Cálculos justificativos</h2>
    <p>Los cálculos se han realizado conforme a la reglamentación indicada, adoptando los criterios de intensidad máxima admisible,
    caída de tensión y corriente de cortocircuito, así como los específicos de cada instalación.</p>
    ${calcHtml}

    <h2 class="pb">3. Pliego de condiciones</h2>${PLIEGO}
    <h2 class="pb">4. Estudio básico de seguridad y salud</h2>${SEGURIDAD}
    <h2 class="pb">5. Presupuesto</h2>
    <h3>5.1 Mediciones y presupuesto</h3>${budgetHtml || '<p>Sin partidas.</p>'}
    <h3>5.2 Resumen del presupuesto</h3>${resumen}
    <p>Asciende el presupuesto total a la expresada cantidad de <b>${fmt(T.total)} €</b>.</p>
    <h2 class="pb">6. Planos</h2>
    <ol>${planos.map((pl) => `<li>${esc(pl)}</li>`).join('')}</ol>

    <div class="firma"><p>${esc(p.municipio || '')}${p.municipio ? ', ' : ''}${esc(fecha)}</p><p style="margin-top:50px">Fdo.: ${esc(p.autor)}</p><p>${esc(p.titulacion)}</p></div>
  </div>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(p.name)}</title><style>${STYLE}</style></head><body>${body}</body></html>`;
}
