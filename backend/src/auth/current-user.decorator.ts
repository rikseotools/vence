import {
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt.guard';
import type { AuthenticatedUser } from './jwt-verifier';

/**
 * Param decorator que extrae el `user` autenticado del request enriquecido
 * por `JwtGuard`. Solo usar en handlers protegidos con `@UseGuards(JwtGuard)`.
 *
 * Uso:
 *   ```ts
 *   @UseGuards(JwtGuard)
 *   @Post('save')
 *   save(@CurrentUser() user: AuthenticatedUser, @Body() body: SaveDto) {
 *     // user.userId, user.email, user.role
 *   }
 *   ```
 *
 * Si se invoca sin JwtGuard previo, devolverá undefined (no rompe — el
 * caller debe gestionarlo si se le olvida el guard).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
