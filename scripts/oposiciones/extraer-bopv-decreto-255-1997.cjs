// Extrae el articulado del Decreto 255/1997 del HTML oficial de euskadi.eus,
// reconstruyendo la numeración que el BOPV deja IMPLÍCITA en <ol>/<li>:
//   ol.x42tNumberBullets → apartados "N.– "   (formato ya usado en nuestra BD)
//   ol.x42tLetterBullets → letras   "a) "
const fs = require('fs')
const { JSDOM } = require(process.env.PWD + '/node_modules/jsdom')

const html = fs.readFileSync('/tmp/bopv_utf8.html', 'utf8')
const doc = new JSDOM(html).window.document

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim()

// Renderiza un <ol> con su marcador correcto, recursivo.
function renderList(ol, depth = 0) {
  const isLetter = ol.className.includes('LetterBullets')
  const items = [...ol.children].filter(c => c.tagName === 'LI')
  return items.map((li, i) => {
    const marker = isLetter ? `${LETTERS[i]}) ` : `${i + 1}.– `
    const parts = []
    for (const child of li.children) {
      if (child.tagName === 'P') { const t = txt(child); if (t) parts.push(t) }
      else if (child.tagName === 'OL') parts.push(renderList(child, depth + 1))
    }
    if (!parts.length) { const t = txt(li); if (t) parts.push(t) }
    return marker + parts.join('\n\n')
  }).join('\n\n')
}

// Cada artículo: el <div class=x42tBOPVSectionBody> que sigue al enlace del título.
const out = {}
for (const a of doc.querySelectorAll('a')) {
  const m = txt(a).match(/^Art[íi]culo\s+(\d+)\b/)
  if (!m) continue
  let node = a.closest('div')
  let body = null
  while (node && !body) { node = node.nextElementSibling; if (node && node.className.includes('SectionBody')) body = node }
  if (!body) continue
  const blocks = []
  for (const child of body.children) {
    if (child.tagName === 'OL') blocks.push(renderList(child))
    else if (child.tagName === 'P') { const t = txt(child); if (t) blocks.push(t) }
  }
  const content = blocks.join('\n\n').trim()
  // nos quedamos con la versión más larga (el articulado real, no el índice)
  if (content && (!out[m[1]] || content.length > out[m[1]].content.length)) {
    out[m[1]] = { titulo: txt(a).replace(/^Art[íi]culo\s+\d+\s*/, '').replace(/\.$/, ''), content }
  }
}
fs.writeFileSync('/tmp/bopv_clean.json', JSON.stringify(out, null, 1))
console.log('artículos extraídos:', Object.keys(out).length)
for (const n of ['5', '13', '14', '15', '17', '20']) {
  const a = out[n]
  console.log(`\n=== art ${n} — ${a ? a.titulo : 'NO'} (${a ? a.content.length : 0} chars) ===`)
  if (a) console.log(a.content.slice(0, 260))
}
