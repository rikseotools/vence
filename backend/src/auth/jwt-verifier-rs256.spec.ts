import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'crypto';
import { JwtVerifier } from './jwt-verifier';

// Rama RS256/JWKS del backend (Fase B). Verifica con la clave PÚBLICA por env
// (misma lib jsonwebtoken → guard síncrono, sin jose ESM). Cubre doble-aceptación
// y anti algorithm-confusion.

const HS_SECRET = 'test-secret-that-is-long-enough-for-hs256-do-not-use-in-prod';
const ISSUER = 'https://test.vence.es';
const SUB = '3260627f-2018-4a5e-8234-e6f07015abb9';

const { privateKey: RSA_PRIVATE, publicKey: RSA_PUBLIC } = generateKeyPairSync(
  'rsa',
  {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  },
);

function makeConfig(
  overrides: Record<string, string | undefined>,
): ConfigService {
  return {
    get: (key: string) => overrides[key],
  } as unknown as ConfigService;
}

function signRs256(
  payload: Record<string, unknown>,
  options: jwt.SignOptions = {},
): string {
  return jwt.sign(payload, RSA_PRIVATE, {
    algorithm: 'RS256',
    audience: 'authenticated',
    issuer: ISSUER,
    expiresIn: '1h',
    subject: SUB,
    ...options,
  });
}

describe('JwtVerifier — rama RS256', () => {
  const fullConfig = {
    SUPABASE_JWT_SECRET: HS_SECRET,
    AUTH_JWT_PUBLIC_KEY: RSA_PUBLIC,
    AUTH_JWT_ISSUER: ISSUER,
  };

  it('token RS256 válido → success con userId/email/role', () => {
    const v = new JwtVerifier(makeConfig(fullConfig));
    const token = signRs256({ email: 'a@b.com', role: 'authenticated' });
    const r = v.verify(token);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.userId).toBe(SUB);
      expect(r.email).toBe('a@b.com');
      expect(r.role).toBe('authenticated');
    }
  });

  it('RS256 sin clave pública configurada → no_secret_configured (dormido)', () => {
    const v = new JwtVerifier(makeConfig({ SUPABASE_JWT_SECRET: HS_SECRET }));
    const token = signRs256({ email: 'a@b.com' });
    const r = v.verify(token);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe('no_secret_configured');
  });

  it('RS256 con issuer distinto → wrong_issuer', () => {
    const v = new JwtVerifier(makeConfig(fullConfig));
    const token = signRs256({ email: 'a@b.com' }, { issuer: 'https://evil.example.com' });
    const r = v.verify(token);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe('wrong_issuer');
  });

  it('RS256 expirado → expired', () => {
    const v = new JwtVerifier(makeConfig(fullConfig));
    const token = signRs256({ email: 'a@b.com' }, { expiresIn: '-10s' });
    const r = v.verify(token);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe('expired');
  });

  it('doble-aceptación: HS256 legacy sigue funcionando con la misma config', () => {
    const v = new JwtVerifier(makeConfig(fullConfig));
    const token = jwt.sign(
      { sub: SUB, email: 'a@b.com', role: 'authenticated', aud: 'authenticated' },
      HS_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    const r = v.verify(token);
    expect(r.success).toBe(true);
    if (r.success) expect(r.userId).toBe(SUB);
  });

  it('anti-confusion: HS256 firmado con la clave PÚBLICA → NO se acepta', () => {
    const v = new JwtVerifier(makeConfig(fullConfig));
    // alg=HS256 → rama HS con SUPABASE_JWT_SECRET (≠ clave pública) → firma inválida.
    const token = jwt.sign(
      { sub: SUB, aud: 'authenticated' },
      RSA_PUBLIC,
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    const r = v.verify(token);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe('invalid_signature');
  });

  it('alg none → unsupported_alg (sin intentar verificar)', () => {
    const v = new JwtVerifier(makeConfig(fullConfig));
    // Construir un JWT alg:none a mano.
    const b64 = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const noneToken = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: SUB, aud: 'authenticated' })}.`;
    const r = v.verify(noneToken);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe('unsupported_alg');
  });
});
