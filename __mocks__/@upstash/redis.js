// __mocks__/@upstash/redis.js — Mock para Jest (Upstash exporta ESM puro)
// Stubs no-op: el cache se trata como "siempre miss" en tests, lo cual
// es el fallback graceful que ya implementa lib/cache/redis.ts. Las llamadas
// devuelven Promise<null/0> para no bloquear la cadena.
module.exports = {
  Redis: class Redis {
    constructor() {}
    get()       { return Promise.resolve(null) }
    set()       { return Promise.resolve('OK') }
    del()       { return Promise.resolve(0) }
    hgetall()   { return Promise.resolve({}) }
    hincrby()   { return Promise.resolve(0) }
  },
}
