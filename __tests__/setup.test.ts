// __tests__/setup.test.js
// Test básico para verificar que Jest funciona correctamente

describe('Jest Setup', () => {
  test('debe ejecutar tests básicos', () => {
    expect(1 + 1).toBe(2)
  })

  test('debe tener acceso a jsdom', () => {
    expect(window).toBeDefined()
    expect(document).toBeDefined()
  })

  test('debe tener acceso a dom básico', () => {
    const div = document.createElement('div')
    div.textContent = 'Hello World'
    document.body.appendChild(div)
    
    expect(div.textContent).toBe('Hello World')
  })
})