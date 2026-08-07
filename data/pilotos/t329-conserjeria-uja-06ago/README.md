# T-329 — Técnico/a Auxiliar de Conserjería UJA, continuación (06/08/2026, w2)

Contribución PARCIAL, continuando el trabajo de la sesión del 31/07 (que dejó el spec con
los 14 epígrafes literales del Anexo II del BOE, pero cuyo Tema 1 extraído — "listo para
insertar" según la ficha — vivía solo en un `scratchpad` de worktree, que no sobrevive
entre sesiones: confirmado que no existe ya en ningún sitio del árbol antes de rehacerlo).

## 1. `scope` de los 4 temas ya cubiertos por leyes existentes (spec.json)

Añadido al spec (`data/temarios/tecnico-auxiliar-conserjeria-universidad-jaen.json`) el
bloque `scope` para los temas 103 (LOSU, ley completa), 104 (RDL 5/2015), 105 (LPRL) y 106
(LO 3/2007), con los recortes exactos que el propio spec ya describía en prosa
(`_fuentes_por_tema`) pero que no estaban traducidos a `article_numbers`.

**Cada rango de artículos se verificó por DOS caminos independientes, no solo por título de
artículo:**
- **RDL 5/2015 (EBEP):** Título IV=55-68 y Título VII=93-98 confirmados por el CONTENIDO
  real de los artículos ya en BD (leído uno a uno). Una primera búsqueda externa (WebFetch)
  dio un resultado **FALSO** (Título VI=85-92 "responsabilidad disciplinaria" / Título
  VII=93-98 "régimen de incompatibilidades") que el contenido real desmiente sin
  ambigüedad: los arts. 93-98 son literalmente "Responsabilidad disciplinaria",
  "Potestad disciplinaria", "Faltas", "Sanciones", "Procedimiento disciplinario" — régimen
  disciplinario, no incompatibilidades. Una segunda búsqueda coincidió con el contenido.
  Título II Cap.I = 8-12 (art.13 "Personal directivo" es Cap.II, verificado y EXCLUIDO).
- **LPRL:** Cap.III (14-29) coincide EXACTO con un `topic_scope` YA VIVO en producción de
  otra oposición — confirmación cruzada contra un scope ya en uso, no solo inferencia.
  Cap.IV (30-32) y V (33-40) confirmados por fuente externa Y por el contenido real.
