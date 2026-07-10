# Runbook — Tablas de artículos aplanadas

> **Frase-gatillo:** *"revisa las tablas de artículos"* (o el finding `flattened_table`
> en la Salud del contenido / `/admin/contenido`). Cuando el usuario lo diga, Claude
> sigue ESTE runbook antes de improvisar.

## Qué es

Muchos artículos se importaron como **texto plano extraído de PDF**. Las **tablas**
(p.ej. Grupo→retribución `A1 | E038`, rango→nº `Hasta 100 residentes | 3`, año→coeficiente)
perdieron la rejilla y quedaron como una **secuencia de celdas en líneas sueltas**:

```
A1
E038
A2
E023
```

El "apelotonado" del TEXTO ya lo arregla el render (`lib/teoria/formatLegalText.ts`,
idempotente). Pero las **tablas NO se pueden reconstruir con seguridad en render**
(columnas variables: 2 vs 3; y son **cifras/euros exactos** → un error de columna es un
error legal). Por eso se **detectan** y se **arreglan por datos con verificación humana**.

## Detección (ya automática)

- El **sweep nocturno** (`scripts/health-sweep.cjs`) usa `lib/teoria/detectFlattenedTable.ts`
  (mirror inline) y escribe **un finding agregado** `kind='flattened_table'` en
  `content_health_findings`: *"N artículos con tabla aplanada en M leyes"*.
- Se ve en `/admin/salud-sistema` (Salud del contenido) + badge + email de contenido (lunes).
- Filtra los **falsos positivos** (índices de estructura `TÍTULO/CAPÍTULO…` → no son tablas).
- Estado de referencia (10/07/2026): **140 tablas en 77 leyes**.

## Procedimiento (Claude, al recibir la frase-gatillo)

1. **Sacar la lista** (RDS, read-only). Reusa el detector; nunca reimplementes el criterio:
   ```
   npx tsx --env-file=.env.local scripts/tablas-articulos.ts list      # (Fase 3: herramienta)
   ```
   Mientras no exista la herramienta, correr el detector sobre `articles` activos
   (texto plano, `content !~ '<'`, `article_number ~ '^[0-9]+$'`) e imprimir slug + artículo + celdas.

2. **Priorizar** por demanda: primero las leyes que se ESTUDIAN (tienen preguntas / están en
   temario de oposiciones vivas) — p.ej. LO 5/1985 (electoral), RDL 2/2004 (haciendas locales),
   presupuestos. Las de leyes obscuras pueden esperar.

3. **Reconstruir cada tabla** — SIN inventar datos, solo REORDENAR las celdas que YA están:
   - Leer la(s) **cabecera(s)** que preceden al run de celdas para inferir el nº de columnas
     (2 = clave→valor; 3 = p.ej. `Grupo | Sueldo | Trienios`).
   - Montar una **tabla Markdown** (`| … | … |` + fila separadora `|---|---|`).
   - **Verificación humana obligatoria** (son cifras/euros): mostrar la tabla propuesta al
     usuario y esperar OK ANTES de escribir. **Nunca** cerrar sin borrador+OK.

4. **Escribir el arreglo en los DATOS** (`articles.content`), no en render → queda bien en
   lector, temario, buscador, IA y TTS a la vez. `formatLegalText` es **table-aware**: preserva
   las filas `| … |` (no las parte con doble salto) → remark-gfm las renderiza como tabla.

5. **Verificar**: recargar el artículo en `/teoria/<ley>/articulo-N` y comprobar que la tabla
   se ve. El finding se limpia solo en el siguiente sweep (re-escaneo TRUNCATE+INSERT).

## Gotchas

- **Nunca inventar/alterar cifras.** Solo reordenar celdas existentes. Si una celda es dudosa,
  cruzar con el **boletín oficial** (BOE/BORM/DOGV…), no adivinar.
- **2 vs 3 columnas:** decidir por la cabecera, no por defecto a 2 (emparejar ciego rompe las de 3).
- **Índices de estructura** (`TÍTULO/CAPÍTULO`) NO son tablas → el detector ya los excluye; si
  aparece uno, dejarlo como lista.
- **Leyes nuevas / artículos editados:** el sweep re-escanea cada noche → las tablas nuevas
  aparecen solas en el finding (cero mantenimiento).

## Ficheros

- Detector (SSOT): `lib/teoria/detectFlattenedTable.ts` (+ mirror en `scripts/health-sweep.cjs`).
- Render table-aware: `lib/teoria/formatLegalText.ts`.
- Mapa finding→runbook→frase: `lib/admin/runbookRegistry.ts`.
- Salud del contenido: `docs/runbooks/salud-contenido.md`.
