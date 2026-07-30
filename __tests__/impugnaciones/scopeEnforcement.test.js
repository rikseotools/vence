// __tests__/impugnaciones/scopeEnforcement.test.js
//
// Detección pura del enforcement de scope/epígrafe (Regla previa OBLIGATORIA) usado por
// los dossiers de impugnaciones y feedback. Solo la parte SIN BD (isScopeComplaint); la
// query de estado Paso 1/Paso 2 necesita RDS y no se testea aquí.

const { isScopeComplaint } = require('../../scripts/impugnaciones/lib/scope-enforcement.cjs');

describe('isScopeComplaint — dispara en quejas de temario/epígrafe/scope', () => {
  test('caso Sara (art no entra en la 1ª parte / temario)', () => {
    expect(isScopeComplaint('Creo que este artículo no entra en la 1ª parte de la Ley de Contratos del Sector Público que se exige en el temario de Auxiliar Administrativo')).toBe(true);
  });

  test('caso Mario (¿entra el art X del Tema 8?)', () => {
    expect(isScopeComplaint('tengo mas dudas de si entra el art. 16 y art. 18 del Tema 8: Prevención de Riesgos Laborales')).toBe(true);
  });

  test('variantes de queja de scope', () => {
    const positivos = [
      'este artículo es de otro tema',
      'esta pregunta no corresponde a este tema',
      'falta el artículo X en el temario',
      'este artículo no aparece en mi epígrafe',
      'creo que no debería estar en este tema',
      'esto es de otro bloque',
      'no figura en el programa',
    ];
    positivos.forEach((t) => expect(isScopeComplaint(t)).toBe(true));
  });

  test('con acentos y mayúsculas (normalización)', () => {
    expect(isScopeComplaint('El EPÍGRAFE no incluye este artículo')).toBe(true);
    expect(isScopeComplaint('No ENTRA en la primera parte')).toBe(true);
  });
});

