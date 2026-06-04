-- Preferencia de CUENTA: mostrar/ocultar la barra de meta diaria en la cabecera.
--
-- Origen 04/06/2026: en móvil la barra "0/40" vive en la fila flotante
-- `absolute top-full` del Header y tapaba contenido. Se añadió en el pill una X
-- para quitarla y la posibilidad de arrastrarla. La X NO es un truco de
-- localStorage por-dispositivo: es una preferencia de cuenta (se ve igual en
-- todos los dispositivos) y se refleja como un toggle en /perfil. Sólo se puede
-- re-activar desde ese toggle (la X la pone en false; la barra desaparece y no
-- hay forma de re-mostrarla salvo el toggle del perfil).
--
-- DEFAULT true + NOT NULL: todos los usuarios actuales la siguen viendo.
-- IF NOT EXISTS: idempotente (aplicado a prod a mano el 04/06).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS show_daily_goal_banner boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_profiles.show_daily_goal_banner IS
  'Preferencia de cuenta: mostrar la barra de meta diaria en la cabecera (premium). La X de la barra la pone false; sólo se re-activa desde el toggle de /perfil. Añadido 04/06/2026.';
