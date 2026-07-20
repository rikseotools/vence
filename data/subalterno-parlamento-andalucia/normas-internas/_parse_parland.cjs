// Parser verbatim de los PDFs oficiales del Parlamento de Andalucía (pdftotext -layout)
const fs = require('fs');
const SP = '/tmp/claude-1000/-home-manuel-Documentos-github-vence/a7c63fbe-2e0f-4671-8436-0532c02684e2/scratchpad';

const NOISE = [
  /^Servicio de Publicaciones/i,
  /^REGLAMENTO DEL PARLAMENTO DE ANDALUC[ÍI]A SOBRE DISTINCIONES/i,
  /^ESTATUTO DE GOBIERNO Y R[ÉE]GIMEN INTERIOR DEL PARLAMENTO DE ANDALUC[ÍI]A$/i,
  /^P[áa]g\.\s*\d+$/i,
];

// Único guion compuesto real del texto (el resto son cortes de línea blandos)
const COMPOUND = [['económico-', 'financiera']];

function isNoise(l) {
  const t = l.trim();
  return t === '' ? false : NOISE.some((r) => r.test(t));
}

function dehyphenate(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let cur = lines[i];
    while (/-$/.test(cur.trimEnd()) && i + 1 < lines.length) {
      const next = lines[i + 1].trimStart();
      const trimmed = cur.trimEnd();
      const keepHyphen = COMPOUND.some(
        ([a, b]) => trimmed.endsWith(a) && next.startsWith(b)
      );
      cur = keepHyphen ? trimmed + next : trimmed.slice(0, -1) + next;
      i++;
    }
    out.push(cur);
  }
  return out;
}

// Reagrupa en párrafos: nueva unidad si la línea empieza por "1." / "a)" / etc.
const NEWPARA = /^\s*(\d+\.\s|[a-zñ]\)\s)/;

function toParagraphs(lines) {
  const paras = [];
  let buf = [];
  const flush = () => {
    if (buf.length) paras.push(buf.join(' ').replace(/\s+/g, ' ').trim());
    buf = [];
  };
  for (const l of lines) {
    if (l.trim() === '') { flush(); continue; }
    if (NEWPARA.test(l) && buf.length) flush();
    buf.push(l.trim());
  }
  flush();
  return paras.filter(Boolean);
}

function parse(file, { startAt, headingCtx }) {
  let lines = fs.readFileSync(`${SP}/${file}`, 'utf8').split('\n');
  const from = lines.findIndex((l) => startAt.test(l));
  if (from < 0) throw new Error('No se encontró el inicio en ' + file);
  lines = lines.slice(from).filter((l) => !isNoise(l));
  lines = dehyphenate(lines);

  const arts = [];
  let cur = null;
  let ctx = '';
  const ART = /^\s*Art[íi]culo\s+(\d+)\.\s*(.*)$/;
  const DISP = /^\s*(Disposici[óo]n\s+[^.]*)\.\s*(.*)$/;

  for (const l of lines) {
    if (headingCtx) {
      const h = l.trim();
      if (/^(T[ÍI]TULO|CAP[ÍI]TULO|SECCI[ÓO]N)\b/.test(h) && h.length < 90) {
        ctx = h.replace(/\.$/, '');
        continue;
      }
    }
    const m = l.match(ART);
    const d = !m && l.match(DISP);
    if (m || d) {
      if (cur) arts.push(cur);
      const num = m ? m[1] : null;
      const heading = (m ? m[2] : d[2]).trim();
      cur = {
        article_number: m ? num : d[1].trim(),
        heading: heading.replace(/\.$/, ''),
        ctx,
        lines: [],
      };
      continue;
    }
    if (cur) cur.lines.push(l);
  }
  if (cur) arts.push(cur);

  return arts.map((a) => ({
    article_number: a.article_number,
    title: a.ctx && headingCtx ? `${a.ctx}. ${a.heading}` : a.heading,
    content: toParagraphs(a.lines).join('\n'),
  }));
}

const luto = parse('luto.txt', {
  startAt: /^\s*Art[íi]culo 1\. Objeto/,
  headingCtx: false,
});
const egripa = parse('egripa.txt', {
  // Saltar índice y exposición de motivos: el articulado real empieza tras "DEL GOBIERNO Y RÉGIMEN INTERIOR"
  startAt: /^\s*DEL GOBIERNO Y R[ÉE]GIMEN INTERIOR\s*$/,
  headingCtx: true,
});

fs.writeFileSync(`${SP}/parsed.json`, JSON.stringify({ luto, egripa }, null, 1));
console.log('LUTO arts:', luto.length, luto.map((a) => a.article_number).join(','));
console.log('EGRIPA arts:', egripa.length, egripa.map((a) => a.article_number).join(','));
console.log('\n--- muestra LUTO art 9 ---\n', JSON.stringify(luto.find((a) => a.article_number === '9'), null, 1).slice(0, 1200));
console.log('\n--- muestra EGRIPA art 11 ---\n', JSON.stringify(egripa.find((a) => a.article_number === '11'), null, 1).slice(0, 1200));
console.log('\n--- chequeo económico-financiera ---');
const a27 = egripa.find((a) => a.article_number === '27');
console.log(/económico-financiera/.test(a27.content) ? 'OK compuesto preservado' : 'FALLO');
console.log('\n--- guiones sobrantes ---');
for (const a of [...luto, ...egripa]) if (/-\s/.test(a.content)) console.log(a.article_number, a.content.match(/\S+-\s\S+/g));
