// __tests__/lib/temario/temarioRefiningDoc.test.js
//
// Señal PURA "este documento contiene un programa/temario que afina el de la oposición".
// Caza el caso CARM (comunicado de ofimática que afina el programa base) sin ruido de menciones
// sueltas. Sin BD.

const { analyzeTemarioDoc, esTemarioRefiningDoc } = require('../../../lib/temario/temarioRefiningDoc');

describe('analyzeTemarioDoc — señal fuerte de temario', () => {
  test('caso CARM: anexo de ofimática (PowerPoint + Excel) → es temario', () => {
    const txt = 'Anexo 1.- PRESENTACIONES CON POWERPOINT 2016 ... 2.- HOJA DE CÁLCULO EXCEL 2016 ...';
    const r = analyzeTemarioDoc(txt);
    expect(r.ofimatica).toBe(true);
    expect(r.esTemario).toBe(true);
  });

  test('programa con muchos Tema N (>=5) → es temario', () => {
    const txt = 'Tema 1.- x. Tema 2.- y. Tema 3.- z. Tema 4.- w. Tema 5.- v. Tema 6.- u.';
    const r = analyzeTemarioDoc(txt);
    expect(r.temaMarkers).toBe(6);
    expect(r.esTemario).toBe(true);
  });

  test('mención SUELTA de "tema"/"anexo" (comunicado admin) → NO es temario (evita el ruido)', () => {
    const txt = 'Se publica el anexo de plazas. Sobre este tema, la comisión resolverá. Ver anexo II.';
    const r = analyzeTemarioDoc(txt);
    expect(r.temaMarkers).toBe(0); // "este tema" no casa "\bTema \d"
    expect(r.esTemario).toBe(false);
  });

  test('solo PowerPoint (sin Excel) → NO dispara ofimática (evita falso positivo)', () => {
    expect(analyzeTemarioDoc('presentación en powerpoint del tribunal').esTemario).toBe(false);
  });

  test('pocos Tema (< 5) sin ofimática → NO es temario', () => {
    expect(analyzeTemarioDoc('Tema 1 y Tema 2 del recurso').esTemario).toBe(false);
  });

  test('vacío / null → no revienta, no es temario', () => {
    expect(esTemarioRefiningDoc('')).toBe(false);
    expect(esTemarioRefiningDoc(null)).toBe(false);
    expect(esTemarioRefiningDoc(undefined)).toBe(false);
  });
});
