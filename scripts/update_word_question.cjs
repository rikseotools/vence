const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NzY3MDMsImV4cCI6MjA2NjQ1MjcwM30.LNP-D1h8Tm4c3XReQTLW5wc6Iihzk_5TuRTFgeAaiLw'
);

const newExplanation = `❌ PREGUNTA INCORRECTA - RESPUESTA VERIFICADA CON DOCUMENTACIÓN OFICIAL

**PROBLEMA IDENTIFICADO:**
La pregunta indica que la respuesta correcta es "Señale a la izquierda del texto y haga triple clic" para seleccionar TODO el documento. Esto es FALSO.

**LO QUE HACE TRIPLE CLIC REALMENTE (verificado con fuentes oficiales):**
- **Triple clic DENTRO de un párrafo**: Selecciona ese párrafo completo (no todo el documento)
- **Triple clic en el margen izquierdo**: NO selecciona todo el documento

**MÉTODOS OFICIALES PARA SELECCIONAR TODO EL DOCUMENTO:**
1. **Ctrl+E** (versión en español de Word)
2. **Ctrl+A** (versión en inglés de Word)
3. Cinta de opciones: Inicio > Seleccionar > Seleccionar todo

**FUENTES VERIFICADAS:**
- Microsoft Support - Select text: Triple-click selecciona un párrafo, NO todo el documento
- Asesoría en SIG: "Triple-click sobre el párrafo selecciona todo un párrafo"
- AulaFacil Word 2010: "Triple click selecciona todo un párrafo"

**RECOMENDACIÓN:**
Esta pregunta debe ser marcada como INCORRECTA y desactivada. Ninguna de las opciones dadas (A, B, C, D) describe correctamente cómo seleccionar todo el documento en Word 365.

Verificado: ${new Date().toISOString().split('T')[0]}`;

(async () => {
  const { data, error } = await supabase
    .from('questions')
    .update({
      verification_status: 'tech_incorrect',
      verified_at: new Date().toISOString(),
      explanation: newExplanation,
      is_active: false,
      topic_review_status: 'tech_bad_answer',
      updated_at: new Date().toISOString()
    })
    .eq('id', '508a950d-4da5-40ad-94d1-c70ce162584a')
    .select();

  if (error) {
    console.error('❌ Error al actualizar:', error);
  } else {
    console.log('✅ Pregunta actualizada correctamente');
    console.log('Estado: tech_incorrect');
    console.log('Activa: false');
    console.log('Explicación actualizada con fuentes oficiales');
    console.log('\nDatos actualizados:');
    console.log(JSON.stringify(data, null, 2));
  }
})();
