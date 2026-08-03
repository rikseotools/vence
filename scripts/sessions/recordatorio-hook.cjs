#!/usr/bin/env node
/**
 * recordatorio-hook.cjs — el recordatorio de método, cada N mensajes. (T-495, 03/08/2026)
 *
 * Lo invoca el hook `UserPromptSubmit` de `.claude/settings.json`, así que corre en TODAS las
 * sesiones sin que nadie tenga que acordarse de nada. Es la tercera vía de T-495, y cubre lo que
 * las otras dos no pueden: los tramos largos en los que la sesión ni estrena ficheros ni renueva
 * el lease, pero sigue decidiendo cosas.
 *
 * ── POR QUÉ CADA N MENSAJES Y NO CADA N MINUTOS ─────────────────────────────────────────────
 * Un temporizador dispara mientras la sesión piensa, compila o espera un deploy — momentos en los
 * que no hay ninguna decisión que corregir. El turno de conversación SÍ es una unidad de trabajo:
 * cada uno es una decisión tomada. Y el intervalo es alto (15) a propósito: recordar cada dos
 * turnos es ruido, y el ruido es lo que hace que se deje de leer.
 *
 * ── EL TEXTO NO VIVE AQUÍ ───────────────────────────────────────────────────────────────────
 * Sale de `lib/sessions/recordatorio.cjs`, el mismo núcleo que usan el `pre-commit` y el
 * `heartbeat`. Tres copias del mismo recordatorio acabarían diciendo tres cosas distintas.
 *
 * **Nunca falla hacia fuera:** ante cualquier problema sale con 0 y sin escribir nada. Un hook que
 * revienta bloquearía el prompt del usuario, y eso se desactiva el primer día.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const REPO = path.resolve(__dirname, '../..')
const CADA = Number(process.env.VENCE_RECORDATORIO_CADA || 15)
const DIR = path.join(os.tmpdir(), 'vence-recordatorio')

function main(entrada) {
  let sid = 'sin-sesion'
  try { sid = String(JSON.parse(entrada || '{}').session_id || sid) } catch { /* payload raro: se sigue */ }

  // El contador es POR SESIÓN y vive en un fichero efímero: si se pierde, lo peor que pasa es que
  // el recordatorio llegue una vez de más. No merece una tabla.
  fs.mkdirSync(DIR, { recursive: true })
  const f = path.join(DIR, sid.replace(/[^a-zA-Z0-9-]/g, '_'))
  let n = 0
  try { n = Number(fs.readFileSync(f, 'utf8')) || 0 } catch { /* primera vez */ }
  n += 1
  try { fs.writeFileSync(f, String(n)) } catch { /* sin contador, se recuerda de más, no de menos */ }

  if (n % CADA !== 0) return

  const { recordatorioPorTiempo } = require(path.join(REPO, 'lib', 'sessions', 'recordatorio.cjs'))
  // Se reutiliza el texto del recordatorio «llevas rato», que es el mismo caso: la sesión está a
  // media tarea. Se le pasa el umbral para que dispare siempre — aquí quien decide el CUÁNDO es el
  // contador de turnos, no los minutos.
  const rec = recordatorioPorTiempo(1, { umbralMin: 0 })
  if (!rec) return

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: [
        'RECORDATORIO DE MÉTODO (cada ' + CADA + ' mensajes, T-495):',
        ...rec.lineas.slice(1),
        '· y si estrenas una herramienta, REGÍSTRALA en lib/admin/toolRegistry.ts',
      ].join('\n'),
    },
    suppressOutput: true,
  }))
}

let buf = ''
process.stdin.on('data', (d) => { buf += d })
process.stdin.on('end', () => { try { main(buf) } catch { /* jamás estorbar al prompt */ } })
process.stdin.on('error', () => { /* sin stdin no hay nada que contar */ })
