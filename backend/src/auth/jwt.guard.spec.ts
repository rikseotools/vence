import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';
import type { JwtVerifier } from './jwt-verifier';

function makeCtx(authHeader?: string): ExecutionContext {
  const request: { headers: Record<string, string>; user?: unknown; ip?: string } = {
    headers: authHeader ? { authorization: authHeader } : {},
    ip: '127.0.0.1',
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtGuard', () => {
  let verifier: jest.Mocked<JwtVerifier>;
  let guard: JwtGuard;

  beforeEach(() => {
    verifier = {
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtVerifier>;
    guard = new JwtGuard(verifier);
  });

  it('sin header Authorization → 401', () => {
    verifier.verify.mockReturnValue({ success: false, error: 'no_token' });
    const ctx = makeCtx();
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(verifier.verify).toHaveBeenCalledWith(null);
  });

  it('header sin "Bearer " → 401', () => {
    verifier.verify.mockReturnValue({ success: false, error: 'no_token' });
    const ctx = makeCtx('Basic xyz');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('Bearer + token inválido → 401 (no expone error específico al cliente)', () => {
    verifier.verify.mockReturnValue({
      success: false,
      error: 'invalid_signature',
    });
    const ctx = makeCtx('Bearer fake-token-here');
    let thrown: Error | null = null;
    try {
      guard.canActivate(ctx);
    } catch (e) {
      thrown = e as Error;
    }
    expect(thrown).toBeInstanceOf(UnauthorizedException);
    // El mensaje al cliente NO debe contener el motivo específico (anti-leak)
    expect((thrown as UnauthorizedException).message).toBe('Unauthorized');
  });

  it('Bearer + token válido → true + inyecta request.user', () => {
    verifier.verify.mockReturnValue({
      success: true,
      userId: '3260627f-2018-4a5e-8234-e6f07015abb9',
      email: 'a@b.com',
      role: 'authenticated',
    });
    const request: { headers: Record<string, string>; user?: unknown; ip?: string } = {
      headers: { authorization: 'Bearer good-token' },
      ip: '127.0.0.1',
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      userId: '3260627f-2018-4a5e-8234-e6f07015abb9',
      email: 'a@b.com',
      role: 'authenticated',
    });
    expect(verifier.verify).toHaveBeenCalledWith('good-token');
  });

  it('token expirado → 401 (mensaje genérico)', () => {
    verifier.verify.mockReturnValue({ success: false, error: 'expired' });
    const ctx = makeCtx('Bearer expired-token');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
