const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

(async () => {
  const nuevaExplicacion = `La pregunta presenta un problema: NINGUNA de las opciones es correcta según la documentación oficial de Microsoft Word.

❌ Los corchetes [ ] en Word solo funcionan para rangos de CARACTERES INDIVIDUALES, no para números completos.

SINTAXIS CORRECTA en Word:
• [0-9] busca cualquier dígito único (0, 1, 2... 9)
• [a-z] busca cualquier letra minúscula
• [A-Z] busca cualquier letra mayúscula

❌ SINTAXIS INCORRECTA:
• [150-175] NO funciona (no es un rango de caracteres individuales)
• [150?175], [150*175], [150@175] NO son sintaxis válidas

SOLUCIÓN REAL para buscar números 150-175:
Para buscar números en este rango en Word, necesitarías usar patrones más complejos:
• 15[0-9] encuentra números de 150-159
• 16[0-9] encuentra números de 160-169
• 17[0-5] encuentra números de 170-175

FUENTES OFICIALES:
• Microsoft Support: "Square brackets are used to find alternate characters or ranges of characters"
• WordMVP Documentation: "Los corchetes funcionan carácter por carácter, no como operador de rangos numéricos amplios"
• Ejemplos oficiales: [0-9] para dígitos individuales, [a-z] para letras

CONCLUSIÓN: Esta pregunta necesita revisión, ya que la respuesta marcada como correcta (opción A: [150-175]) es técnicamente incorrecta según la documentación oficial de Microsoft Word.`;

  const { data, error } = await supabase
    .from('questions')
    .update({
      verification_status: 'incorrect',
      verified_at: new Date().toISOString(),
      explanation: nuevaExplicacion
    })
    .eq('id', 'd7b8cb98-03be-4561-9a3f-98011844268a')
    .select();

  if (error) {
    console.error('❌ Error al actualizar:', error);
  } else {
    console.log('✅ Pregunta actualizada correctamente');
    console.log('Estado: INCORRECT');
    console.log('Verificada el:', new Date().toISOString());
    console.log('\nDatos actualizados:');
    console.log(JSON.stringify(data, null, 2));
  }
})();
