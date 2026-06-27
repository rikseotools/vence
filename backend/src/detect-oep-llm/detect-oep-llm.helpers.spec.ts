import { detectGenericSeguimiento, normalizeDate } from './detect-oep-llm.service';
import type { LlmExtraction } from '../oep-signals/oep-signals.schemas';

const withInfo = { hasOepInfo: true } as LlmExtraction;
const noInfo = { hasOepInfo: false } as LlmExtraction;

describe('detectGenericSeguimiento (incidente Extremadura 27/06)', () => {
  it('oposición ACTIVA cuya página no contiene su convocatoria → 🚩 genérica', () => {
    expect(detectGenericSeguimiento(noInfo, { isActive: true })).toBe(true);
    expect(detectGenericSeguimiento(null, { isActive: true })).toBe(true);
  });

  it('página específica (hasOepInfo=true) → no se marca', () => {
    expect(detectGenericSeguimiento(withInfo, { isActive: true })).toBe(false);
  });

  it('oposición catalogada (inactiva) con URL genérica → no se marca (esperable)', () => {
    expect(detectGenericSeguimiento(noInfo, { isActive: false })).toBe(false);
  });
});

describe('normalizeDate (cross-check de fecha de examen)', () => {
  it('ISO YYYY-MM-DD', () => {
    expect(normalizeDate('el examen es 2026-06-13 en cinco sedes')).toBe('2026-06-13');
  });
  it('DD/MM/AAAA y DD-MM-AAAA → ISO', () => {
    expect(normalizeDate('13/06/2026')).toBe('2026-06-13');
    expect(normalizeDate('1-6-2026')).toBe('2026-06-01');
  });
  it('fecha en texto sin números reconocibles → null (no genera señal)', () => {
    expect(normalizeDate('sábado trece de junio')).toBeNull();
    expect(normalizeDate('pendiente de fecha')).toBeNull();
  });
});
