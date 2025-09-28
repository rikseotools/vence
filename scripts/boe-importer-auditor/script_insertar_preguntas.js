require("dotenv").config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fs = require('fs');

// Configuración
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000
});

// Array para guardar errores de artículos no encontrados
const erroresArticulosNoEncontrados = [];

// ✅ FUNCIÓN: Mapear nombres de leyes del JSON a los short_name de la BD
function mapearNombreLey(nombreLeyJSON) {
  const mapeoLeyes = {
    'Constitución Española': 'CE',
    'Ley 39/2015': 'Ley 39/2015',
    'Ley 29/1998': 'Ley 29/1998', 
    'Ley 40/2015': 'Ley 40/2015'
  };
  
  return mapeoLeyes[nombreLeyJSON] || nombreLeyJSON;
}

// ✅ FUNCIÓN: Normalizar número de artículo (quitar subapartados)
function normalizarNumeroArticulo(articuloNumber) {
  // Si tiene punto, quitar todo después del punto
  // Ejemplo: "76.1" → "76", "43.3" → "43"
  if (articuloNumber && articuloNumber.includes('.')) {
    return articuloNumber.split('.')[0];
  }
  return articuloNumber;
}

// ✅ FUNCIÓN: Verificar si pregunta ya existe (ANTES de generar explicación)
async function verificarPreguntaExistente(pregunta) {
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('id, primary_article_id, articles!inner(article_number, title, laws!inner(short_name))')
      .eq('question_text', pregunta.pregunta)
      .single();

    if (error && error.code === 'PGRST116') {
      // No encontrada - no existe
      return { existe: false };
    }
    
    if (error) {
      throw error;
    }

    // Pregunta existe
    return {
      existe: true,
      preguntaId: data.id,
      articuloAsignado: {
        numero: data.articles.article_number,
        titulo: data.articles.title,
        ley: data.articles.laws.short_name
      }
    };
  } catch (error) {
    console.error('Error verificando pregunta existente:', error);
    return { existe: false };
  }
}

// Función para cargar preguntas desde JSON
function cargarPreguntasDesdeJSON(rutaJSON) {
  try {
    console.log(`📄 Cargando preguntas desde: ${rutaJSON}`);
    
    if (!fs.existsSync(rutaJSON)) {
      throw new Error(`El archivo JSON no existe: ${rutaJSON}`);
    }
    
    const jsonContent = fs.readFileSync(rutaJSON, 'utf8');
    const data = JSON.parse(jsonContent);
    
    console.log(`✅ Cargadas ${data.preguntas.length} preguntas`);
    console.log(`📊 Años incluidos: ${data.metadata.años_incluidos.join(', ')}`);
    
    // Convertir formato a nuestro formato interno
    const preguntasConvertidas = data.preguntas.map(p => {
      // Convertir respuesta_correcta de letra a índice
      const letraAIndice = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
      const correcta = letraAIndice[p.respuesta_correcta.toLowerCase()];
      
      return {
        numero: p.numero,
        año: p.año_examen,
        pregunta: p.pregunta,
        opciones: [p.opciones.a, p.opciones.b, p.opciones.c, p.opciones.d],
        correcta: correcta,
        ley_mencionada: p.ley_mencionada,
        articulo_mencionado: p.articulo || null
      };
    });
    
    return preguntasConvertidas;
    
  } catch (error) {
    console.error('❌ Error cargando JSON:', error.message);
    return [];
  }
}

