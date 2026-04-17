// Sistema de respaldo local para respuestas de test
// Previene pérdida de datos cuando hay fallos de red o servidor

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
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(initialBackup));
      } catch (e) {
        console.warn('⚠️ No se pudo inicializar backup local:', e);
      }
    }
  }

  // Guardar respuesta localmente ANTES de enviar a BD
  saveLocally(questionNumber: number, answerData: BackupAnswerData): boolean {
    try {
      const backup = this.getBackup();
      backup.answers[questionNumber] = {
        ...answerData,
        timestamp: new Date().toISOString(),
        synced: false
      };
      backup.lastModified = new Date().toISOString();

      localStorage.setItem(this.storageKey, JSON.stringify(backup));
      console.log(`💾 Respuesta #${questionNumber} guardada localmente`);
      return true;
    } catch (e: unknown) {
      console.error('❌ Error guardando backup local:', e);
      // Si localStorage está lleno, intentar limpiar backups antiguos
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        this.cleanOldBackups();
        // Reintentar una vez
        try {
          const backup = this.getBackup();
          backup.answers[questionNumber] = {
            ...answerData,
            timestamp: new Date().toISOString(),
            synced: false
          };
          backup.lastModified = new Date().toISOString();
          localStorage.setItem(this.storageKey, JSON.stringify(backup));
          return true;
        } catch (retryError) {
          console.error('❌ Fallo después de limpiar localStorage:', retryError);
        }
      }
      return false;
    }
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
    try {
      const backup = this.getBackup();
      if (backup.answers[questionNumber]) {
        backup.answers[questionNumber].synced = true;
        backup.answers[questionNumber].syncedAt = new Date().toISOString();
        backup.lastModified = new Date().toISOString();
        localStorage.setItem(this.storageKey, JSON.stringify(backup));
        console.log(`✅ Pregunta #${questionNumber} marcada como sincronizada`);
        return true;
      }
    } catch (e) {
      console.error('❌ Error marcando como sincronizado:', e);
    }
    return false;
  }

  // Obtener el backup actual
  getBackup(): BackupData {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {
        testId: this.testId,
        answers: {},
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
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
    try {
      localStorage.removeItem(this.storageKey);
      console.log(`🗑️ Backup del test ${this.testId} eliminado`);
      return true;
    } catch (e) {
      console.error('❌ Error eliminando backup:', e);
      return false;
    }
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
          const backup = JSON.parse(localStorage.getItem(key) || '{}') as BackupData
          const lastModified = new Date(backup.lastModified || backup.createdAt)
          const answers = Object.values(backup.answers || {})
          const allSynced = answers.length > 0 && answers.every(a => a.synced)
          backupKeys.push({ key, lastModified, allSynced })
        } catch {
          localStorage.removeItem(key)
        }
      }

      // 1) Purge fully synced backups (data already on server)
      for (const b of backupKeys) {
        if (b.allSynced) {
          localStorage.removeItem(b.key)
        }
      }
      const remaining = backupKeys.filter(b => !b.allSynced)

      // 2) Purge backups older than 3 days
      for (const b of remaining) {
        if (b.lastModified < cutoff) {
          localStorage.removeItem(b.key)
        }
      }
      const afterAge = remaining.filter(b => b.lastModified >= cutoff)

      // 3) If still over limit, drop oldest first (keep current test)
      if (afterAge.length > MAX_BACKUPS) {
        afterAge.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime())
        const toDrop = afterAge.length - MAX_BACKUPS
        for (let i = 0; i < toDrop; i++) {
          if (afterAge[i].key !== this.storageKey) {
            localStorage.removeItem(afterAge[i].key)
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
