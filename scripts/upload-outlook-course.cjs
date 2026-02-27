/**
 * Script para subir el curso de Outlook 365 a Supabase Storage
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
const COURSE_SLUG = 'outlook-365';

const course = {
  slug: COURSE_SLUG,
  title: 'Curso de Outlook 365',
  description: 'Curso completo de Microsoft Outlook 365 con 45 lecciones organizadas en 3 bloques. Desde la instalación y gestión de correo, calendario y contactos hasta configuración avanzada, Outlook Online y alternativas.',
  isPremium: true,
  orderPosition: 4,
  // Nota: la carpeta tiene un espacio al final en el nombre
  sourceFolder: path.join(process.env.HOME, 'Documentos/outlook '),
  lessons: [
    {
      file: 'BLOQUE 01.mp4',
      title: 'Bloque 1: Fundamentos y gestión',
      description: 'Instalación de cuentas, backstage, barras de aplicaciones/menús/título, gestión de correo electrónico, calendario, contactos, tareas, To Do, complementos, reglas y alertas',
      duration: 3946,
    },
    {
      file: 'BLOQUE 02.mp4',
      title: 'Bloque 2: Configuración y personalización',
      description: 'Respuestas automáticas, sondeos, importación/exportación, impresión, notas, opciones de configuración (generales, correo, calendario, personas, tareas, búsqueda, idioma, accesibilidad, avanzadas), personalizar cinta, firma, Outlook en Windows 11 y Outlook Online',
      duration: 3721,
    },
    {
      file: 'BLOQUE 03.mp4',
      title: 'Bloque 3: Herramientas y alternativas',
      description: 'Configuración de Outlook en Windows 11, alternativas a Outlook, ordenar correos, servicios de correo gratuito, correos temporales, gestión de espacio, alternativas en Android, enviar DNI por correo e integración con Word',
      duration: 4087,
    },
  ],
};

async function uploadFile(localPath, remotePath) {
  const fileName = path.basename(localPath);
  const fileBuffer = fs.readFileSync(localPath);
  const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(1);
  console.log(`📤 Subiendo: ${fileName} (${fileSizeMB} MB) -> ${remotePath}`);

  const startTime = Date.now();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(remotePath, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

  if (error) {
    console.error(`   ❌ Error (${elapsed}s): ${error.message}`);
    return false;
  }

  console.log(`   ✅ Subido en ${elapsed}s`);
  return true;
}

async function createCourse() {
  const totalLessons = course.lessons.length;
  const totalDurationMinutes = Math.round(
    course.lessons.reduce((sum, l) => sum + l.duration, 0) / 60
  );

  console.log(`\n📚 Creando curso: ${course.title}`);
  console.log(`   ${totalLessons} lecciones, ${totalDurationMinutes} minutos total`);

  const { data, error } = await supabase
    .from('video_courses')
    .upsert(
      {
        slug: course.slug,
        title: course.title,
        description: course.description,
        is_premium: course.isPremium,
        is_active: true,
        order_position: course.orderPosition,
        total_lessons: totalLessons,
        total_duration_minutes: totalDurationMinutes,
      },
      { onConflict: 'slug' }
    )
    .select('id')
    .single();

  if (error) {
    console.error(`   ❌ Error creando curso: ${error.message}`);
    return null;
  }

  console.log(`   ✅ Curso creado/actualizado: ${data.id}`);
  return data.id;
}

async function createLessons(courseId) {
  console.log(`\n📝 Creando ${course.lessons.length} lecciones...`);

  for (let i = 0; i < course.lessons.length; i++) {
    const lesson = course.lessons[i];
    const lessonSlug = `bloque-${String(i + 1).padStart(2, '0')}`;
    const videoPath = `${COURSE_SLUG}/${lessonSlug}.mp4`;

    const { error } = await supabase.from('video_lessons').upsert(
      {
        course_id: courseId,
        slug: lessonSlug,
        title: lesson.title,
        description: lesson.description,
        video_path: videoPath,
        duration_seconds: lesson.duration,
        order_position: i + 1,
        is_preview: i === 0,
        preview_seconds: 600,
        is_active: true,
      },
      { onConflict: 'course_id,slug' }
    );

    if (error) {
      console.error(`   ❌ Error en lección ${lessonSlug}: ${error.message}`);
    } else {
      console.log(`   ✅ ${lesson.title}`);
    }
  }
}

async function main() {
  console.log('🎬 SUBIDA DE CURSO OUTLOOK 365 A SUPABASE\n');
  console.log('='.repeat(50));

  // Verificar bucket
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === BUCKET);
  if (!bucketExists) {
    console.error(`❌ El bucket "${BUCKET}" no existe.`);
    process.exit(1);
  }
  console.log(`✅ Bucket "${BUCKET}" encontrado`);

  // Verificar archivos locales
  console.log(`\n📂 Carpeta origen: ${course.sourceFolder}`);
  for (const lesson of course.lessons) {
    const localPath = path.join(course.sourceFolder, lesson.file);
    if (!fs.existsSync(localPath)) {
      console.error(`❌ Archivo no encontrado: ${localPath}`);
      process.exit(1);
    }
  }
  console.log('✅ Todos los archivos encontrados\n');

  // 1. Subir videos
  console.log('='.repeat(50));
  console.log('📤 SUBIENDO VIDEOS...');
  console.log('='.repeat(50));

  for (let i = 0; i < course.lessons.length; i++) {
    const lesson = course.lessons[i];
    const localPath = path.join(course.sourceFolder, lesson.file);
    const remotePath = `${COURSE_SLUG}/bloque-${String(i + 1).padStart(2, '0')}.mp4`;
    const success = await uploadFile(localPath, remotePath);
    if (!success) {
      console.error('⚠️ Error en subida. Abortando.');
      process.exit(1);
    }
  }

  // 2. Crear curso en BD
  console.log('\n' + '='.repeat(50));
  console.log('💾 CREANDO REGISTROS EN BD...');
  console.log('='.repeat(50));

  const courseId = await createCourse();
  if (!courseId) {
    console.error('❌ No se pudo crear el curso');
    process.exit(1);
  }

  // 3. Crear lecciones
  await createLessons(courseId);

  console.log('\n' + '='.repeat(50));
  console.log('🎉 PROCESO COMPLETADO');
  console.log('='.repeat(50));
}

// Opción para solo crear registros en BD sin subir videos
const args = process.argv.slice(2);
if (args.includes('--db-only')) {
  (async () => {
    const courseId = await createCourse();
    if (courseId) {
      await createLessons(courseId);
    }
    console.log('✅ Registros de BD creados');
  })();
} else {
  main().catch(console.error);
}