describe('isScopeComplaint — NO dispara en quejas ajenas al scope', () => {
  test('bug de UI (MariSol)', () => {
    expect(isScopeComplaint('Aparece un check verde de más. Sale el correcto y seguidamente sale otro que pone justo ahora')).toBe(false);
  });

  test('facturación / premium', () => {
    expect(isScopeComplaint('no puedo descargar temas, me dice que me haga premium cuando ya lo hice')).toBe(false);
  });

  test('duda de respuesta (clave), no de scope', () => {
    expect(isScopeComplaint('la respuesta correcta debería ser la B según el artículo')).toBe(false);
  });

  test('texto vacío / nulo', () => {
    expect(isScopeComplaint('')).toBe(false);
    expect(isScopeComplaint(null)).toBe(false);
    expect(isScopeComplaint(undefined)).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────
// ESTRUCTURA vs SCOPE (T-223, 28/07/2026)
//
// Añadido tras responder MAL a la usuaria Luisa: dijo que del Decreto 53/1989 (T9 de
// `auxiliar_administrativo_sms`) solo entraban unos artículos, se le contestó que entraba
// entero razonando sobre la PROSA del epígrafe, y su rango eran exactamente los Capítulos
// que el epígrafe nombra por su RÚBRICA. Estas partes son puras: el bloque que se imprime
// se construye a partir de datos, así que se puede fijar sin BD.
// ───────────────────────────────────────────────────────────────────────────────────────

const {
  extraerReferenciasNorma,
  formatEstructuraVsScope,
  enSeccion,
} = require('../../scripts/impugnaciones/lib/scope-enforcement.cjs');

describe('extraerReferenciasNorma — qué norma está citando el usuario', () => {
  test('caso Luisa, tal como lo escribió', () => {
    expect(extraerReferenciasNorma('del tema 9, el decreto 53/1989, de 1 de junio, en mi opinion, entran solo los articulos del 5 al 25 incluidos'))
      .toEqual(['53/1989']);
  });

  test('varias normas en un mismo mensaje, sin repetir', () => {
    const r = extraerReferenciasNorma('la Ley 39/2015 y la Ley 40/2015, y otra vez la 39/2015');
    expect(r.sort()).toEqual(['39/2015', '40/2015']);
  });

  test('año de dos cifras, que es como lo escribe la gente', () => {
    expect(extraerReferenciasNorma('el decreto 53/89')).toEqual(['53/1989']);
    expect(extraerReferenciasNorma('el RD 5/15')).toEqual(['5/2015']);
  });

  test('normaliza el cero a la izquierda para casar con la BD', () => {
    expect(extraerReferenciasNorma('Ley 07/2007')).toEqual(['7/2007']);
  });

  test('no confunde con fracciones ni fechas: un año imposible no es una norma', () => {
    expect(extraerReferenciasNorma('acerté 3/10 preguntas')).toEqual([]);
    expect(extraerReferenciasNorma('el día 5/12 hice el test')).toEqual([]);
  });

  test('texto sin normas', () => {
    expect(extraerReferenciasNorma('no me carga la página')).toEqual([]);
    expect(extraerReferenciasNorma(null)).toEqual([]);
  });
});

describe('enSeccion — a qué capítulo pertenece un artículo', () => {
  const cap = { article_range_start: 5, article_range_end: 8 };
  test('incluye los extremos', () => {
    expect(enSeccion(cap, 5)).toBe(true);
    expect(enSeccion(cap, 8)).toBe(true);
  });
  test('excluye lo de fuera, incluido el off-by-one', () => {
    expect(enSeccion(cap, 4)).toBe(false);
    expect(enSeccion(cap, 9)).toBe(false);
  });
  test('un artículo no numérico no cae en ningún sitio', () => {
    expect(enSeccion(cap, NaN)).toBe(false);
  });
});

describe('formatEstructuraVsScope — el dato que faltaba en pantalla', () => {
  // La estructura REAL del Decreto 53/1989 según el BORM (verificada el 28/07 contra el
  // PDF oficial). Es el caso que motivó todo esto.
  const BORM_53_1989 = [
    { section_type: 'capitulo', section_number: 'I',   title: 'Disposiciones generales',          article_range_start: 1,  article_range_end: 4,  order_position: 1 },
    { section_type: 'capitulo', section_number: 'II',  title: 'Funciones del EAP',                article_range_start: 5,  article_range_end: 8,  order_position: 2 },
    { section_type: 'capitulo', section_number: 'III', title: 'Organización',                     article_range_start: 9,  article_range_end: 25, order_position: 3 },
    { section_type: 'capitulo', section_number: 'IV',  title: 'Reglamento de Régimen Interior',   article_range_start: 26, article_range_end: 27, order_position: 4 },
    { section_type: 'capitulo', section_number: 'V',   title: 'Régimen de personal',              article_range_start: 28, article_range_end: 28, order_position: 5 },
    { section_type: 'capitulo', section_number: 'VI',  title: 'Régimen de Usuarios',              article_range_start: 29, article_range_end: 31, order_position: 6 },
    { section_type: 'capitulo', section_number: 'VII', title: 'Órganos de participación',         article_range_start: 32, article_range_end: 32, order_position: 7 },
  ];
  const arts = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));

  test('con el scope VIEJO (la ley entera) se ve que 4 capítulos sobran', () => {
    const out = formatEstructuraVsScope({
      ley: 'Decreto 53/1989 EAP Murcia', tema: 9, scope: arts(1, 32), secciones: BORM_53_1989,
      epigrafe: 'El Decreto 53/1989: funciones y organización del EAP.',
    });
    // Los capítulos que el epígrafe NO nombra aparecen cubiertos al 100%: eso es la
    // sobre-inclusión, y ahora se LEE en vez de deducirse.
    expect(out).toContain('Reglamento de Régimen Interior');
    expect(out).toContain('Órganos de participación');
    expect(out).not.toContain('FUERA del scope');
    // Y el epígrafe se imprime al lado para poder casar rúbricas.
    expect(out).toContain('funciones y organización del EAP');
  });

  test('con el scope CORREGIDO (1-25) marca como FUERA justo los Caps. IV-VII', () => {
    const out = formatEstructuraVsScope({
      ley: 'Decreto 53/1989 EAP Murcia', tema: 9, scope: arts(1, 25), secciones: BORM_53_1989,
    });
    const fuera = out.match(/bloques hoy fuera del scope: (.+)/)[1];
    expect(fuera).toContain('capitulo IV');
    expect(fuera).toContain('capitulo V');
    expect(fuera).toContain('capitulo VI');
    expect(fuera).toContain('capitulo VII');
    expect(fuera).not.toContain('capitulo II');
    expect(fuera).not.toContain('capitulo III');
  });

  test('marca PARCIAL cuando un capítulo entra a medias', () => {
    const out = formatEstructuraVsScope({
      ley: 'X', tema: 1, scope: arts(1, 6), secciones: BORM_53_1989,
    });
    expect(out).toContain('PARCIAL');   // Cap. II: entran 5 y 6 de 5-8
  });

  test('la ley ENTERA (article_numbers NULL) se dice con esas palabras', () => {
    const out = formatEstructuraVsScope({ ley: 'X', tema: 1, scope: null, secciones: BORM_53_1989 });
    expect(out).toContain('LEY ENTERA');
    expect(out).not.toContain('FUERA del scope');  // NULL = todo dentro, no todo fuera
  });

  test('SIN estructura en BD lo grita, que es el caso peligroso', () => {
    // Es exactamente lo que pasaba con este decreto: `law_sections` vacío. Si el bloque
    // se omitiera en silencio, quien resuelve volvería a razonar sobre la prosa.
    const out = formatEstructuraVsScope({ ley: 'Decreto 53/1989', tema: 9, scope: arts(1, 32), secciones: [] });
    expect(out).toContain('SIN ESTRUCTURA EN BD');
    expect(out).toContain('T-140');
    expect(out).toMatch(/NO deduzcas los cap[ií]tulos de la prosa/);
  });
});

// ── Semáforo: CERO temas no es «todo en orden» (bug cazado el 28/07) ──────────────────
//
// Las dos consultas de estado agrupan por `topics` de esa oposición. Si la oposición no tiene
// NINGÚN tema activo devuelven cero filas, y el recuento de "pendientes" daba 0 en ambas → el
// semáforo caía en el `else` y pintaba 🟢 «Paso 1 y Paso 2 en orden». Justo al revés: no hay
// temario contra el que comprobar nada. Pasó resolviendo la impugnación `1c71e908` (oposición
// `administrativo_de_administracion_general_administracion_local`, 0 temas y 0 topic_scope).
//
// Se prueba con un cliente falso, sin BD, igual que el resto del fichero.
const { scopeEnforcement } = require('../../scripts/impugnaciones/lib/scope-enforcement.cjs');

const clienteQueNoDevuelveNada = { unsafe: async () => [] };

describe('scopeEnforcement — el semáforo no aprueba por ausencia de datos', () => {
  test('oposición SIN temario: avisa en rojo y NO da luz verde', async () => {
    const out = await scopeEnforcement(clienteQueNoDevuelveNada, {
      text: 'esta pregunta es de otro tema',
      oposicion: 'oposicion_catalogada_pero_vacia',
    });
    expect(out).toContain('🛑');
    expect(out).toContain('NO TIENE TEMARIO');
    expect(out).not.toContain('🟢');
  });

  test('explica que entonces la queja no puede ser de scope', async () => {
    const out = await scopeEnforcement(clienteQueNoDevuelveNada, {
      text: 'no entra en el temario',
      oposicion: 'oposicion_catalogada_pero_vacia',
    });
    expect(out).toMatch(/no hay temas donde estarlo/i);
    expect(out).toMatch(/target_oposicion/);
  });

  test('sin disparo (queja ajena al scope) sigue sin imprimir nada', async () => {
    const out = await scopeEnforcement(clienteQueNoDevuelveNada, {
      text: 'la app se cierra al abrir el test',
      oposicion: 'oposicion_catalogada_pero_vacia',
    });
    expect(out).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VERSIÓN DE SOFTWARE (30/07/2026)
//
// Una usuaria escribió: «¿Vais a actualizar la parte de informática a Windows 11 en las
// oposiciones de Auxiliar Administrativo para la CAM? Solo está Windows 10». Es una pregunta
// de TEMARIO con todas las letras, pero el disparador de scope no la tocaba: no dice
// «temario» ni «no entra». Resultado: se investigó por libre sin abrir el runbook de
// epígrafes, que tiene la respuesta escrita en su §5-bis desde hace semanas.
//
// Y es de las caras de equivocarse. La versión SOLO la fijan la nota del órgano de selección
// o la convocatoria, y **la nota puede publicarse DESPUÉS**, así que muchas veces la
// respuesta correcta es «está sin fijar, lo vigilamos», no una versión concreta.
// ─────────────────────────────────────────────────────────────────────────────
describe('scopeEnforcement — preguntas de versión de software', () => {
  const sinCliente = null;

  test('salta con el mensaje REAL de la usuaria', async () => {
    const out = await scopeEnforcement(sinCliente, {
      text: 'Hola. Vais a actualizar la parte de informatica a Windows 11 en las oposiciones de Auxiliar Administrativo para la CAM? Solo está Windows 10. Gracias.',
      oposicion: null,
    });
    expect(out).toMatch(/VERSI[ÓO]N DE SOFTWARE/);
  });

  test('dice las dos únicas fuentes válidas y que NO se deduce', async () => {
    const out = await scopeEnforcement(sinCliente, { text: '¿que version de Word entra?', oposicion: null });
    expect(out).toMatch(/NO SE DEDUCE/);
    expect(out).toMatch(/NOTA del órgano de selección/);
    expect(out).toMatch(/convocatoria/);
  });

  test('avisa de que NO existe el criterio de «la más moderna»', async () => {
    // Es el escalón que se borró: invitaba a contarle a un usuario como oficial una versión
    // que nadie ha publicado.
    const out = await scopeEnforcement(sinCliente, { text: 'seguis con office 2010?', oposicion: null });
    expect(out).toMatch(/más moderna/);
    expect(out).toMatch(/nadie ha publicado/);
  });

  test('avisa de que la nota puede llegar DESPUÉS de la convocatoria', async () => {
    const out = await scopeEnforcement(sinCliente, { text: 'que version de windows entra?', oposicion: null });
    expect(out).toMatch(/DESPU[ÉE]S de la convocatoria/);
    expect(out).toMatch(/vigilar/i);
  });

  test('recuerda que puede haber dos convocatorias vivas con versión distinta', async () => {
    const out = await scopeEnforcement(sinCliente, { text: 'windows 11 o windows 10?', oposicion: null });
    expect(out).toMatch(/DOS convocatorias/i);
  });

  test('un mensaje ajeno a versiones no dispara este aviso', async () => {
    expect(await scopeEnforcement(sinCliente, { text: 'la pregunta 4 tiene mal la respuesta', oposicion: null })).toBe('');
    expect(await scopeEnforcement(sinCliente, { text: 'no puedo pagar', oposicion: null })).toBe('');
  });

  test('«ventanas» o «palabra» sueltas no lo confunden', async () => {
    expect(await scopeEnforcement(sinCliente, { text: 'no veo la ventana de resultados', oposicion: null })).toBe('');
  });
});
