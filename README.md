# Proyectos Eléctricos

Aplicación web para facilitar la elaboración de proyectos eléctricos: cálculo, comprobación
reglamentaria, presupuesto y generación del documento del proyecto (memoria, cálculos, pliego,
estudio básico de seguridad y salud, presupuesto y relación de planos).

Funciona íntegramente en el navegador, sin dependencias ni servidor de datos: los proyectos se
guardan en el almacenamiento local del navegador y pueden exportarse/importarse en JSON.

## Tipos de instalación

| Módulo | Contenido | Normativa principal |
|---|---|---|
| 🔌 Baja tensión | Previsión de cargas de edificios, derivación individual, circuitos interiores (sección, PIA, ΔU, Icc mínima) | REBT, ITC-BT-10, 15, 19, 25, UNE-HD 60364-5-52 |
| 💡 Alumbrado exterior | Método del flujo, eficiencia energética y calificación A–G, red de alimentación (ΔU con cargas repartidas), tierras | RD 1890/2008 (ITC-EA), ITC-BT-09 |
| 🚗 Recarga VE | Esquemas, previsión de cargas, dotación mínima CTE HE-6, circuitos de recarga | ITC-BT-52, CTE DB HE-6 |
| ☀️ Fotovoltaica | Compatibilidad módulo-inversor por temperatura, strings/MPPT, producción, pérdidas de orientación, cableado DC/AC, estudio económico | RD 244/2019, ITC-BT-40, PCT IDAE |
| ⚡ Centro de transformación | Potencia, intensidades, cortocircuitos MT/BT, fusibles, ventilación, foso, puesta a tierra UNESA (tensiones de paso y contacto) | RD 337/2014 (ITC-RAT), UE 548/2014 |
| 🎛️ Centro de seccionamiento | Celdas, cortocircuito, ajustes orientativos 50/51, puesta a tierra | ITC-RAT |
| 🔀 Red de distribución BT | Línea radial por tramos con simultaneidad, selección de sección, ΔU acumulada, fusible de cabecera | ITC-BT-06, 07, 10 |
| 🗼 Línea de MT | Subterránea/aérea: intensidad admisible corregida, ΔU, pérdidas, cortocircuito | RD 223/2008 (ITC-LAT 06/07) |
| ❄️ Climatización | Cargas térmicas por ratios, ventilación RITE (IDA), recuperación de calor, alimentación eléctrica | RITE, CTE |
| 📡 Telecomunicaciones (ICT) | Canalizaciones, recintos, red de cables, tomas, balance de niveles RTV | RD 346/2011, Orden ITC/1644/2011 |

Un mismo proyecto puede incluir varias instalaciones (p. ej. edificio con BT + VE + FV + ICT).

## Uso

```bash
npm start          # servidor local en http://localhost:8080 (sin dependencias)
npm test           # pruebas de los motores de cálculo
```

También puede publicarse tal cual en cualquier hosting estático (p. ej. GitHub Pages).
Al usar módulos ES, no funciona abriendo `index.html` con doble clic (`file://`): use `npm start`
o cualquier servidor estático (`python3 -m http.server`).

Flujo de trabajo:

1. **Nuevo proyecto** (o elegir directamente un tipo de instalación en la portada).
2. **Datos generales**: titular, emplazamiento, autor, relación de planos.
3. **Instalaciones**: introducir datos; los resultados y comprobaciones se recalculan al instante.
4. **Presupuesto**: generar mediciones desde los cálculos, ajustar precios, GG/BI/IVA, exportar CSV.
5. **Documento**: vista previa, imprimir a PDF o descargar en Word (.doc) / HTML.

## Estructura

```
index.html, css/styles.css
js/app.js            vistas y enrutado
js/store.js          persistencia local, importación/exportación
js/report.js         documento del proyecto y presupuesto
js/ui/               motor de formularios y presentación de resultados
js/calc/common.js    intensidades admisibles, caída de tensión, cortocircuito, protecciones
js/calc/mt.js        transformadores, cortocircuito MT, ventilación, puesta a tierra UNESA
js/modules/*.js      un módulo por tipo de instalación (datos, cálculo, memoria, presupuesto)
tests/               pruebas (node --test)
```

Para añadir un nuevo tipo de instalación basta con crear un módulo en `js/modules/` con
`defaults()`, `sections`, `calculate()`, `memoria()` y `budget()`, y registrarlo en `js/modules/index.js`.

## Aviso

Las tablas y métodos implementados son de referencia para predimensionado y redacción.
El técnico proyectista es responsable de verificar los resultados con la normativa vigente,
las normas particulares de la empresa distribuidora y los datos de los fabricantes
(en particular coeficientes UNESA, curvas de luminarias y catálogos de cables). Los precios del
presupuesto son orientativos.
