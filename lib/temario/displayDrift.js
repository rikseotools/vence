'use strict'
/**
 * displayDrift.js — NÚCLEO PURO de la coherencia entre el título de un tema y sus
 * campos de display (`descripcion_corta`, `epigrafe`, `description`).
 *
 * Nace del fallo real del 08/07/2026 (Cantabria): al reescribir la parte específica
 * a Windows 11 / Microsoft 365 se actualizaron title/epigrafe/description pero se
 * olvidó `descripcion_corta`, que además quedó DESPLAZADA (un tema de Excel mostraba
 * "Word 2016…" en el listado). En BD parecía correcto; solo se veía en la página LIVE.
 *
 * ## Por qué vive aquí y no dentro del script
 *
 * Hasta el 27/07/2026 esta lógica vivía DENTRO de `scripts/audit-temario-display-drift.cjs`,
 * o sea: solo la conocía el DETECTOR, y no el ESCRITOR que puede introducir el drift.
 * Un detector nocturno que caza lo que un escritor acaba de romper llega tarde por
 * definición. Al extraerla, la MISMA definición de "drift de versión/app" la usan:
 *   · `scripts/audit-temario-display-drift.cjs` — barrido + gate de CI (a posteriori)
 *   · `lib/temario/epigrafeApply.js` — guarda del escritor `verify:epigrafe apply` (a priori)
 * Dos definiciones del mismo concepto es como se cuela una regresión por la puerta
 * que no vigila nadie. Ver `lib/admin/toolWriters.ts` (mismo criterio para escritores).
 */

const APPS = [
  { key: 'windows', re: /\bwindows\b/i },
  { key: 'word', re: /\bword\b/i },
  { key: 'excel', re: /\bexcel\b/i },
  { key: 'outlook', re: /\boutlook\b/i },
  { key: 'teams', re: /\bteams\b/i },
  { key: 'access', re: /\baccess\b/i },
  { key: 'powerpoint', re: /\bpower\s?point\b/i },
  { key: 'internet', re: /\b(?:red\s+)?internet\b/i },
]

/** Primera app mencionada en el texto (la que "encabeza"), o null. */
function firstApp(text) {
  if (!text) return null
  let best = null
  let pos = Infinity
  for (const a of APPS) {
    const m = a.re.exec(text)
    if (m && m.index < pos) { pos = m.index; best = a.key }
  }
  return best
}

/** Versiones de Windows citadas en el texto ('10' | '11'). */
function winVers(text) {
  const s = new Set()
  const re = /windows\s*(10|11)/gi
  let m
  while ((m = re.exec(text || '')) !== null) s.add(m[1])
  return s
}

/** Versiones de Office citadas en el texto ('2016' | '2019' | '2021' | '365'). */
function officeVers(text) {
  const s = new Set()
  const re = /\b(2016|2019|2021|365)\b/g
  let m
  while ((m = re.exec(text || '')) !== null) s.add(m[1])
  return s
}

/**
 * Hallazgos de drift de un tema. PURA.
 * @returns {Array<{type:'APP_DRIFT'|'WIN_VER_DRIFT'|'OFFICE_VER_DRIFT', detail:string}>}
 */
function detectDrift({ title, descripcion_corta, epigrafe, description }) {
  const out = []
  const tApp = firstApp(title)
  if (!tApp) return out // no es tema de informática por título → no aplica

  // 1) APP_DRIFT: la descripcion_corta encabeza con otra app distinta a la del título.
  const dcApp = firstApp(descripcion_corta)
  if (dcApp && dcApp !== tApp) {
    out.push({ type: 'APP_DRIFT', detail: `título es '${tApp}' pero descripcion_corta encabeza con '${dcApp}'` })
  }

  const fields = [
    ['descripcion_corta', descripcion_corta],
    ['epigrafe', epigrafe],
    ['description', description],
  ]

  // 2) WIN_VER_DRIFT: alguna versión de Windows del campo que NO esté entre las del título.
  //    (un título "Windows 10/11" cubre ambas → no es drift que un campo diga una de ellas.)
  const tWin = winVers(title)
  if (tWin.size) {
    for (const [f, txt] of fields) {
      for (const v of winVers(txt)) {
        if (!tWin.has(v)) { out.push({ type: 'WIN_VER_DRIFT', detail: `título Windows [${[...tWin]}] pero ${f} dice Windows ${v}` }); break }
      }
    }
  }

  // 3) OFFICE_VER_DRIFT: alguna versión Office del campo que NO esté entre las del título.
  const tOff = officeVers(title)
  if (tOff.size && ['word', 'excel', 'outlook', 'access', 'powerpoint'].includes(tApp)) {
    for (const [f, txt] of fields) {
      for (const v of officeVers(txt)) {
        if (!tOff.has(v)) { out.push({ type: 'OFFICE_VER_DRIFT', detail: `título ${tApp} [${[...tOff]}] pero ${f} dice ${v}` }); break }
      }
    }
  }
  return out
}

module.exports = { APPS, firstApp, winVers, officeVers, detectDrift }
