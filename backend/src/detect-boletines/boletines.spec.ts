import {
  looksLikeC1C2Convocatoria,
  extractCandidatesFromSumarioText,
  extractCandidatosFromSumarioText,
  looksLikeTemarioChange,
  extractTemarioCandidatesFromSumarioText,
  absolutizarUrl,
  collectBoeEntradas,
  collectBoeTitulos,
  htmlToText,
  htmlToTextConAnclas,
  urlDelCandidato,
} from './boletines';

// Caso real que motivó el sensor `temario_change` (Cantabria, 08/07/2026):
// la Orden PRE/12/2026 modificó el programa de materias y ningún sensor lo cazó.
const CANTABRIA_PRE12 =
  'ORDEN PRE/12/2026, de 10 de febrero, por la que se modifica la Orden PRE/76/2024, de 29 de agosto, por la que se hacen públicos los programas exigibles en los procesos selectivos para el acceso a cuerpos, escalas y, en su caso, especialidades de la Administración de la Comunidad Autónoma de Cantabria.';

// Caso real que motivó el sensor (BOCYL 17/06/2026, BOCYL-D-17062026-115-10).
const ULE_ADMIN =
  'RESOLUCIÓN de 15 de junio de 2026, del Rectorado de la Universidad de León, por la que se convoca proceso selectivo para el ingreso, por el sistema general de acceso libre, en la Escala Administrativa de la Universidad de León.';

describe('looksLikeC1C2Convocatoria', () => {
  it('detecta la convocatoria de ingreso C1/C2 (caso ULE Escala Administrativa)', () => {
    expect(looksLikeC1C2Convocatoria(ULE_ADMIN)).toBe(true);
  });

  it('detecta una Escala Auxiliar de ingreso', () => {
    expect(
      looksLikeC1C2Convocatoria(
        'Resolución de la UNED por la que se convocan pruebas selectivas para ingreso en la Escala de Auxiliares Administrativos.',
      ),
    ).toBe(true);
  });

  it('detecta cuerpos NO administrativos C1/C2 (IIPP, Justicia, Hacienda)', () => {
    // Caso real Manuel 19/06/2026: el gate viejo exigía palabra "administrativa"
    // y dejaba ciego a IIPP/Justicia/Hacienda.
    expect(
      looksLikeC1C2Convocatoria(
        'Resolución por la que se convoca proceso selectivo para ingreso, por acceso libre, en el Cuerpo de Ayudantes de Instituciones Penitenciarias.',
      ),
    ).toBe(true);
    expect(
      looksLikeC1C2Convocatoria(
        'Orden por la que se convocan pruebas selectivas para ingreso en el Cuerpo de Tramitación Procesal y Administrativa.',
      ),
    ).toBe(true);
    expect(
      looksLikeC1C2Convocatoria(
        'Resolución por la que se convoca oposición para ingreso en el Cuerpo General de Agentes de la Hacienda Pública.',
      ),
    ).toBe(true);
  });

  it('descarta listas de resultados (relación de aspirantes que han superado)', () => {
    expect(
      looksLikeC1C2Convocatoria(
        'RESOLUCIÓN por la que se publica la relación de aspirantes que han superado el proceso selectivo de Auxiliar Administrativo.',
      ),
    ).toBe(false);
  });

  it('ADMITE cuerpos A1/A2 y docentes (Fase 0 "catalogar TODO", 04/07/2026)', () => {
    // Antes se descartaban por grupo; ahora se catalogan igual (misión: BD sin gaps).
    expect(
      looksLikeC1C2Convocatoria(
        'Resolución por la que se convoca proceso selectivo para ingreso en el Cuerpo de Catedráticos de Universidad.',
      ),
    ).toBe(true);
    expect(
      looksLikeC1C2Convocatoria(
        'Resolución por la que se convocan pruebas selectivas de Titulado Superior, subgrupo A1.',
      ),
    ).toBe(true);
  });

  it('detecta Agrupación Profesional / antiguo Grupo E (AP entra al radar, ampliación 02/07/2026)', () => {
    expect(
      looksLikeC1C2Convocatoria(
        'Orden por la que se convocan pruebas selectivas para ingreso en el Cuerpo de la Agrupación Profesional de Servicios Públicos de la Administración Pública Regional.',
      ),
    ).toBe(true);
  });

  it('descarta provisión por libre designación (no es ingreso)', () => {
    expect(
      looksLikeC1C2Convocatoria(
        'Resolución por la que se convoca la provisión de puesto de trabajo de Administrativo por el sistema de libre designación.',
      ),
    ).toBe(false);
  });

  it('descarta ruido no funcionarial (apartamentos de estudiantes, vías pecuarias)', () => {
    expect(
      looksLikeC1C2Convocatoria(
        'Resolución por la que se convoca concurso para la adjudicación de plazas en los apartamentos para estudiantes.',
      ),
    ).toBe(false);
    expect(
      looksLikeC1C2Convocatoria(
        'ORDEN por la que se aprueba la clasificación de las vías pecuarias del término municipal.',
      ),
    ).toBe(false);
  });
});

