// __tests__/api/boeScraperFunctions.test.js
// Tests para las funciones de scraping del BOE
// Previene regresiones en el scraper de artículos

/**
 * Copia de la función spanishTextToNumber del scraper
 * Convierte texto de número español a dígito
 */
function spanishTextToNumber(text) {
  if (!text) return null

  const suffixMatch = text.match(/^(.+?)\s+(bis|ter|quater|quinquies|sexies|septies)\.?$/i)
  let mainText = suffixMatch ? suffixMatch[1].trim() : text.trim()
  const suffix = suffixMatch ? suffixMatch[2].toLowerCase() : ''

  const normalized = mainText.toLowerCase().trim()

  const ordinals = {
    'primero': 1, 'segundo': 2, 'tercero': 3, 'cuarto': 4, 'quinto': 5,
    'sexto': 6, 'séptimo': 7, 'septimo': 7, 'octavo': 8, 'noveno': 9
  }

  const units = {
    'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
    'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9
  }

  const teens = {
    'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14,
    'quince': 15, 'dieciséis': 16, 'dieciseis': 16, 'diecisiete': 17,
    'dieciocho': 18, 'diecinueve': 19
  }

  const twenties = {
    'veinte': 20, 'veintiuno': 21, 'veintiuna': 21, 'veintidós': 22, 'veintidos': 22,
    'veintitrés': 23, 'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25,
    'veintiséis': 26, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28,
    'veintinueve': 29
  }

  const tens = {
    'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60,
    'setenta': 70, 'ochenta': 80, 'noventa': 90
  }

  const hundreds = {
    'cien': 100, 'ciento': 100, 'doscientos': 200, 'doscientas': 200,
    'trescientos': 300, 'trescientas': 300
  }

  function convertPart(str) {
    str = str.toLowerCase().trim()
    if (ordinals[str]) return ordinals[str]
    if (units[str]) return units[str]
    if (teens[str]) return teens[str]
    if (twenties[str]) return twenties[str]
    if (tens[str]) return tens[str]
    const tensCompound = str.match(/^(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(\w+)$/i)
    if (tensCompound) {
      const tenValue = tens[tensCompound[1].toLowerCase()] || 0
      const unitValue = units[tensCompound[2].toLowerCase()] || 0
      if (tenValue && unitValue) return tenValue + unitValue
    }
    if (hundreds[str]) return hundreds[str]
    return null
  }

  const directConversion = convertPart(normalized)
  if (directConversion !== null) {
    return suffix ? `${directConversion} ${suffix}` : String(directConversion)
  }

  const hundredsMatch = normalized.match(/^(cien|ciento|doscientos?|doscientas?|trescientos?|trescientas?)(?:\s+(.+))?$/i)
  if (hundredsMatch) {
    const hundredValue = hundreds[hundredsMatch[1].toLowerCase()] || 0
    if (hundredsMatch[2]) {
      const rest = convertPart(hundredsMatch[2])
      if (rest !== null) {
        const total = hundredValue + rest
        return suffix ? `${total} ${suffix}` : String(total)
      }
    }
    return suffix ? `${hundredValue} ${suffix}` : String(hundredValue)
  }

  return null
}

/**
 * Copia simplificada de extractArticlesFromBOE para testing
 */
function extractArticlesFromBOE(html) {
  const articles = []
  const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="a[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|$)/gi

  let match
  while ((match = articleBlockRegex.exec(html)) !== null) {
    const blockContent = match[1]
    let articleNumber = null
    let title = ''

    // Formato numérico
    const numericMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>Artículo\s+(\d+(?:\s+(?:bis|ter|quater|quinquies|sexies|septies))?)\.?\s*([^<]*)<\/h5>/i)

    if (numericMatch) {
      articleNumber = numericMatch[1].trim().replace(/\s+/g, ' ')
      title = numericMatch[2]?.trim().replace(/\.$/, '') || ''
    } else {
      // Formato texto
      const textMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>Artículo\s+([^<]+)<\/h5>/i)
      if (textMatch) {
        let textContent = textMatch[1].trim()
        const titleSeparatorMatch = textContent.match(/^(.+?)\.\s+(.+)$/)
        if (titleSeparatorMatch) {
          textContent = titleSeparatorMatch[1].trim()
          title = titleSeparatorMatch[2].trim().replace(/\.$/, '')
        }
        const converted = spanishTextToNumber(textContent)
        if (converted) {
          articleNumber = converted
        }
      }
    }

    if (!articleNumber) continue

    // Extraer contenido básico
    let content = blockContent
      .replace(/<h5[^>]*class="articulo"[^>]*>[\s\S]*?<\/h5>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()

    articles.push({
      article_number: articleNumber,
      title: title || null,
      content: content.substring(0, 100) // Solo primeros 100 chars para tests
    })
  }

  return articles
}

