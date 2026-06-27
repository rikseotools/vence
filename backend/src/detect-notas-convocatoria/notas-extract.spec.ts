import {
  extractDocLinks,
  extractSublinks,
  scanSignals,
  hasActionableSignal,
  parseNotasJson,
} from './notas-extract';

describe('notas-extract (lógica validada vs incidente Aragón 27/06)', () => {
  describe('extractDocLinks', () => {
    it('coge PDFs y /documents/ y descarta assets', () => {
      const html = `
        <a href="/documents/d/guest/2-nota-informativa-250109-pdf">Nota versiones</a>
        <a href="https://x.es/anexo.pdf">Anexo</a>
        <a href="/assets/app.css">css</a>
        <a href="/index.html">home</a>
        <a href="/static/logo.png">logo</a>`;
      const docs = extractDocLinks(html, 'https://www.aragon.es/');
      expect(docs).toContain('https://www.aragon.es/documents/d/guest/2-nota-informativa-250109-pdf');
      expect(docs).toContain('https://x.es/anexo.pdf');
      expect(docs.some((d) => /\.css|index\.html|\.png/.test(d))).toBe(false);
    });
  });

  describe('extractSublinks', () => {
    it('sigue anclas cuyo texto sea documentación/notas/convocatoria', () => {
      const html = `
        <a href="https://x.es/documentacion">Documentación</a>
        <a href="https://x.es/inicio">Inicio</a>
        <a href="https://x.es/notas-informativas">Notas informativas</a>`;
      const subs = extractSublinks(html, 'https://x.es/');
      expect(subs).toContain('https://x.es/documentacion');
      expect(subs).toContain('https://x.es/notas-informativas');
      expect(subs).not.toContain('https://x.es/inicio');
    });
  });

  describe('scanSignals', () => {
    it('capta "Windows 11" (orden directo)', () => {
      const s = scanSignals('se examina sobre Windows 11 y Word');
      expect(s.versiones).toContain('windows 11');
    });

    it('capta "la versión 11 de Windows" (orden inverso — el bug del 27/06)', () => {
      const s = scanSignals(
        'respecto al sistema operativo Windows, la versión 11 de Windows.',
      );
      expect(s.versiones).toContain('versión 11 de windows');
    });

    it('capta Word/Excel Microsoft 365 y el criterio "versión más moderna"', () => {
      const s = scanSignals(
        'Word para Microsoft 365 en la Web. la referencia siempre es a la versión más moderna',
      );
      expect(s.versiones).toEqual(expect.arrayContaining(['word', 'microsoft 365']));
      expect(s.criterio).toContain('versión más moderna');
      expect(hasActionableSignal(s)).toBe(true);
    });

    it('texto sin señales → no accionable', () => {
      expect(hasActionableSignal(scanSignals('relación de admitidos y excluidos'))).toBe(false);
    });
  });

  describe('parseNotasJson', () => {
    it('parsea JSON con fences ```json', () => {
      const r = parseNotasJson('```json\n{"confianza":"alta"}\n```');
      expect(r).toEqual({ confianza: 'alta' });
    });

    it('rescata el mayor bloque {...} si hay ruido alrededor', () => {
      const r = parseNotasJson('Aquí tienes: {"windows":"11"} fin');
      expect(r).toEqual({ windows: '11' });
    });

    it('devuelve null si no hay JSON', () => {
      expect(parseNotasJson('no hay json aquí')).toBeNull();
    });
  });
});