describe('extractCandidatesFromSumarioText', () => {
  it('separa disposiciones y deja las convocatorias de ingreso de cualquier grupo', () => {
    const sumario = [
      ULE_ADMIN,
      'RESOLUCIÓN por la que se publica la relación de aspirantes que han superado el proceso selectivo.',
      'ORDEN PRE/548/2026, de 10 de junio, por la que se convoca la constitución de la bolsa de empleo temporal del Cuerpo de Gestión Económico-Financiera.',
      'RESOLUCIÓN por la que se convoca proceso selectivo para ingreso en el Cuerpo de Catedráticos de Universidad.',
    ].join(' ');
    const hits = extractCandidatesFromSumarioText(sumario);
    expect(hits.some((h) => /Escala Administrativa de la Universidad de León/.test(h))).toBe(true);
    expect(hits.some((h) => /Cuerpo de Gestión Económico-Financiera/.test(h))).toBe(true);
    // Fase 0: los catedráticos (A1) AHORA entran; solo se descartan los hitos de resultado.
    expect(hits.some((h) => /aspirantes que han superado/.test(h))).toBe(false);
    expect(hits.some((h) => /Catedráticos/.test(h))).toBe(true);
  });
});

describe('looksLikeTemarioChange', () => {
  it('detecta la modificación de temario que se nos escapó (Cantabria PRE/12/2026)', () => {
    expect(looksLikeTemarioChange(CANTABRIA_PRE12)).toBe(true);
  });

  it('detecta la Orden que hace públicos los programas exigibles', () => {
    expect(
      looksLikeTemarioChange(
        'ORDEN PRE/76/2024, de 29 de agosto, por la que se hacen públicos los programas exigibles en los procesos selectivos.',
      ),
    ).toBe(true);
  });

  it('detecta actualización de temario/materias de un cuerpo', () => {
    expect(
      looksLikeTemarioChange(
        'Resolución por la que se actualiza el programa de materias del Cuerpo Auxiliar Administrativo.',
      ),
    ).toBe(true);
  });

  it('NO confunde una convocatoria de plazas con un cambio de temario', () => {
    // El sensor de convocatorias ya cubre esto; aquí NO debe dispararse.
    expect(looksLikeTemarioChange(ULE_ADMIN)).toBe(false);
  });

  it('descarta ruido (programas de ayudas/subvenciones, no temarios)', () => {
    expect(
      looksLikeTemarioChange(
        'ORDEN por la que se aprueba el programa de ayudas al desarrollo rural para 2026.',
      ),
    ).toBe(false);
  });
});

describe('extractTemarioCandidatesFromSumarioText', () => {
  it('extrae la Orden de temario y NO la convocatoria (sin cross-contamination)', () => {
    const sumario = [
      ULE_ADMIN,
      CANTABRIA_PRE12,
      'ORDEN por la que se aprueba el programa de ayudas al desarrollo rural.',
    ].join(' ');

    const temario = extractTemarioCandidatesFromSumarioText(sumario);
    expect(temario.some((h) => /PRE\/12\/2026/.test(h))).toBe(true);
    expect(temario.some((h) => /Escala Administrativa de la Universidad de León/.test(h))).toBe(false);
    expect(temario.some((h) => /ayudas al desarrollo rural/.test(h))).toBe(false);

    // Y el sensor de convocatorias NO debe capturar la Orden de temario.
    const convocatorias = extractCandidatesFromSumarioText(sumario);
    expect(convocatorias.some((h) => /PRE\/12\/2026/.test(h))).toBe(false);
    expect(convocatorias.some((h) => /Escala Administrativa/.test(h))).toBe(true);
  });
});

