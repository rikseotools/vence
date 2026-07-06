import { detectTech } from './tech-detect';

describe('detectTech', () => {
  it('detecta WordPress + Yoast + Apache (caso tecnoszubia)', () => {
    const html = `<html><head>
      <meta name="generator" content="WordPress 6.5.2" />
      <link rel="sitemap" href="/sitemap.xml"/> yoast SEO
      <div class="wp-content"></div></head></html>`;
    const tech = detectTech(html, { server: 'Apache/2.4.41 (Ubuntu)' });
    expect(tech.cms).toBe('wordpress');
    expect(tech.sitemapGenerator).toBe('yoast');
    expect(tech.server).toBe('apache');
    expect(tech.cdnWaf).toBeNull();
  });

  it('detecta WordPress por wp-content sin meta generator', () => {
    const tech = detectTech('<img src="/wp-content/uploads/x.jpg">', {});
    expect(tech.cms).toBe('wordpress');
  });

  it('detecta Cloudflare por cabecera cf-ray', () => {
    const tech = detectTech('<html></html>', { 'cf-ray': '8abc-MAD', server: 'cloudflare' });
    expect(tech.cdnWaf).toBe('cloudflare');
    expect(tech.server).toBe('cloudflare');
  });

  it('devuelve nulls si no hay señales', () => {
    expect(detectTech('<html></html>', {})).toEqual({
      cms: null,
      sitemapGenerator: null,
      server: null,
      cdnWaf: null,
    });
  });
});
