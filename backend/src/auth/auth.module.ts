import { Global, Module } from '@nestjs/common';
import { JwtVerifier } from './jwt-verifier';
import { JwtGuard } from './jwt.guard';

/**
 * Módulo Global de autenticación.
 *
 * Provee:
 *   - `JwtVerifier` — wrapper agnóstico sobre `jose` que valida JWT HS256.
 *     Hoy valida tokens emitidos por Supabase Auth (firmados con
 *     SUPABASE_JWT_SECRET). El día que migremos auth (Bloque 5 del
 *     roadmap: Auth.js / Better Auth / Cognito), solo cambia el secret/
 *     issuer en config; el verifier sigue validando JWTs estándar.
 *   - `JwtGuard` — NestJS Guard que protege controladores/handlers con
 *     `@UseGuards(JwtGuard)`. Lee `Authorization: Bearer <jwt>`, valida,
 *     inyecta `request.user = { userId, email, role }`. Si falla → 401.
 *
 * Uso desde un Controller:
 *   ```ts
 *   @UseGuards(JwtGuard)
 *   @Post('save')
 *   async save(@CurrentUser() user: AuthenticatedUser) { ... }
 *   ```
 *
 * Por qué `jose` y no `jsonwebtoken`:
 *   - `jose` usa Web Crypto, portable a cualquier runtime (Node, Edge,
 *     Workers, Browser). El día que dockericemos otra app que necesite
 *     auth, sirve igual.
 *   - Implementación moderna mantenida por Auth0/Okta.
 *   - El frontend Vercel sigue con `jsonwebtoken` pero NO hace diferencia
 *     funcional — ambos validan JWT estándar HS256 con la misma semántica.
 */
@Global()
@Module({
  providers: [JwtVerifier, JwtGuard],
  exports: [JwtVerifier, JwtGuard],
})
export class AuthModule {}
