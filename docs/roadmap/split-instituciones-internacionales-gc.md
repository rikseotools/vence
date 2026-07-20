# Split físico de "Instituciones Internacionales GC" (982→917 preguntas)

**Contexto:** una "ley" editorial virtual (`instituciones-internacionales-gc`, `696cacfc`) mezclaba ~12 organizaciones internacionales en un solo contenedor, escopada como "toda la ley" por **guardia_civil T6** (ONU, Consejo de Europa, UE, OTAN, INTERPOL, EUROPOL, EUROJUST, FRONTEX, CEPOL, FAO, FMI, OMS) y **policia_nacional T4** (La Unión Europea + cooperación policial + TEDH/TJUE). Ese doble scope "toda la ley" causaba mis-scoping: cada opositor recibía preguntas de la otra materia.

**Estructura de partida (917 preguntas activas):**
- **art.0 "contenedor":** 815 preguntas de datos institucionales de ~12 organizaciones (la mayoría NO son de articulado de tratado, sino de hecho institucional). Reparto heurístico: ONU 135, UE 94, Consejo Europa 78, OTAN 73, OMS 54, INTERPOL 51, CEPOL 51, FMI 48, FAO 47, FRONTEX 44, EUROPOL 39, EUROJUST 37, +63 sin clasificar.
- **39 artículos numerados (102 preguntas):** ya llevaban la norma en el título (corrección 19/07) → atribuibles limpio a 6 tratados.

## Fase 1 — HECHA (19/07): escindir los artículos numerados (cero regresión)

Creadas 6 leyes de tratado y movidos los 39 artículos numerados (con sus 102 preguntas), escopadas en GC T6 y PN T4 **junto al contenedor** (todo NULL="toda la ley") → lo que se servía no cambia, solo queda estructurado. Verificado: 917 = 815 (contenedor) + 102 (6 tratados), sin pérdida.

| Ley (slug) | short_name | scope | arts | preguntas |
|---|---|---|---|---|
| `carta-naciones-unidas` | Carta ONU | (intl) | 8 | 17 |
| `estatuto-consejo-europa` | Estatuto Consejo de Europa | (intl) | 1 | 3 |
| `estatuto-interpol` | Estatuto INTERPOL | (intl) | 9 | 12 |
| `reglamento-ue-2015-2219-cepol` | Regl. UE 2015/2219 CEPOL | eu | 11 | 45 |
| `reglamento-ue-2016-794-europol` | Regl. UE 2016/794 Europol | eu | 4 | 12 |
| `reglamento-ue-2019-1896-frontex` | Regl. UE 2019/1896 Frontex | eu | 6 | 13 |

## Fase 2 — HECHA (19/07): drenar el art.0 (815 preguntas)

Creadas 7 leyes editoriales (UE-instituciones, OTAN, EUROJUST, FAO, FMI, OMS, Tribunales europeos TEDH/TJUE) + `art.0` contenedor en las 13 organizaciones. Las 815 clasificadas por organización con **12 agentes Sonnet** (pista heurística + corrección) → **integridad verificada** (815/815, 0 sin clasificar/sobrantes). **798 movidas** a su organización, **17 `OTRO`** (ambiguas) permanecen en el contenedor. Las 13 org laws escopadas en GC T6 + PN T4 → **917 preguntas servidas por tema, cero regresión**.

**Distribución final** (numerados Fase 1 + institucionales Fase 2): Carta ONU 159 · UE-instituciones 110 · CEPOL 96 · Consejo Europa 84 · OTAN 74 · INTERPOL 66 · Europol 60 · Frontex 60 · OMS 54 · FMI 48 · FAO 47 · EUROJUST 38 · TribunalesEU 4 · contenedor (OTRO) 17.

## Fase 3 — HECHA (19/07): de-scope fino + 17 OTRO + contenedor repurposado

- **De-scope fino (decisión Manuel):** **PN T4** ("La Unión Europea + cooperación policial + TEDH/TJUE") se queda con **UE, CEPOL, Europol, Eurojust, Frontex, TribunalesEU e INTERPOL** (cooperación policial internacional) → sirve **434 preguntas** (antes 917); quitadas ONU, Consejo de Europa, OTAN, FAO, FMI, OMS + contenedor. **GC T6** (epígrafe amplio) mantiene las 13 orgs + teoría general → **917**. **Mis-scoping resuelto.**
- **17 OTRO:** eran preguntas de **teoría general** de organizaciones internacionales (concepto, clasificación, caracteres, órganos, sedes, UNESCO, Gendarmería Europea…), no mapean a una org concreta.
- **Contenedor NO borrado, sino repurposado:** `instituciones-internacionales-gc` → short_name "Instituciones Internacionales (teoría general)", 17 preguntas, escopado **solo en GC T6**. Deja de ser un cajón mixto; es un bucket legítimo de teoría general.

## Estado final

- 6 leyes de tratado (Carta ONU, Estatuto Consejo Europa, Estatuto INTERPOL, Regl. UE CEPOL/Europol/Frontex) con artículos numerados + hechos institucionales.
- 7 leyes editoriales (UE, OTAN, EUROJUST, FAO, FMI, OMS, Tribunales europeos) con hechos institucionales.
- 1 bucket de teoría general (17 preg).
- **GC T6:** 917 preg (las 13 orgs + teoría general). **PN T4:** 434 preg (UE + coop. policial + tribunales). Sin regresión de contenido, con el mis-scoping corregido.