// Función para generar explicación educativa con GPT
async function generarExplicacionEducativa(pregunta, articuloContent, leyName, articuloNumber) {
  try {
    // ✅ USAR NOMBRE MAPEADO EN EL PROMPT
    const shortNameLey = mapearNombreLey(leyName);
    
    const prompt = `
Eres un experto en derecho administrativo. Genera una explicación educativa para esta pregunta de examen oficial:

PREGUNTA: "${pregunta.pregunta}"
OPCIONES: ${pregunta.opciones.map((op, i) => `${String.fromCharCode(97 + i)}) ${op}`).join('\n')}
RESPUESTA CORRECTA: ${String.fromCharCode(97 + pregunta.correcta)}) ${pregunta.opciones[pregunta.correcta]}

ARTÍCULO CORRESPONDIENTE:
Ley: ${shortNameLey}
Artículo: ${articuloNumber}
Contenido: "${articuloContent}"

INSTRUCCIONES:
1. Cita el artículo específico y su contenido literal relevante (usando comillas)
2. Explica el razonamiento jurídico de por qué esa respuesta es correcta
3. Conecta la pregunta con la ley de forma clara y educativa
4. Máximo 200 palabras
5. Usa un lenguaje claro pero técnicamente preciso

FORMATO: Párrafo explicativo sin comillas externas ni markdown.

EJEMPLO:
"El artículo X de la Ley Y establece que 'contenido literal relevante'. Por tanto, [explicación del razonamiento]..."
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 300
    });

    let explicacion = response.choices[0].message.content.trim();
    
    // Limpiar markdown si aparece
    if (explicacion.startsWith('```') || explicacion.startsWith('"')) {
      explicacion = explicacion.replace(/^```[a-z]*\s*/, '').replace(/```\s*$/, '');
      explicacion = explicacion.replace(/^"/, '').replace(/"$/, '');
    }

    return explicacion;
  } catch (error) {
    console.error('Error generando explicación educativa:', error);
    // ✅ USAR NOMBRE MAPEADO EN FALLBACK TAMBIÉN
    const shortNameLey = mapearNombreLey(leyName);
    return `Según el artículo ${articuloNumber} de ${shortNameLey}, la respuesta correcta es: ${pregunta.opciones[pregunta.correcta]}. Para más detalles, consulte el contenido completo del artículo.`;
  }
}

// Función para sugerir artículo usando GPT
async function sugerirArticuloConGPT(pregunta) {
  try {
    const prompt = `
Analiza esta pregunta de examen oficial y sugiere QUÉ ARTÍCULO ESPECÍFICO de la ley mencionada podría responder a esta pregunta:

PREGUNTA: "${pregunta.pregunta}"
OPCIONES: ${pregunta.opciones.map((op, i) => `${String.fromCharCode(97 + i)}) ${op}`).join('\n')}
LEY MENCIONADA: ${pregunta.ley_mencionada}

Responde SOLO con un JSON sin markdown:
{
  "articulo_sugerido": "número del artículo",
  "confianza": 0-100,
  "razon": "breve explicación de por qué este artículo"
}

IMPORTANTE:
- Solo sugiere el NÚMERO del artículo (ej: "35", "21", "4 bis")
- Si no estás seguro, pon confianza baja
- Si no sabes, pon articulo_sugerido: null
- NO uses bloques de código markdown
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 300
    });

    let content = response.choices[0].message.content.trim();
    
    // Limpiar markdown si aparece
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    }
    if (content.startsWith('```')) {
      content = content.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Error sugiriendo artículo con GPT:', error);
    return { articulo_sugerido: null, confianza: 0, razon: "Error en sugerencia" };
  }
}

// Función para verificar correspondencia con GPT
async function verificarCorrespondenciaConGPT(pregunta, articuloContent, leyName, articuloNumber) {
  try {
    const prompt = `
Analiza si esta pregunta de examen oficial corresponde al contenido del artículo proporcionado:

PREGUNTA: "${pregunta.pregunta}"
OPCIONES: ${pregunta.opciones.map((op, i) => `${String.fromCharCode(97 + i)}) ${op}`).join('\n')}
RESPUESTA CORRECTA: ${String.fromCharCode(97 + pregunta.correcta)}) ${pregunta.opciones[pregunta.correcta]}

ARTÍCULO A VERIFICAR:
Ley: ${leyName}
Artículo: ${articuloNumber}
Contenido: "${articuloContent}"

ANÁLISIS REQUERIDO:
1. ¿El tema de la pregunta corresponde exactamente al contenido del artículo?
2. ¿La respuesta correcta está fundamentada en este artículo específico?
3. ¿Hay alguna discrepancia entre la pregunta y el artículo?

Responde SOLO con un JSON sin markdown:
{
  "corresponde": true/false,
  "confianza": 0-100,
  "razon": "explicación breve",
  "articulo_sugerido": "número del artículo correcto si no corresponde, o null"
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 300
    });

    let content = response.choices[0].message.content.trim();
    
    // Limpiar markdown si aparece
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    }
    if (content.startsWith('```')) {
      content = content.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Error con GPT:', error);
    return { corresponde: false, confianza: 0, razon: "Error en verificación", articulo_sugerido: null };
  }
}

