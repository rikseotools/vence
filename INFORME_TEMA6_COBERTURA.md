# INFORME: Cobertura del Epígrafe - Tema 6 Tramitación Procesal

**Fecha:** 2026-01-20
**Tema:** Tema 6 - El Poder Judicial

## 📋 Epígrafe Oficial

> El Poder Judicial. El Consejo General del Poder Judicial: composición y funciones.
> La jurisdicción: Jueces y Magistrados: Funciones y competencias. La independencia judicial.
> El Ministerio Fiscal: Organización y funciones. Sistemas de acceso a las carreras judicial y fiscal.

---

## ✅ SCOPE ACTUAL EN BASE DE DATOS

### Constitución Española (CE)
- **Artículos:** 117-127 (11 artículos)
- **Cobertura:**
  - Art. 117: Justicia, Jueces y Magistrados
  - Art. 122: ⭐ **CGPJ: composición y funciones**
    - Apartado 2: CGPJ como órgano de gobierno, funciones (nombramientos, ascensos, inspección, disciplinario)
    - Apartado 3: **Composición: Presidente TS + 20 miembros (12 jueces/magistrados, 4 Congreso, 4 Senado)**
  - Art. 123: Tribunal Supremo y nombramiento de su Presidente por CGPJ
  - Art. 124: Ministerio Fiscal
  - Arts. 117-127: Poder Judicial general

### Ley Orgánica del Poder Judicial (LO 6/1985)
- **Artículos:** 13, 14, 541-584 bis (49 artículos)
- **Cobertura:**
  - Arts. 13-14: Independencia judicial
  - Arts. 541-584 bis: **Ministerio Fiscal** (organización y funciones)

### Ley 38/1988 (Demarcación y Planta Judicial)
- **Todos los artículos** (sin filtro específico)

---

## 📊 ANÁLISIS DE COBERTURA POR ELEMENTO DEL EPÍGRAFE

| Elemento del Epígrafe | Estado | Artículos Actuales | Observaciones |
|------------------------|--------|-------------------|---------------|
| **El Poder Judicial** | ✅ CUBIERTO | CE 117-127 | Completo |
| **CGPJ: composición** | ✅ CUBIERTO | CE 122.3 | Composición completa: 20 miembros + Presidente |
| **CGPJ: funciones** | ⚠️ PARCIAL | CE 122.2 | CE menciona funciones, pero falta desarrollo de LOPJ |
| **Jueces y Magistrados: Funciones y competencias** | ✅ CUBIERTO | CE 117, 120, LOPJ 13-14 | Completo |
| **Independencia judicial** | ✅ CUBIERTO | CE 117, 127, LOPJ 14 | Completo |
| **Ministerio Fiscal: Organización y funciones** | ✅ CUBIERTO | CE 124, LOPJ 541-584 bis | Completo |
| **Sistemas de acceso a las carreras judicial y fiscal** | ❌ NO CUBIERTO | - | **FALTA COMPLETAMENTE** |

---

## ⚠️ ELEMENTOS FALTANTES

### 1. CGPJ: Desarrollo de funciones de gobierno
**Artículos LOPJ recomendados:** 104-105

- **Art. 104 LOPJ:**
  - Principios de unidad e independencia
  - **CGPJ como órgano de gobierno del Poder Judicial**
  - Subordinación de Salas de Gobierno

- **Art. 105 LOPJ:**
  - Presidente del TS y CGPJ como primera autoridad judicial
  - Representación del Poder Judicial

**Justificación:** El CE Art. 122 establece QUÉ es el CGPJ y su composición, pero los arts. 104-105 LOPJ desarrollan CÓMO ejerce el gobierno del Poder Judicial, complementando el epígrafe "funciones".

### 2. Sistemas de acceso a las carreras judicial y fiscal
**Artículos LOPJ recomendados:** 301-308

- **Art. 301:** Principios de ingreso (mérito y capacidad)
- **Art. 302:** Requisitos para oposición libre
- **Art. 304:** Tribunal evaluador de pruebas
- **Art. 305:** Comisión de Selección
- **Art. 306:** Convocatoria de oposiciones (cada 2 años)
- **Art. 307:** Escuela Judicial (selección y formación)
- **Art. 308:** Relación de aprobados y nombramiento

**Justificación:** El epígrafe menciona explícitamente "Sistemas de acceso a las carreras judicial y fiscal". Este contenido NO está cubierto en absoluto por el scope actual.

---

## 💡 RECOMENDACIÓN

### Artículos a AÑADIR al topic_scope de Tema 6 (LO 6/1985):

```
104, 105, 301, 302, 304, 305, 306, 307, 308
```

**Total:** 9 artículos nuevos
**Scope actual:** 49 artículos LOPJ
**Scope propuesto:** 58 artículos LOPJ

### Impacto:
- ✅ Cubre completamente "CGPJ: funciones" (desarrollo del gobierno judicial)
- ✅ Cubre completamente "Sistemas de acceso a las carreras judicial y fiscal"
- ✅ Epígrafe 100% cubierto

---

## 📝 NOTAS IMPORTANTES

### Sobre los artículos 122-148 LOPJ (suprimidos)
Los artículos 122-148 de la LOPJ, que históricamente regulaban la composición y organización detallada del CGPJ, **fueron suprimidos en la reforma LO 3/2024**. Por tanto:

- ✅ La base de datos está CORRECTA al no incluirlos
- ✅ El BOE extractor funciona correctamente (filtra artículos "(Suprimido)")
- ✅ La sincronización está actualizada (646 arts BD vs 641 BOE)

### Cobertura actual de composición del CGPJ
Aunque los artículos detallados de LOPJ fueron suprimidos, **la composición del CGPJ SÍ está cubierta** porque:

- El **CE Art. 122.3** (rango constitucional) establece la composición completa
- Este artículo tiene mayor jerarquía que la LOPJ
- **Ya está en el scope actual** (CE 117-127)

---

## 🎯 CONCLUSIÓN

El Tema 6 tiene **cobertura casi completa** del epígrafe, con dos áreas que requieren artículos adicionales:

1. **LOPJ 104-105:** Desarrollo de las funciones de gobierno del CGPJ
2. **LOPJ 301-308:** Sistema de acceso a las carreras (actualmente 0% cubierto)

La adición de estos 9 artículos garantizaría la **cobertura 100% del epígrafe oficial**.
