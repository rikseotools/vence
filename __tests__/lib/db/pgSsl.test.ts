// __tests__/lib/db/pgSsl.test.ts
//
// Núcleo puro de la conexión a RDS con `pg`. Sin BD: se prueba la TRANSFORMACIÓN,
// que es donde estaba el fallo (T-377). Lo que este módulo evita, medido:
// 14 suites de integración mudas y 3 canarios verdes sin haber mirado la BD.

/* eslint-disable @typescript-eslint/no-require-imports */
const { sinSslMode, pgConfig } = require('../../../lib/db/pgSsl.cjs')

describe('sinSslMode', () => {
  test('lo quita cuando es el único parámetro, sin dejar el "?" colgando', () => {
    expect(sinSslMode('postgres://u:p@h:5432/db?sslmode=require')).toBe('postgres://u:p@h:5432/db')
  })

  test('lo quita conservando los demás parámetros, vaya delante o detrás', () => {
    expect(sinSslMode('postgres://u:p@h:5432/db?a=1&sslmode=require')).toBe('postgres://u:p@h:5432/db?a=1')
    expect(sinSslMode('postgres://u:p@h:5432/db?sslmode=require&b=2')).toBe('postgres://u:p@h:5432/db?b=2')
  })

  test('una URL sin sslmode no se toca', () => {
    expect(sinSslMode('postgres://u:p@h:5432/db?a=1')).toBe('postgres://u:p@h:5432/db?a=1')
    expect(sinSslMode('postgres://u:p@h:5432/db')).toBe('postgres://u:p@h:5432/db')
  })

  test('acepta cualquier valor de sslmode, no solo "require"', () => {
    expect(sinSslMode('postgres://u:p@h/db?sslmode=verify-full')).toBe('postgres://u:p@h/db')
    expect(sinSslMode('postgres://u:p@h/db?sslmode=no-verify&x=1')).toBe('postgres://u:p@h/db?x=1')
  })
})

describe('pgConfig', () => {
  test('devuelve la URL ya limpia y el ssl que node-postgres necesita', () => {
    const c = pgConfig('postgres://u:p@h:5432/db?sslmode=require')
    expect(c.connectionString).toBe('postgres://u:p@h:5432/db')
    expect(c.ssl).toEqual({ rejectUnauthorized: false })
  })

  test('sin URL falla claro en vez de conectar a cualquier sitio', () => {
    const previo = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      expect(() => pgConfig()).toThrow(/DATABASE_URL/)
    } finally {
      if (previo !== undefined) process.env.DATABASE_URL = previo
    }
  })

  test('el `ssl` NO puede ir acompañado del sslmode: es el fallo que se está evitando', () => {
    // Si alguien "simplifica" pgConfig quitando la limpieza, esto lo caza: en pg el
    // sslmode de la cadena pisa la opción ssl y la conexión muere con self-signed.
    const c = pgConfig('postgres://u:p@h/db?sslmode=require')
    expect(c.connectionString).not.toMatch(/sslmode/)
  })
})
