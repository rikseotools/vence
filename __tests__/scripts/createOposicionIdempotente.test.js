/**
 * El scaffolder de oposiciones tiene que poder correrse DOS VECES.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────────────────
 *
 * Su cabecera dice «determinista, transaccional e idempotente» desde el primer día, pero el camino
 * `--completar` —el que el manual ofrece para implementar una oposición ASPIRACIONAL, o sea el que
 * se usa cuando la fila ya existe— no se había ejecutado nunca dos veces. Al hacerlo (03/08/2026,
 * Aux. Enfermería Geriatría de Cádiz) aparecieron SEIS escrituras no idempotentes, una detrás de
 * otra, cada una descubierta solo al arreglar la anterior:
 *
 *   1. `oposicion_bloques` → duplicate key (unique position_type+bloque_number)
 *   2. `topics`            → duplicate key (unique position_type+topic_number)
 *   3. `convocatorias`     → duplicate key (índice parcial ref_oficial_unica)
 *   4. `temario_versions`  → duplicate key (índice parcial ux_temario_version_default)
 *   5. `convocatoria_hitos`→ **NO reventaba: DUPLICABA el timeline en silencio** (3 → 6 hitos)
 *   6. `topic_scope`       → **NO reventaba: TRIPLICABA el scope en silencio** (37 → 111 filas)
 *
 * Las cuatro primeras son ruidosas y se ven enseguida. **Las dos últimas son las peligrosas**: no
 * fallan, y lo que duplican se PUBLICA — un timeline con cada hito repetido y un scope inflado. Se
 * cazaron porque `audit:oposicion` cantó «6 hitos» donde el spec define 3.
 *
 * Estos tests son un TRINQUETE sobre el código: no prueban la BD (eso lo hace el gate
 * `audit:oposicion`), prueban que ninguna de las seis escrituras vuelve a ser un INSERT pelado.
 *
 * Y el séptimo defecto, ese sí de lógica pura, tiene su bloque aparte abajo: el straggler check.
 */
const fs = require('fs');
const path = require('path');
const { hayRecuentoAjeno, STRAGGLER_TEXTO } = require('../../scripts/create-oposicion.cjs');

const SRC = fs.readFileSync(path.join(__dirname, '../../scripts/create-oposicion.cjs'), 'utf8');

describe('create-oposicion — las seis escrituras son re-ejecutables', () => {
  // Cada entrada: la tabla y el trozo de SQL/JS que demuestra que no es un insert pelado.
  const ESCRITURAS = [
    ['oposicion_bloques', /on conflict \(position_type, bloque_number\) do update/],
    ['topics', /on conflict \(position_type, topic_number\) do update/],
    ['convocatorias', /on conflict \(oposicion_id, convocatoria_numero\)/],
    ['temario_versions', /select id from temario_versions where oposicion_id=\$1 and es_default/],
    ['convocatoria_hitos', /select id from convocatoria_hitos where convocatoria_id=\$1 and fecha=\$2 and titulo=\$3/],
    ['topic_scope', /select id from topic_scope where topic_id=\$1 and law_id=\$2/],
  ];

  it.each(ESCRITURAS)('%s no se escribe con un INSERT pelado', (_tabla, patron) => {
    expect(SRC).toMatch(patron);
  });

  it('topic_scope NO se apoya en un `on conflict do nothing` sin índice único', () => {
    // La versión anterior lo tenía y no hacía NADA: sin índice único no hay conflicto que capturar,
    // así que cada pasada añadía otras 37 filas. Es el fallo más silencioso de los seis.
    expect(SRC).not.toMatch(/insert into topic_scope[^;]*on conflict do nothing/);
  });

  it('`disponible` NO se pisa al re-ejecutar (lo decide la FASE 3, no el scaffolder)', () => {
    // Si el upsert de topics actualizara `disponible`, re-correr el scaffolder le apagaría los tests
    // a una oposición que ya está sirviendo.
    const upsertTopics = SRC.match(/on conflict \(position_type, topic_number\) do update set [^']*/)[0];
    expect(upsertTopics).not.toMatch(/disponible/);
  });
});

describe('create-oposicion — conexión a RDS', () => {
  it('usa pgConfig y no arma `{connectionString, ssl}` a mano', () => {
    // El `sslmode=require` de la URL PISA la opción `ssl`, así que la receta a mano muere con
    // "self-signed certificate in certificate chain". El scaffolder la tenía y no conectaba.
    expect(SRC).toMatch(/require\('\.\.\/lib\/db\/pgSsl\.cjs'\)/);
    expect(SRC).not.toMatch(/connectionString:\s*process\.env\.DATABASE_URL,\s*ssl:/);
  });
});

describe('hayRecuentoAjeno — el straggler check no puede prohibir un número CIERTO', () => {
  it('NO marca «25 temas» cuando la oposición tiene 25 (el falso positivo que lo motiva)', () => {
    expect(hayRecuentoAjeno('Temario completo. 25 temas oficiales organizados en 2 partes.', 25)).toBe(false);
  });

  it('SÍ marca «25 temas» cuando la oposición tiene 20 (residuo real de la plantilla)', () => {
    expect(hayRecuentoAjeno('Temario completo. 25 temas oficiales organizados en 2 partes.', 20)).toBe(true);
  });

  it('marca si CUALQUIERA de los recuentos del texto no cuadra, no solo el primero', () => {
    // Las descripciones SEO repiten el número en varios sitios; sustituir uno y olvidar otro es
    // justo el error que esto tiene que ver.
    expect(hayRecuentoAjeno('20 temas oficiales. Prepara los 25 temas del programa.', 20)).toBe(true);
  });

  it('un texto sin recuentos no dispara', () => {
    expect(hayRecuentoAjeno('Prepara tu oposición con tests por tema.', 25)).toBe(false);
  });

  it('no confunde otros números con el recuento de temas', () => {
    expect(hayRecuentoAjeno('31 plazas y 100 preguntas tipo test. 25 temas.', 25)).toBe(false);
  });
});

describe('STRAGGLER_TEXTO — solo texto, nunca números', () => {
  it('caza los literales de la plantilla', () => {
    expect(STRAGGLER_TEXTO.test('Escala Administrativa de la Universidad de León')).toBe(true);
    expect(STRAGGLER_TEXTO.test('publicado en el BOCYL')).toBe(true);
  });

  it('caza la enumeración de bloques de León, que era el residuo REAL que se colaba', () => {
    // Una oposición de cuidados llegó a anunciar esto en su meta description mientras el guard
    // abortaba por «25 temas», que era correcto.
    expect(STRAGGLER_TEXTO.test('Gestión financiera, Gestión académica e Informática')).toBe(true);
  });

  it('NO contiene ningún recuento de temas (eso es trabajo de hayRecuentoAjeno)', () => {
    expect(STRAGGLER_TEXTO.source).not.toMatch(/\d+ temas/);
  });
});
