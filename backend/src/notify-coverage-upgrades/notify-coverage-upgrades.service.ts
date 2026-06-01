import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/**
 * Sprint F del roadmap docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md.
 *
 * Cron diario que detecta saltos de coverage_level ocurridos en las últimas
 * 24h y notifica a los usuarios con target_oposicion = slug que su oposición
 * ha avanzado. Convierte detección automática en captación real.
 *
 * Filtros aplicados:
 *  - Solo saltos hacia niveles "interesantes" (con_temario+, salvo
 *    monitorizada con datos relevantes).
 *  - Deduplica: un usuario con N oposiciones que han subido recibe 1 email
 *    con resumen agrupado, no N emails.
 *  - Respeta email_preferences.unsubscribed_all.
 *  - Skip si el usuario no tiene email en user_profiles.email.
 *
 * Tracking: INSERT en email_events tras cada envío.
 */

const LEVEL_LABEL: Record<string, string> = {
  catalogada: 'catalogada',
  monitorizada: 'con datos del proceso detectados',
  con_temario: 'con temario disponible',
  con_tests: 'con tests por tema disponibles',
  con_landing: 'con landing completa',
  full: 'implementada al 100%',
};

const LEVEL_RANK: Record<string, number> = {
  catalogada: 1,
  monitorizada: 2,
  con_temario: 3,
  con_tests: 4,
  con_landing: 5,
  full: 6,
};

interface UpgradeRow extends Record<string, unknown> {
  oposicion_id: string;
  slug: string;
  nombre: string;
  to_level: string;
  changed_at: string;
}

interface UserToNotify {
  user_id: string;
  email: string;
  display_name: string | null;
  oposiciones_upgrades: Array<{
    slug: string;
    nombre: string;
    to_level: string;
  }>;
}

export interface NotifyCoverageUpgradesResult {
  upgrades_detected: number;
  emails_sent: number;
  emails_skipped: number;
  errors: number;
  durationMs: number;
}

