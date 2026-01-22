-- Script para añadir conocimiento sobre cancelación y devoluciones a la knowledge base
-- Ejecutar con: node scripts/run-sql.cjs scripts/add-cancelacion-kb.sql

-- 1. Garantía de Devolución
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'faq',
  'cancelacion',
  '¿Cómo funciona la garantía de devolución?',
  E'## Garantía de Devolución de Vence\n\nEn Vence ofrecemos una **garantía de devolución del 100%** si no estás satisfecho.\n\n### Requisitos:\n1. **Plazo**: Solicitar dentro de los **primeros 15 días** desde el pago\n2. **Sin uso abusivo**: No haber usado el servicio de forma abusiva (ej: extraer todo el contenido en pocos días)\n3. **Una sola vez**: La garantía solo puede usarse **una vez por cliente**\n\n### ¿Cómo solicitarla?\nAbre un chat de soporte y pídelo. Ya tenemos tus datos, solo necesitas indicar que quieres la devolución.\n\n### ¿Cuánto tarda?\n- Procesamos la devolución al momento en Stripe\n- El dinero aparece en tu cuenta en **5-10 días hábiles** (depende de tu banco)\n\nMás info: [Cancelación y Devoluciones](/cancelacion-y-devoluciones)',
  'Tienes 15 días desde el pago para solicitar devolución completa. Solo una vez por cliente. Abre chat de soporte para solicitarla.',
  ARRAY['garantía', 'devolución', 'reembolso', 'dinero', '15 días', 'devolver'],
  10,
  true
);

-- 2. Cancelación de suscripción
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'faq',
  'cancelacion',
  '¿Cómo cancelo mi suscripción?',
  E'## Cancelar tu suscripción en Vence\n\n### ¿Qué pasa al cancelar?\n- Tu suscripción **no se renovará** automáticamente\n- **Sigues siendo Premium** hasta el final del periodo que pagaste\n- Tu progreso, estadísticas y racha se mantienen\n- Cuando termine, pasas al plan Free automáticamente\n\n### Pasos para cancelar:\n1. Ve a tu **Perfil**\n2. Haz clic en **"Gestionar suscripción"**\n3. Selecciona **"Cancelar suscripción"**\n4. Confirma\n\nTambién puedes abrir un chat de soporte y lo tramitamos nosotros.\n\n**Nota**: Cancelar no devuelve dinero. Si quieres devolución, tienes 15 días desde el pago para solicitarla.',
  'Ve a Perfil > Gestionar suscripción > Cancelar. Sigues siendo Premium hasta fin de periodo. No hay devolución al cancelar.',
  ARRAY['cancelar', 'cancelación', 'baja', 'suscripción', 'anular'],
  10,
  true
);

-- 3. Diferencia entre cancelar y devolver
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'faq',
  'cancelacion',
  '¿Cuál es la diferencia entre cancelar y pedir devolución?',
  E'## Cancelar vs Devolución\n\n### Cancelación:\n- Paras la renovación automática\n- **Sigues siendo Premium** hasta fin de periodo\n- **No hay devolución de dinero**\n- Puedes reactivar más adelante\n\n### Garantía de Devolución:\n- Te devolvemos el **100% del dinero**\n- Solo en los **primeros 15 días** desde el pago\n- Solo **una vez** por cliente\n- Sin uso abusivo del servicio\n\n**Resumen**: Cancela si quieres dejar de pagar pero seguir usando hasta que termine tu periodo. Pide devolución si no estás satisfecho en los primeros 15 días.',
  'Cancelar = paras renovación pero sigues Premium. Devolución = te devolvemos el dinero (solo primeros 15 días).',
  ARRAY['diferencia', 'cancelar', 'devolver', 'devolución', 'reembolso'],
  9,
  true
);

-- 4. ¿Pierdo mi progreso al cancelar?
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'faq',
  'cancelacion',
  '¿Pierdo mi progreso si cancelo?',
  E'## Tu progreso está seguro\n\n**No**, tu progreso **nunca se pierde**:\n- Estadísticas de tests\n- Historial de respuestas\n- Racha de días\n- Áreas de mejora identificadas\n\nCuando tu periodo Premium termine, pasas al plan Free pero **conservas todos tus datos**.\n\nSi vuelves a suscribirte, todo sigue igual donde lo dejaste.',
  'No, tu progreso, estadísticas y racha se mantienen siempre, incluso al pasar a plan Free.',
  ARRAY['progreso', 'estadísticas', 'racha', 'perder', 'datos', 'cancelar'],
  8,
  true
);

-- 5. ¿Puedo reactivar después de cancelar?
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'faq',
  'cancelacion',
  '¿Puedo reactivar mi suscripción después de cancelar?',
  E'## Reactivar suscripción\n\n**Sí, puedes reactivar** en cualquier momento desde tu perfil.\n\n- Todo tu progreso se mantiene intacto\n- Estadísticas y racha siguen igual\n- Solo necesitas volver a suscribirte\n\n**Nota**: Si ya usaste la garantía de devolución, puedes suscribirte de nuevo pero no podrás pedir otra devolución.',
  'Sí, puedes reactivar cuando quieras desde tu perfil. Tu progreso se mantiene.',
  ARRAY['reactivar', 'volver', 'suscribir', 'después', 'cancelar'],
  7,
  true
);

-- 6. ¿Qué es uso abusivo?
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'faq',
  'cancelacion',
  '¿Qué se considera uso abusivo del servicio?',
  E'## Uso abusivo\n\nUso abusivo sería, por ejemplo, completar **cientos de tests en muy pocos días** con el único objetivo de extraer todo el contenido y luego pedir devolución.\n\n**El uso normal y honesto del servicio, aunque sea intensivo, NO se considera abusivo.**\n\nSi estudias mucho porque tienes examen pronto, eso está perfecto. El uso abusivo se refiere a comportamientos claramente fraudulentos.',
  'Uso abusivo = extraer todo el contenido rápido para pedir devolución. Estudiar mucho de forma honesta NO es abusivo.',
  ARRAY['uso abusivo', 'abuso', 'fraude', 'devolución', 'garantía'],
  6,
  true
);
