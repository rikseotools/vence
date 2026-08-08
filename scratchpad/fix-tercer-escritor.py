import pathlib

p = pathlib.Path('/home/manuel/vence-sessions/movil3/scripts/reparar-narrativa-letra-clavada.ts')
s = p.read_text()

# 1) importar el detector compartido, igual que los otros dos escritores
VIEJO_IMPORT = """import {
  isStructuredExplanation,"""
NUEVO_IMPORT = """import { optionsReferenceOtherOptions } from '@/lib/shuffle/classifyShuffleMode'
import {
  isStructuredExplanation,"""
assert VIEJO_IMPORT in s
s = s.replace(VIEJO_IMPORT, NUEVO_IMPORT, 1)

# 2) no marcar `safe` sin mirar si las opciones se citan entre sí
VIEJO = """    await db.execute(sql`
      SELECT record_shuffle_safety(${p.id}::uuid, 'safe', 'structured_explanation', 'reparar-narrativa')`)
  }"""
NUEVO = """    // NO se marca `safe` a ciegas. Podar la letra de la narrativa arregla UN defecto; no dice
    // nada sobre si las opciones se citan entre sí («como en la opción B…»), que es lo que hace
    // imposible barajar por otra vía. `record_shuffle_safety` solo valida la CADENA del estado,
    // no el contenido, así que la comprobación tiene que estar aquí — y con el MISMO detector
    // compartido que ya usan los otros dos escritores de `explanation_data`, no con una copia.
    //
    // Medido el 08/08 al encontrarlo: **79 preguntas activas con explicación estructurada tienen
    // opciones que se citan entre sí**. Sin esto, podar cualquiera de ellas la dejaba marcada
    // `safe` siendo `unsafe` — y el serve la habría barajado.
    const cruzadas = optionsReferenceOtherOptions(p.opciones)
    await db.execute(sql`
      SELECT record_shuffle_safety(
        ${p.id}::uuid,
        ${cruzadas ? 'unsafe' : 'safe'},
        ${cruzadas ? 'options_reference_others' : 'structured_explanation'},
        'reparar-narrativa')`)
    if (cruzadas) marcadasUnsafe++
  }"""
assert VIEJO in s
s = s.replace(VIEJO, NUEVO, 1)

# 3) las opciones tienen que viajar hasta ahí
s = s.replace(
  "  const podables: Array<{ id: string; antes: string; despues: string; estructura: StructuredExplanation; cambiaTexto: boolean; estilo: string }> = []",
  "  const podables: Array<{ id: string; antes: string; despues: string; estructura: StructuredExplanation; cambiaTexto: boolean; estilo: string; opciones: string[] }> = []\n"
  "  let marcadasUnsafe = 0", 1)
s = s.replace("""    podables.push({
      id: f.id,""", """    podables.push({
      id: f.id,
      opciones,""", 1)

# 4) que se vea en el informe: una reparación que además destapa un unsafe es información
s = s.replace("""  if (podables.length) {
    try {""", """  if (marcadasUnsafe) {
    console.log(`\\n⚠️  ${marcadasUnsafe} de las podadas quedan como \\`unsafe\\`: sus opciones se citan entre sí`)
    console.log('   (podar la narrativa no las arregla — eso es un defecto distinto, ver §5.1)')
  }
  if (podables.length) {
    try {""", 1)

p.write_text(s)
print('tercer escritor cerrado')
