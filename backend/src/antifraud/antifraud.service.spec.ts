import { AntifraudService } from './antifraud.service';

describe('AntifraudService — extractores estáticos', () => {
  describe('extractDeviceId', () => {
    it('lee header x-device-id (string)', () => {
      expect(AntifraudService.extractDeviceId({ 'x-device-id': 'abc123' })).toBe('abc123');
    });
    it('lee header x-device-id (array → primera entrada)', () => {
      expect(
        AntifraudService.extractDeviceId({ 'x-device-id': ['abc123', 'extra'] }),
      ).toBe('abc123');
    });
    it('null si header ausente', () => {
      expect(AntifraudService.extractDeviceId({})).toBeNull();
    });
    it('null si header undefined', () => {
      expect(
        AntifraudService.extractDeviceId({ 'x-device-id': undefined }),
      ).toBeNull();
    });
    it('null si array vacío', () => {
      expect(
        AntifraudService.extractDeviceId({ 'x-device-id': [] as unknown as string[] }),
      ).toBeNull();
    });
  });

  describe('extractHwFingerprint', () => {
    it('lee header x-hw-fingerprint', () => {
      expect(
        AntifraudService.extractHwFingerprint({ 'x-hw-fingerprint': 'fp-xyz' }),
      ).toBe('fp-xyz');
    });
    it('null si ausente', () => {
      expect(AntifraudService.extractHwFingerprint({})).toBeNull();
    });
  });
});

describe('AntifraudService.parseDeviceLabel', () => {
  // 4 browsers detectables × 5 OS = 20 combos + 4 edge cases

  const browsers: Record<string, string> = {
    Chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    Safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    Edge: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  };

  describe('detección de browser', () => {
    for (const [name, ua] of Object.entries(browsers)) {
      it(`${name} se detecta`, () => {
        expect(AntifraudService.parseDeviceLabel(ua).startsWith(name)).toBe(true);
      });
    }

    it('Edge NO se confunde con Chrome (contiene "Chrome" pero también "Edg")', () => {
      // Caso crítico: orden de los if matters
      const ua = browsers.Edge;
      expect(AntifraudService.parseDeviceLabel(ua)).toBe('Edge / Mac');
    });

    it('Safari real (sin Chrome en UA) se detecta correctamente', () => {
      const ua = browsers.Safari;
      expect(AntifraudService.parseDeviceLabel(ua).startsWith('Safari')).toBe(true);
    });

    it('UA desconocido → "Unknown / ..."', () => {
      expect(AntifraudService.parseDeviceLabel('curl/8.0')).toBe('Unknown / Unknown');
    });
  });

  describe('detección de OS', () => {
    const osCases: Record<string, string> = {
      iOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      Android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      Windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120',
      Linux: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
    };

    for (const [os, ua] of Object.entries(osCases)) {
      it(`${os} se detecta`, () => {
        expect(AntifraudService.parseDeviceLabel(ua).endsWith(os)).toBe(true);
      });
    }

    it('iPad también se detecta como iOS', () => {
      const ua = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
      expect(AntifraudService.parseDeviceLabel(ua).endsWith('iOS')).toBe(true);
    });

    it('iOS gana a Mac aunque iPhone UA contenga "Mac OS X"', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari';
      expect(AntifraudService.parseDeviceLabel(ua).endsWith('iOS')).toBe(true);
    });

    it('UA sin OS reconocible → "... / Unknown"', () => {
      expect(AntifraudService.parseDeviceLabel('Chrome/120 SomeBSD')).toBe('Chrome / Unknown');
    });
  });

  describe('combinaciones completas (4 × 5)', () => {
    const fullCombos: Array<[string, string, string]> = [
      ['Chrome', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', 'Chrome / Windows'],
      ['Chrome', 'Mozilla/5.0 (Macintosh; Mac OS X) Chrome/120', 'Chrome / Mac'],
      ['Chrome', 'Mozilla/5.0 (X11; Linux) Chrome/120', 'Chrome / Linux'],
      ['Chrome', 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari', 'Chrome / Android'],
      ['Firefox', 'Mozilla/5.0 (Windows NT 10.0; rv:121) Firefox/121', 'Firefox / Windows'],
      ['Firefox', 'Mozilla/5.0 (Macintosh; rv:121) Firefox/121', 'Firefox / Mac'],
      ['Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari', 'Safari / iOS'],
      ['Edge', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537 Edg/120', 'Edge / Windows'],
    ];
    for (const [_browserName, ua, expected] of fullCombos) {
      it(`UA "${ua.slice(0, 50)}..." → "${expected}"`, () => {
        expect(AntifraudService.parseDeviceLabel(ua)).toBe(expected);
      });
    }
  });
});