// ✅ FUNCIÓN CORREGIDA: obtenerArticulo con mapeo de nombres y normalización
async function obtenerArticulo(leyName, articuloNumber) {
  try {
    // ✅ MAPEAR NOMBRE DE LEY
    const shortNameLey = mapearNombreLey(leyName);
    
    // ✅ NORMALIZAR NÚMERO DE ARTÍCULO (quitar subapartados)
    const articuloNormalizado = normalizarNumeroArticulo(articuloNumber);
    
    const { data: lawData, error: lawError } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', shortNameLey)
      .single();

    if (lawError) throw lawError;

    const { data, error } = await supabase
      .from('articles')
      .select('id, content, title')
      .eq('law_id', lawData.id)
      .eq('article_number', articuloNormalizado) // ✅ Usar número normalizado
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error obteniendo artículo ${articuloNumber} de ${leyName} (mapeado: ${mapearNombreLey(leyName)}, normalizado: ${normalizarNumeroArticulo(articuloNumber)}):`, error);
    return null;
  }
}

// ✅ FUNCIÓN CORREGIDA: insertarPreguntaConValidacion con verificación previa
async function insertarPreguntaConValidacion(pregunta, articuloInfo) {
  try {
    // ✅ VERIFICAR PRIMERO SI YA EXISTE (SIN GENERAR EXPLICACIÓN)
    console.log(`   🔍 Verificando si pregunta ya existe...`);
    const verificacion = await verificarPreguntaExistente(pregunta);
    
    if (verificacion.existe) {
      console.log(`   ⚠️ Pregunta YA EXISTE:`);
      console.log(`      📚 ${verificacion.articuloAsignado.ley} Art. ${verificacion.articuloAsignado.numero}`);
      console.log(`      📝 "${verificacion.articuloAsignado.titulo}"`);
      
      // Comparar si es el mismo artículo
      const articuloActual = verificacion.articuloAsignado.numero;
      const articuloNuevo = normalizarNumeroArticulo(articuloInfo.articuloNumber);
      const leyActual = verificacion.articuloAsignado.ley;
      const leyNueva = mapearNombreLey(pregunta.ley_mencionada);
      
      if (articuloActual === articuloNuevo && leyActual === leyNueva) {
        console.log(`   ✅ MISMO ARTÍCULO - Duplicada correcta`);
      } else {
        console.log(`   🎯 INTENTABA insertar en:`);
        console.log(`      📚 ${leyNueva} Art. ${articuloNuevo}`);
        console.log(`      📝 "${articuloInfo.articulo.title}"`);
        console.log(`   ⚠️ ARTÍCULO DIFERENTE - Posible problema de asignación`);
      }
      
      return { insertada: false, razon: 'Duplicada' };
    }
    
    // ✅ NO EXISTE - AHORA SÍ GENERAR EXPLICACIÓN
    console.log(`   🤖 Generando explicación educativa...`);
    const explicacionEducativa = await generarExplicacionEducativa(
      pregunta, 
      articuloInfo.articulo.content, 
      pregunta.ley_mencionada, 
      articuloInfo.articuloNumber
    );
    
    console.log(`   📝 Explicación generada: "${explicacionEducativa.substring(0, 100)}..."`);

    // ✅ MAPEAR NOMBRE DE LEY PARA TAGS
    const shortNameLey = mapearNombreLey(pregunta.ley_mencionada);
    
    // Tags sin referencia al tema (se determina por topic_scope)
    const tags = [
      `examen_${pregunta.año}`,           // Año del examen: "examen_2016"
      'pregunta_oficial',                 // Marca como pregunta oficial
      'examen_oposicion',                 // Tipo de examen
      'auxiliar_administrativo',          // Puesto de la oposición
      shortNameLey.toLowerCase().replace(/\s+/g, '_') // ✅ Usar nombre mapeado para tags
    ];
    
    // Si tiene artículo específico, añadirlo como tag
    if (pregunta.articulo_mencionado) {
      tags.push(`articulo_${pregunta.articulo_mencionado}`);
    }

    const { data, error } = await supabase
      .from('questions')
      .insert({
        primary_article_id: articuloInfo.articulo.id,
        question_text: pregunta.pregunta,
        option_a: pregunta.opciones[0],
        option_b: pregunta.opciones[1],
        option_c: pregunta.opciones[2],
        option_d: pregunta.opciones[3],
        correct_option: pregunta.correcta,
        explanation: explicacionEducativa, // ✅ Usar explicación educativa generada por GPT
        difficulty: 'medium',
        question_type: 'single',
        tags: tags,
        is_active: true,
        is_official_exam: true  // true porque son preguntas de exámenes oficiales
      });

    if (error) throw error;

    console.log(`   ✅ Pregunta insertada correctamente con explicación educativa`);
    console.log(`   🏷️ Tags: ${tags.join(', ')}`);
    return { insertada: true, data };
    
  } catch (error) {
    console.error('Error insertando pregunta:', error);
    return { insertada: false, razon: error.message };
  }
}

async function procesarPreguntas() {
  console.log('🚀 Iniciando proceso de inserción de preguntas desde JSON...');
  
  // Cargar preguntas desde JSON
  const rutaJSON = './preguntas-tema11-oficiales.json';
  const preguntas = cargarPreguntasDesdeJSON(rutaJSON);
  
  if (preguntas.length === 0) {
    console.error('❌ No se pudieron cargar preguntas del JSON');
    return;
  }
  
  console.log(`\n📚 Se procesarán ${preguntas.length} preguntas del JSON`);
  console.log(`🔄 Mapeo de leyes activado: JSON → BD`);
  console.log(`   • Constitución Española → CE`);
  console.log(`   • Ley 39/2015 → Ley 39/2015`);
  console.log(`   • Ley 29/1998 → Ley 29/1998`);
  console.log(`   • Ley 40/2015 → Ley 40/2015`);
  console.log(`🔧 Normalización de artículos activada: 76.1 → 76, 43.3 → 43`);
  
  let procesadas = 0;
  let insertadas = 0;
  let errores = 0;
  let duplicadas = 0;

  for (const pregunta of preguntas) {
    try {
      console.log(`\n📝 Procesando pregunta ${pregunta.año}-${pregunta.numero}...`);
      console.log(`   📄 "${pregunta.pregunta.substring(0, 80)}..."`);
      console.log(`   📊 Ley: ${pregunta.ley_mencionada} → ${mapearNombreLey(pregunta.ley_mencionada)}`);
      console.log(`   📊 Artículo mencionado: ${pregunta.articulo_mencionado || 'No específico'}`);
      
      let resultado = null;
      
      // Caso 1: La pregunta menciona un artículo específico
      if (pregunta.articulo_mencionado) {
        const articuloNormalizado = normalizarNumeroArticulo(pregunta.articulo_mencionado);
        console.log(`   🎯 Buscando artículo mencionado: ${mapearNombreLey(pregunta.ley_mencionada)} Art. ${pregunta.articulo_mencionado} → ${articuloNormalizado}`);
        const articulo = await obtenerArticulo(pregunta.ley_mencionada, pregunta.articulo_mencionado);
        
        if (!articulo) {
          console.log(`   ❌ ERROR: Artículo ${pregunta.articulo_mencionado} → ${articuloNormalizado} no existe en BD para ${mapearNombreLey(pregunta.ley_mencionada)}`);
          erroresArticulosNoEncontrados.push({
            pregunta_numero: pregunta.numero,
            año: pregunta.año,
            ley: pregunta.ley_mencionada,
            ley_mapeada: mapearNombreLey(pregunta.ley_mencionada),
            articulo_buscado: pregunta.articulo_mencionado,
            articulo_normalizado: articuloNormalizado,
            tipo_error: 'articulo_mencionado_no_existe',
            timestamp: new Date().toISOString()
          });
          errores++;
          procesadas++;
          continue;
        }
        
        const verificacion = await verificarCorrespondenciaConGPT(
          pregunta, 
          articulo.content, 
          pregunta.ley_mencionada, 
          articuloNormalizado
        );
        
        console.log(`   📊 Verificación directa: ${verificacion.confianza}% - ${verificacion.razon}`);
        
        if (verificacion.corresponde && verificacion.confianza > 70) {
          resultado = { 
            articuloNumber: articuloNormalizado, 
            articulo, 
            verificacion 
          };
        }
      }

      // Caso 2: No menciona artículo específico, preguntar a GPT
      if (!resultado) {
        console.log('   🤖 Preguntando a GPT qué artículo podría ser...');
        const sugerencia = await sugerirArticuloConGPT(pregunta);
        
        if (sugerencia.articulo_sugerido && sugerencia.confianza > 60) {
          const articuloSugeridoNormalizado = normalizarNumeroArticulo(sugerencia.articulo_sugerido);
          console.log(`   💡 GPT sugiere: ${mapearNombreLey(pregunta.ley_mencionada)} Art. ${sugerencia.articulo_sugerido} → ${articuloSugeridoNormalizado} (confianza: ${sugerencia.confianza}%)`);
          console.log(`   💭 Razón: ${sugerencia.razon}`);
          
          const articuloSugerido = await obtenerArticulo(pregunta.ley_mencionada, sugerencia.articulo_sugerido);
          
          if (!articuloSugerido) {
            console.log(`   ❌ ERROR: Artículo sugerido ${sugerencia.articulo_sugerido} → ${articuloSugeridoNormalizado} no existe en BD para ${mapearNombreLey(pregunta.ley_mencionada)}`);
            erroresArticulosNoEncontrados.push({
              pregunta_numero: pregunta.numero,
              año: pregunta.año,
              ley: pregunta.ley_mencionada,
              ley_mapeada: mapearNombreLey(pregunta.ley_mencionada),
              articulo_buscado: sugerencia.articulo_sugerido,
              articulo_normalizado: articuloSugeridoNormalizado,
              tipo_error: 'articulo_sugerido_gpt_no_existe',
              sugerencia_gpt: sugerencia,
              timestamp: new Date().toISOString()
            });
            errores++;
            procesadas++;
            continue;
          }
          
          console.log(`   🔍 Verificando artículo sugerido...`);
          const verificacion = await verificarCorrespondenciaConGPT(
            pregunta, 
            articuloSugerido.content, 
            pregunta.ley_mencionada, 
            articuloSugeridoNormalizado
          );
          
          console.log(`   📊 Verificación: ${verificacion.confianza}% - ${verificacion.razon}`);
          
          if (verificacion.corresponde && verificacion.confianza > 70) {
            resultado = { 
              articuloNumber: articuloSugeridoNormalizado, 
              articulo: articuloSugerido, 
              verificacion 
            };
          }
        } else {
          console.log(`   ⚠️ GPT no pudo sugerir artículo con confianza suficiente`);
        }
      }

      // Insertar pregunta si encontramos artículo válido
      if (resultado && resultado.verificacion.confianza > 70) {
        console.log(`   ✅ Artículo encontrado: ${mapearNombreLey(pregunta.ley_mencionada)} Art. ${resultado.articuloNumber} (confianza: ${resultado.verificacion.confianza}%)`);
        
        const insercion = await insertarPreguntaConValidacion(pregunta, resultado);
        
        if (insercion.insertada) {
          insertadas++;
        } else if (insercion.razon === 'Duplicada') {
          duplicadas++;
        } else {
          errores++;
        }
      } else {
        console.log(`   ❌ No se encontró artículo correspondiente - SALTANDO PREGUNTA`);
        errores++;
      }

      procesadas++;
      
      // Delay entre preguntas (reducido porque ya no genera explicaciones innecesarias)
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 segundos
      
    } catch (error) {
      console.error(`   💥 Error procesando pregunta ${pregunta.año}-${pregunta.numero}:`, error);
      errores++;
      procesadas++;
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN FINAL:');
  console.log('='.repeat(50));
  console.log(`   📝 Preguntas procesadas: ${procesadas}`);
  console.log(`   ✅ Preguntas insertadas: ${insertadas}`);
  console.log(`   ⚠️ Preguntas duplicadas: ${duplicadas}`);
  console.log(`   ❌ Artículos no encontrados: ${erroresArticulosNoEncontrados.length}`);
  console.log(`   ❌ Otros errores: ${errores - erroresArticulosNoEncontrados.length}`);
  console.log(`   📈 Tasa de éxito: ${((insertadas / procesadas) * 100).toFixed(1)}%`);
  console.log(`   💰 Tokens GPT ahorrados: ~${duplicadas * 500} (explicaciones no generadas para duplicadas)`);
  console.log('='.repeat(50));
  
  // Guardar errores de artículos no encontrados
  if (erroresArticulosNoEncontrados.length > 0) {
    const errorFile = `errores_articulos_${new Date().toISOString().slice(0,10)}.json`;
    fs.writeFileSync(errorFile, JSON.stringify(erroresArticulosNoEncontrados, null, 2));
    console.log(`💾 Errores de artículos guardados en: ${errorFile}`);
    
    console.log('\n📋 ARTÍCULOS NO ENCONTRADOS:');
    erroresArticulosNoEncontrados.forEach(error => {
      console.log(`   ❌ Pregunta ${error.año}-${error.pregunta_numero}: ${error.ley} → ${error.ley_mapeada} Art. ${error.articulo_buscado} → ${error.articulo_normalizado} (${error.tipo_error})`);
    });
  }
}

async function main() {
  try {
    await procesarPreguntas();
  } catch (error) {
    console.error('💥 Error en ejecución principal:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { procesarPreguntas };