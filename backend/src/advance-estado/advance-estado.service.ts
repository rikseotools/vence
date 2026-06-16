import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, isNotNull, or } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { oposiciones } from '../oep-signals/oep-signals.schema';

/**
 * Orden canónico del ciclo selectivo (de menor a mayor avance).
 * Usado solo para garantizar que nunca retrocedemos un estado.
 */
const ORDER = [
  'sin_oep',
  'oep_aprobada',
  'convocada',
  'inscripcion_abierta',
  'inscripcion_cerrada',
  'lista_admitidos',
  'pendiente_examen',
  'examen_realizado',
  'resultados',
  'nombramientos',
] as const;
type Estado = (typeof ORDER)[number];

const rank = (e: string | null | undefined): number =>
  ORDER.indexOf((e ?? '') as Estado);

/**
 * Transiciones PERMITIDAS por el auto-avance basado en fechas.
 * Clave: solo avanzamos a un estado X si el estado actual es uno de los
 * inmediatamente plausibles previos. Esto evita el mayor riesgo —
 * los ROLLOVERS: una oposición re-anclada a `oep_aprobada` para el ciclo
 * nuevo suele conservar `inscription_deadline` del ciclo VIEJO (ya vencido);
 * sin esta whitelist saltaría erróneamente a `inscripcion_cerrada`.
 * Por eso `inscripcion_cerrada` y `examen_realizado` NO se alcanzan desde
 * `oep_aprobada`/`sin_oep`.
 */
const ALLOWED_FROM: Record<Estado, readonly string[]> = {
  sin_oep: [],
  oep_aprobada: [],
  convocada: ['sin_oep', 'oep_aprobada'],
  inscripcion_abierta: ['sin_oep', 'oep_aprobada', 'convocada'],
  inscripcion_cerrada: ['convocada', 'inscripcion_abierta'],
  lista_admitidos: [],
  // OJO: NO incluir 'lista_admitidos' aquí — es un estado MÁS informativo que
  // 'pendiente_examen'; degradarlo perdería el "admitidos publicados". Se queda
  // en lista_admitidos hasta que pase la fecha de examen → 'examen_realizado'.
  pendiente_examen: ['inscripcion_abierta', 'inscripcion_cerrada'],
  examen_realizado: ['inscripcion_cerrada', 'lista_admitidos', 'pendiente_examen'],
  resultados: [],
  nombramientos: [],
};

interface OposicionFechas {
  inscriptionStart: string | null;
  inscriptionDeadline: string | null;
  examDate: string | null;
  examDateApproximate: boolean | null;
}

export interface AdvanceEstadoStats {
  scanned: number;
  advanced: number;
  changes: { slug: string | null; from: string | null; to: string }[];
}

/**
 * Avanza `estado_proceso` de las oposiciones según sus fechas de convocatoria
 * (apertura/cierre de inscripción, examen) comparadas con HOY.
 *
 * Solo avanza (nunca retrocede) y solo a través de transiciones de la
 * whitelist `ALLOWED_FROM`, para no pisar estados fijados a mano
 * (`lista_admitidos`, `resultados`, `nombramientos`) ni mover rollovers.
 *
 * Las fechas de examen APROXIMADAS (`exam_date_approximate=true`) no bastan
 * para afirmar `examen_realizado`; como mucho marcan `pendiente_examen`.
 */
@Injectable()
export class AdvanceEstadoService {
  private readonly logger = new Logger(AdvanceEstadoService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Estado mínimo implicado por las fechas. null si no hay evidencia de fechas. */
  deriveEstado(today: string, o: OposicionFechas): Estado | null {
    let inscripcion: Estado | null = null;
    if (o.inscriptionStart && o.inscriptionDeadline) {
      if (today < o.inscriptionStart) inscripcion = 'convocada';
      else if (today <= o.inscriptionDeadline) inscripcion = 'inscripcion_abierta';
      else inscripcion = 'inscripcion_cerrada';
    } else if (o.inscriptionDeadline && today > o.inscriptionDeadline) {
      inscripcion = 'inscripcion_cerrada';
    }

    let examen: Estado | null = null;
    if (o.examDate) {
      if (o.examDate < today) {
        // Examen pasado: solo afirmamos 'examen_realizado' si la fecha es firme.
        // Aproximada → ambiguo, no avanzamos por ello.
        examen = o.examDateApproximate ? null : 'examen_realizado';
      } else {
        examen = 'pendiente_examen';
      }
    }

    // Un examen FUTURO no es una fase más avanzada que la inscripción en curso:
    // mientras la inscripción está abierta (o aún no ha abierto), esa es la fase
    // saliente. Solo cuenta 'pendiente_examen' una vez cerrada la inscripción.
    if (
      examen === 'pendiente_examen' &&
      (inscripcion === 'inscripcion_abierta' || inscripcion === 'convocada')
    ) {
      examen = null;
    }

    const candidates: (Estado | null)[] = [inscripcion, examen];
    const valid = candidates.filter((c): c is Estado => c !== null);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => (rank(b) > rank(a) ? b : a));
  }

  async run(today?: string): Promise<AdvanceEstadoStats> {
    const t = today ?? new Date().toISOString().slice(0, 10);

    const rows = await this.db
      .select({
        id: oposiciones.id,
        slug: oposiciones.slug,
        estadoProceso: oposiciones.estadoProceso,
        inscriptionStart: oposiciones.inscriptionStart,
        inscriptionDeadline: oposiciones.inscriptionDeadline,
        examDate: oposiciones.examDate,
        examDateApproximate: oposiciones.examDateApproximate,
      })
      .from(oposiciones)
      .where(
        or(
          isNotNull(oposiciones.inscriptionDeadline),
          isNotNull(oposiciones.examDate),
        ),
      );

    const changes: AdvanceEstadoStats['changes'] = [];

    for (const o of rows) {
      const derived = this.deriveEstado(t, o);
      if (!derived) continue;
      if (rank(o.estadoProceso) >= rank(derived)) continue; // nunca retroceder
      if (!ALLOWED_FROM[derived].includes(o.estadoProceso ?? '')) continue; // transición no permitida

      await this.db
        .update(oposiciones)
        .set({ estadoProceso: derived })
        .where(eq(oposiciones.id, o.id));
      changes.push({ slug: o.slug, from: o.estadoProceso, to: derived });
      this.logger.log(`${o.slug}: ${o.estadoProceso} → ${derived}`);
    }

    return { scanned: rows.length, advanced: changes.length, changes };
  }
}
