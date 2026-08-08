import pathlib

p = pathlib.Path('/home/manuel/vence-sessions/movil3/__tests__/flota/encargo.test.ts')
bloque = '''
// ── EL ENCARGO TIENE QUE QUEDAR EN EL LOG ────────────────────────────────────────────────────
// [T-653] copia el encargo a la cabecera del log ANTES de arrancar el turno: sin eso, el log de
// un trabajador dice qué contestó pero no QUÉ se le pidió — y con 18 de 63 revisiones en
// "problemas" el mismo día, esa es justo la distinción entre arreglar el encargo o al trabajador.
// La revisión de esa entrega marcó que el fragmento de shell se verificó A MANO (`bash -n` + un
// encargo sintético) y se quedó sin test, teniendo este fichero el patrón listo.
//
// Importa más de lo que parece: `scripts/flota/flota.cjs` está EXCLUIDO del linter, y construir
// comandos remotos con comillas anidadas es lo que ya se rompió aquí antes ([T-642], [T-486]).
// Un cambio en esa cadena dejaría de volcar el encargo EN SILENCIO.
describe('el log de un turno dice también QUÉ se le pidió (T-653)', () => {
  const src = require('fs').readFileSync(
    require('path').join(process.cwd(), 'scripts', 'flota', 'flota.cjs'), 'utf8')
  const desde = src.indexOf('function mandarEncargo')
  const bloque = src.slice(desde, desde + 6000)

  it('vuelca el encargo a la cabecera del log', () => {
    expect(bloque).toMatch(/cat \\$\\{enc\\} > \\$\\{log\\}/)
  })

  it('…y lo hace ANTES del send-keys, o el turno ya estaría escribiendo encima', () => {
    const iVolcado = bloque.indexOf('cat ${enc} > ${log}')
    const iEnvio = bloque.indexOf('send-keys')
    expect(iVolcado).toBeGreaterThan(-1)
    expect(iEnvio).toBeGreaterThan(-1)
    expect(iVolcado).toBeLessThan(iEnvio)
  })

  it('separa el encargo de la salida, para que se distingan al leerlo', () => {
    expect(bloque).toMatch(/SALIDA DEL TURNO/)
  })

  it('el texto del encargo sigue yendo por stdin, NUNCA por la línea de órdenes', () => {
    // Es lo que salva el quoting: el encargo lleva comillas, `$(…)` y saltos de línea. Si algún
    // día alguien lo interpola en el comando, esto se entera.
    expect(bloque).toMatch(/cat > \\$\\{enc\\}/)
    expect(bloque).not.toMatch(/echo\\s+\\$\\{texto\\}/)
  })
})
'''
p.write_text(p.read_text().rstrip() + '\n' + bloque)
print('ok')
