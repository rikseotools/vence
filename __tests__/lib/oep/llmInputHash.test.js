const path = require('path');
const {
  cleanHtml,
  llmInputHash,
  legacyContentHash,
  necesitaLlm,
  LLM_MAX_CHARS,
} = require(path.join(__dirname, '..', '..', '..', 'lib', 'oep', 'llmInputHash.cjs'));
const fs = require('fs');

/**
 * Núcleo del embudo de `detect-oep-llm` (T-166).
 *
 * Lo que estos tests protegen no es "que el sha256 funcione", sino las dos
 * decisiones de diseño que salieron de medir el 27/07:
 *   1. El gate hashea la ventana que ve el MODELO (20k), no los 100k del hash
 *      actual — si no, paga llamadas por cambios que el modelo no puede ver.
 *   2. La asimetría: saltarse una llamada de más cuesta céntimos; saltarse una
 *      convocatoria, no. Ante la duda, SIEMPRE llamar.
 */
describe('llmInputHash — núcleo del embudo de detect-oep-llm', () => {
  describe('el gate mira la ventana del modelo, no los 100k', () => {
    // 25k de relleno: el corte del modelo (20k) cae DENTRO, así que un cambio
    // al final es invisible para él pero sí movería el hash de 100k.
    const base = '<p>' + 'convocatoria '.repeat(2000) + '</p>';

    it('un cambio MÁS ALLÁ de los 20k NO mueve el hash del gate', () => {
      const a = base + '<p>cola original</p>';
      const b = base + '<p>cola distinta</p>';
      expect(cleanHtml(a, 10 ** 9).length).toBeGreaterThan(LLM_MAX_CHARS);
      expect(llmInputHash(a)).toBe(llmInputHash(b));
    });

    it('…pero SÍ mueve el hash legacy — que es la llamada inútil que hoy se paga', () => {
      const a = base + '<p>cola original</p>';
      const b = base + '<p>cola distinta</p>';
      expect(legacyContentHash(a)).not.toBe(legacyContentHash(b));
    });

    it('un cambio DENTRO de los 20k sí mueve el hash del gate', () => {
      expect(llmInputHash('<p>Plazas: 10</p>')).not.toBe(
        llmInputHash('<p>Plazas: 20</p>'),
      );
    });
  });

  describe('normalización (espejo del backend)', () => {
    it('ignora scripts, estilos y comentarios: no son contenido', () => {
      const limpio = '<p>Convocatoria</p>';
      const sucio =
        '<script>var t=Date.now()</script><style>.a{color:red}</style><!-- build 123 --><p>Convocatoria</p>';
      expect(llmInputHash(sucio)).toBe(llmInputHash(limpio));
    });

    it('ignora el espaciado y la etiqueta que envuelve el texto', () => {
      expect(llmInputHash('<div>Convocatoria 2026</div>')).toBe(
        llmInputHash('<p>Convocatoria\n\n  2026</p>'),
      );
    });

    // GOTCHA medido al escribir estos tests: cada etiqueta se sustituye por un
    // ESPACIO, así que `<b>Plazas</b>:` normaliza a "Plazas :" (espacio antes de
    // los dos puntos) y `Plazas:` a "Plazas:". No son el mismo hash.
    // Consecuencia práctica: un rediseño del HTML que mueva las etiquetas dispara
    // un falso "cambió" y paga una llamada de más. Es aceptable —el coste es de
    // céntimos y cae del lado seguro de la asimetría—, pero conviene saberlo antes
    // de culpar al gate de "gastar sin motivo".
    it('DOCUMENTADO: mover una etiqueta junto a un signo de puntuación sí cambia el hash', () => {
      expect(llmInputHash('<div><b>Plazas</b>: 10</div>')).not.toBe(
        llmInputHash('<div>Plazas: 10</div>'),
      );
      expect(cleanHtml('<div><b>Plazas</b>: 10</div>', 1000)).toBe('Plazas : 10');
      expect(cleanHtml('<div>Plazas: 10</div>', 1000)).toBe('Plazas: 10');
    });

    it('NO ignora un cambio de cifra — el falso negativo que no nos podemos permitir', () => {
      expect(llmInputHash('<p>Plazas: 10</p>')).not.toBe(
        llmInputHash('<p>Plazas: 11</p>'),
      );
    });
  });

  describe('necesitaLlm — la asimetría manda', () => {
    const html = '<p>Convocatoria 2026</p>';

    it('sin hash previo SIEMPRE llama: nunca se descarta a ciegas', () => {
      expect(necesitaLlm(html, null).necesita).toBe(true);
      expect(necesitaLlm(html, null).motivo).toBe('sin_hash_previo');
      expect(necesitaLlm(html, '').necesita).toBe(true);
    });

    it('con hash distinto llama', () => {
      const r = necesitaLlm(html, 'otro-hash');
      expect(r.necesita).toBe(true);
      expect(r.motivo).toBe('cambio');
    });

    it('solo se salta la llamada con igualdad EXACTA', () => {
      const h = llmInputHash(html);
      const r = necesitaLlm(html, h);
      expect(r.necesita).toBe(false);
      expect(r.motivo).toBe('sin_cambios');
    });

    it('devuelve el hash nuevo siempre, para poder persistirlo aunque llame', () => {
      expect(necesitaLlm(html, null).hash).toBe(llmInputHash(html));
    });
  });

  describe('contieneFecha — medir HOY el ruido de MAÑANA', () => {
    const { contieneFecha } = require(path.join(__dirname, '..', '..', '..', 'lib', 'oep', 'llmInputHash.cjs'));
    const hoy = new Date(2026, 6, 27); // 27 julio 2026 (mes 0-indexado)

    it.each([
      ['dd/mm/aaaa', 'Actualizado el 27/07/2026 a las 09:12'],
      ['d-m-aaaa sin ceros', 'Fecha: 27-7-2026'],
      ['ISO aaaa-mm-dd', 'lastmod 2026-07-27'],
      ['texto largo', 'Sevilla, a 27 de julio de 2026'],
      ['texto largo en mayúsculas', 'A 27 DE JULIO DE 2026'],
    ])('detecta el formato %s', (_, texto) => {
      expect(contieneFecha(texto, hoy)).toBe(true);
    });

    it('NO confunde la fecha de AYER ni la de mañana', () => {
      expect(contieneFecha('26/07/2026', hoy)).toBe(false);
      expect(contieneFecha('28 de julio de 2026', hoy)).toBe(false);
    });

    it('NO confunde otro año con el mismo día y mes', () => {
      expect(contieneFecha('27/07/2025', hoy)).toBe(false);
    });

    it('no marca una página sin fechas', () => {
      expect(contieneFecha('Convocatoria de 10 plazas de auxiliar', hoy)).toBe(false);
    });

    // El día 1 no puede casar con el 11 ni el 21: el \b evita el falso positivo.
    it('respeta los límites de palabra (el 1 no casa con el 11)', () => {
      const uno = new Date(2026, 6, 1);
      expect(contieneFecha('11/07/2026', uno)).toBe(false);
      expect(contieneFecha('01/07/2026', uno)).toBe(true);
    });
  });

  describe('paridad con el backend (anti-deriva)', () => {
    // Si `cleanHtml` del servicio cambia y esta copia no, el gate hashea un
    // texto distinto del que se analiza y decide mal. Se compara el CUERPO de
    // la función real, no una regex sobre el fichero.
    it('cleanHtml replica las mismas sustituciones que oep-signals-llm.service.ts', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'backend', 'src', 'oep-signals', 'oep-signals-llm.service.ts'),
        'utf8',
      );
      const cuerpo = src.match(/private cleanHtml\(html: string, maxChars: number\): string \{[\s\S]*?\n  \}/);
      expect(cuerpo).toBeTruthy();
      const reglas = (cuerpo[0].match(/\.replace\(/g) || []).length;
      const nuestras = (String(cleanHtml).match(/\.replace\(/g) || []).length;
      expect(nuestras).toBe(reglas);
      // Y el truncado debe seguir siendo el mismo marcador.
      expect(cuerpo[0]).toContain('...[truncado]');
      expect(cleanHtml('x'.repeat(50), 10)).toContain('...[truncado]');
    });

    it('la ventana del modelo sigue siendo 20.000 en el servicio real', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'backend', 'src', 'oep-signals', 'oep-signals-llm.service.ts'),
        'utf8',
      );
      expect(src).toContain('this.cleanHtml(html, 20000)');
      expect(LLM_MAX_CHARS).toBe(20000);
    });
  });
});
