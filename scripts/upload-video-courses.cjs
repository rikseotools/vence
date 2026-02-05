/**
 * Script para subir cursos de video a Supabase Storage
 * y crear los registros en la base de datos
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = 'videos-premium';

// Datos de los cursos
const courses = [
  {
    slug: 'word-365',
    title: 'Curso de Word 365',
    description: 'Curso completo de Microsoft Word 365 con 74 lecciones organizadas en 6 bloques. Desde lo básico hasta funciones avanzadas como macros, ChatGPT y colaboración online.',
    isPremium: true,
    orderPosition: 1,
    sourceFolder: path.join(process.env.HOME, 'Documentos/word'),
    lessons: [
      { file: 'BLOQUE 01.mp4', title: 'Bloque 1: Fundamentos', description: 'Backstage, crear documentos, seleccionar, copiar, estilos, búsqueda, insertar, tablas y diseño', duration: 4053 },
      { file: 'BLOQUE 02.mp4', title: 'Bloque 2: Formato avanzado', description: 'Columnas, sangrías, disposición, referencias, tabla de contenido, índice, código QR, emojis y correspondencia', duration: 3356 },
      { file: 'BLOQUE 03.mp4', title: 'Bloque 3: Gestión de documentos', description: 'Proteger documentos, recuperar archivos, PDF, importar/exportar, panel de revisión, vistas, macros y Word Online', duration: 3575 },
      { file: 'BLOQUE 04.mp4', title: 'Bloque 4: Funciones avanzadas', description: 'Índice con hipervínculos, modo oscuro, modelos 3D, formularios, referencias cruzadas, autoguardado y protección', duration: 3992 },
      { file: 'BLOQUE 05.mp4', title: 'Bloque 5: Productividad', description: 'OCR online, apps de CV, vincular Excel, editar imágenes, Word Online avanzado y optimización de fuentes', duration: 3885 },
      { file: 'BLOQUE 06.mp4', title: 'Bloque 6: Herramientas modernas', description: 'Gestión de fuentes, Whiteboard, lectura inmersiva, Microsoft Sway, complementos e integración con ChatGPT', duration: 3021 },
    ]
  },
  {
    slug: 'excel-365',
    title: 'Curso de Excel 365',
    description: 'Curso completo de Microsoft Excel 365 con 79 lecciones en 7 bloques. Desde lo básico hasta tablas dinámicas, macros y ChatGPT.',
    isPremium: true,
    orderPosition: 2,
    sourceFolder: path.join(process.env.HOME, 'Documentos/excell'),
    lessons: [
      { file: 'BLOQUE 01.mp4', title: 'Bloque 1: Fundamentos', description: 'Introducción, interfaz, guardar archivos, operaciones básicas, referencias, filtros y filtro avanzado', duration: 4039 },
      { file: 'BLOQUE 02.mp4', title: 'Bloque 2: Gráficos y función SI', description: 'Gráficos, minigráficos, fórmulas básicas, función SI con opciones múltiples y SI.CONJUNTO', duration: 3961 },
      { file: 'BLOQUE 03.mp4', title: 'Bloque 3: Funciones lógicas', description: 'SI vs SI.CONJUNTO, SUMAR.SI, CONTAR.SI, funciones Y/O, BUSCARV y BUSCARH', duration: 2996 },
      { file: 'BLOQUE 04.mp4', title: 'Bloque 4: Análisis de datos', description: 'Nombres de rangos, fecha/hora, formato condicional, tablas, buscar objetivo, escenarios y Solver', duration: 3496 },
      { file: 'BLOQUE 05.mp4', title: 'Bloque 5: Tablas dinámicas I', description: 'Errores en fórmulas, fijar celdas, funciones financieras, plantillas, complementos y tablas dinámicas básicas', duration: 3764 },
      { file: 'BLOQUE 06.mp4', title: 'Bloque 6: Tablas dinámicas II', description: 'Campos calculados, gráficos dinámicos, segmentación, macros, subtotales, listas desplegables y protección', duration: 3460 },
      { file: 'BLOQUE 07.mp4', title: 'Bloque 7: Herramientas modernas', description: 'Macros con ChatGPT, atajos, dictado, nube, cotizaciones, divisas, mapas 3D y automatización', duration: 3641 },
    ]
  }
];

async function uploadFile(localPath, remotePath) {
  console.log(`📤 Subiendo: ${path.basename(localPath)} -> ${remotePath}`);

  const fileBuffer = fs.readFileSync(localPath);
  const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(1);
  console.log(`   Tamaño: ${fileSizeMB} MB`);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(remotePath, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true, // Sobrescribir si existe
    });

  if (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }

  console.log(`   ✅ Subido correctamente`);
  return true;
}

async function createCourse(courseData) {
  const { slug, title, description, isPremium, orderPosition, lessons } = courseData;

  // Calcular totales
  const totalLessons = lessons.length;
  const totalDurationMinutes = Math.round(lessons.reduce((sum, l) => sum + l.duration, 0) / 60);

  console.log(`\n📚 Creando curso: ${title}`);
  console.log(`   ${totalLessons} lecciones, ${totalDurationMinutes} minutos total`);

  // Insertar o actualizar curso
  const { data: course, error: courseError } = await supabase
    .from('video_courses')
    .upsert({
      slug,
      title,
      description,
      is_premium: isPremium,
      is_active: true,
      order_position: orderPosition,
      total_lessons: totalLessons,
      total_duration_minutes: totalDurationMinutes,
    }, { onConflict: 'slug' })
    .select('id')
    .single();

  if (courseError) {
    console.error(`   ❌ Error creando curso: ${courseError.message}`);
    return null;
  }

  console.log(`   ✅ Curso creado/actualizado: ${course.id}`);
  return course.id;
}

async function createLessons(courseId, courseSlug, lessons) {
  console.log(`\n📝 Creando ${lessons.length} lecciones...`);

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    const lessonSlug = `bloque-${String(i + 1).padStart(2, '0')}`;
    const videoPath = `${courseSlug}/${lessonSlug}.mp4`;

    const { error } = await supabase
      .from('video_lessons')
      .upsert({
        course_id: courseId,
        slug: lessonSlug,
        title: lesson.title,
        description: lesson.description,
        video_path: videoPath,
        duration_seconds: lesson.duration,
        order_position: i + 1,
        is_preview: i === 0, // Primer bloque es preview gratuito
        preview_seconds: 600, // 10 minutos de preview
        is_active: true,
      }, { onConflict: 'course_id,slug' });

    if (error) {
      console.error(`   ❌ Error en lección ${lessonSlug}: ${error.message}`);
    } else {
      console.log(`   ✅ ${lesson.title}`);
    }
  }
}

async function main() {
  console.log('🎬 SUBIDA DE CURSOS DE VIDEO A SUPABASE\n');
  console.log('=' .repeat(50));

  // Verificar que el bucket existe
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === BUCKET);

  if (!bucketExists) {
    console.error(`❌ El bucket "${BUCKET}" no existe. Créalo primero en Supabase.`);
    process.exit(1);
  }

  console.log(`✅ Bucket "${BUCKET}" encontrado\n`);

  for (const course of courses) {
    console.log('\n' + '='.repeat(50));
    console.log(`🎯 PROCESANDO: ${course.title}`);
    console.log('='.repeat(50));

    // 1. Subir videos
    for (let i = 0; i < course.lessons.length; i++) {
      const lesson = course.lessons[i];
      const localPath = path.join(course.sourceFolder, lesson.file);
      const remotePath = `${course.slug}/bloque-${String(i + 1).padStart(2, '0')}.mp4`;

      if (!fs.existsSync(localPath)) {
        console.error(`❌ Archivo no encontrado: ${localPath}`);
        continue;
      }

      const success = await uploadFile(localPath, remotePath);
      if (!success) {
        console.error(`⚠️ Saltando lección por error de subida`);
      }
    }

    // 2. Crear curso en BD
    const courseId = await createCourse(course);
    if (!courseId) continue;

    // 3. Crear lecciones en BD
    await createLessons(courseId, course.slug, course.lessons);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 PROCESO COMPLETADO');
  console.log('='.repeat(50));
}

// Ejecutar solo un curso específico (para pruebas)
const args = process.argv.slice(2);
if (args.includes('--word-only')) {
  courses.splice(1); // Solo Word
} else if (args.includes('--excel-only')) {
  courses.splice(0, 1); // Solo Excel
} else if (args.includes('--db-only')) {
  // Solo crear registros en BD, sin subir videos
  (async () => {
    for (const course of courses) {
      const courseId = await createCourse(course);
      if (courseId) {
        await createLessons(courseId, course.slug, course.lessons);
      }
    }
    console.log('✅ Registros de BD creados');
  })();
  return;
}

main().catch(console.error);