@Injectable()
export class NotifyCoverageUpgradesService {
  private readonly logger = new Logger(NotifyCoverageUpgradesService.name);
  private readonly resend: Resend | null;
  private readonly fromName: string;
  private readonly fromAddress: string;
  private readonly appBaseUrl: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.fromName = this.config.get<string>('EMAIL_FROM_NAME') ?? 'Vence';
    this.fromAddress =
      this.config.get<string>('EMAIL_FROM_ADDRESS') ?? 'info@vence.es';
    this.appBaseUrl =
      this.config.get<string>('APP_BASE_URL') ?? 'https://www.vence.es';

    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY no configurada — notificaciones de coverage_level desactivadas (degradado)',
      );
      this.resend = null;
      return;
    }
    this.resend = new Resend(apiKey);
  }

  async run(): Promise<NotifyCoverageUpgradesResult> {
    const startedAt = Date.now();

    if (!this.resend) {
      return {
        upgrades_detected: 0,
        emails_sent: 0,
        emails_skipped: 0,
        errors: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    // 1. Leer saltos de las últimas 24h que merecen notificación.
    //    Solo niveles ≥ monitorizada (catalogada→catalogada no avisa).
    const upgrades = await this.db.execute<UpgradeRow>(sql`
      SELECT
        ch.oposicion_id::text AS oposicion_id,
        o.slug,
        o.nombre,
        ch.to_level,
        ch.changed_at::text AS changed_at
      FROM coverage_history ch
      JOIN oposiciones o ON o.id = ch.oposicion_id
      WHERE ch.changed_at >= NOW() - INTERVAL '24 hours'
        AND ch.changed_by = 'cron_auto_promote'
        AND ch.to_level IN ('monitorizada', 'con_temario', 'con_tests', 'con_landing', 'full')
    `);

    const upgradesList = upgrades as unknown as UpgradeRow[];
    this.logger.log(`Saltos detectados últimas 24h: ${upgradesList.length}`);

    if (upgradesList.length === 0) {
      return {
        upgrades_detected: 0,
        emails_sent: 0,
        emails_skipped: 0,
        errors: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    // 2. Para cada oposición con salto, buscar users con target_oposicion = slug_underscored.
    //    Agrupar por user_id para mandar 1 email con N oposiciones.
    const usersByUserId = new Map<string, UserToNotify>();

    for (const u of upgradesList) {
      const positionType = u.slug.replace(/-/g, '_');
      const users = await this.db.execute<{
        user_id: string;
        email: string;
        display_name: string | null;
      }>(sql`
        SELECT
          up.id::text AS user_id,
          up.email,
          pup.display_name
        FROM user_profiles up
        LEFT JOIN public_user_profiles pup ON pup.id = up.id
        LEFT JOIN email_preferences ep ON ep.user_id = up.id
        WHERE up.target_oposicion = ${positionType}
          AND up.email IS NOT NULL
          AND COALESCE(ep.unsubscribed_all, false) = false
      `);

      for (const user of users as unknown as Array<{
        user_id: string;
        email: string;
        display_name: string | null;
      }>) {
        const existing = usersByUserId.get(user.user_id);
        if (existing) {
          // El user ya tiene 1+ oposiciones esperando notificación: añadir más
          existing.oposiciones_upgrades.push({
            slug: u.slug,
            nombre: u.nombre,
            to_level: u.to_level,
          });
        } else {
          usersByUserId.set(user.user_id, {
            user_id: user.user_id,
            email: user.email,
            display_name: user.display_name,
            oposiciones_upgrades: [
              {
                slug: u.slug,
                nombre: u.nombre,
                to_level: u.to_level,
              },
            ],
          });
        }
      }
    }

    // 3. Enviar 1 email por user.
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of usersByUserId.values()) {
      // Si alguno de los saltos es ≥ con_temario, vale la pena email.
      // Si todos son monitorizada, también vale (saben que hay novedad).
      const maxRank = Math.max(
        ...user.oposiciones_upgrades.map(
          o => LEVEL_RANK[o.to_level] ?? 0,
        ),
      );
      if (maxRank < LEVEL_RANK['monitorizada']) {
        skipped++;
        continue;
      }

      try {
        await this.sendEmail(user);
        await this.recordEmailEvent(user, 'sent');
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(
          `Email a ${user.email.slice(0, 4)}…@… falló: ${msg}`,
        );
        await this.recordEmailEvent(user, 'failed', msg);
        errors++;
      }
    }

    return {
      upgrades_detected: upgradesList.length,
      emails_sent: sent,
      emails_skipped: skipped,
      errors,
      durationMs: Date.now() - startedAt,
    };
  }

  private async sendEmail(user: UserToNotify): Promise<void> {
    const resend = this.resend;
    if (!resend) return;

    const greeting = user.display_name ? `Hola ${user.display_name},` : 'Hola,';
    const subject =
      user.oposiciones_upgrades.length === 1
        ? `Tu oposición «${user.oposiciones_upgrades[0].nombre}» ha avanzado en Vence`
        : `Tus oposiciones han avanzado en Vence`;

    const linesHtml: string[] = [];
    const linesText: string[] = [];

    for (const o of user.oposiciones_upgrades) {
      const label = LEVEL_LABEL[o.to_level] ?? o.to_level;
      const url = `${this.appBaseUrl}/${o.slug}`;
      linesHtml.push(
        `<li><a href="${url}">${escapeHtml(o.nombre)}</a> → ahora ${escapeHtml(label)}.</li>`,
      );
      linesText.push(`- ${o.nombre} → ahora ${label}. Enlace: ${url}`);
    }

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <p>${escapeHtml(greeting)}</p>
  <p>Te avisamos porque hay novedades en oposiciones que tienes marcadas como interés:</p>
  <ul>${linesHtml.join('\n')}</ul>
  <p>Entra a Vence para verlas. Si ahora tienen temario o tests disponibles, puedes empezar a estudiar ya mismo.</p>
  <p style="color: #666; font-size: 12px; margin-top: 32px;">
    Recibes este aviso porque marcaste estas oposiciones como tu objetivo en Vence.
    Si no quieres recibir más avisos, ajusta tus preferencias en
    <a href="${this.appBaseUrl}/perfil">tu perfil</a>.
  </p>
</div>`.trim();

    const text = `
${greeting}

Te avisamos porque hay novedades en oposiciones que tienes marcadas como interés:

${linesText.join('\n')}

Entra a Vence para verlas. Si ahora tienen temario o tests disponibles, puedes empezar a estudiar ya mismo.

— El equipo de Vence

Recibes este aviso porque marcaste estas oposiciones como tu objetivo en Vence.
Ajusta tus preferencias en ${this.appBaseUrl}/perfil
`.trim();

    await resend.emails.send({
      from: `${this.fromName} <${this.fromAddress}>`,
      to: user.email,
      subject,
      html,
      text,
      tags: [
        { name: 'category', value: 'coverage_upgrade' },
        { name: 'count', value: String(user.oposiciones_upgrades.length) },
      ],
    });
  }

  private async recordEmailEvent(
    user: UserToNotify,
    status: 'sent' | 'failed',
    errorMessage?: string,
  ): Promise<void> {
    try {
      const preview = user.oposiciones_upgrades
        .map(o => `${o.slug}→${o.to_level}`)
        .join('; ')
        .slice(0, 500);
      await this.db.execute(sql`
        INSERT INTO email_events (
          user_id, email_type, event_type, email_address,
          email_content_preview, error_details, created_at
        ) VALUES (
          ${user.user_id}::uuid,
          'coverage_upgrade',
          ${status},
          ${user.email},
          ${preview},
          ${errorMessage ?? null},
          NOW()
        )
      `);
    } catch (e) {
      // Tracking opcional — no romper el flujo.
      this.logger.debug(
        `email_events INSERT falló: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
