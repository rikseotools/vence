-- Auditoría 06/04/2026: actualización masiva de 9 oposiciones tras verificación web oficial
-- Cada oposición verificada contra su página oficial de seguimiento y fuentes externas

-- 1) COM. VALENCIANA → inscripcion_abierta (OEP 2026, exp 70/26, DOGV-C-2026-8076)
--    Plazas: 204 libre + 41 discap = 245 total | Inscr hasta 14/04/2026
--    Hitos rehecho completos (7 hitos) para convocatoria nueva (antes tenía hitos de conv anterior 19 plazas)
--    seguimiento_url actualizada a sede.gva.es

-- 2) AUXILIO JUDICIAL → seguimiento_url actualizada a PJC/1549/2025 (antes apuntaba a PJC/1437/2024)
--    Convocatoria: BOE-A-2025-27053 | 425 plazas | Inscr cerrada 29/01/2026 | Examen ~03/10/2026
--    Hitos enriquecidos (7 hitos)

-- 3) TRAMITACIÓN PROCESAL → seguimiento_url actualizada a PJC/1549/2025
--    Convocatoria: BOE-A-2025-27053 | 1155 plazas | Inscr cerrada 29/01/2026 | Examen ~03/10/2026
--    Hitos enriquecidos (7 hitos)

-- 4) ASTURIAS → estado corregido a oep_aprobada (antes decía inscripcion_cerrada con datos falsos)
--    Realidad: OEP 2025 solo aprobada (BOPA 240, 29/12/2025), 7 plazas, SIN convocatoria
--    seguimiento_url corregida | inscription_deadline y exam_date a NULL
--    Hitos corregidos (3 hitos estimados)

-- 5) CLM → estado actualizado a examen_realizado (proceso en fase méritos provisionales)
--    Examen se celebró 11/10/2025, aprobados 15/01/2026, méritos prov 12/03/2026
--    Hitos rehecho con 9 hitos reales (antes tenía 5 con datos ficticios)
--    OEP 2025 (327 plazas) aprobada pero sin convocar aún

-- 6) ANDALUCÍA → estado actualizado a nombramientos (proceso C2.1000 finalizado sept 2025)
--    is_convocatoria_activa = false | Landing sigue activa para captar
--    Próxima OEP (~64-90 plazas) sin fecha de convocatoria

-- 7) GALICIA → hito listas provisionales a current (publicadas 27/03/2026)

-- 8) CyL → hito tribunal a completed (publicado 13/02/2026, no 15/05)

-- 9) EXTREMADURA → plazas corregidas: 126 libre + 20 disc = 146 total (antes decía 106)
