// Sistema de respaldo local para respuestas de test
// Previene pérdida de datos cuando hay fallos de red o servidor
//
// [T-203] Migrado a safeGet/safeSet/safeRemove (lib/storage/safeLocalStorage): antes cada método
// atrapaba QuotaExceededError a mano y lo hacía sin telemetría — el helper ya no lanza nunca y
// emite `storage_unavailable`, así que el try/catch de aquí sobra salvo donde protege un
// JSON.parse (eso sigue siendo cosa de este fichero).

import { safeGet, safeSet, safeRemove } from '@/lib/storage/safeLocalStorage'

export interface BackupAnswerData {
  questionData: Record<string, unknown>
  answerData: Record<string, unknown>
  tema: number
  confidenceLevel: string
  interactionCount: number
  timeData?: { questionStartTime: number | null; firstInteractionTime: number | null }
  timestamp?: string
  synced?: boolean
  syncedAt?: string
  [key: string]: unknown
}

export interface BackupData {
  testId: string
  answers: Record<string, BackupAnswerData>
  createdAt: string
  lastModified: string
}

export interface SyncResults {
  success: number
  failed: number
  errors: Array<{ questionNumber: number; error: string }>
}

export interface BackupStats {
  total: number
  synced: number
  unsynced: number
  createdAt: string
  lastModified: string
}

class TestBackupSystem {
  testId: string
  storageKey: string

  constructor(testId: string) {
    this.testId = testId;
    this.storageKey = `test_backup_${testId}`;
    this.cleanOldBackups();
    this.initBackup();
  }

  initBackup(): void {
    if (!this.getBackup().testId) {
      const initialBackup: BackupData = {
        testId: this.testId,
        answers: {},
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      if (!safeSet(this.storageKey, JSON.stringify(initialBackup))) {
        console.warn('⚠️ No se pudo inicializar backup local');
      }
    }
  }

  // Guardar respuesta localmente ANTES de enviar a BD
  saveLocally(questionNumber: number, answerData: BackupAnswerData): boolean {
    const backup = this.getBackup();
    backup.answers[questionNumber] = {
      ...answerData,
      timestamp: new Date().toISOString(),
      synced: false
    };
    backup.lastModified = new Date().toISOString();

    if (safeSet(this.storageKey, JSON.stringify(backup))) {
      console.log(`💾 Respuesta #${questionNumber} guardada localmente`);
      return true;
    }

    // safeSet falló (típicamente cuota llena): limpiar backups antiguos y reintentar una vez.
    this.cleanOldBackups();
    const retryBackup = this.getBackup();
    retryBackup.answers[questionNumber] = {
      ...answerData,
      timestamp: new Date().toISOString(),
      synced: false
    };
    retryBackup.lastModified = new Date().toISOString();
    if (safeSet(this.storageKey, JSON.stringify(retryBackup))) {
      return true;
    }
    console.error('❌ Fallo guardando backup local después de limpiar.');
    return false;
  }

  // Recuperar respuestas no sincronizadas
  getUnsyncedAnswers(): Array<BackupAnswerData & { questionNumber: number }> {
    const backup = this.getBackup();
    return Object.entries(backup.answers)
      .filter(([_, data]) => !data.synced)
      .map(([num, data]) => ({
        questionNumber: parseInt(num),
        ...data
      }));
  }

  // Marcar como sincronizado
  markAsSynced(questionNumber: number): boolean {
    const backup = this.getBackup();
    if (backup.answers[questionNumber]) {
      backup.answers[questionNumber].synced = true;
      backup.answers[questionNumber].syncedAt = new Date().toISOString();
      backup.lastModified = new Date().toISOString();
      if (safeSet(this.storageKey, JSON.stringify(backup))) {
        console.log(`✅ Pregunta #${questionNumber} marcada como sincronizada`);
        return true;
      }
      console.error('❌ Error marcando como sincronizado');
    }
    return false;
  }

  // Obtener el backup actual
  getBackup(): BackupData {
    const stored = safeGet(this.storageKey);
    if (!stored) {
      return {
        testId: this.testId,
        answers: {},
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
    }
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('❌ Error leyendo backup:', e);
      return {
        testId: this.testId,
        answers: {},
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
    }
  }

  // Obtener estadísticas del backup
  getStats(): BackupStats {
    const backup = this.getBackup();
    const total = Object.keys(backup.answers).length;
    const synced = Object.values(backup.answers).filter(a => a.synced).length;
    const unsynced = total - synced;

    return {
      total,
      synced,
      unsynced,
      createdAt: backup.createdAt,
      lastModified: backup.lastModified
    };
  }

  // Limpiar este backup
  clear(): boolean {
    const ok = safeRemove(this.storageKey);
    if (ok) {
      console.log(`🗑️ Backup del test ${this.testId} eliminado`);
    } else {
      console.error('❌ Error eliminando backup');
    }
    return ok;
  }

  cleanOldBackups(): void {
    const MAX_BACKUPS = 20
    const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000 // 3 días

    try {
      const now = Date.now()
      const cutoff = new Date(now - MAX_AGE_MS)
      const backupKeys: { key: string; lastModified: Date; allSynced: boolean }[] = []

      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith('test_backup_')) continue
        try {
          const backup = JSON.parse(safeGet(key) || '{}') as BackupData
          const lastModified = new Date(backup.lastModified || backup.createdAt)
          const answers = Object.values(backup.answers || {})
          const allSynced = answers.length > 0 && answers.every(a => a.synced)
          backupKeys.push({ key, lastModified, allSynced })
        } catch {
          safeRemove(key)
        }
      }

      // 1) Purge fully synced backups (data already on server)
      for (const b of backupKeys) {
        if (b.allSynced) {
          safeRemove(b.key)
        }
      }
      const remaining = backupKeys.filter(b => !b.allSynced)

      // 2) Purge backups older than 3 days
      for (const b of remaining) {
        if (b.lastModified < cutoff) {
          safeRemove(b.key)
        }
      }
      const afterAge = remaining.filter(b => b.lastModified >= cutoff)

      // 3) If still over limit, drop oldest first (keep current test)
      if (afterAge.length > MAX_BACKUPS) {
        afterAge.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime())
        const toDrop = afterAge.length - MAX_BACKUPS
        for (let i = 0; i < toDrop; i++) {
          if (afterAge[i].key !== this.storageKey) {
            safeRemove(afterAge[i].key)
          }
        }
      }
    } catch (e) {
      console.error('❌ Error limpiando backups:', e);
    }
  }

  // Intentar sincronizar todas las respuestas pendientes
  async syncPending(saveFunction: (answer: BackupAnswerData & { questionNumber: number }) => Promise<{ success: boolean; error?: unknown }>): Promise<SyncResults> {
    const unsynced = this.getUnsyncedAnswers();
    const results: SyncResults = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const answer of unsynced) {
      try {
        const result = await saveFunction(answer);
        if (result.success) {
          this.markAsSynced(answer.questionNumber);
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            questionNumber: answer.questionNumber,
            error: String(result.error || 'Unknown error')
          });
        }
      } catch (error: unknown) {
        results.failed++;
        results.errors.push({
          questionNumber: answer.questionNumber,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }
}

export { TestBackupSystem };
