import { parseFechaExamen } from './parse-fecha-examen';

describe('parseFechaExamen', () => {
  describe('acepta fechas de día único inequívocas', () => {
    it('ISO', () => {
      expect(parseFechaExamen('2026-07-04')).toBe('2026-07-04');
      expect(parseFechaExamen('2027-01-31')).toBe('2027-01-31');
    });
    it('DD/MM/YYYY (normaliza cero a la izquierda)', () => {
      expect(parseFechaExamen('4/07/2026')).toBe('2026-07-04');
      expect(parseFechaExamen('28/06/2026')).toBe('2026-06-28');
      expect(parseFechaExamen('17/10/2026')).toBe('2026-10-17');
    });
    it('DD-MM-YYYY (un solo día, no un rango)', () => {
      expect(parseFechaExamen('12-05-2025')).toBe('2025-05-12');
    });
    it('"D de MES de YYYY" (con y sin tilde, setiembre)', () => {
      expect(parseFechaExamen('4 de julio de 2026')).toBe('2026-07-04');
      expect(parseFechaExamen('8 de febrero de 2026')).toBe('2026-02-08');
      expect(parseFechaExamen('19 de septiembre de 2026')).toBe('2026-09-19');
      expect(parseFechaExamen('1 de setiembre de 2026')).toBe('2026-09-01');
    });
    it('recorta espacios sobrantes', () => {
      expect(parseFechaExamen('  2026-03-15  ')).toBe('2026-03-15');
    });
  });

  describe('rechaza (devuelve null) todo lo ambiguo o basura', () => {
    it('vacío / null / "null"', () => {
      expect(parseFechaExamen(null)).toBeNull();
      expect(parseFechaExamen(undefined)).toBeNull();
      expect(parseFechaExamen('')).toBeNull();
      expect(parseFechaExamen('   ')).toBeNull();
      expect(parseFechaExamen('null')).toBeNull();
    });
    it('rangos "19-21 de junio de 2026"', () => {
      expect(parseFechaExamen('19-21 de junio de 2026')).toBeNull();
    });
    it('varias fechas unidas por "y"', () => {
      expect(
        parseFechaExamen('14 de mayo de 2026 y 15 de marzo de 2026'),
      ).toBeNull();
      expect(parseFechaExamen('09/07/2026 y 10/07/2026')).toBeNull();
    });
    it('arrays JSON crudos', () => {
      expect(parseFechaExamen('["14/07/2026", "15/07/2026"]')).toBeNull();
    });
    it('solo mes/año o con texto entre paréntesis', () => {
      expect(parseFechaExamen('Octubre 2025')).toBeNull();
      expect(parseFechaExamen('Octubre 2025 (primer ejercicio)')).toBeNull();
    });
    it('texto con punto y coma / coma / paréntesis', () => {
      expect(
        parseFechaExamen(
          '19-21 de junio de 2026 (primera fase); a partir de octubre de 2026',
        ),
      ).toBeNull();
      expect(parseFechaExamen('4 de julio de 2026, a las 10:00')).toBeNull();
    });
    it('fechas de calendario imposibles', () => {
      expect(parseFechaExamen('31/02/2026')).toBeNull();
      expect(parseFechaExamen('2026-13-01')).toBeNull();
      expect(parseFechaExamen('35 de julio de 2026')).toBeNull();
    });
    it('mes desconocido', () => {
      expect(parseFechaExamen('4 de xulio de 2026')).toBeNull();
    });
    it('años fuera de rango', () => {
      expect(parseFechaExamen('1999-01-01')).toBeNull();
    });
  });
});
