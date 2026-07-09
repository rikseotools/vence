// Mock de `server-only` para Jest.
// `server-only` es un guard de build que lanza si un módulo de servidor se
// importa desde un Client Component. En tests (entorno node/jsdom) no aplica y
// además rompería la importación de módulos server-only legítimos (fetchers,
// queries). Aquí es un no-op.
module.exports = {}
