import { normaCore, buildNormaIndex } from './detect-boletines.service';

describe('normaCore', () => {
  it('normaliza una referencia a su núcleo TIPO-NN-AAAA', () => {
    expect(normaCore('Orden PRE/76/2024')).toBe('pre-76-2024');
  });

  it('empareja la misma norma con distinta redacción', () => {
    expect(normaCore('la Orden PRE/76/2024, de 29 de agosto')).toBe(
      normaCore('Orden PRE/76/2024'),
    );
  });

  it('distingue por número y año (no colisiona)', () => {
    expect(normaCore('Orden PRE/12/2026')).not.toBe(normaCore('Orden PRE/76/2024'));
  });

  it('devuelve "" cuando no hay patrón (nunca match espurio)', () => {
    expect(normaCore(null)).toBe('');
    expect(normaCore('Resolución sin número')).toBe('');
  });
});

describe('buildNormaIndex', () => {
  const normas = [
    {
      oposicion_id: 'opo-cantabria',
      norma_ref: 'Orden PRE/76/2024',
      cuerpo: 'Cuerpo General Auxiliar',
      ambito: 'Cantabria',
      oposicion_nombre: 'Auxiliar Administrativo del Gobierno de Cantabria',
    },
  ];

  it('auto-vincula la Orden modificadora (PRE/12/2026) a la oposición cuya norma-fuente (PRE/76/2024) modifica', () => {
    const idx = buildNormaIndex(normas);
    // El sensor mira la norma que la nueva Orden MODIFICA (PRE/76/2024).
    const match = idx.get(normaCore('la Orden PRE/76/2024'));
    expect(match?.oposicionId).toBe('opo-cantabria');
    expect(match?.nombre).toContain('Cantabria');
  });

  it('no vincula una norma no registrada', () => {
    const idx = buildNormaIndex(normas);
    expect(idx.get(normaCore('Orden JUS/999/2025'))).toBeUndefined();
  });

  it('ignora filas cuya norma_ref no tiene núcleo parseable', () => {
    const idx = buildNormaIndex([
      { ...normas[0], norma_ref: 'sin patrón' },
    ]);
    expect(idx.size).toBe(0);
  });
});
