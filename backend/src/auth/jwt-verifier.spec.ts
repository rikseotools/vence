import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { JwtVerifier } from './jwt-verifier';

const TEST_SECRET = 'test-secret-that-is-long-enough-for-hs256-do-not-use-in-prod';
const TEST_USER_ID = '3260627f-2018-4a5e-8234-e6f07015abb9';

function makeConfig(secret: string | undefined): ConfigService {
  return {
    get: (key: string) => (key === 'SUPABASE_JWT_SECRET' ? secret : undefined),
  } as unknown as ConfigService;
}

function signTestJwt(
  payload: Record<string, unknown>,
  secret: string = TEST_SECRET,
  options: jwt.SignOptions = {},
): string {
  return jwt.sign(payload, secret, { algorithm: 'HS256', ...options });
}

describe('JwtVerifier', () => {
  describe('configuración', () => {
    it('si no hay SUPABASE_JWT_SECRET, devuelve no_secret_configured', () => {
      const v = new JwtVerifier(makeConfig(undefined));
      const result = v.verify('cualquier-token');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('no_secret_configured');
    });
  });

  describe('extractBearerToken (static)', () => {
    it('extrae token Bearer del header', () => {
      expect(JwtVerifier.extractBearerToken('Bearer abc123')).toBe('abc123');
    });
    it('null si no hay header', () => {
      expect(JwtVerifier.extractBearerToken(null)).toBeNull();
      expect(JwtVerifier.extractBearerToken(undefined)).toBeNull();
    });
    it('null si no empieza con "Bearer "', () => {
      expect(JwtVerifier.extractBearerToken('Basic xyz')).toBeNull();
      expect(JwtVerifier.extractBearerToken('abc123')).toBeNull();
    });
    it('null si Bearer pero token vacío', () => {
      expect(JwtVerifier.extractBearerToken('Bearer ')).toBeNull();
      expect(JwtVerifier.extractBearerToken('Bearer    ')).toBeNull();
    });
  });

  describe('verify()', () => {
    let verifier: JwtVerifier;

    beforeEach(() => {
      verifier = new JwtVerifier(makeConfig(TEST_SECRET));
    });

    it('null/undefined/empty → no_token', () => {
      for (const t of [null, undefined, '']) {
        const r = verifier.verify(t);
        expect(r.success).toBe(false);
        if (!r.success) expect(r.error).toBe('no_token');
      }
    });

    it('token válido HS256 + audience + sub → success con userId/email/role', () => {
      const token = signTestJwt(
        {
          sub: TEST_USER_ID,
          aud: 'authenticated',
          email: 'a@b.com',
          role: 'authenticated',
        },
        TEST_SECRET,
        { expiresIn: '1h' },
      );
      const r = verifier.verify(token);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.userId).toBe(TEST_USER_ID);
        expect(r.email).toBe('a@b.com');
        expect(r.role).toBe('authenticated');
      }
    });

    it('token sin email → email es null pero success', () => {
      const token = signTestJwt(
        { sub: TEST_USER_ID, aud: 'authenticated' },
        TEST_SECRET,
        { expiresIn: '1h' },
      );
      const r = verifier.verify(token);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.email).toBeNull();
        expect(r.role).toBe('authenticated'); // default
      }
    });

    it('token sin sub → malformed (defense in depth)', () => {
      const token = signTestJwt(
        { aud: 'authenticated' }, // sin sub
        TEST_SECRET,
        { expiresIn: '1h' },
      );
      const r = verifier.verify(token);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error).toBe('malformed');
    });

    it('token firmado con OTRO secret → invalid_signature', () => {
      const token = signTestJwt(
        { sub: TEST_USER_ID, aud: 'authenticated' },
        'otro-secret-distinto-y-suficientemente-largo-para-hs256',
        { expiresIn: '1h' },
      );
      const r = verifier.verify(token);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error).toBe('invalid_signature');
    });

    it('token expirado → expired', () => {
      const token = signTestJwt(
        { sub: TEST_USER_ID, aud: 'authenticated' },
        TEST_SECRET,
        { expiresIn: '-1h' }, // ya expirado
      );
      const r = verifier.verify(token);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error).toBe('expired');
    });

    it('audience equivocado → wrong_audience', () => {
      const token = signTestJwt(
        { sub: TEST_USER_ID, aud: 'admin' }, // no es authenticated
        TEST_SECRET,
        { expiresIn: '1h' },
      );
      const r = verifier.verify(token);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error).toBe('wrong_audience');
    });

    it('token completamente malformado (basura no-JWT) → malformed', () => {
      const r = verifier.verify('no.es.un.jwt.valido.basura');
      expect(r.success).toBe(false);
      if (!r.success) {
        // según jsonwebtoken puede ser malformed o invalid_signature.
        // Ambos son aceptables — lo importante es NO success.
        expect(['malformed', 'invalid_signature']).toContain(r.error);
      }
    });

    it('algorithm confusion: token firmado con alg distinto (RS256) → rechazado', () => {
      // Aunque firmemos con alg falso, jsonwebtoken con whitelist HS256
      // rechazará. Aquí simulamos con un token cuyo header dice 'none'
      // (caso clásico de algorithm confusion attack).
      // Para crear "alg: none" manualmente, no podemos con jsonwebtoken
      // (rechaza al firmar). Validamos con un payload base64 manipulado.
      const fakeNoneToken = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' }),
      )
        .toString('base64url') +
        '.' +
        Buffer.from(
          JSON.stringify({ sub: TEST_USER_ID, aud: 'authenticated' }),
        ).toString('base64url') +
        '.';
      const r = verifier.verify(fakeNoneToken);
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(['invalid_signature', 'malformed', 'unsupported_alg']).toContain(
          r.error,
        );
      }
    });
  });
});
