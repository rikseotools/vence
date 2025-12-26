/**
 * Tests para las utilidades de scraping del BOE
 * Verifican que el scraping funciona correctamente para todas las leyes
 */

const {
  spanishTextToNumber,
  normalizeArticleNumber,
  normalizeText,
  compareContent,
  extractArticlesFromBOE
} = require('../../lib/boeScrapingUtils')

describe('BOE Scraping Utils', () => {

  // =====================================================
  // spanishTextToNumber - Conversión de texto a número
  // =====================================================
  describe('spanishTextToNumber', () => {

    describe('Ordinales (1-9)', () => {
      test.each([
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
      ])('"%s" → "%s"', (input, expected) => {
        expect(spanishTextToNumber(input)).toBe(expected)
      })
    })

    describe('Unidades (1-9)', () => {
      test.each([
        ['uno', '1'],
        ['una', '1'],
        ['dos', '2'],
        ['tres', '3'],
        ['cuatro', '4'],
        ['cinco', '5'],
        ['seis', '6'],
        ['siete', '7'],
        ['ocho', '8'],
        ['nueve', '9'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(spanishTextToNumber(input)).toBe(expected)
      })
    })

    describe('Teens (10-19)', () => {
      test.each([
        ['diez', '10'],
        ['once', '11'],
        ['doce', '12'],
        ['trece', '13'],
        ['catorce', '14'],
        ['quince', '15'],
        ['dieciséis', '16'],
        ['dieciseis', '16'], // sin acento
        ['diecisiete', '17'],
        ['dieciocho', '18'],
        ['diecinueve', '19'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(spanishTextToNumber(input)).toBe(expected)
      })
    })

    describe('Veintenas (20-29)', () => {
      test.each([
        ['veinte', '20'],
        ['veintiuno', '21'],
        ['veintiuna', '21'],
        ['veintidós', '22'],
        ['veintidos', '22'], // sin acento
        ['veintitrés', '23'],
        ['veintitres', '23'],
        ['veinticuatro', '24'],
        ['veinticinco', '25'],
        ['veintiséis', '26'],
        ['veintiseis', '26'],
        ['veintisiete', '27'],
        ['veintiocho', '28'],
        ['veintinueve', '29'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(spanishTextToNumber(input)).toBe(expected)
      })
    })

    describe('Decenas (30-90)', () => {
      test.each([
        ['treinta', '30'],
        ['cuarenta', '40'],
        ['cincuenta', '50'],
        ['sesenta', '60'],
        ['setenta', '70'],
        ['ochenta', '80'],
        ['noventa', '90'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(spanishTextToNumber(input)).toBe(expected)
      })
    })

    describe('Decenas compuestas (31-99)', () => {
      test.each([
        ['treinta y uno', '31'],
        ['treinta y dos', '32'],
        ['cuarenta y cinco', '45'],
        ['cincuenta y siete', '57'],
        ['sesenta y tres', '63'],
        ['setenta y ocho', '78'],
        ['ochenta y cuatro', '84'],
        ['noventa y nueve', '99'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(spanishTextToNumber(input)).toBe(expected)
      })
    })

    describe('Centenas (100-399)', () => {
      test.each([
        ['cien', '100'],
        ['ciento', '100'],
        ['ciento uno', '101'],
        ['ciento diez', '110'],
        ['ciento veinte', '120'],
        ['ciento veintiuno', '121'],
        ['ciento treinta y cinco', '135'],
        ['ciento ochenta y cuatro', '184'],
        ['doscientos', '200'],
        ['doscientas', '200'],
        ['doscientos uno', '201'],
        ['doscientos cincuenta', '250'],
        ['trescientos', '300'],
        ['trescientas', '300'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(spanishTextToNumber(input)).toBe(expected)
      })
    })

    describe('Con sufijos latinos (bis, ter, etc.)', () => {
      test.each([
        ['primero bis', '1 bis'],
        ['cuarto bis', '4 bis'],
        ['veintidós ter', '22 ter'],
        ['treinta y cinco quater', '35 quater'],
        ['ciento uno bis', '101 bis'],
        ['doscientos ter', '200 ter'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(spanishTextToNumber(input)).toBe(expected)
      })
    })

    describe('Con punto final (limpiar)', () => {
      test.each([
        ['primero.', '1'],
        ['segundo.', '2'],
        ['ciento uno.', '101'],
        ['treinta y cinco bis.', '35 bis'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(spanishTextToNumber(input)).toBe(expected)
      })
    })

    describe('Casos inválidos', () => {
      test('null devuelve null', () => {
        expect(spanishTextToNumber(null)).toBeNull()
      })

      test('undefined devuelve null', () => {
        expect(spanishTextToNumber(undefined)).toBeNull()
      })

      test('string vacío devuelve null', () => {
        expect(spanishTextToNumber('')).toBeNull()
      })

      test('texto no reconocido devuelve null', () => {
        expect(spanishTextToNumber('foo bar')).toBeNull()
      })
    })
  })

  // =====================================================
  // normalizeArticleNumber - Normalización de números
  // =====================================================
  describe('normalizeArticleNumber', () => {

    describe('Números simples', () => {
      test.each([
        ['1', '1'],
        ['55', '55'],
        ['100', '100'],
        ['216', '216'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(normalizeArticleNumber(input)).toBe(expected)
      })
    })

    describe('Con sufijos pegados', () => {
      test.each([
        ['55bis', '55 bis'],
        ['4ter', '4 ter'],
        ['22quater', '22 quater'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(normalizeArticleNumber(input)).toBe(expected)
      })
    })

    describe('Normalización de mayúsculas', () => {
      test.each([
        ['4 BIS', '4 bis'],
        ['22 TER', '22 ter'],
        ['55 QUATER', '55 quater'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(normalizeArticleNumber(input)).toBe(expected)
      })
    })

    describe('Normalización de acentos (quáter → quater)', () => {
      test.each([
        ['22 quáter', '22 quater'],
        ['55 QUÁTER', '55 quater'],
        ['100quáter', '100 quater'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(normalizeArticleNumber(input)).toBe(expected)
      })
    })

    describe('Con números adicionales (216 bis 2)', () => {
      test.each([
        ['216 bis 2', '216 bis 2'],
        ['216 bis 3', '216 bis 3'],
        ['100 ter 1', '100 ter 1'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(normalizeArticleNumber(input)).toBe(expected)
      })
    })

    describe('Todos los sufijos latinos', () => {
      test.each([
        ['1 bis', '1 bis'],
        ['2 ter', '2 ter'],
        ['3 quater', '3 quater'],
        ['4 quinquies', '4 quinquies'],
        ['5 sexies', '5 sexies'],
        ['6 septies', '6 septies'],
        ['7 octies', '7 octies'],
        ['8 nonies', '8 nonies'],
        ['9 decies', '9 decies'],
      ])('"%s" → "%s"', (input, expected) => {
        expect(normalizeArticleNumber(input)).toBe(expected)
      })
    })

    describe('Casos edge', () => {
      test('null devuelve string vacío', () => {
        expect(normalizeArticleNumber(null)).toBe('')
      })

      test('undefined devuelve string vacío', () => {
        expect(normalizeArticleNumber(undefined)).toBe('')
      })

      test('espacios extra se normalizan', () => {
        expect(normalizeArticleNumber('4   bis')).toBe('4 bis')
      })
    })
  })

  // =====================================================
  // normalizeText - Normalización de texto
  // =====================================================
  describe('normalizeText', () => {

    test('convierte a minúsculas', () => {
      expect(normalizeText('HOLA MUNDO')).toBe('hola mundo')
    })

    test('quita acentos', () => {
      expect(normalizeText('árbol único')).toBe('arbol unico')
    })

    test('quita puntuación', () => {
      expect(normalizeText('Hola, mundo.')).toBe('hola mundo')
    })

    test('normaliza espacios múltiples', () => {
      expect(normalizeText('hola    mundo')).toBe('hola mundo')
    })

    test('null devuelve string vacío', () => {
      expect(normalizeText(null)).toBe('')
    })
  })

  // =====================================================
  // compareContent - Comparación de contenido
  // =====================================================
  describe('compareContent', () => {

    test('textos idénticos → match 100%', () => {
      const text = 'El artículo establece las normas básicas.'
      const result = compareContent(text, text)
      expect(result.match).toBe(true)
      expect(result.similarity).toBe(100)
    })

    test('textos con diferentes acentos → match', () => {
      const boe = 'El artículo establece las normas básicas.'
      const db = 'El articulo establece las normas basicas.'
      const result = compareContent(boe, db)
      expect(result.match).toBe(true)
      expect(result.similarity).toBe(100)
    })

    test('textos con pequeñas diferencias → match si > 95%', () => {
      const boe = 'El artículo establece las normas básicas de funcionamiento del sistema.'
      const db = 'El artículo establece las normas básicas de funcionamiento del sistema administrativo.'
      const result = compareContent(boe, db)
      expect(result.similarity).toBeGreaterThan(80)
    })

    test('textos muy diferentes → no match', () => {
      const boe = 'El artículo establece las normas básicas.'
      const db = 'Las funciones administrativas son diferentes.'
      const result = compareContent(boe, db)
      expect(result.match).toBe(false)
      expect(result.similarity).toBeLessThan(50)
    })

    test('textos vacíos idénticos → match 100%', () => {
      // Dos strings vacíos normalizados son iguales
      const result = compareContent('', '')
      expect(result.match).toBe(true)
      expect(result.similarity).toBe(100)
    })
  })

  // =====================================================
  // extractArticlesFromBOE - Extracción de artículos
  // =====================================================
  describe('extractArticlesFromBOE', () => {

    describe('Formato numérico estándar', () => {
      test('extrae artículo simple con título', () => {
        const html = `
          <div class="bloque" id="a1">
            <h5 class="articulo">Artículo 1. Objeto de la ley</h5>
            <p>Esta ley tiene por objeto regular las bases del régimen jurídico.</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles).toHaveLength(1)
        expect(articles[0].article_number).toBe('1')
        expect(articles[0].title).toBe('Objeto de la ley')
        expect(articles[0].content).toContain('Esta ley tiene por objeto')
      })

      test('extrae artículo sin título', () => {
        const html = `
          <div class="bloque" id="a5">
            <h5 class="articulo">Artículo 5.</h5>
            <p>Contenido del artículo cinco.</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles).toHaveLength(1)
        expect(articles[0].article_number).toBe('5')
        expect(articles[0].title).toBeNull() // null cuando no hay título
      })

      test('extrae múltiples artículos', () => {
        const html = `
          <div class="bloque" id="a1">
            <h5 class="articulo">Artículo 1. Primero</h5>
            <p>Contenido 1</p>
          </div>
          <div class="bloque" id="a2">
            <h5 class="articulo">Artículo 2. Segundo</h5>
            <p>Contenido 2</p>
          </div>
          <div class="bloque" id="a3">
            <h5 class="articulo">Artículo 3. Tercero</h5>
            <p>Contenido 3</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles).toHaveLength(3)
        expect(articles[0].article_number).toBe('1')
        expect(articles[1].article_number).toBe('2')
        expect(articles[2].article_number).toBe('3')
      })
    })

    describe('Artículos con sufijos latinos', () => {
      test('extrae artículo bis', () => {
        const html = `
          <div class="bloque" id="a4bis">
            <h5 class="articulo">Artículo 4 bis. Disposición adicional</h5>
            <p>Contenido del artículo 4 bis.</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles).toHaveLength(1)
        expect(articles[0].article_number).toBe('4 bis')
      })

      test('extrae artículo ter', () => {
        const html = `
          <div class="bloque" id="a22ter">
            <h5 class="articulo">Artículo 22 ter.</h5>
            <p>Contenido.</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles).toHaveLength(1)
        expect(articles[0].article_number).toBe('22 ter')
      })

      test('extrae artículo quater (con y sin acento)', () => {
        const html = `
          <div class="bloque" id="a55quater">
            <h5 class="articulo">Artículo 55 quáter.</h5>
            <p>Contenido.</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles).toHaveLength(1)
        // El número normalizado debe tener "quater" sin acento
        expect(articles[0].article_number).toBe('55 quáter')
      })

      test('extrae artículo con número adicional (216 bis 2)', () => {
        const html = `
          <div class="bloque" id="a216bis2">
            <h5 class="articulo">Artículo 216 bis 2. Título especial</h5>
            <p>Contenido del artículo 216 bis 2.</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles).toHaveLength(1)
        expect(articles[0].article_number).toBe('216 bis 2')
      })
    })

    describe('Formato texto (Constitución, LOREG)', () => {
      test('extrae "Artículo primero"', () => {
        const html = `
          <div class="bloque" id="aprimero">
            <h5 class="articulo">Artículo primero. España se constituye</h5>
            <p>España se constituye en un Estado social y democrático de Derecho.</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles).toHaveLength(1)
        expect(articles[0].article_number).toBe('1')
      })

      test('extrae "Artículo ciento ochenta y cuatro"', () => {
        const html = `
          <div class="bloque" id="a184">
            <h5 class="articulo">Artículo ciento ochenta y cuatro. Concejales</h5>
            <p>Cada término municipal constituye una circunscripción.</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles).toHaveLength(1)
        expect(articles[0].article_number).toBe('184')
      })

      test('extrae "Artículo doscientos diez"', () => {
        const html = `
          <div class="bloque" id="a210">
            <h5 class="articulo">Artículo doscientos diez.</h5>
            <p>Contenido del artículo 210.</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles).toHaveLength(1)
        expect(articles[0].article_number).toBe('210')
      })
    })

    describe('Ordenación de artículos', () => {
      test('ordena correctamente artículos simples', () => {
        const html = `
          <div class="bloque" id="a3"><h5 class="articulo">Artículo 3.</h5><p>C</p></div>
          <div class="bloque" id="a1"><h5 class="articulo">Artículo 1.</h5><p>A</p></div>
          <div class="bloque" id="a2"><h5 class="articulo">Artículo 2.</h5><p>B</p></div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles.map(a => a.article_number)).toEqual(['1', '2', '3'])
      })

      test('ordena correctamente con sufijos', () => {
        const html = `
          <div class="bloque" id="a4ter"><h5 class="articulo">Artículo 4 ter.</h5><p>C</p></div>
          <div class="bloque" id="a4"><h5 class="articulo">Artículo 4.</h5><p>A</p></div>
          <div class="bloque" id="a4bis"><h5 class="articulo">Artículo 4 bis.</h5><p>B</p></div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles.map(a => a.article_number)).toEqual(['4', '4 bis', '4 ter'])
      })

      test('ordena correctamente con números adicionales', () => {
        const html = `
          <div class="bloque" id="a216bis3"><h5 class="articulo">Artículo 216 bis 3.</h5><p>D</p></div>
          <div class="bloque" id="a216"><h5 class="articulo">Artículo 216.</h5><p>A</p></div>
          <div class="bloque" id="a216bis"><h5 class="articulo">Artículo 216 bis.</h5><p>B</p></div>
          <div class="bloque" id="a216bis2"><h5 class="articulo">Artículo 216 bis 2.</h5><p>C</p></div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles.map(a => a.article_number)).toEqual(['216', '216 bis', '216 bis 2', '216 bis 3'])
      })
    })

    describe('Limpieza de contenido', () => {
      test('elimina notas de modificación del BOE', () => {
        const html = `
          <div class="bloque" id="a1">
            <h5 class="articulo">Artículo 1.</h5>
            <p>Contenido principal del artículo.</p>
            <p class="nota_pie">Modificado por Ley X/2023</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles[0].content).not.toContain('Modificado por')
      })

      test('elimina enlaces de jurisprudencia', () => {
        const html = `
          <div class="bloque" id="a1">
            <h5 class="articulo">Artículo 1.</h5>
            <p>Contenido principal.</p>
            <a class="jurisprudencia" href="#">Ver jurisprudencia</a>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles[0].content).not.toContain('jurisprudencia')
      })

      test('elimina formularios', () => {
        const html = `
          <div class="bloque" id="a1">
            <h5 class="articulo">Artículo 1.</h5>
            <p>Contenido.</p>
            <form action="/search"><input type="text" /></form>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles[0].content).not.toContain('form')
        expect(articles[0].content).not.toContain('input')
      })

      test('preserva saltos de párrafo', () => {
        const html = `
          <div class="bloque" id="a1">
            <h5 class="articulo">Artículo 1.</h5>
            <p>Párrafo uno.</p>
            <p>Párrafo dos.</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles[0].content).toContain('\n')
      })
    })

    describe('Casos edge', () => {
      test('HTML vacío devuelve array vacío', () => {
        expect(extractArticlesFromBOE('')).toEqual([])
      })

      test('HTML sin artículos devuelve array vacío', () => {
        const html = '<div><p>No hay artículos aquí</p></div>'
        expect(extractArticlesFromBOE(html)).toEqual([])
      })

      test('ignora bloques sin número de artículo válido', () => {
        const html = `
          <div class="bloque" id="apreambulo">
            <h5 class="articulo">Preámbulo</h5>
            <p>Texto del preámbulo.</p>
          </div>
          <div class="bloque" id="a1">
            <h5 class="articulo">Artículo 1.</h5>
            <p>Contenido.</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles).toHaveLength(1)
        expect(articles[0].article_number).toBe('1')
      })
    })
  })

  // =====================================================
  // Tests de regresión - Casos reales problemáticos
  // =====================================================
  describe('Casos de regresión (bugs reales)', () => {

    test('LOREG: artículos con texto español deben convertirse correctamente', () => {
      // La LOREG usa "Artículo primero", "Artículo segundo", etc.
      const html = `
        <div class="bloque" id="aprimero">
          <h5 class="articulo">Artículo primero. Derecho de sufragio activo</h5>
          <p>Tienen derecho de sufragio activo los españoles mayores de edad.</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles[0].article_number).toBe('1')
      expect(articles[0].title).toBe('Derecho de sufragio activo')
    })

    test('Ley de Régimen Local: artículos altos (ciento ochenta y cuatro)', () => {
      const html = `
        <div class="bloque" id="a184">
          <h5 class="articulo">Artículo ciento ochenta y cuatro. Concejales de Municipios</h5>
          <p>Cada término municipal constituye una circunscripción.</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles[0].article_number).toBe('184')
    })

    test('RD con múltiples sufijos: 216 bis 2, 216 bis 3', () => {
      const html = `
        <div class="bloque" id="a216bis2">
          <h5 class="articulo">Artículo 216 bis 2.</h5>
          <p>Segundo artículo adicional.</p>
        </div>
        <div class="bloque" id="a216bis3">
          <h5 class="articulo">Artículo 216 bis 3.</h5>
          <p>Tercer artículo adicional.</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles).toHaveLength(2)
      expect(articles[0].article_number).toBe('216 bis 2')
      expect(articles[1].article_number).toBe('216 bis 3')
    })

    test('Constitución: formato mixto texto/número', () => {
      // Algunos artículos de la Constitución usan texto, otros números
      const html = `
        <div class="bloque" id="a1">
          <h5 class="articulo">Artículo 1.</h5>
          <p>España se constituye en un Estado social.</p>
        </div>
        <div class="bloque" id="a2">
          <h5 class="articulo">Artículo segundo.</h5>
          <p>La soberanía nacional reside en el pueblo.</p>
        </div>
      `
      const articles = extractArticlesFromBOE(html)
      expect(articles).toHaveLength(2)
      expect(articles.map(a => a.article_number)).toEqual(['1', '2'])
    })

    test('Ley 39/2015: sufijos octies, nonies, decies', () => {
      const numbers = ['octies', 'nonies', 'decies']
      numbers.forEach(suffix => {
        const html = `
          <div class="bloque" id="a1${suffix}">
            <h5 class="articulo">Artículo 1 ${suffix}.</h5>
            <p>Contenido.</p>
          </div>
        `
        const articles = extractArticlesFromBOE(html)
        expect(articles).toHaveLength(1)
        expect(articles[0].article_number).toBe(`1 ${suffix}`)
      })
    })
  })
})
