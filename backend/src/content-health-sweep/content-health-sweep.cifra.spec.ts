// Paridad EXACTA del mirror `cifraEnTexto` del backend contra el núcleo del root.
//
// `__tests__/health/content-sweep-parity.test.ts` (raíz) garantiza que los dos gemelos emiten los
// mismos KINDS, pero comparar nombres no compara aritmética: el backend no puede importar
// `lib/convocatoria/cifraEnTexto.cjs` (es otro proyecto) y lleva su copia a mano. Si una tabla de
// numerales derivara, el @Cron nocturno —que es el writer REAL del badge— acusaría a una landing que
// el auditor da por buena, o al revés. Un hallazgo que aparece o desaparece según quién mire es peor
// que no tenerlo.
//
// A diferencia del spec hermano de `estado`, aquí NO se replican casos a mano: se carga el núcleo del
// root y se comparan las dos implementaciones sobre TODO su dominio. Es barato porque son funciones
// puras, y así la paridad no depende de que alguien acuerde de añadir el caso nuevo a los dos sitios.
import { enLetra, cifraEnTexto, esPlazaHuerfana, firmaDerivadaValida, sumaDeSubconjunto } from './content-health-sweep.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const validador = require('../../../lib/convocatoria/validarDerivada.cjs') as {
  validarFirmaDerivada: (f: { plazas?: number | null; snippet?: string | null }) => { ok: boolean };
  sumaDeSubconjunto: (o: number, n: number[]) => number[] | null;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nucleo = require('../../../lib/convocatoria/cifraEnTexto.cjs') as {
  enLetra: (n: number) => string | null;
  cifraEnTexto: (n: number | null | undefined, t: string | null | undefined) => boolean;
  esPlazaHuerfana: (f: Record<string, unknown>) => boolean;
};

