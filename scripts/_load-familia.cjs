// scripts/_load-familia.cjs
// Carga el clasificador de familia (lib/oposiciones/familia.ts) desde scripts .cjs
// sin ts-node: transpila el TS al vuelo con babel → CJS en memoria. ÚNICA fuente:
// backfill, sim y canary lo usan (no se duplica la lógica de clasificación).
const fs = require('fs')
const path = require('path')

module.exports = function loadFamiliaModule() {
  const file = path.resolve(__dirname, '../lib/oposiciones/familia.ts')
  const src = fs.readFileSync(file, 'utf8')
  const { code } = require('@babel/core').transformSync(src, {
    filename: file,
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' } }],
      '@babel/preset-typescript',
    ],
    babelrc: false,
    configFile: false,
  })
  const mod = { exports: {} }
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require)
  return mod.exports
}
