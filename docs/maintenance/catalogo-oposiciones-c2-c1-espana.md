# Catálogo maestro — Oposiciones C1 + C2 de España

> **Versión 1 — 2026-06-01.** Inventario completo + gaps identificados para conectar con el sistema multi-sensor de detección de convocatorias (`docs/roadmap/deteccion-convocatorias-oeps-completo.md`).
>
> **Fuentes:** OFFICIAL_OPOSICIONES en `components/OnboardingModal.tsx` (138 entradas C1+C2 actuales) + tabla BD `oposiciones` (45 implementadas activas) + investigación oficial por sector.

## 1. Resumen ejecutivo

**Estado actual** (catálogo aspiracional + implementado):

- C1 = 16 entradas en OFFICIAL_OPOSICIONES → 9 implementadas en BD.
- C2 = 122 entradas en OFFICIAL_OPOSICIONES → 31 implementadas en BD.
- Total C1+C2 catalogado: 138. Total implementado: 40.

**Cobertura por sector** (catálogo):

- AGE Estado: 17 entradas. Cobertura ~80% de cuerpos C1/C2 estatales conocidos.
- Justicia: 3 entradas. **Completo** (Aux Judicial C2, Tramitación C1, Gestión C1).
- Autonómica (17 CCAA): 30 entradas → C1 solo 4 de 17 CCAA. **Gap principal: 13 C1 autonómicas**.
- Sanitaria: 17 entradas → 17 TCAEs de los 17 servicios salud + INGESA. **Completo**.
- Diputaciones provinciales: 41 entradas → **41 de 41 Diputaciones clásicas** (las 9 provincias sin Dip son CCAA uniprovinciales/forales y ya están cubiertas por sus CCAA). **Completo**.
- Ayuntamientos top: 11 entradas → **Faltan ~12-15 capitales top** (Granada, A Coruña, Vigo, Vitoria, Pamplona, Alicante, Córdoba, Valladolid, Gijón, etc.).
- Local Policía + Bombero: solo 3 entradas genéricas. **Sin granularidad por CCAA**.
- Correos: 1 entrada (Personal Operativo C2). **Falta** Administrativo Correos C1.
- Universidad: 1 entrada genérica. **Sin granularidad por universidad**.

**Conclusión rápida:** el catálogo está mejor de lo que parecía a vista. Los huecos reales son ~30-50 entradas concretas, no cientos. La mayoría son C1 autonómicas + Aytos top + algunos cuerpos estatales menores.

## 2. Inventario actual por sector

### 2.1 Estado / AGE (17 entradas)

C1 (7):
- `administrativo_estado` — Administrativo del Estado ✓ implementada
- `administrativo_seguridad_social` — Administrativo de la Seguridad Social ✓ implementada
- `policia_nacional` — Policía Nacional (Escala Básica) ✓ implementada
- `guardia_civil` — Guardia Civil ✓ implementada
- `agente_hacienda` — Agente de la Hacienda Pública
- `ayudante_instituciones_penitenciarias` — Ayudante de Instituciones Penitenciarias
- `tecnico_informatica` — Técnico Auxiliar de Informática

C2 (10):
- `auxiliar_administrativo_estado` — Auxiliar Administrativo del Estado ✓ implementada
- `auxiliar_administrativo_seguridad_social` — Auxiliar Administrativo SS
- `bibliotecario` — Auxiliar de Biblioteca
- `auxiliar_estadistica_ine` — Auxiliar de Estadística INE
- `auxiliar_inspeccion_soivre` — Auxiliar Inspección SOIVRE
- `auxiliar_vigilancia_aduanera` — Auxiliar Vigilancia Aduanera
- `auxiliar_catastro` — Auxiliar Catastro
- `auxiliar_sepe` — Auxiliar SEPE
- `conductor` — Conductor
- `mecanico_conductor_estado` — Mecánico-Conductor Parque Móvil

### 2.2 Justicia (3 entradas — completo)