describe('collectBoeTitulos', () => {
  it('recoge recursivamente todos los campos titulo del JSON del sumario BOE', () => {
    const json = {
      data: {
        sumario: {
          diario: [
            {
              seccion: [
                {
                  nombre: 'II.B Oposiciones y concursos',
                  item: [{ titulo: ULE_ADMIN, url_pdf: '/x.pdf' }],
                },
              ],
            },
          ],
        },
      },
    };
    const titulos = collectBoeTitulos(json);
    expect(titulos).toContain(ULE_ADMIN);
  });
});

describe('htmlToText', () => {
  it('limpia tags y decodifica entidades acentuadas', () => {
    expect(htmlToText('<p>Resoluci&oacute;n de la <b>Administraci&oacute;n</b></p>')).toBe(
      'Resolución de la Administración',
    );
  });
});

// ============================================================
// [T-221] El enlace al ANUNCIO concreto — provenance de las señales
//
// Sin esto, la señal solo podía citar el SUMARIO DEL DÍA, que no sirve como prueba
// (clonar un sumario entero "respalda" cualquier cifra, antipatrón T-147(c)). Medido
// el 28/07: 133 señales aplicadas en 7 días y solo 19 con documento clonado (14%).
// ============================================================

// Fragmento REAL del sumario del BOCYL del 22/07/2026 (bocyl.jcyl.es/boletin.do?fechaBoletin=22/07/2026).
// Es la trampa del caso: los enlaces de la disposición ANTERIOR (140-6, una libre
// designación) van JUSTO ANTES del título de la convocatoria de la ULE (140-7), porque
// este boletín pone el título en un <p> y las descargas DESPUÉS. Adjudicar "la última
// marca vista" daría 140-6 → prueba falsa.
const BOCYL_SUMARIO_REAL = `
<p>ANUNCIO por el que se anuncia convocatoria pública para cubrir, mediante el sistema de libre designación, el puesto de trabajo que se cita.</p>
<ul class="descargaBoletin">
<li><a href='https://bocyl.jcyl.es/boletines/2026/07/22/pdf/BOCYL-D-22072026-140-6.pdf' title="Acceder a la disposición BOCYL-D-22072026-140-6.pdf"><img class="imagenEnlace" src="img/ico_pdf.jpg" alt="" /> BOCYL-D-22072026-140-6.pdf - 444 KB</a></li>
<!-- <li><a href='html/2026/07/22/html/BOCYL-D-22072026-140-6.do' title="comentado"><img src="img/ico_html.jpg" />HTML y otros formatos</a></li> -->
<li><a href='html/2026/07/22/html/BOCYL-D-22072026-140-6.do' title="Acceder a la disposición BOCYL-D-22072026-140-6.html"><img class="imagenEnlace" src="img/ico_html.jpg" alt="" />BOCYL-D-22072026-140-6.html y otros formatos</a></li>
</ul>
<h5 class="encabezado6">UNIVERSIDAD DE LEÓN</h5>
<p>RESOLUCIÓN de 17 de julio de 2026, del Rectorado de la Universidad de León, por la que se convoca proceso selectivo para el ingreso, por el sistema general de acceso libre, en la Escala de Ayudantes de Archivos, Bibliotecas y Museos de la Universidad de León.</p>
<ul class="descargaBoletin">
<li><a href='https://bocyl.jcyl.es/boletines/2026/07/22/pdf/BOCYL-D-22072026-140-7.pdf' title="Acceder a la disposición BOCYL-D-22072026-140-7.pdf"><img class="imagenEnlace" src="img/ico_pdf.jpg" alt="" /> BOCYL-D-22072026-140-7.pdf - 572 KB</a></li>
<li><a href='html/2026/07/22/html/BOCYL-D-22072026-140-7.do' title="Acceder a la disposición BOCYL-D-22072026-140-7.html"><img class="imagenEnlace" src="img/ico_html.jpg" alt="" />BOCYL-D-22072026-140-7.html y otros formatos</a></li>
</ul>`;

const BOCYL_URL = 'https://bocyl.jcyl.es/boletin.do?fechaBoletin=22/07/2026';