describe('mirror cifraEnTexto (backend @Cron) ↔ núcleo del root', () => {
  it('enLetra coincide en TODO el dominio que se usa (0..9999)', () => {
    const divergencias: string[] = [];
    for (let n = 0; n <= 9999; n++) {
      const mio = enLetra(n);
      const suyo = nucleo.enLetra(n);
      if (mio !== suyo) divergencias.push(`${n}: backend «${mio}» ≠ root «${suyo}»`);
    }
    expect(divergencias.slice(0, 10)).toEqual([]);
  });

  it('cifraEnTexto coincide buscando cada cifra en su propio numeral y en sus dígitos', () => {
    const divergencias: string[] = [];
    for (let n = 0; n <= 2000; n++) {
      const corpus = [
        `se convocan ${nucleo.enLetra(n)} plazas`,
        `se convocan ${n} plazas`,
        `se convocan ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} plazas`,
        'un texto que no contiene ninguna cifra escrita',
      ];
      for (const t of corpus) {
        if (cifraEnTexto(n, t) !== nucleo.cifraEnTexto(n, t)) {
          divergencias.push(`${n} en «${t.slice(0, 40)}»`);
        }
      }
    }
    expect(divergencias.slice(0, 10)).toEqual([]);
  });

  it('coincide en los bordes (null, vacío, >9999)', () => {
    const casos: Array<[number | null | undefined, string | null | undefined]> = [
      [null, null], [null, 'texto'], [undefined, 'texto'], [100, null], [100, ''],
      [12345, 'son 12.345'], [12345, 'doce mil trescientos cuarenta y cinco'],
      [0, 'cero plazas'], [1, 'una plaza'],
    ];
    for (const [n, t] of casos) {
      expect(cifraEnTexto(n, t)).toBe(nucleo.cifraEnTexto(n, t));
    }
  });

  // [T-195] La guarda contra entradas imposibles es justo el tipo de arreglo que se aplica en un lado
  // y se olvida en el otro — y al vivir el mirror en otro build, nadie lo notaría hasta que el @Cron
  // nocturno reventara en silencio. Aquí se exige que ambos respondan lo mismo ANTE LA BASURA, no solo
  // ante las cifras legítimas. El timeout corto es a propósito: `NaN` colgaba por recursión infinita,
  // y un cuelgue debe salir como fallo, no como test lento.
  it('[T-195] coinciden ante entradas imposibles: false, sin excepción ni recursión', () => {
    const basura = [-3, -1, 2.5, NaN, Infinity, -Infinity];
    for (const n of basura) {
      expect(cifraEnTexto(n, 'se convocan 139 plazas')).toBe(false);
      expect(nucleo.cifraEnTexto(n, 'se convocan 139 plazas')).toBe(false);
      expect(enLetra(n)).toBe(nucleo.enLetra(n));
      expect(enLetra(n)).toBeNull();
    }
  }, 3000);

  // [T-202] La frontera de número es criterio del detector, no un detalle: si el mirror se queda
  // con el `includes` viejo, el @Cron nocturno y el auditor bajo demanda dirían cosas distintas
  // sobre la MISMA convocatoria — y el badge acabaría discrepando de quien lo audita a mano.
  it('[T-202] coinciden exigiendo que la cifra sea un número entero, no una subcadena', () => {
    const casos: Array<[number, string]> = [
      [216, 'B.1.3 C.ADMINISTRATIVO C1.1000197163216 C.DE AYUDANTES'],
      [278, 'PLAZAS ADICIONALES TD C211L26181 8 69 4 28 6 2781853 6 Grupo E'],
      [317, 'Acuerdo 52/2025, de 11 de diciembre19220212 Total31745362 2.2.'],
      [1747, 'Plazas del cupo general: 1.747. Plazas del cupo de reserva'],
      [1704, 'Mil setecientas cuatro (1704) plazas libres.'],
      [36, 'se convocan treinta y seis plazas de la escala administrativa'],
      [747, 'un total de 1.747 plazas'],
    ];
    for (const [n, t] of casos) {
      expect(cifraEnTexto(n, t)).toBe(nucleo.cifraEnTexto(n, t));
    }
    // …y el veredicto es el correcto, no solo el mismo en los dos.
    expect(cifraEnTexto(216, 'C1.1000197163216')).toBe(false);
    expect(cifraEnTexto(1704, 'Mil setecientas cuatro (1704) plazas libres.')).toBe(true);
  });

  it('esPlazaHuerfana coincide, incluida la válvula `cifra_derivada`', () => {
    const filas = [
      { plazas_libres: 561, corpus: 'convoca 231 plazas', docs: 2 },
      { plazas_libres: 111, corpus: null, docs: 0 },
      { plazas_libres: 139, corpus: 'oferta de 139 plazas', docs: 9 },
      { plazas_libres: 126, corpus: '23 … 103 …', docs: 1, derivada_declarada: true },
      { plazas_libres: 126, corpus: '23 … 103 …', docs: 1, derivada_declarada: false },
      { plazas_libres: 126, corpus: '23 … 103 …', docs: 1 },
      { plazas_libres: null, corpus: null, docs: 0 },
      { plazas_libres: 3, corpus: 'se convocan tres plazas', docs: 1 },
    ];
    for (const f of filas) {
      expect(esPlazaHuerfana(f)).toBe(nucleo.esPlazaHuerfana(f));
    }
  });

  it('la validación de firmas derivadas coincide con el núcleo (las 4 firmas reales del 27/07)', () => {
    const firmas: Array<[number, string]> = [
      [126, '146 plazas … 23 por el turno de acceso libre … 103 por el turno de acceso libre'],
      [128, 'Mallorca: 110 plazas del turno libre, 6 … Menorca: 6 plazas, 1 … Eivissa: 11 plazas'],
      [111, 'el cupo general es de 100 plazas, las reservadas a discapacidad son 11'],
      [139, '250102 Escala General Administrativa. Administrativos 144 (3 reservadas, 1 reservada, 1 reservada)'],
      [144, '250102 Escala General Administrativa. Administrativos 144 (3 reservadas, 1, 1)'],
    ];
    for (const [plazas, snippet] of firmas) {
      expect(firmaDerivadaValida(plazas, snippet)).toBe(validador.validarFirmaDerivada({ plazas, snippet }).ok);
    }
    expect(firmaDerivadaValida(139, '… 144 (3, 1, 1)')).toBe(false);   // mi firma mala, en ambos
    expect(firmaDerivadaValida(126, null)).toBe(false);
  });

  it('sumaDeSubconjunto coincide con el núcleo sobre combinaciones generadas', () => {
    const divergencias: string[] = [];
    for (let a = 1; a <= 40; a++) {
      for (let b = 1; b <= 40; b++) {
        const nums = [a, b, a + b, a * 2 + 1];
        for (const objetivo of [a + b, a + b + 1, a]) {
          const mio = JSON.stringify(sumaDeSubconjunto(objetivo, nums));
          const suyo = JSON.stringify(validador.sumaDeSubconjunto(objetivo, nums));
          if (mio !== suyo) divergencias.push(`${objetivo} en [${nums}]`);
        }
      }
    }
    expect(divergencias.slice(0, 5)).toEqual([]);
  });

  it('el filtro de ruido del boletín coincide (la cita real de Extremadura: 16 números → 8)', () => {
    const citaReal = '«Se convocan pruebas selectivas para cubrir 146 plazas del Cuerpo Auxiliar ' +
      '(30 plazas correspondiente a la Oferta de Empleo Público para el año 2021 (23 por el turno de ' +
      'acceso libre, 7 por el turno de discapacidad) más 116 plazas … para los años 2022 y 2023) ' +
      '(103 por el turno de acceso libre y 13 por el turno de discapacidad).» — Orden de 17/12/2025, ' +
      'base Primera.1 (DOE núm. 244, 19/12/2025)';
    expect(firmaDerivadaValida(126, citaReal)).toBe(validador.validarFirmaDerivada({ plazas: 126, snippet: citaReal }).ok);
    expect(firmaDerivadaValida(126, citaReal)).toBe(true);
  });
});
