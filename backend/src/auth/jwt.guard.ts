import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  JwtVerifier,
  type AuthenticatedUser,
} from './jwt-verifier';

/**
 * Request enriquecido con el user autenticado tras pasar JwtGuard.
 * Para usar el user en un handler:
 *   ```ts
 *   @UseGuards(JwtGuard)
 *   @Post('save')
 *   save(@CurrentUser() user: AuthenticatedUser, @Body() body: SaveDto) {...}
 *   ```
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * Guard NestJS que protege un handler con JWT Bearer.
 *
 * Flujo:
 *   1. Lee `Authorization: Bearer <jwt>` del request.
 *   2. Verifica el JWT con `JwtVerifier` (HS256 + audience + exp).
 *   3. Si OK → asigna `request.user = { userId, email, role }` y permite.
 *   4. Si falla → lanza `UnauthorizedException` (NestJS responde 401).
 *
 * Errores específicos quedan en logs (no se exponen al cliente para no
 * dar pistas al atacante — siempre 401 "Unauthorized" genérico).
 */
@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new Logger(JwtGuard.name);

  constructor(private readonly verifier: JwtVerifier) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization ?? null;
    const token = JwtVerifier.extractBearerToken(authHeader);

    const result = this.verifier.verify(token);
    if (!result.success) {
      // Log detallado server-side para diagnóstico; cliente recibe 401 genérico.
      this.logger.debug(
        `JWT rejected: ${result.error} (ip=${request.ip ?? 'unknown'})`,
      );
      throw new UnauthorizedException('Unauthorized');
    }

    request.user = {
      userId: result.userId,
      email: result.email,
      role: result.role,
    };
    return true;
  }
}
