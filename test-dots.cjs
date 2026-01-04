function spanishTextToNumber(text) {
  if (!text) return null;

  console.log('  Input:', JSON.stringify(text));

  const suffixMatch = text.match(/^(.+?)\s+(bis|ter|quater|quinquies|sexies|septies)\.?$/i);
  let mainText = suffixMatch ? suffixMatch[1].trim() : text.trim();
  const suffix = suffixMatch ? suffixMatch[2].toLowerCase() : '';
  const normalized = mainText.toLowerCase().trim();

  console.log('  Normalized:', JSON.stringify(normalized));

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
    if (hundreds[str]) return hundreds[str];
    return null;
  }

  const directConversion = convertPart(normalized);
  if (directConversion !== null) {
    return suffix ? `${directConversion} ${suffix}` : String(directConversion);
  }

  const hundredsMatch = normalized.match(/^(cien|ciento|doscientos?|doscientas?|trescientos?|trescientas?)(?:\s+(.+))?$/i);
  console.log('  hundredsMatch:', hundredsMatch);
  if (hundredsMatch) {
    const hundredValue = hundreds[hundredsMatch[1].toLowerCase()] || 0;
    if (hundredsMatch[2]) {
      const rest = convertPart(hundredsMatch[2]);
      console.log('  rest from convertPart:', rest);
      if (rest !== null) {
        const total = hundredValue + rest;
        return suffix ? `${total} ${suffix}` : String(total);
      }
    }
    return suffix ? `${hundredValue} ${suffix}` : String(hundredValue);
  }
  return null;
}

console.log('=== TEST 1: "doscientos diez" ===');
console.log('Result:', spanishTextToNumber('doscientos diez'));

console.log('\n=== TEST 2: "doscientos diez." (con punto) ===');
console.log('Result:', spanishTextToNumber('doscientos diez.'));

console.log('\n=== TEST 3: "doscientos once" ===');
console.log('Result:', spanishTextToNumber('doscientos once'));
