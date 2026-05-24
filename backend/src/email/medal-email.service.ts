import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import type { UserMedal } from '../medals/medals.constants';

interface UserContactRow {
  email: string | null;
  display_name: string | null;
  unsubscribed_all: boolean | null;
}

/**
 * Servicio de email transaccional para medallas (Bloque 3 canary POST).
 *
 * Port 1:1 de `app/api/emails/send-medal-congratulation/route.ts` con
 * **cero dependencia a Vercel ni a Supabase Auth SDK**:
 *   - Email del user: lectura SQL pura de `user_profiles.email` con
 *     fallback a `auth.users.email` (ambas son tablas Postgres estándar,
 *     accesibles vía Drizzle desde cualquier cliente).
 *   - Display name: `public_user_profiles.display_name`.
 *   - Preferencias opt-out: `email_preferences.unsubscribed_all`.
 *   - Envío: Resend SDK directo (proveedor estándar, swap trivial).
 *   - Tracking: INSERT en `email_events` (tabla aplicación).
 *
 * Operación degradada si falta RESEND_API_KEY: log warn + skip silencioso.
 * Esto permite que el resto de la lógica (cálculo medallas + INSERT) siga
 * funcionando aunque el envío de emails esté desconfigurado.
 */
@Injectable()
export class MedalEmailService {
  private readonly logger = new Logger(MedalEmailService.name);
  private readonly resend: Resend | null;
  private readonly fromName: string;
  private readonly fromAddress: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.fromName = this.config.get<string>('EMAIL_FROM_NAME') ?? 'Vence';
    this.fromAddress =
      this.config.get<string>('EMAIL_FROM_ADDRESS') ?? 'info@vence.es';

    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY no configurada — envío de emails desactivado (degradado)',
      );
      this.resend = null;
      return;
    }
    this.resend = new Resend(apiKey);
  }

  /**
   * Envía email de felicitación al ganar una medalla nueva.
   *
   * Best-effort: si algo falla (BD, Resend, opt-out), loguea warn y
   * vuelve sin throw. NUNCA debe romper el flujo de POST /api/medals
   * (que ya escribió la medalla en BD antes de llamar aquí).
   */
  async sendMedalCongratulation(
    userId: string,
    medal: UserMedal,
  ): Promise<void> {
    if (!this.resend) {
      return;
    }

    try {
      const contact = await this.getUserContact(userId);
      if (!contact) {
        this.logger.warn(
          `Usuario ${userId.slice(0, 8)} sin email — skip envío medal '${medal.id}'`,
        );
        return;
      }
      if (contact.unsubscribed_all === true) {
        this.logger.log(
          `Usuario ${userId.slice(0, 8)} con opt-out global — skip envío medal '${medal.id}'`,
        );
        return;
      }

      const userName = contact.display_name ?? 'Estudiante';
      const { subject, html } = this.generateMedalEmailContent(medal, userName);

      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromAddress}>`,
        to: contact.email!,
        subject,
        html,
      });

      if (error) {
        this.logger.error(
          `Resend error enviando medal '${medal.id}' a user ${userId.slice(0, 8)}:`,
          error,
        );
        return;
      }

      // Tracking en email_events (tabla aplicación, agnóstica)
      await this.db
        .execute(
          sql`INSERT INTO email_events (user_id, email_type, event_type, email_address, subject, template_id, email_content_preview)
              VALUES (${userId}::uuid, 'medal_congratulation', 'sent', ${contact.email}, ${subject}, ${medal.id}, ${'Medalla conseguida: ' + medal.title})`,
        )
        .catch((err) => {
          this.logger.warn(
            `Tracking email_events falló para medal '${medal.id}':`,
            err,
          );
        });

      this.logger.log(
        `Email medal '${medal.id}' enviado a user ${userId.slice(0, 8)} (Resend id=${data?.id})`,
      );
    } catch (err) {
      this.logger.error(
        `Error inesperado enviando medal '${medal.id}' a user ${userId.slice(0, 8)}:`,
        err,
      );
    }
  }

  /**
   * Obtiene email + display_name + opt-out del user en UNA query.
   * Prioriza user_profiles.email (tabla aplicación); si está vacío cae
   * a auth.users.email (tabla auth — pero leída como SQL puro, no API
   * Supabase). Si el day migremos auth a Auth.js / Better Auth, esas
   * crean tablas equivalentes (`users.email`) y la query sigue igual.
   */
  private async getUserContact(userId: string): Promise<UserContactRow | null> {
    const rows = (await this.db.execute(
      sql`SELECT
            COALESCE(up.email, au.email) AS email,
            pup.display_name              AS display_name,
            ep.unsubscribed_all           AS unsubscribed_all
          FROM (SELECT ${userId}::uuid AS uid) target
          LEFT JOIN user_profiles up         ON up.id  = target.uid
          LEFT JOIN auth.users au            ON au.id  = target.uid
          LEFT JOIN public_user_profiles pup ON pup.id = target.uid
          LEFT JOIN email_preferences ep     ON ep.user_id = target.uid
          LIMIT 1`,
    )) as unknown as UserContactRow[];

    const row = rows[0];
    if (!row?.email) return null;
    return row;
  }

  /**
   * Port literal de `generateMedalEmailContent` del endpoint Vercel.
   * HTML inline + texto por medalla. Si añades medallas nuevas en
   * lib/api/medals/schemas.ts (RANKING_MEDALS), añade su caso aquí.
   */
  private generateMedalEmailContent(
    medal: UserMedal,
    userName: string,
  ): { subject: string; html: string } {
    const baseUrl =
      this.config.get<string>('APP_BASE_URL') ?? 'https://www.vence.es';

    let congratsText = '';
    let achievementText = '';
    let motivationText = '';

    switch (medal.id) {
      case 'first_place_today':
        congratsText = 'Eres el campeon del dia!';
        achievementText = `Has conseguido el primer lugar en el ranking diario con un ${medal.stats?.accuracy ?? 0}% de aciertos.`;
        motivationText = 'Increible! Manten este ritmo y dominaras la oposicion.';
        break;
      case 'first_place_week':
        congratsText = 'Campeon de la semana!';
        achievementText = `Has dominado el ranking semanal con ${medal.stats?.totalQuestions ?? 0} preguntas y ${medal.stats?.accuracy ?? 0}% de precision.`;
        motivationText = 'Tu constancia y dedicacion son ejemplares. Sigue asi!';
        break;
      case 'first_place_month':
        congratsText = 'Campeon del mes!';
        achievementText =
          'Has alcanzado la cima del ranking mensual. Tu esfuerzo ha sido extraordinario.';
        motivationText =
          'Eres un ejemplo para todos los opositores. El exito esta cada vez mas cerca!';
        break;
      case 'top_3_today':
      case 'top_3_week':
      case 'top_3_month': {
        const period =
          medal.period === 'today'
            ? 'dia'
            : medal.period === 'week'
              ? 'semana'
              : 'mes';
        congratsText = `En el podio del ${period}!`;
        achievementText = `Has conseguido la posicion #${medal.rank} en el ranking del ${period}.`;
        motivationText = 'Estas entre los mejores. El primer puesto esta al alcance!';
        break;
      }
      case 'high_accuracy':
        congratsText = 'Precision extrema!';
        achievementText =
          'Has conseguido mas del 90% de aciertos esta semana. Tu precision es excepcional.';
        motivationText = 'Tu comprension del temario es excelente. Sigue perfeccionando!';
        break;
      case 'volume_leader':
        congratsText = 'Maquina de preguntas!';
        achievementText =
          'Has respondido mas de 100 preguntas esta semana. Tu dedicacion es admirable.';
        motivationText = 'La practica hace al maestro. Tu esfuerzo dara sus frutos!';
        break;
      default:
        congratsText = 'Nueva medalla conseguida!';
        achievementText = medal.description ?? '';
        motivationText = 'Sigue esforzandote, vas por el buen camino!';
    }

    const subject = `${congratsText} - Vence`;
    const titleFirstWord = medal.title.split(' ')[0];
    const statsBlock = medal.stats
      ? `<div class="stats">
          <h3 style="margin: 0 0 10px 0; color: #1e40af;">Tus estadisticas:</h3>
          <p style="margin: 5px 0;"><strong>Preguntas respondidas:</strong> ${medal.stats.totalQuestions}</p>
          <p style="margin: 5px 0;"><strong>Porcentaje de aciertos:</strong> ${medal.stats.accuracy}%</p>
          <p style="margin: 5px 0;"><strong>Posicion en el ranking:</strong> #${medal.rank}</p>
        </div>`
      : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .medal { font-size: 60px; margin: 20px 0; }
    .content { padding: 30px 20px; }
    .achievement-box { background: #fef3cd; border: 2px solid #f6e05e; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center; }
    .stats { background: #f0f9ff; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Felicidades, ${userName}!</h1>
      <div class="medal">${titleFirstWord}</div>
      <p style="color: #e2e8f0; margin: 0; font-size: 18px;">${congratsText}</p>
    </div>
    <div class="content">
      <div class="achievement-box">
        <h2 style="margin: 0 0 10px 0; color: #92400e;">${medal.title}</h2>
        <p style="margin: 0; color: #92400e; font-weight: 500;">${achievementText}</p>
      </div>
      ${statsBlock}
      <p>${motivationText}</p>
      <p>Sigue practicando y conseguiras mas medallas! Cada pregunta que respondes te acerca mas al exito en tu oposicion.</p>
      <div style="text-align: center;">
        <a href="${baseUrl}/auxiliar-administrativo-estado/test" class="button">Seguir Practicando</a>
      </div>
      <div style="text-align: center; margin-top: 20px;">
        <a href="${baseUrl}/mis-estadisticas" style="color: #667eea; text-decoration: none;">Ver todas mis medallas</a>
      </div>
    </div>
    <div class="footer">
      <p>Este email se envio porque conseguiste una nueva medalla en Vence.</p>
      <p><a href="${baseUrl}/perfil?tab=emails" style="color: #64748b;">Gestionar preferencias de email</a></p>
      <p>&copy; ${new Date().getFullYear()} Vence - Tu plataforma de preparación de oposiciones</p>
    </div>
  </div>
</body>
</html>`;

    return { subject, html };
  }
}
