function spanishTextToNumber(text) {
  if (!text) return null;
  const suffixMatch = text.match(/^(.+?)\s+(bis|ter|quater|quinquies|sexies|septies)\.?$/i);
  let mainText = suffixMatch ? suffixMatch[1].trim() : text.trim();
  const suffix = suffixMatch ? suffixMatch[2].toLowerCase() : '';
  const normalized = mainText.toLowerCase().trim();

  const ordinals = { 'primero': 1, 'segundo': 2, 'tercero': 3, 'cuarto': 4, 'quinto': 5, 'sexto': 6, 'séptimo': 7, 'septimo': 7, 'octavo': 8, 'noveno': 9 };
  const units = { 'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9 };
  const teens = { 'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15, 'dieciséis': 16, 'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19 };
  const twenties = { 'veinte': 20, 'veintiuno': 21, 'veintiuna': 21, 'veintidós': 22, 'veintidos': 22, 'veintitrés': 23, 'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25, 'veintiséis': 26, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28, 'veintinueve': 29 };
  const tens = { 'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90 };
  const hundreds = { 'cien': 100, 'ciento': 100, 'doscientos': 200, 'doscientas': 200, 'trescientos': 300, 'trescientas': 300 };

  function convertPart(str) {
    str = str.toLowerCase().trim();
    if (ordinals[str]) return ordinals[str];
    if (units[str]) return units[str];
    if (teens[str]) return teens[str];
    if (twenties[str]) return twenties[str];
    if (tens[str]) return tens[str];
    const tensCompound = str.match(/^(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(\w+)$/i);
    if (tensCompound) {
      const tenValue = tens[tensCompound[1].toLowerCase()] || 0;
      const unitValue = units[tensCompound[2].toLowerCase()] || 0;
      if (tenValue && unitValue) return tenValue + unitValue;
    }
    if (hundreds[str]) return hundreds[str];
    return null;
  }

  const directConversion = convertPart(normalized);
  if (directConversion !== null) {
    return suffix ? `${directConversion} ${suffix}` : String(directConversion);
  }

  const hundredsMatch = normalized.match(/^(cien|ciento|doscientos?|doscientas?|trescientos?|trescientas?)(?:\s+(.+))?$/i);
  if (hundredsMatch) {
    const hundredValue = hundreds[hundredsMatch[1].toLowerCase()] || 0;
    if (hundredsMatch[2]) {
      const rest = convertPart(hundredsMatch[2]);
      if (rest !== null) {
        const total = hundredValue + rest;
        return suffix ? `${total} ${suffix}` : String(total);
      }
    }
    return suffix ? `${hundredValue} ${suffix}` : String(hundredValue);
  }
  return null;
}

function extractArticlesFromBOE(html) {
  const articles = [];
  const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="a[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|$)/gi;

  let match;
  while ((match = articleBlockRegex.exec(html)) !== null) {
    const blockContent = match[1];
    let articleNumber = null;
    let title = '';

    const numericMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>Artículo\s+(\d+(?:\s+(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?(?:\s+\d+)?)\.?\s*([^<]*)<\/h5>/i);

    if (numericMatch) {
      articleNumber = numericMatch[1].trim().replace(/\s+/g, ' ');
      title = numericMatch[2]?.trim().replace(/\.$/, '') || '';
    } else {
      const textMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>Artículo\s+([^<]+)<\/h5>/i);
      if (textMatch) {
        let textContent = textMatch[1].trim();
        const titleSeparatorMatch = textContent.match(/^(.+?)\.\s+(.+)$/);
        if (titleSeparatorMatch) {
          textContent = titleSeparatorMatch[1].trim();
          title = titleSeparatorMatch[2].trim().replace(/\.$/, '');
        }
        const converted = spanishTextToNumber(textContent);
        if (converted) {
          articleNumber = converted;
        }
      }
    }

    if (articleNumber) {
      articles.push({ article_number: articleNumber, title });
    }
  }
  return articles;
}

(async () => {
  const url = 'https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672';
  console.log('Descargando BOE...');
  const response = await fetch(url);
  const html = await response.text();

  const articles = extractArticlesFromBOE(html);
  console.log('Artículos extraídos:', articles.length);
  console.log('Primeros 5:', articles.slice(0, 5));
  console.log('Art 200-210:', articles.filter(a => parseInt(a.article_number) >= 200 && parseInt(a.article_number) <= 210));
  console.log('¿Tiene 204?', articles.some(a => a.article_number === '204'));
})();
