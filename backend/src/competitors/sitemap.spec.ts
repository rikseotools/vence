import { parseSitemapXml } from './sitemap';

describe('parseSitemapXml', () => {
  it('parsea un sitemap index y marca isIndex=true', () => {
    const xml = `<?xml version="1.0"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://www.tecnoszubia.es/oposiciones-sitemap.xml</loc><lastmod>2026-07-04T10:00:00+00:00</lastmod></sitemap>
        <sitemap><loc>https://www.tecnoszubia.es/page-sitemap.xml</loc></sitemap>
      </sitemapindex>`;
    const { entries, isIndex } = parseSitemapXml(xml);
    expect(isIndex).toBe(true);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      loc: 'https://www.tecnoszubia.es/oposiciones-sitemap.xml',
      lastmod: '2026-07-04T10:00:00+00:00',
    });
    expect(entries[1].lastmod).toBeNull();
  });

  it('parsea un urlset y marca isIndex=false', () => {
    const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://www.tecnoszubia.es/oposiciones/policia-local/</loc><lastmod>2026-06-01</lastmod></url>
      <url><loc>https://www.tecnoszubia.es/oposicion/administracion/</loc></url>
    </urlset>`;
    const { entries, isIndex } = parseSitemapXml(xml);
    expect(isIndex).toBe(false);
    expect(entries.map((e) => e.loc)).toEqual([
      'https://www.tecnoszubia.es/oposiciones/policia-local/',
      'https://www.tecnoszubia.es/oposicion/administracion/',
    ]);
  });

  it('decodifica entidades XML en el loc y deduplica', () => {
    const xml = `<urlset>
      <url><loc>https://x.es/a?b=1&amp;c=2</loc></url>
      <url><loc>https://x.es/a?b=1&amp;c=2</loc></url>
    </urlset>`;
    const { entries } = parseSitemapXml(xml);
    expect(entries).toHaveLength(1);
    expect(entries[0].loc).toBe('https://x.es/a?b=1&c=2');
  });

  it('devuelve vacío para XML sin bloques', () => {
    expect(parseSitemapXml('<urlset></urlset>').entries).toEqual([]);
  });
});
