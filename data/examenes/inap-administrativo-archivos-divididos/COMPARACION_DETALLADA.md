# Comparación Detallada: INAP vs BD Vence

## Programas Identificados

### 1. **Temario Oficial INAP** (BOE 18/12/2025)
- Oposición: **Auxiliar Administrativo del Estado**
- Total temas: **37 consecutivos** (1-37)
- Estructura:
  - I. Organización del Estado (Temas 1-11)
  - II. Organización de oficinas públicas (Temas 12-15)
  - III. Derecho administrativo general (Temas 16-22)
  - IV. Gestión de Personal (Temas 23-31)
  - V. Gestión financiera (Temas 32-37)

### 2. **Temario Vence `/administrativo-estado`** (position_type: 'administrativo')
- Total temas: **45** (1-11, 201-204, 301-307, 401-409, 501-506, 601-608)
- Estructura:
  - Bloque I: Organización del Estado (1-11)
  - Bloque II: Organización de Oficinas (201-204)
  - Bloque III: Derecho Administrativo (301-307)
  - Bloque IV: Gestión de Personal (401-409)
  - Bloque V: Gestión Financiera (501-506)
  - Bloque VI: Informática y Ofimática (601-608)

### 3. **Temario Vence `/auxiliar-administrativo-estado`** (position_type: 'auxiliar_administrativo')
- Total temas: **28** (1-16, 101-112)
- Estructura:
  - Bloque I: Organización Pública (1-16)
  - Bloque II: Actividad Administrativa y Ofimática (101-112)

## Análisis de Correspondencias

### INAP Tema 1 ↔ BD Tema 1

**INAP:**
- Título: "La Constitución Española de 1978: estructura y contenido. Derechos y deberes fundamentales. Su garantía y suspensión. El Tribunal Constitucional. El Defensor del Pueblo. Reforma de la Constitución."
- Leyes oficiales:
  - Constitución Española (TODOS los artículos)

**BD Vence (Tema 1):**
- Título: "La Constitución Española de 1978"
- Leyes en topic_scope:
  1. **CE** → Artículos: 1-169 (específicos)
  2. **LO 3/1981** (Defensor del Pueblo) → Artículos: 1-54
  3. **Reglamento del Congreso** → Artículo: 146
  4. **Reglamento del Senado** → Artículo: 152

**DIFERENCIAS:**
- ✅ **CE**: En la BD tienen artículos específicos (1-169), en INAP dicen "Todos"
- ➕ **EXTRA EN BD**: LO 3/1981 (Defensor del Pueblo) - tiene sentido porque el tema INAP menciona el Defensor
- ➕ **EXTRA EN BD**: Reglamentos Congreso/Senado - no mencionados en programa INAP
- ❓ **Falta en BD**: LO 2/1979 (Tribunal Constitucional) - el tema INAP lo menciona pero no está en scope BD

---

### INAP Tema 2 ↔ BD Tema 2

**INAP:**
- Título: "La Jefatura del Estado. La Corona: funciones constitucionales del Rey. Sucesión y regencia."
- Leyes oficiales:
  - Constitución Española → Artículos: 56-65 (Título II - De la Corona)

**BD Vence (Tema 2):**
- Título: "La Jefatura del Estado. La Corona"
- Leyes en topic_scope:
  1. **CE** → Artículos: 56-65, 168, 1, 12 (y otros)

**DIFERENCIAS:**
- ✅ **CE Arts. 56-65**: Coinciden perfecto
- ➕ **EXTRA EN BD**: Art. 168 (Reforma constitucional) - probablemente relacionado con sucesión
- ➕ **EXTRA EN BD**: Arts. 1, 12 - parecen extras innecesarios

---

### INAP Tema 3 ↔ BD Tema 3

**INAP:**
- Título: "Las Cortes Generales: composición, atribuciones y funcionamiento del Congreso de los Diputados y del Senado."
- Leyes oficiales:
  - Constitución Española → Artículos: 66-80 (Título III - Cortes Generales)

**BD Vence (Tema 3):**
- Título: "Las Cortes Generales"
- Leyes en topic_scope:
  1. **CE** → Artículos: 66-80 (y algunos más)
  2. **Reglamento del Senado** → Arts. 5, 6, 7, 22-31, 108
  3. **Reglamento del Congreso** → Arts. 30, 110, 146, 162
  4. **LO 5/1985** (LOREG) → Arts. 162, 207