describe('[T-221] enlace al anuncio concreto', () => {
  it('BOCYL real: adjudica a la convocatoria SU documento (140-7), no el de la disposición anterior (140-6)', () => {
    const { texto, urls } = htmlToTextConAnclas(BOCYL_SUMARIO_REAL, BOCYL_URL);
    const candidatos = extractCandidatosFromSumarioText(texto, urls);

    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].titulo).toContain('Escala de Ayudantes de Archivos');
    // El fallo que este test existe para impedir: pegarle el documento del anterior.
    expect(candidatos[0].url).not.toContain('140-6');
    expect(candidatos[0].url).toContain('BOCYL-D-22072026-140-7');
  });

  it('BOCYL real: prefiere el HTML al PDF (el PDF no siempre trae la ficha de análisis — T-190)', () => {
    const { texto, urls } = htmlToTextConAnclas(BOCYL_SUMARIO_REAL, BOCYL_URL);
    const [c] = extractCandidatosFromSumarioText(texto, urls);
    expect(c.url).toBe('https://bocyl.jcyl.es/html/2026/07/22/html/BOCYL-D-22072026-140-7.do');
  });

  it('ignora los enlaces que viven dentro de comentarios HTML (el BOCYL duplica cada <li> comentado)', () => {
    const { urls } = htmlToTextConAnclas(BOCYL_SUMARIO_REAL, BOCYL_URL);
    expect(urls.filter((u) => u.includes('140-6.do'))).toHaveLength(1);
  });

  it('maquetación opuesta: si el ancla ENVUELVE el título, ese es su enlace', () => {
    const html = `<ul>
      <li><a href="/anuncios/2026/anterior.pdf">ORDEN de 1 de julio de 2026, de nombramiento.</a></li>
      <li><a href="/anuncios/2026/convocatoria-c2.pdf">RESOLUCIÓN de 2 de julio de 2026, por la que se convoca proceso selectivo para el ingreso en el Cuerpo Auxiliar.</a></li>
    </ul>`;
    const { texto, urls } = htmlToTextConAnclas(html, 'https://boletin.example.es/sumario');
    const candidatos = extractCandidatosFromSumarioText(texto, urls);
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].url).toBe('https://boletin.example.es/anuncios/2026/convocatoria-c2.pdf');
  });

  it('sin enlaces (sumario en PDF) devuelve url null: NUNCA se adivina una URL', () => {
    const texto =
      'RESOLUCIÓN de 2 de julio de 2026, por la que se convoca proceso selectivo para el ingreso en el Cuerpo Auxiliar.';
    const [c] = extractCandidatosFromSumarioText(texto);
    expect(c.url).toBeNull();
  });

  it('descarta hrefs que no son documentos (#, javascript:, mailto:)', () => {
    expect(absolutizarUrl('#seccion', BOCYL_URL)).toBeNull();
    expect(absolutizarUrl('javascript:void(0)', BOCYL_URL)).toBeNull();
    expect(absolutizarUrl('mailto:info@jcyl.es', BOCYL_URL)).toBeNull();
    expect(absolutizarUrl('/x.pdf', BOCYL_URL)).toBe('https://bocyl.jcyl.es/x.pdf');
  });

  it('decodifica &amp; del href: si no, el BOPA de Asturias da 200 con los parámetros ROTOS', () => {
    // Caso real (simulación 28/07): `…&amp;p_p_lifecycle=0` llegaba como `&amp;p_p_lifecycle`,
    // el servidor respondía 200 y servía OTRA página. Un 200 no prueba nada.
    const href =
      '/bopa/disposiciones?p_p_id=SedeBopaDispositionWeb&amp;p_p_lifecycle=0&amp;p_r_p_dispositionReference=2026-06220';
    const u = absolutizarUrl(href, 'https://miprincipado.asturias.es/');
    expect(u).not.toContain('amp;');
    expect(new URL(u!).searchParams.get('p_p_lifecycle')).toBe('0');
  });

  it('descarta la PORTADA del boletín (raíz o index.php sin query): es navegación, no un anuncio', () => {
    // Caso real (simulación 28/07): al DOE de Extremadura se le adjudicaba doe.juntaex.es/index.php.
    expect(absolutizarUrl('https://doe.juntaex.es/index.php', 'https://doe.juntaex.es/')).toBeNull();
    expect(absolutizarUrl('/', 'https://doe.juntaex.es/')).toBeNull();
    // …pero un index.php CON query sí identifica un documento.
    expect(absolutizarUrl('/index.php?id=2026061939', 'https://doe.juntaex.es/')).toBe(
      'https://doe.juntaex.es/index.php?id=2026061939',
    );
  });

  it('el título NO arrastra las marcas de ancla', () => {
    const { texto, urls } = htmlToTextConAnclas(BOCYL_SUMARIO_REAL, BOCYL_URL);
    const [c] = extractCandidatosFromSumarioText(texto, urls);
    expect(c.titulo).not.toMatch(/⟦/);
  });

  it('paridad: la variante de solo títulos sigue devolviendo lo mismo (una sola regla de troceo)', () => {
    const { texto, urls } = htmlToTextConAnclas(BOCYL_SUMARIO_REAL, BOCYL_URL);
    expect(extractCandidatesFromSumarioText(texto)).toEqual(
      extractCandidatosFromSumarioText(texto, urls).map((c) => c.titulo),
    );
  });

  describe('urlDelCandidato (casar la extracción del LLM con su candidato)', () => {
    // Candidatos REALES del BOCYL 22/07/2026 y del DOGV 21/07/2026.
    const CANDIDATOS = [
      {
        titulo:
          'RESOLUCIÓN de 17 de julio de 2026, del Rectorado de la Universidad de León, por la que se convoca proceso selectivo para el ingreso, por el sistema general de acceso libre, en la Escala de Ayudantes de Archivos, Bibliotecas y Museos de la Universidad de León.',
        url: 'https://bocyl.jcyl.es/html/2026/07/22/html/BOCYL-D-22072026-140-7.do',
      },
      {
        titulo:
          'RESOLUCIÓN de 16 de julio de 2026, por la que se convoca la creación, con carácter urgente, de una bolsa de empleo temporal de auxiliares de servicios.',
        url: 'https://dogv.gva.es/2026/07/21/pdf/2026_24586_es.pdf',
      },
    ];

    it('adjudica el documento del candidato correcto', () => {
      expect(
        urlDelCandidato('Escala de Ayudantes de Archivos, Bibliotecas y Museos', CANDIDATOS),
      ).toBe('https://bocyl.jcyl.es/html/2026/07/22/html/BOCYL-D-22072026-140-7.do');
    });

    it('NO adjudica si el parecido es flojo (nombre de otra convocatoria)', () => {
      expect(urlDelCandidato('Cuerpo de Gestión Procesal y Administrativa', CANDIDATOS)).toBeNull();
    });

    it('NO adjudica ante EMPATE: dos convocatorias del mismo cuerpo que solo cambian de turno', () => {
      // Caso real del DOGV 21/07/2026: dos bolsas idénticas salvo el número de expediente.
      const empate = [
        {
          titulo:
            'RESOLUCIÓN de 16 de julio de 2026, por la que se convoca la creación, con carácter urgente, de una bolsa de empleo temporal de auxiliares de servicios.',
          url: 'https://dogv.gva.es/2026/07/21/pdf/2026_24586_es.pdf',
        },
        {
          titulo:
            'RESOLUCIÓN de 16 de julio de 2026, por la que se convoca la creación, con carácter urgente, de una bolsa de empleo temporal de auxiliares de servicios.',
          url: 'https://dogv.gva.es/2026/07/21/pdf/2026_24589_es.pdf',
        },
      ];
      expect(urlDelCandidato('bolsa de empleo temporal de auxiliares de servicios', empate)).toBeNull();
    });

    it('devuelve null si el candidato casado no tiene documento (sumario en PDF)', () => {
      expect(
        urlDelCandidato('Escala de Ayudantes de Archivos, Bibliotecas y Museos', [
          { titulo: CANDIDATOS[0].titulo, url: null },
        ]),
      ).toBeNull();
    });
  });

  it('BOE: coge el enlace del ITEM (y prefiere url_html al PDF, T-190)', () => {
    const json = {
      data: {
        sumario: {
          diario: [
            {
              sumario_diario: { url_pdf: { texto: 'https://www.boe.es/…/BOE-S-2026-177.pdf' } },
              seccion: [
                {
                  item: [
                    {
                      titulo: ULE_ADMIN,
                      url_pdf: { texto: 'https://www.boe.es/boe/dias/2026/07/22/pdfs/BOE-A-2026-1.pdf' },
                      url_html: { texto: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-1' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    };
    const entradas = collectBoeEntradas(json).filter((e) => e.titulo === ULE_ADMIN);
    expect(entradas).toHaveLength(1);
    expect(entradas[0].url).toBe('https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-1');
  });
});
