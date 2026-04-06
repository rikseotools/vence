-- Completar 8 leyes activas que tenían 0 artículos en BD
-- Fecha: 2026-04-06
-- Detectado al investigar error 500 en /api/teoria/articles?law=odm

-- 1) ODM (Objetivos Desarrollo Milenio): 8 artículos insertados (objetivos 1-8)
--    Fuente: ONU/OMC. Artículo "General" desactivado.
--    topic_scope actualizado de ["General"] a ["1"-"8"]

-- 2) LOMLOE (LO 3/2020): 24 artículos sincronizados vía API BOE
--    boe_id y boe_url añadidos (BOE-A-2020-17264)

-- 3) RD 1084/1990: 4 artículos extraídos de BOE doc.php

-- 4) RD 221/1987: 25 entradas (12 arts + 9 DA + 1 DT + 3 DF)
--    boe_id corregido: BOE-A-1987-4605 (antes BOE-A-1987-4616)

-- 5) Ley 10/1965: 5 artículos extraídos de BOE doc.php

-- 6) Orden PCM/7/2021: 4 entradas (art único + DA + DT + DF)
--    boe_id corregido: BOE-A-2021-521 (antes BOE-A-2021-558)

-- 7) RD 1230/2023: 7 entradas (art único + DD + 5 DF)
--    boe_id corregido: BOE-A-2023-26727 (antes BOE-A-2023-26613)

-- 8) RD 2225/1993: 11 entradas (8 arts + DT + DD + DF)
--    boe_id corregido: BOE-A-1993-31099 (antes BOE-A-1993-30479)

-- Limpieza: 17 refs rotas eliminadas de topic_scope (topic_id o law_id null/inexistente)
