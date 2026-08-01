/**
 * @jest-environment node
 */
// T-434 — el perfil de la sesión se resuelve MÁS DE UNA VEZ EN LA VIDA.
//
// ## Qué fija este fichero, y por qué es un guardarraíl y no un test normal
//
// El fallo original no fue un error de lógica: fue una **omisión estructural**. `token.appUserId`
// se resolvía en un único punto, dentro de `if (user?.email)`, y en Auth.js `user` solo llega en
// el primer sign-in — así que un único fallo dejaba a la persona rota **para siempre**. 235
// usuarios, el más antiguo 25 días, 85 intentos de compra rechazados en una semana.
//
// Ese código era correcto a la vista: leído solo, el bloque hace lo que dice. Lo que fallaba era
// lo que NO estaba. Por eso lo que hay que impedir no es un valor mal calculado, sino que alguien
// —simplificando, refactorizando o revirtiendo— vuelva a dejar la resolución colgando de un solo
// momento. Un test de comportamiento no lo vería: con el reintento borrado, todos los unitarios
// del núcleo puro siguen en verde.
//
// El CABLEADO es el modo de fallo más silencioso que hay: el módulo existe, sus tests pasan, y
// en producción no lo llama nadie.

import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const AUTHJS = readFileSync(join(ROOT, 'lib/auth/authjs.ts'), 'utf8')
const RESOLVER = readFileSync(join(ROOT, 'lib/auth/resolveAppUser.ts'), 'utf8')

describe('el reintento está CABLEADO en el callback jwt', () => {
  it('`authjs.ts` importa y llama al núcleo puro de la decisión', () => {
    expect(AUTHJS).toMatch(/from '\.\/reintentoPerfil'/)
    expect(AUTHJS).toMatch(/decidirReintentoPerfil\(\s*token\s*,/)
  })

  it('el reintento vive FUERA del bloque de sign-in (si no, no corre en las rotaciones)', () => {
    // Es la condición exacta que causó el fallo: `user` solo existe en el primer sign-in.
    const bloqueSignIn = AUTHJS.indexOf('if (user?.email)')
    const llamadaReintento = AUTHJS.indexOf('decidirReintentoPerfil(')
    expect(bloqueSignIn).toBeGreaterThan(-1)
    expect(llamadaReintento).toBeGreaterThan(bloqueSignIn)
    // …y por encima del `return token`, o no se llegaría a ejecutar.
    expect(llamadaReintento).toBeLessThan(AUTHJS.lastIndexOf('return token'))
  })

  it('el resultado del reintento se PERSISTE en el token (si no, se pierde en cada vuelta)', () => {
    expect(AUTHJS).toMatch(/token\.appUserId = r\.id/)
  })

  it('se deja marca del intento (sin ella, un irresoluble consulta la BD en cada carga)', () => {
    expect(AUTHJS).toMatch(/token\[CAMPO_REINTENTO\] = Math\.floor\(Date\.now\(\) \/ 1000\)/)
  })
})

describe('lo que el reintento emite: los tres casos, distinguibles', () => {
  it('la CURACIÓN deja rastro propio — es la métrica de que el atasco se drena', () => {
    expect(AUTHJS).toMatch(/eventType: 'auth_perfil_recuperado'/)
  })

  it('el FALLO en reintento se distingue del fallo en el alta', () => {
    expect(AUTHJS).toMatch(/enReintento: true/)
  })

  it('«sin email» tiene evento PROPIO: el reintento no puede curarlo nunca', () => {
    expect(AUTHJS).toMatch(/eventType: 'auth_sesion_sin_email'/)
  })

  it('las tres señales están vigiladas por una regla de alerta', () => {
    const reglas = readFileSync(join(ROOT, 'backend/src/alerts/alert-rules.ts'), 'utf8')
    for (const t of ['auth_alta_sin_perfil', 'auth_sesion_sin_email', 'auth_perfil_recuperado']) {
      expect(reglas).toContain(`'${t}'`)
    }
  })

  it('el email NUNCA viaja en claro en la telemetría (solo prefijo y dominio)', () => {
    // Si alguien mete `email: user.email` en una metadata, esto lo caza.
    const metadatas = AUTHJS.match(/metadata: \{[\s\S]*?\}/g) || []
    for (const m of metadatas) {
      expect(m).not.toMatch(/\bemail:\s*(user\.email|decision\.email|token\.email)/)
    }
    expect(AUTHJS).toMatch(/emailPrefijo/)
  })
})

// Las dos correcciones de robustez del resolutor. Cada una tapa un modo de fallo distinto y las
// dos son invisibles hasta que ocurren en producción.
describe('el resolutor no puede duplicar a un usuario ni tumbar la sesión', () => {
  it('la CONSULTA está protegida: si falla, NO se intenta crear nada', () => {
    // Crear un perfil sin saber si ya existe es el peor fallo posible aquí: la cabecera del
    // propio fichero lo dice — «un usuario hereda los datos de otro».
    expect(RESOLVER).toMatch(/motivo: 'error_lectura'/)
    // Se ancla a la LLAMADA real, no a la primera mención del nombre: `create_organic_user`
    // aparece antes en los comentarios y comparar contra eso daba un falso rojo.
    const iLectura = RESOLVER.indexOf("motivo: 'error_lectura'")
    const iCrear = RESOLVER.indexOf('SELECT create_organic_user(')
    expect(iCrear).toBeGreaterThan(-1)
    expect(iLectura).toBeLessThan(iCrear)
  })

  it('la carrera se trata como «otro lo creó», no como error', () => {
    expect(RESOLVER).toMatch(/23505/)
    expect(RESOLVER).toMatch(/motivo: 'creado_por_otro'/)
  })

  it('el resolutor DICE por qué (si solo devolviera null, no se podría emitir el evento justo)', () => {
    expect(RESOLVER).toMatch(/export type MotivoResolucion/)
    expect(RESOLVER).toMatch(/export async function resolverPerfilPorEmail/)
  })
})

// Sin el índice funcional, la consulta que ahora corre en cada reparación es un Seq Scan de
// 426 ms sobre la tabla entera (medido con EXPLAIN ANALYZE el 01/08/2026 sobre 11.713 perfiles).
// El reintento SIN el índice sería un problema de rendimiento, no una mejora.
describe('el índice que hace viable el reintento existe en las migraciones', () => {
  it('hay una migración que crea el índice único sobre lower(email)', () => {
    const mig = readFileSync(
      join(ROOT, 'supabase/migrations/20260801_user_profiles_email_lower_unique.sql'),
      'utf8',
    )
    expect(mig).toMatch(/CREATE UNIQUE INDEX CONCURRENTLY/i)
    expect(mig).toMatch(/lower\(email\)/i)
  })

  it('la consulta del resolutor y el índice usan LA MISMA expresión', () => {
    // Si divergen, el índice deja de aplicarse y volvemos al Seq Scan sin que nada avise.
    expect(RESOLVER).toMatch(/lower\(email\) = \$\{email\}/)
  })
})