**DIFERENCIAS:**
- ✅ **CE Arts. 66-80**: Coinciden perfecto
- ➕ **EXTRA EN BD**: Reglamentos parlamentarios - no en programa INAP oficial
- ➕ **EXTRA EN BD**: LOREG - podría tener sentido pero no está en INAP

---

### INAP Tema 4 ↔ BD Tema 4

**INAP:**
- Título: "El Poder Judicial. El Consejo General del Poder Judicial. El Tribunal Supremo. La organización judicial española."
- Leyes oficiales:
  - Constitución Española → Artículos: 117-127
  - Ley Orgánica 6/1985 del Poder Judicial → Artículos: 1-5, 107-115 (organizac

ión)

**BD Vence (Tema 4):**
- Título: "El Poder Judicial"
- Leyes en topic_scope:
  1. **CE** → Artículos: 117-127
  2. **LO 6/1985** (LOPJ) → Arts. 12, 14, 19, 26, 29, 30, 32, 34, 38, 39, 42, 53, 54, 55, 56...

**DIFERENCIAS:**
- ✅ **CE Arts. 117-127**: Coinciden perfecto
- ⚠️ **LOPJ**: En INAP mencionan arts. 1-5, 107-115; en BD tienen otros artículos (12, 14, 19, 26, 29, 30, 32, 34, 38, 39, 42, 53-56...)
- ❓ **Posible desajuste**: Los artículos de LOPJ difieren significativamente

---

### INAP Tema 5 ↔ BD Tema 5

**INAP:**
- Título: "El Gobierno y la Administración. El Presidente del Gobierno. El Consejo de Ministros. Designación, causas de cese y responsabilidad del Gobierno. Las funciones del Gobierno. Relaciones entre el Gobierno y las Cortes Generales."
- Leyes oficiales:
  - Constitución Española → Artículos: 97-116 (Títulos IV y V)
  - Ley 50/1997 del Gobierno → Artículos: 1-26

**BD Vence (Tema 5):**
- Título: "El Gobierno y la Administración"
- Leyes en topic_scope:
  1. **CE** → Artículos: 97-116
  2. **Ley 50/1997** → Artículos: 1, 2, 3, 4, 5, 8, 10, 11, 12, 14, 15, 18, 25, 26...

**DIFERENCIAS:**
- ✅ **CE Arts. 97-116**: Coinciden perfecto
- ✅ **Ley 50/1997**: Hay bastante coincidencia, aunque en BD no tienen TODOS los arts. 1-26, sino una selección

---

## Resumen de Hallazgos

### ✅ COINCIDENCIAS:
- La mayoría de artículos de la CE coinciden bien entre INAP y BD
- La estructura de bloques es similar

### ⚠️ DIFERENCIAS ENCONTRADAS:

1. **Leyes Extra en BD** (no mencionadas en programa INAP):
   - Reglamento del Congreso
   - Reglamento del Senado
   - LOREG (Ley Orgánica Régimen Electoral)

2. **Leyes que faltan en BD** (mencionadas en INAP):
   - LO 2/1979 (Tribunal Constitucional) - debería estar en Tema 1

3. **Artículos diferentes**:
   - LOPJ: Los artículos en BD no coinciden con los del programa INAP

4. **Artículos extra en BD**:
   - Algunos temas tienen artículos adicionales que no están en el programa oficial

## Recomendaciones

1. **Revisar Tema 1**: Añadir LO 2/1979 (Tribunal Constitucional) al topic_scope
2. **Revisar Tema 4**: Ajustar artículos de LOPJ para que coincidan con arts. 1-5, 107-115
3. **Decidir sobre leyes extra**:
   - ¿Mantener Reglamentos parlamentarios? (añaden valor pero no están en INAP)
   - ¿Mantener LOREG en Tema 3? (añade valor pero no está en INAP)
4. **Verificar resto de temas**: Hacer comparación completa de los 37 temas

---

**Próximo Paso:** ¿Quieres que continue comparando el resto de temas o prefieres que primero ajustemos estos primeros 5?
