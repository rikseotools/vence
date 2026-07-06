import { classifyOpomasterUrl, parseOpomasterCourse } from './opomaster';

describe('opomaster adapter', () => {
  it('clasifica listados como categoría y el resto como página', () => {
    expect(classifyOpomasterUrl('https://opomaster.com/oposiciones.html')).toBe('categoria');
    expect(classifyOpomasterUrl('https://opomaster.com/temarios.html')).toBe('categoria');
    expect(classifyOpomasterUrl('https://opomaster.com/contacto.html')).toBe('page');
    expect(classifyOpomasterUrl('nope')).toBe('other');
  });

  it('no produce cursos con fetch plano (catálogo por Firebase/JS)', () => {
    expect(parseOpomasterCourse('https://opomaster.com/oposiciones.html', '<html></html>')).toBeNull();
  });
});
