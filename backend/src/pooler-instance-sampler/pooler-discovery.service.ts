import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Una instancia del pooler descubierta dinámicamente desde el target group del NLB. */
export interface PoolerInstance {
  /** IP privada (172.26.x.x) — clave estable de la VM. */
  ip: string;
  port: number;
  /** Availability Zone (eu-west-2a / eu-west-2b). */
  az: string | null;
  /** Vista del NLB: healthy | unhealthy | draining | unused | initial. */
  targetHealth: string | null;
}

/**
 * Descubre las instancias del pooler PgBouncer LEYENDO el target group del NLB
 * (`elasticloadbalancing:DescribeTargetHealth`). Fuente de verdad: incluye
 * instancias que el NLB marcó unhealthy — justo las interesantes.
 *
 * Anti-chapuza: CERO IPs hardcodeadas. Si se añade una 3ª VM al NLB, el sampler
 * la recoge sin tocar código. Si el SDK falla, devuelve [] (el cron lo trata
 * como "no descubierto" y no crashea).
 *
 * Patrón de import lazy + región igual que oep-signals-llm.service.ts.
 */
@Injectable()
export class PoolerDiscoveryService {
  private readonly logger = new Logger(PoolerDiscoveryService.name);

  constructor(private readonly config: ConfigService) {}

  /** ARN del target group del pooler. Vacío = feature desactivado. */
  private targetGroupArn(): string {
    return this.config.get<string>('POOLER_TARGET_GROUP_ARN') ?? '';
  }

  isEnabled(): boolean {
    return this.targetGroupArn().length > 0;
  }

  async discover(): Promise<PoolerInstance[]> {
    const arn = this.targetGroupArn();
    if (!arn) return [];

    try {
      const { ElasticLoadBalancingV2Client, DescribeTargetHealthCommand } =
        await import('@aws-sdk/client-elastic-load-balancing-v2');
      const region = process.env.AWS_REGION ?? 'eu-west-2';
      const client = new ElasticLoadBalancingV2Client({ region });

      const out = await client.send(
        new DescribeTargetHealthCommand({ TargetGroupArn: arn }),
      );

      const instances: PoolerInstance[] = (out.TargetHealthDescriptions ?? [])
        .filter((d) => d.Target?.Id)
        .map((d) => ({
          ip: d.Target!.Id!,
          port: d.Target!.Port ?? 6543,
          az: d.Target!.AvailabilityZone ?? null,
          targetHealth: d.TargetHealth?.State ?? null,
        }));

      if (instances.length === 0) {
        this.logger.warn(
          `Target group ${arn} no devolvió instancias — ¿TG vacío o ARN incorrecto?`,
        );
      }
      return instances;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`DescribeTargetHealth falló: ${msg}`);
      return [];
    }
  }
}