- `tramitacion_procesal` — Tramitación Procesal C1 ✓ implementada
- `gestion_procesal` — Gestión Procesal C1
- `auxilio_judicial` — Auxilio Judicial C2 ✓ implementada

### 2.3 Autonómica — Administrativo (17 CCAA)

C2 Aux Administrativo (17 + Ceuta + Melilla):
- ✓ Las 17 CCAA + Ceuta + Melilla cubiertas con entradas específicas
- Implementadas (16): andalucia, aragon, asturias, baleares, canarias, cantabria, carm, catalunya, clm, cyl, extremadura, galicia, gva (valencia), la_rioja, madrid, pais_vasco
- Aspiracional (3): navarra, ceuta, melilla

C1 Administrativo:
- ✓ `administrativo_galicia`, `administrativo_gva`, `administrativo_navarra`
- ✓ `administrativo_comunidad_autonoma` (genérico)
- **Faltan 13 entradas C1 específicas** para: Madrid, Andalucía, Catalunya, CyL, P. Vasco, Baleares, Canarias, Asturias, CARM, Cantabria, La Rioja, Extremadura, CLM, Aragón

C2 Específicos autonómicos (4 cuerpos transversales):
- `agente_forestal`, `agente_medioambiental`, `auxiliar_residencia_mayores`, `auxiliar_servicios_sociales`, `auxiliar_educador_centros_menores`, `operador_emergencias_112`

### 2.4 Sanitaria — TCAEs (17 entradas — completo)

Todas las 17 entradas TCAE de los servicios autonómicos de salud + INGESA:
- ✓ Aspiracionales o implementadas: tcae_sas (Andalucía), tcae_aragon, tcae_sespa (Asturias), tcae_ibsalut (Baleares), tcae_canarias, tcae_scs_cantabria, tcae_sescam (CLM), tcae_sacyl (CyL), tcae_ics (Catalunya), tcae_ses (Extremadura), tcae_galicia, tcae_seris (La Rioja), tcae_sermas (Madrid), tcae_murcia, tcae_navarra, auxiliar_enfermeria_gva (Valencia), auxiliar_enfermeria (genérico) + tcae_ibsalut + tcae_ingesa (Ceuta/Melilla) + tcae_osakidetza (P. Vasco)

**Faltan otros cuerpos C2 sanitarios:**
- Celador × 17 servicios salud (solo cubierto Celador genérico en aspiracional `celador_scs_canarias`, `celador_sermas_madrid`, `celador_sescam_clm`)
- Personal de Servicios Generales (PSG) hospitalario
- Auxiliar de Farmacia hospitalaria
- Auxiliar de Cocina hospitalaria

### 2.5 Diputaciones provinciales (41 entradas — completo)

Las 41 Diputaciones provinciales clásicas + 3 Diputaciones Forales vascas + Cabildos canarios + Consells baleares:

**Andalucía (8):** Almería, Cádiz, Córdoba, Granada, Huelva, Jaén, Málaga, Sevilla ✓
**Aragón (3):** Huesca, Teruel, Zaragoza ✓
**Castilla y León (9):** Ávila, Burgos, León, Palencia, Salamanca, Segovia, Soria, Valladolid, Zamora ✓
**Castilla-La Mancha (5):** Albacete, Ciudad Real, Cuenca, Guadalajara, Toledo ✓
**Catalunya (4):** Barcelona, Girona, Lleida, Tarragona ✓
**Comunidad Valenciana (3):** Alicante, Castellón, Valencia ✓
**Extremadura (2):** Badajoz, Cáceres ✓
**Galicia (4):** A Coruña, Lugo, Ourense, Pontevedra ✓
**País Vasco (3 forales):** Álava, Bizkaia, Gipuzkoa ✓
**Canarias (7 Cabildos):** El Hierro, Fuerteventura, Gran Canaria, La Gomera, La Palma, Lanzarote, Tenerife ✓
**Baleares (3 Consells):** Formentera, Mallorca, Menorca ✓

