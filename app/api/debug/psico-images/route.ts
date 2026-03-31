// API para servir imágenes locales de psicotécnicas (solo desarrollo)
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const IMG_DIR = join(process.cwd(), 'preguntas-para-subir/auxiliar-madrid/images')

// Lista de las 405 imágenes relevantes (preguntas desactivadas sin content_data)
let relevantFiles: string[] | null = null
function getRelevantFiles(): string[] {
  if (!relevantFiles) {
    try {
      const path = '/tmp/psico_relevant_images.json'
      relevantFiles = JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      relevantFiles = []
    }
  }
  return relevantFiles!
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const file = searchParams.get('file')
  const action = searchParams.get('action')

  // Listar solo las imágenes relevantes (405)
  if (action === 'list') {
    const files = getRelevantFiles().filter(f => existsSync(join(IMG_DIR, f)))
    return Response.json({ count: files.length, files })
  }

  // Servir imagen específica
  if (!file) {
    return Response.json({ error: 'file param required' }, { status: 400 })
  }

  // Seguridad: solo permitir nombres de archivo simples
  if (file.includes('/') || file.includes('..')) {
    return Response.json({ error: 'invalid file' }, { status: 400 })
  }

  const path = join(IMG_DIR, file)
  if (!existsSync(path)) {
    return Response.json({ error: 'not found' }, { status: 404 })
  }

  const buffer = readFileSync(path)
  const ext = file.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'

  return new Response(buffer, {
    headers: { 'Content-Type': `image/${ext}`, 'Cache-Control': 'public, max-age=3600' }
  })
}
