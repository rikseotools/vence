/**
 * @jest-environment node
 */
// T-199 (08/08/2026): el icono 🎁 no puede aparecer en el mismo instante del pago —una
// recomendación hecha el mismo día huele a incentivada (objeción de Manuel, 27/07)—, así que
// además de poder acceder al programa hace falta antigüedad desde el alta. Es la única función
// que decide SI se enseña el icono, así que se fija aquí.
import { debeMostrarIconoRecompensas, DIAS_MINIMOS_ANTES_DE_MOSTRAR_ICONO } from '@/lib/referrals/logic'

const NOW = new Date('2026-08-08T12:00:00Z')
const haceNDias = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

describe('debeMostrarIconoRecompensas', () => {
  it('sin poder acceder al programa, nunca se enseña — da igual la antigüedad', () => {
    expect(
      debeMostrarIconoRecompensas({
        puedeAccederAlPrograma: false,
        createdAt: haceNDias(365),
        now: NOW,
      })
    ).toBe(false)
  })

  it('recién pagado (el caso real que motiva la ficha): NO se enseña el mismo día', () => {
    expect(
      debeMostrarIconoRecompensas({
        puedeAccederAlPrograma: true,
        createdAt: NOW.toISOString(),
        now: NOW,
      })
    ).toBe(false)
  })

  it('un día antes del umbral: sigue sin enseñarse', () => {
    expect(
      debeMostrarIconoRecompensas({
        puedeAccederAlPrograma: true,
        createdAt: haceNDias(DIAS_MINIMOS_ANTES_DE_MOSTRAR_ICONO - 1),
        now: NOW,
      })
    ).toBe(false)
  })

  it('justo en el umbral: ya se enseña (>=, no solo >)', () => {
    expect(
      debeMostrarIconoRecompensas({
        puedeAccederAlPrograma: true,
        createdAt: haceNDias(DIAS_MINIMOS_ANTES_DE_MOSTRAR_ICONO),
        now: NOW,
      })
    ).toBe(true)
  })

  it('con antigüedad de sobra (caso típico medido: semanas o meses), se enseña', () => {
    expect(
      debeMostrarIconoRecompensas({
        puedeAccederAlPrograma: true,
        createdAt: haceNDias(90),
        now: NOW,
      })
    ).toBe(true)
  })

  it('dato roto o ausente falla CERRADO, no se enseña — no hay antigüedad que demostrar', () => {
    for (const createdAt of [null, undefined, '', 'no-es-una-fecha']) {
      expect(
        debeMostrarIconoRecompensas({ puedeAccederAlPrograma: true, createdAt, now: NOW })
      ).toBe(false)
    }
  })

  it('una fecha de alta en el FUTURO (reloj desincronizado) no revienta ni da falso positivo', () => {
    expect(
      debeMostrarIconoRecompensas({
        puedeAccederAlPrograma: true,
        createdAt: haceNDias(-5),
        now: NOW,
      })
    ).toBe(false)
  })

  it('el umbral vive en una constante — hoy 14 días, el extremo bajo del rango 14-30 de la ficha', () => {
    expect(DIAS_MINIMOS_ANTES_DE_MOSTRAR_ICONO).toBe(14)
  })
})
