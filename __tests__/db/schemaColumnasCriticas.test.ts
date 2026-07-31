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