CCAA uniprovinciales sin Diputación (gobierna la CCAA): Asturias, Cantabria, Navarra, La Rioja, Madrid, Murcia → cubiertas en sección 2.3.

C2 cuerpos transversales en Diputaciones:
- `auxiliar_inspeccion_tributos_locales` ✓
- `ayudante_recaudacion` ✓

### 2.6 Ayuntamientos top (11 entradas — gap moderado)

C2 implementadas o aspiracionales:
- Madrid ✓ implementada
- Barcelona, Sevilla, Zaragoza, Málaga, Bilbao, Las Palmas, Palma, Murcia ✓ implementada, Valencia ✓ implementada, Badajoz ✓ implementada

**Faltan capitales top (50k+ habitantes):**
- A Coruña, Vigo (Galicia)
- Vitoria-Gasteiz, San Sebastián (P. Vasco)
- Alicante, Elche, Castellón (CV)
- Córdoba, Granada, Jerez, Almería (Andalucía)
- Valladolid, Burgos, Salamanca (CyL)
- Pamplona (Navarra)
- Gijón, Oviedo (Asturias)
- Santander (Cantabria)
- Logroño (La Rioja)
- Hospitalet, Tarrasa, Sabadell, Mataró (Catalunya)
- Móstoles, Alcalá Henares, Fuenlabrada, Leganés, Getafe, Alcorcón (Madrid area)

Total ~25-30 Aytos top sin entrada propia.

### 2.7 Correos / Postal (1 entrada — gap)

C2:
- `correos_personal_operativo` — Personal Operativo de Correos ✓ implementada
- `correos` — Correos y Telégrafos (genérico)

**Falta:**
- Administrativo Correos C1
- Atención al Cliente Correos C2
- Cartero rural (es lo mismo que operativo? verificar)

### 2.8 Universidad (1 entrada — gap)

C2:
- `auxiliar_administrativo_universidad` — Auxiliar Administrativo de Universidad (genérico)

**Falta granularidad:** España tiene ~50 universidades públicas. Si se quiere alta cobertura por universidad: entradas específicas para las top 15 (UCM, UAM, UB, UV, US, UGR, UCO, UNED, UDC, USC, UNIZAR, UVa, UMA, etc.).

### 2.9 Local — Policía, Bombero, Otros (3 entradas genéricas)

C1 genéricas:
- `policia_local`, `bombero`, `administrativo_ayuntamiento`

**Falta granularidad:** Policía Local y Bombero varían fuerte por CCAA en cuerpo legal y temario (ej. Bombero CAM, Bombero Barcelona, Bombero Catalunya, etc.). Si se quiere alta cobertura: ~17 Bomberos × CCAA + Policía Local × top Aytos.

C2 transversal:
- `auxiliar_ayuntamiento` (genérico ya añadido)

## 3. Gaps consolidados (priorizados por demanda esperada)

### 🔥 Alta prioridad (~13 entradas) — C1 autonómicas

Hoy solo 4 de 17 CCAA tienen entrada C1 propia. Las 13 que faltan:

1. Administrativo Comunidad de Madrid (C1)
2. Administrativo Junta de Andalucía (C1)
3. Administrativo Generalitat de Catalunya (C1)
4. Administrativo Junta de Castilla y León (C1)
5. Administrativo Gobierno Vasco (C1)
6. Administrativo CAIB (Baleares) (C1)
7. Administrativo Gobierno de Canarias (C1)
8. Administrativo Principado de Asturias (C1)
9. Administrativo CARM (Murcia) (C1)
10. Administrativo Gobierno de Cantabria (C1)
11. Administrativo Gobierno de La Rioja (C1)
12. Administrativo Junta de Extremadura (C1)
13. Administrativo Junta de Castilla-La Mancha (C1)
14. Administrativo Aragón (C1)

Coste: ~1h investigación + insert.

### 🔥 Alta prioridad (~25 entradas) — Aytos top sin entrada

Capitales/Aytos con población ≥100k que no tienen entrada específica. Coste: ~1.5h.