- **LO 3/2007:** Título V Caps. I-III = 51-64, verificado por fuente externa (con
  reintento: la primera búsqueda dio un límite ambiguo "51-68"; una fuente dedicada al
  Título V confirmó que los arts. 65-68 son Cap. IV "Fuerzas Armadas" y Cap. V "Fuerzas y
  Cuerpos de Seguridad" — capítulos que el epígrafe del spec NO pide, EXCLUIDOS a propósito).

**Los 76 artículos de las 4 leyes se comprobaron uno a uno contra `articles` en BD**
(existencia + `is_active`): **0 faltantes**. Ver el detalle del scope en el propio
`spec.json` (campo `_recorte` de cada entrada).

## 2. Tema 1 (IV Convenio Colectivo) — extraído, verificado y CON UN FALLO CORREGIDO

`convenio-colectivo-articulos.json`: **71 artículos, 110.770 caracteres, sin huecos ni
duplicados** (verificado programáticamente: cada artículo contiene EXACTAMENTE una vez su
propio encabezado y ninguno del vecino).

**Fuente:** PDF oficial mirror de la propia UJA
(`https://www.ujaen.es/representacion/ccoo/sites/representacion_ccoo/files/uploads/documentos/normativa/IV_CONVENIO_definitivo.pdf`),
NO el HTML de la Junta de Andalucía que proponía el spec original (`_fuentes_por_tema.101`).

**⚠️ Hallazgo, no supuesto — MEDIDO comparando las dos fuentes:** el HTML de
`juntadeandalucia.es/boja/2004/36/14` (la fuente que la sesión anterior había extraído y
que la ficha daba por "verificado, listo para insertar", con el mismo recuento — 71
artículos, 113.490 caracteres) tiene el **artículo 33 (Permisos, licencias...) TRUNCADO**:
un widget "Descargar PDF" que la página inyecta en mitad del flujo del documento corta el
texto justo donde dice *"Se entiende por deber de carácter inexcusable y personal:"* — sin
ningún aviso de que falta contenido, el texto simplemente termina en dos puntos. El PDF de
la propia UJA SÍ trae la enumeración completa que sigue (asistencia a tribunales, a Plenos,
deberes ciudadanos, traslado de domicilio, exámenes, asuntos particulares...). **La sesión
anterior (y mi primer intento, antes de comparar las dos fuentes) habría insertado un
artículo legal INCOMPLETO** sin saberlo — el HTML no da ningún error, el corte es silencioso.
Con el PDF completo, el artículo 33 pasa a ser **el más largo de los 71** (10.558
caracteres) cuando en la versión truncada del HTML no llegaba a competir con el 66
(Acción Social, 9.736) — el cambio de "cuál es el artículo más largo" entre las dos
fuentes es justo la clase de contraste que debería hacer sospechar de un corte silencioso.

**Gotchas del troceo (documentados en `extraer-convenio.py`, con test de reproducibilidad
verificado — el script guardado reproduce BYTE A BYTE el JSON guardado):**
1. Encabezado exige "Artículo" con A mayúscula (evita casar referencias internas tipo
   "conforme al artículo 5").
2. El PDF usa `"Artículo N.-"` (guion), no `"Artículo N. "` (espacio) como el HTML — hay que
   soportar los dos formatos si se reutiliza el patrón con otra fuente.
3. Sin cortar en frontera de ANEXO/Disposición, el artículo 71 (el último, cajón por
   definición) se traga los 4 anexos completos (~45.000 caracteres de más).
4. El corte de ANEXO/Disposición tiene que ser **case-sensitive** ("ANEXO I" encabezado vs
   "anexo I" referencia interna dentro del propio artículo 71 — con el patrón
   case-insensitive, el 71 se cortaba 1.300 caracteres antes de tiempo, a media frase).

## No aplicado

Sin `DATABASE_URL` de escritura (la mía es `vence_coordinacion`, sin acceso a `laws`,
`articles`, `topics`, `topic_scope`) no se puede ni siquiera correr
`create-oposicion.cjs --dry-run` (usa transacción + ROLLBACK, pero eso sigue exigiendo
privilegio de escritura sobre la conexión — no se ha intentado con una credencial que no
me corresponde).

## Lo que NO se ha hecho (alcance real)

- **Tema 2 (Estatutos UJA, Decreto 230/2003):** PDF ya localizado en el spec, sin extraer.
- **Los 8 contenedores documentales (temas 107-110, 112-114):** siguen con "URL pendiente
  de localizar" en `_fuentes_por_tema` — necesitan investigación en ujaen.es antes de poder
  extraer nada.
- **Insertar el Convenio como ley real en BD**, correr el scaffolder, y generar/auditar
  preguntas para los 10 temas nuevos — el grueso del trabajo, ninguno posible sin
  escritura.

## Cómo continuar

1. Alguien con escritura importa el Convenio (`convenio-colectivo-articulos.json`, 71
   artículos) como ley real, verbatim, con doble auditoría (el manual de leyes lo exige
   siempre, aunque esta extracción ya esté verificada por dos fuentes).
2. Completar Tema 2 con el mismo método (cuidado: el PDF de Estatutos puede tener sus
   propios gotchas — verificar de nuevo, no asumir que este método es universal).
3. Localizar las URLs de los 8 documentos UJA pendientes.
4. `node scripts/create-oposicion.cjs data/temarios/tecnico-auxiliar-conserjeria-universidad-jaen.json --dry-run`
   y seguir el resto del manual (`docs/maintenance/crear-nueva-oposicion.md`).
5. Avisar a Chari (hilo `7a81b194`) cuando esté — **vía `borrador --para`, nunca directo.**