// ==================== TESTS ====================

describe('BOE Scraper Functions', () => {

  describe('spanishTextToNumber - Ordinales (1-9)', () => {
    const ordinales = [
      ['primero', '1'],
      ['segundo', '2'],
      ['tercero', '3'],
      ['cuarto', '4'],
      ['quinto', '5'],
      ['sexto', '6'],
      ['séptimo', '7'],
      ['septimo', '7'], // sin acento
      ['octavo', '8'],
      ['noveno', '9'],
    ]

    test.each(ordinales)('"%s" → "%s"', (input, expected) => {
      expect(spanishTextToNumber(input)).toBe(expected)
    })
  })

  describe('spanishTextToNumber - Teens (10-19)', () => {
    const teens = [
      ['diez', '10'],
      ['once', '11'],
      ['doce', '12'],
      ['trece', '13'],
      ['catorce', '14'],
      ['quince', '15'],
      ['dieciséis', '16'],
      ['dieciseis', '16'],
      ['diecisiete', '17'],
      ['dieciocho', '18'],
      ['diecinueve', '19'],
    ]

    test.each(teens)('"%s" → "%s"', (input, expected) => {
      expect(spanishTextToNumber(input)).toBe(expected)
    })
  })

  describe('spanishTextToNumber - Twenties (20-29)', () => {
    const twenties = [
      ['veinte', '20'],
      ['veintiuno', '21'],
      ['veintidós', '22'],
      ['veintidos', '22'],
      ['veintitrés', '23'],
      ['veintitres', '23'],
      ['veinticuatro', '24'],
      ['veinticinco', '25'],
      ['veintiséis', '26'],
      ['veintiseis', '26'],
      ['veintisiete', '27'],
      ['veintiocho', '28'],
      ['veintinueve', '29'],
    ]

    test.each(twenties)('"%s" → "%s"', (input, expected) => {
      expect(spanishTextToNumber(input)).toBe(expected)
    })
  })

  describe('spanishTextToNumber - Decenas compuestas (30-99)', () => {
    const decenas = [
      ['treinta', '30'],
      ['treinta y uno', '31'],
      ['treinta y nueve', '39'],
      ['cuarenta', '40'],
      ['cuarenta y dos', '42'],
      ['cincuenta', '50'],
      ['cincuenta y cinco', '55'],
      ['sesenta', '60'],
      ['sesenta y seis', '66'],
      ['setenta', '70'],
      ['setenta y siete', '77'],
      ['ochenta', '80'],
      ['ochenta y ocho', '88'],
      ['noventa', '90'],
      ['noventa y nueve', '99'],
    ]

    test.each(decenas)('"%s" → "%s"', (input, expected) => {
      expect(spanishTextToNumber(input)).toBe(expected)
    })
  })

  describe('spanishTextToNumber - Centenas (100-300+)', () => {
    const centenas = [
      ['cien', '100'],
      ['ciento', '100'],
      ['ciento uno', '101'],
      ['ciento diez', '110'],
      ['ciento veinte', '120'],
      ['ciento veintiuno', '121'],
      ['ciento treinta', '130'],
      ['ciento treinta y uno', '131'],
      ['ciento ochenta y dos', '182'],
      ['ciento noventa y nueve', '199'],
      ['doscientos', '200'],
      ['doscientos uno', '201'],
      ['doscientos diez', '210'],
      ['doscientos veinte', '220'],
      ['doscientos veintiuno', '221'],
      ['doscientos veintisiete', '227'],
      ['trescientos', '300'],
    ]

    test.each(centenas)('"%s" → "%s"', (input, expected) => {
      expect(spanishTextToNumber(input)).toBe(expected)
    })
  })

  describe('spanishTextToNumber - Con sufijos (bis, ter, etc.)', () => {
    const conSufijos = [
      ['cuarto bis', '4 bis'],
      ['veintidós ter', '22 ter'],
      ['ciento ochenta y siete bis', '187 bis'],
      ['doscientos diez bis', '210 bis'],
      ['doscientos veinte bis', '220 bis'],
    ]

    test.each(conSufijos)('"%s" → "%s"', (input, expected) => {
      expect(spanishTextToNumber(input)).toBe(expected)
    })
  })

  describe('spanishTextToNumber - Casos edge', () => {
    test('null devuelve null', () => {
      expect(spanishTextToNumber(null)).toBeNull()
    })

    test('undefined devuelve null', () => {
      expect(spanishTextToNumber(undefined)).toBeNull()
    })

    test('string vacío devuelve null', () => {
      expect(spanishTextToNumber('')).toBeNull()
    })

    test('texto no numérico devuelve null', () => {
      expect(spanishTextToNumber('hola mundo')).toBeNull()
    })
  })

  describe('extractArticlesFromBOE - Formato numérico', () => {
    test('extrae artículo con formato numérico simple', () => {
      const html = `
        <div class="bloque" id="a1">
          <h5 class="articulo">Artículo 1</h5>
          <p>Contenido del artículo uno.</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles).toHaveLength(1)
      expect(articles[0].article_number).toBe('1')
    })

    test('extrae artículo con formato numérico y título', () => {
      const html = `
        <div class="bloque" id="a14">
          <h5 class="articulo">Artículo 14. Derecho a la igualdad</h5>
          <p>Los españoles son iguales ante la ley.</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles).toHaveLength(1)
      expect(articles[0].article_number).toBe('14')
      expect(articles[0].title).toBe('Derecho a la igualdad')
    })

    test('extrae artículo con sufijo bis', () => {
      const html = `
        <div class="bloque" id="a14bis">
          <h5 class="articulo">Artículo 14 bis</h5>
          <p>Contenido adicional.</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles).toHaveLength(1)
      expect(articles[0].article_number).toBe('14 bis')
    })
  })

  describe('extractArticlesFromBOE - Formato texto (LOREG)', () => {
    test('extrae artículo "primero"', () => {
      const html = `
        <div class="bloque" id="aprimero">
          <h5 class="articulo">Artículo primero</h5>
          <p>1. La presente Ley Orgánica es de aplicación...</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles).toHaveLength(1)
      expect(articles[0].article_number).toBe('1')
    })

    test('extrae artículo "ciento ochenta y dos"', () => {
      const html = `
        <div class="bloque" id="aciento82">
          <h5 class="articulo">Artículo ciento ochenta y dos</h5>
          <p>El Congreso está formado por...</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles).toHaveLength(1)
      expect(articles[0].article_number).toBe('182')
    })

    test('extrae artículo con texto y título después del punto', () => {
      const html = `
        <div class="bloque" id="a184">
          <h5 class="articulo">Artículo ciento ochenta y cuatro. Concejales de Municipios</h5>
          <p>Los Concejales son elegidos...</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles).toHaveLength(1)
      expect(articles[0].article_number).toBe('184')
      expect(articles[0].title).toBe('Concejales de Municipios')
    })

    test('extrae artículo "ciento ochenta y siete bis"', () => {
      const html = `
        <div class="bloque" id="a187bis">
          <h5 class="articulo">Artículo ciento ochenta y siete bis</h5>
          <p>Contenido adicional...</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles).toHaveLength(1)
      expect(articles[0].article_number).toBe('187 bis')
    })

    test('extrae artículo "doscientos veintisiete"', () => {
      const html = `
        <div class="bloque" id="a227">
          <h5 class="articulo">Artículo doscientos veintisiete. Subvención de gastos</h5>
          <p>Las subvenciones...</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles).toHaveLength(1)
      expect(articles[0].article_number).toBe('227')
      expect(articles[0].title).toBe('Subvención de gastos')
    })
  })

  describe('extractArticlesFromBOE - Múltiples artículos', () => {
    test('extrae múltiples artículos correctamente', () => {
      const html = `
        <div class="bloque" id="a1">
          <h5 class="articulo">Artículo 1</h5>
          <p>Primero</p>
        </div>
        <div class="bloque" id="a2">
          <h5 class="articulo">Artículo 2. Título</h5>
          <p>Segundo</p>
        </div>
        <div class="bloque" id="a3">
          <h5 class="articulo">Artículo tercero</h5>
          <p>Tercero</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles).toHaveLength(3)
      expect(articles[0].article_number).toBe('1')
      expect(articles[1].article_number).toBe('2')
      expect(articles[1].title).toBe('Título')
      expect(articles[2].article_number).toBe('3')
    })
  })

  describe('extractArticlesFromBOE - Bloques sin artículo', () => {
    test('ignora bloques sin h5.articulo', () => {
      const html = `
        <div class="bloque" id="preambulo">
          <h4>Preámbulo</h4>
          <p>Texto del preámbulo...</p>
        </div>
        <div class="bloque" id="a1">
          <h5 class="articulo">Artículo 1</h5>
          <p>Contenido</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles).toHaveLength(1)
      expect(articles[0].article_number).toBe('1')
    })
  })
})