### 🟡 Media prioridad (~17 entradas) — Bombero por CCAA

Bombero Forestal CAM, Bombero CAT, Bombero Andalucía, etc. Cada uno tiene su Estatuto Bomberos autonómico distinto. Coste: ~2h.

### 🟡 Media prioridad (~17 entradas) — Celador por servicio salud

Celador SAS, Celador SERMAS, Celador SACYL, etc. Hoy solo 3 aspiracionales. Coste: ~1h.

### 🟢 Baja prioridad (~10 entradas) — Cuerpos estatales menores y Correos

- Administrativo Correos C1
- Atención Cliente Correos C2
- Aux Trabajadores TGSS
- Aux Penitenciarios C2 (distinto de Ayudante C1)
- Aux Trabajo y Seguridad Social
- Aux Mantenimiento Aeropuertos AENA
- Aux SEPE Provincial (en caso de territorialización)

### 🟢 Baja prioridad (~15 entradas) — Universidad por institución

Solo si se quiere granularidad por universidad. Demanda probablemente baja (alguno preferiría "Aux Admin Universidad" genérico).

## 4. Conexión con `detection_sources` (Fase 3 roadmap)

Para que cada oposición sea detectable automáticamente, la administración convocante debe estar en `detection_sources`. Estado actual:

- 167 `detection_sources` activas en BD (2026-05-31).
- Cubren: 17 boletines autonómicos + 50 BOPs provinciales + DGFP + INAP + portales empleo CCAA + portales empleo locales top.
- **Gap:** las administraciones cuyas C1 autonómicas faltan en el catálogo probablemente sí tienen `detection_source` (porque su boletín autonómico ya está). Pero conviene verificar 1 a 1.
- **Gap real para Aytos faltantes:** los Aytos top sin entrada propia tampoco tienen un `detection_source` específico de su portal de empleo. Solo se detectan vía BOP provincial. ROI bajo añadir 25 detection_sources de portales municipales — mejor confiar en BOP + DGFP nacionales.

## 5. Plan de inserción priorizado

Fase A (esta sesión si Manuel lo aprueba): añadir las **13 C1 autonómicas** faltantes + **25 Aytos top** + **17 Celadores** = ~55 entradas. Coste estimado: 3-4h. Sin investigación profunda (data ya está en el catálogo arriba o son derivaciones obvias del patrón).

Fase B (siguiente sesión): completar Bomberos por CCAA + Aux Correos + Aux Penitenciario + cuerpos estatales menores. ~30 entradas. Coste 2-3h.

Fase C (cuando haya demanda real medida): granularidad Universidad + Policía Local por Ayto. ~30 entradas más. Coste 2h.

**Total para "100% C1+C2 cubierto":** ~115 entradas nuevas, ~7-9h trabajo distribuido en 2-3 sesiones.

## 6. Verificación de la inserción

Tras añadir entradas a `OFFICIAL_OPOSICIONES`:

1. Tests `__tests__/config/oposicionAliases.test.ts` no se rompen (las aspiracionales nuevas no requieren aliases obligatorios).
2. Test `__tests__/config/oposicionesCentralConfig.test.ts` no se afecta (mide OPOSICIONES no OFFICIAL_OPOSICIONES).
3. Selector perfil (`app/perfil/page.tsx`) — manualmente añadir las top 20 si se quiere que aparezcan en el selector hardcoded. El resto solo aparecen en el modal de onboarding.
4. Búsqueda `matchesOposicion` (`lib/utils/searchOposicion.ts`) las encuentra automáticamente sin cambios.

## 7. Referencias

- Roadmap detección: `docs/roadmap/deteccion-convocatorias-oeps-completo.md`
- Audit cobertura: `docs/maintenance/audit-seguimiento-coverage.md`
- Manual crear oposición: `docs/maintenance/crear-nueva-oposicion.md`
- Catálogo demanda: `SELECT target_oposicion, COUNT(*) FROM user_profiles GROUP BY target_oposicion ORDER BY 2 DESC`
