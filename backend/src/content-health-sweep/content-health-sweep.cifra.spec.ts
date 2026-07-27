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
import { enLetra, cifraEnTexto, esPlazaHuerfana } from './content-health-sweep.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nucleo = require('../../../lib/convocatoria/cifraEnTexto.cjs') as {
  enLetra: (n: number) => string;
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
});
