// __tests__/db/schemaColumnasCriticas.test.ts
//
// El trinquete `schemaColumnDrift` (integración, contra RDS) comprueba que NINGUNA
// columna viva falte en `db/schema.ts`, pero es genérico: trata igual una columna de
// adorno que una que sostiene dinero o coordinación. Esto fija las que importan y
// **por qué**, para que una regeneración descuidada del schema no las tire en silencio.
//
// Contexto (T-377, 31/07/2026): estas 18 columnas llevaban semanas en producción y no
// en el fichero que el proyecto declara como fuente de verdad del esquema.

import { backlogTasks, userProfiles, fraudConfirmations } from '@/db/schema'

describe('db/schema.ts declara las columnas que sostienen algo', () => {
  test('backlog_tasks: las cuatro esperas y el plazo externo', () => {
    // Sin esto, la coordinación entre 2-10 sesiones en paralelo deja de ser tipada:
    // una tarea "en espera" que el modelo no conoce es una tarea que alguien coge.
    for (const col of [
      'snoozeUntil', 'snoozeReason', 'snoozedBy', 'snoozeCount',
      'wakeOnDeploySha', 'wakeOnDeploySurface',
      'progressNote', 'resumeCheck',
      'dueAt', 'dueReason',
      'forceClaimedAt', 'forceClaimReason',
    ]) {
      expect(backlogTasks).toHaveProperty(col)
    }
  })

  test('backlog_tasks: la QUINTA espera y el escalón de archivado', () => {
    // Mismo fallo que arriba, repetido (05/08): estas 11 columnas vivían en RDS y no en
    // este fichero. Las dos familias sostienen el final del ciclo de una tarea, que es
    // justo donde se pierde el trabajo:
    //   · review_* — «hecho, esperando que lo mires» (T-539). Sin ellas, una entrega no
    //     se distingue de una tarea abandonada y nadie la revisa.
    //   · archived_* / requiere_archivo — el escalón DESPUÉS de `done` (T-392): `done`
    //     dice que el deploy incluye el commit; `archived_at` dice que alguien MIRÓ
    //     producción. Confundirlos es cerrar sin verificar, que es el fallo que originó
    //     esa ficha.
    //   · effort / worked_seconds — lo declarado contra lo medido (T-414). Un campo que
    //     nadie puede desmentir se rellena a ojo.
    for (const col of [
      'reviewNote', 'reviewRequestedAt', 'reviewRequestedBy',
      'archivedAt', 'archiveEvidence', 'archivedBy', 'requiereArchivo',
      'effort', 'firstClaimedAt', 'lastClaimedBy', 'workedSeconds',
    ]) {
      expect(backlogTasks).toHaveProperty(col)
    }
  })

  // ── EL TRINQUETE SOLO PROTEGE LO QUE YA CONOCE, Y POR ESO HAY QUE SUBIRLO (T-617) ────────
  // El bloque de arriba se escribió el 05/08 y no podía cubrir lo que llegó el 06/08: el flujo de
  // revisión de la flota (T-486) añadió `reviewed_at`/`reviewed_by`/`review_verdict`/
  // `review_findings` a RDS y **las cuatro faltaban en `db/schema.ts`**. O sea que el sistema que
  // decide si una entrega se puede mergear escribía y leía columnas que el esquema tipado no veía.
  //
  // Encontrado revisando worktrees abandonados —el arreglo estaba escrito en una rama que nunca
  // llegó a `main`— y no por un fallo en ejecución: nada revienta, simplemente Drizzle no las
  // conoce y quien programe contra el esquema no sabe que existen.
  test('backlog_tasks: el VEREDICTO de una revisión (quién, qué decidió y por qué)', () => {
    // `reviewed_at` solo dice que alguien la miró. Sin las otras tres, «entregada» y «revisada
    // con problemas» son indistinguibles, que es exactamente lo que T-486 tuvo que arreglar el
    // mismo día leyendo media fila.
    for (const col of ['reviewedAt', 'reviewedBy', 'reviewVerdict', 'reviewFindings']) {
      expect(backlogTasks).toHaveProperty(col)
    }
  })

  test('user_profiles: la traza de un premium concedido a mano', () => {
    // Un premium sin cobro es una DECISIÓN, y una decisión sobre dinero tiene que poder
    // auditarse: quién lo dio, cuándo y por qué. Un booleano suelto no vale.
    for (const col of ['premiumGrantedAt', 'premiumGrantedBy', 'premiumGrantReason']) {
      expect(userProfiles).toHaveProperty(col)
    }
  })

  test('fraud_confirmations: evidencia del caso y caducidad del dato personal', () => {
    // `retentionUntil` no es metadato: es el RGPD. Si el modelo no la conoce, nadie
    // escribe el borrado.
    for (const col of ['emailHashes', 'fingerprint', 'retentionUntil']) {
      expect(fraudConfirmations).toHaveProperty(col)
    }
  })
})
