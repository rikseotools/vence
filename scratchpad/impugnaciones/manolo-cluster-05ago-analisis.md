# Cluster de 4 impugnaciones de Manolo García (2eebe749-…) — 05/08/2026, w2

Mismo usuario que `f34b88ad` (ver `f34b88ad-analisis.md`), premium, Diputación de Córdoba
(`auxiliar_administrativo_diputacion_cordoba`). Cuatro impugnaciones nuevas, `pending`, seguidas en
**4 minutos** (10:30:56 → 10:34:31 UTC de hoy), todas con la MISMA queja en distinta redacción:

| id | question_id | descripción |
|---|---|---|
| `ea65996b-5a29-4aa0-ae17-272affe9da5b` | `84957d1a…` (CE art. 110) | "Este artículo no entra en el Temario" |
| `4ac133b7-8814-47c4-9596-6263cb6b29b0` | `c2641428…` (CE art. 112) | "Este artículo no entra en el Temario" |
| `066a3d65-42ed-4c49-8e27-1ec68a07dbb6` | `f7c4ed67…` (CE art. 108) | "Este artículo no entra en el Temario" |
| `21be6a56-a273-435d-9945-d1145f08a9b0` | `bdcbad67…` (CE art. 114) | "Esta pregunta no entra en el Temario" |

Nota: `dispute_type='otro'` en las 4 (texto libre, no hay ningún desplegable con esta frase en el
código — lo escribió él).

## 1. Verificación de cada una — TODAS están en su temario

Las 4 preguntas cuelgan de artículos de la **CE** (108, 110, 112, 114 — todos del bloque "relaciones
Gobierno-Cortes / cuestión de confianza / moción de censura"). Comprobé el `topic_scope` de
**su oposición** (`auxiliar_administrativo_diputacion_cordoba`) para la ley CE:

```
Tema 2 "Las Cortes Generales, el Gobierno, el Poder Judicial y las leyes"
article_numbers incluye: 66..127 (rango completo) → incluye 108, 110, 112 y 114
```

Y comprobado en el **HTML servido**, no solo en BD (`WebFetch` a
`https://www.vence.es/auxiliar-administrativo-diputacion-cordoba/temario/tema-2`): la página
enseña el Tema 2 con los 62 artículos, y **cita literalmente** los 4 artículos en disputa (108, 110,
112, 114) con su contenido correcto sobre cuestión de confianza / moción de censura / responsabilidad
política.

Contenido y clave de las 3 que no había mirado en el dossier automático (la de `ea65996b`/art.110 ya
la revisé en el dossier — clave D "Todas son correctas", correcta):

| Pregunta | Clave | Verificado contra CE |
|---|---|---|
| art. 112 (cuestión de confianza) | C) Presidente del Gobierno, previa deliberación del Consejo de Ministros | ✅ literal del art. 112 CE |
| art. 108 (responsabilidad política) | A) Ante el Congreso de los Diputados | ✅ literal del art. 108 CE |
| art. 114.2 (moción de censura constructiva) | A) dimisión al Rey + candidato investido + Rey nombra | ✅ literal del art. 114.2 CE, explicación didáctica y correcta |

**Ninguna de las 4 tiene defecto de contenido, clave o vinculación.** Los cuatro artículos
pertenecen, sin ambigüedad, al Tema 2 de su temario.

## 2. ¿Por qué las impugna entonces? — hipótesis a verificar por quien tenga acceso a `user_profiles`

No es un patrón amplio: busqué `description ILIKE '%no entra en el Temario%'` en TODAS las
impugnaciones (histórico completo) y solo hay **4 usuarios** con esa queja alguna vez, 3 de ellos con
1 sola vez en meses — **Manolo es el único con un ráfaga de 4 en 4 minutos**. No es un problema de
datos ni de UX generalizado: es específico de él, hoy.

**Coincidencia que merece mirarse:** esta misma rama de trabajo (`fix/T-397-…`) tiene STAGEADO (no
desplegado aún) el arreglo de un bug real donde **guardar el perfil borraba `target_oposicion`**
(caso raíz Félix Peña, 04/08 — mismo día que el primer caso de Manolo, `f34b88ad`). Yo, como
trabajador de flota, **no tengo acceso a `user_profiles`** (permission denied con las dos
credenciales) y no puedo comprobar si `target_oposicion` de Manolo está ahora mismo en NULL. Si lo
está, encajaría con esta ráfaga: sin oposición objetivo guardada, ciertas vistas de repaso/dashboard
pueden estar sirviéndole un pool no filtrado por su temario, y de ahí su percepción de que estas
preguntas "no entran". **No lo afirmo — lo dejo para que alguien con acceso compruebe**:
`SELECT target_oposicion FROM user_profiles WHERE id='2eebe749-de92-47e7-afcf-61d2d89d14e6'`. Si es
NULL, el arreglo de T-397 (ya escrito, sin desplegar) más un backfill de su valor real
(`auxiliar_administrativo_diputacion_cordoba`, confirmado el 04/08) resolvería la causa de fondo y
evitaría que seguidor repitiendo la queja.

**Independientemente de esa causa**, el contenido está bien: no hay nada que corregir en las
preguntas ni en el scope — por eso las 4 respuestas de abajo son de RECHAZO informativo, no de
corrección.

## 3. Borradores (4 mensajes independientes — NUNCA agrupar en un email)

### ea65996b (art. 110 CE)
```
Hola Manolo,

Esta pregunta sí forma parte de tu temario: el artículo 110 de la Constitución está dentro del
Tema 2 ("Las Cortes Generales, el Gobierno, el Poder Judicial y las leyes"), que cubre las
relaciones entre el Gobierno y las Cortes.

Muchas gracias.

Equipo de Vence
```

### 4ac133b7 (art. 112 CE — cuestión de confianza)
```
Hola Manolo,

Esta pregunta sí forma parte de tu temario: el artículo 112 de la Constitución (la cuestión de
confianza) está dentro del Tema 2 ("Las Cortes Generales, el Gobierno, el Poder Judicial y las
leyes").

Muchas gracias.

Equipo de Vence
```

### 066a3d65 (art. 108 CE — responsabilidad política)
```
Hola Manolo,

Esta pregunta sí forma parte de tu temario: el artículo 108 de la Constitución está dentro del
Tema 2 ("Las Cortes Generales, el Gobierno, el Poder Judicial y las leyes").

Muchas gracias.

Equipo de Vence
```

### 21be6a56 (art. 114 CE — moción de censura)
```
Hola Manolo,

Esta pregunta sí forma parte de tu temario: la moción de censura (artículo 114 de la Constitución)
está dentro del Tema 2 ("Las Cortes Generales, el Gobierno, el Poder Judicial y las leyes").

Muchas gracias.

Equipo de Vence
```

## 4. Estado / siguiente paso

Las 4 quedan **reservadas por w2** (`cola.cjs claim` las cogió junto con `f34b88ad`). Las libero para
que otra sesión con permisos de escritura las cierre como `rejected` (no penaliza al usuario; no hay
recompensa en `otro` de todos modos) tras el `--sistemico "aislado: solo 1 usuario con ráfaga, resto
histórico 1 caso c/u en meses — medido por SQL sobre description ILIKE"`.

**Antes de cerrar, recomiendo comprobar `user_profiles.target_oposicion` de Manolo** (ver §2) — si
está en NULL, vale la pena decírselo aparte o acelerar el deploy de T-397 con backfill, aunque el
contenido de estas 4 preguntas concretas no necesite cambiar.
