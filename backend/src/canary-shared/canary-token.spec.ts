import jwt from 'jsonwebtoken';
import { signCanaryToken } from './canary-token';

// Cubre el helper compartido de auth de canaries (creado 25/06 al migrar
// canary-theme-stats; usado también por answer-save/stats-pipeline/smoke-auth).
// Verifica que el token sale con los claims que verifyAuth/verifyJwtLocal espera.
describe('signCanaryToken', () => {
  const SECRET = 'test-secret-hs256';

  it('devuelve null si falta el secreto', () => {
    expect(signCanaryToken('user-1', { secret: undefined })).toBeNull();
    const prev = process.env.SUPABASE_JWT_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;
    expect(signCanaryToken('user-1')).toBeNull();
    if (prev !== undefined) process.env.SUPABASE_JWT_SECRET = prev;
  });

  it('devuelve null si falta userId', () => {
    expect(signCanaryToken('', { secret: SECRET })).toBeNull();
  });

  it('firma un JWT HS256 verificable con sub/aud/role correctos', () => {
    const token = signCanaryToken('user-123', { secret: SECRET });
    expect(token).toBeTruthy();
    const decoded = jwt.verify(token as string, SECRET) as jwt.JwtPayload;
    expect(decoded.sub).toBe('user-123');
    expect(decoded.aud).toBe('authenticated');
    expect(decoded.role).toBe('authenticated');
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(300);
  });

  it('respeta ttlSeconds y email (paridad con los 3 canaries migrados)', () => {
    const token = signCanaryToken('user-9', {
      secret: SECRET,
      ttlSeconds: 3600,
      email: 'smoke@vence.es',
    });
    const decoded = jwt.verify(token as string, SECRET) as jwt.JwtPayload;
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(3600);
    expect((decoded as { email?: string }).email).toBe('smoke@vence.es');
  });
});
