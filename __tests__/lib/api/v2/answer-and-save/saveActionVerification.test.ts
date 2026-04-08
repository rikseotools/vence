// __tests__/lib/api/v2/answer-and-save/saveActionVerification.test.ts
// Verificar que syncOne y el API manejan saveAction correctamente
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../../../..')

describe('saveAction verification — syncOne', () => {
  const queueContent = fs.readFileSync(path.join(ROOT, 'utils/answerSaveQueue.ts'), 'utf-8')

  it('syncOne parsea response.json() para verificar saveAction', () => {
    expect(queueContent).toContain('response.json()')
    expect(queueContent).toContain('saveAction')
  })

  it('syncOne devuelve false cuando saveAction es save_failed', () => {
    expect(queueContent).toContain("data.saveAction === 'save_failed'")
    // Debe devolver false, no true
    const saveFailedBlock = queueContent.slice(
      queueContent.indexOf("data.saveAction === 'save_failed'"),
      queueContent.indexOf("data.saveAction === 'save_failed'") + 200
    )
    expect(saveFailedBlock).toContain('return false')
  })

  it('syncOne devuelve false para HTTP no-ok (antes de verificar saveAction)', () => {
    // El return false para !response.ok debe estar ANTES del check de saveAction
    const responseOkIdx = queueContent.indexOf('if (!response.ok)')
    const saveActionIdx = queueContent.indexOf("data.saveAction === 'save_failed'")
    expect(responseOkIdx).toBeLessThan(saveActionIdx)
  })

  it('syncOne devuelve false para 401', () => {
    expect(queueContent).toContain('response.status === 401')
    const block401 = queueContent.slice(
      queueContent.indexOf('response.status === 401'),
      queueContent.indexOf('response.status === 401') + 500
    )
    expect(block401).toContain('return false')
  })

  it('syncOne devuelve true solo cuando response.ok Y saveAction no es save_failed', () => {
    // El return true debe ser al final, después de todos los checks
    const lastReturnTrue = queueContent.lastIndexOf('return true')
    const saveActionCheck = queueContent.indexOf("data.saveAction === 'save_failed'")
    expect(lastReturnTrue).toBeGreaterThan(saveActionCheck)
  })
})

describe('saveAction verification — API validateAndSaveAnswer', () => {
  const queriesContent = fs.readFileSync(path.join(ROOT, 'lib/api/v2/answer-and-save/queries.ts'), 'utf-8')

  it('devuelve success basado en saveResult.success, no hardcoded true', () => {
    // Buscar el return final
    const returnBlock = queriesContent.slice(
      queriesContent.lastIndexOf('return {'),
      queriesContent.lastIndexOf('return {') + 300
    )
    expect(returnBlock).toContain('success: saveResult.success')
    expect(returnBlock).not.toContain('success: true')
  })

  it('loguea error cuando save falla', () => {
    expect(queriesContent).toContain('save_failed')
    expect(queriesContent).toContain('console.error')
  })

  it('solo actualiza score cuando save tiene éxito', () => {
    expect(queriesContent).toContain('if (saveResult.success)')
  })
})

describe('saveAction verification — Route HTTP status', () => {
  const routeContent = fs.readFileSync(path.join(ROOT, 'app/api/v2/answer-and-save/route.ts'), 'utf-8')

  it('devuelve HTTP 500 cuando saveAction es save_failed', () => {
    expect(routeContent).toContain('save_failed')
    expect(routeContent).toContain('500')
  })

  it('devuelve HTTP 404 cuando pregunta no encontrada', () => {
    expect(routeContent).toContain('404')
  })

  it('no devuelve 200 para save_failed', () => {
    // Si result.success es false, no debe llegar al return 200
    const successCheckIdx = routeContent.indexOf('if (!result.success)')
    const return200Idx = routeContent.indexOf('return NextResponse.json(result)')
    // El check de !result.success debe estar ANTES del return 200
    expect(successCheckIdx).toBeLessThan(return200Idx)
  })
})

describe('saveAction verification — Client retry', () => {
  const clientContent = fs.readFileSync(path.join(ROOT, 'lib/api/v2/answer-and-save/client.ts'), 'utf-8')

  it('reintenta en 5xx (save_failed devuelve 500)', () => {
    expect(clientContent).toContain('response.status >= 500')
    expect(clientContent).toContain('continue') // retry
  })

  it('no reintenta en 4xx', () => {
    // 4xx lanza error sin retry
    const block4xx = clientContent.slice(
      clientContent.indexOf('response.status >= 500'),
      clientContent.indexOf('response.status >= 500') + 200
    )
    expect(block4xx).toContain('throw')
  })
})

describe('saveAction verification — Escenarios completos', () => {
  const queueContent = fs.readFileSync(path.join(ROOT, 'utils/answerSaveQueue.ts'), 'utf-8')
  const queriesContent = fs.readFileSync(path.join(ROOT, 'lib/api/v2/answer-and-save/queries.ts'), 'utf-8')

  it('Escenario: save OK → API success:true → syncOne true → respuesta eliminada de cola', () => {
    // API devuelve success:true con saveAction:saved_new
    expect(queriesContent).toContain('success: saveResult.success')
    // syncOne verifica saveAction !== save_failed → true
    expect(queueContent).toContain('return true')
  })

  it('Escenario: save FAIL → API success:false + 500 → syncOne false → respuesta se reintenta', () => {
    // API devuelve success:false con saveAction:save_failed
    expect(queriesContent).toContain('success: saveResult.success')
    // Route devuelve 500
    // syncOne recibe !response.ok → return false
    expect(queueContent).toContain('if (!response.ok)')
    // O si por alguna razón llega 200 con save_failed, syncOne también detecta
    expect(queueContent).toContain("data.saveAction === 'save_failed'")
  })

  it('Escenario: pregunta no encontrada → API success:false + 404 → no retry (4xx)', () => {
    // correctOption === null → success:false → 404
    expect(queriesContent).toContain('correctOption === null')
  })

  it('Escenario: duplicate (23505) → API success:true + already_saved → syncOne true', () => {
    // insertTestAnswer devuelve success:true, action:already_saved
    const insertContent = fs.readFileSync(path.join(ROOT, 'lib/api/test-answers/queries.ts'), 'utf-8')
    expect(insertContent).toContain("'23505'")
    expect(insertContent).toContain("action: 'already_saved'")
  })

  it('Escenario: network error → syncOne catch → false → reintento', () => {
    expect(queueContent).toContain('catch (err)')
    expect(queueContent).toContain('return false')
  })

  it('Escenario: timeout → syncOne abort → catch → false → reintento', () => {
    expect(queueContent).toContain('controller.abort()')
    // El abort cae en el catch genérico que devuelve false
    expect(queueContent).toContain('catch (err)')
  })
})
