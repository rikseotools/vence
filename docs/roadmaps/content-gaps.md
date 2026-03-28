# Lagunas de Contenido por Oposición

Registro de áreas del epígrafe que no tienen suficientes preguntas. Para priorizar la creación de contenido.

## Auxiliar Administrativo Comunidad de Madrid

### T11 - La Seguridad Social
**Epígrafe:** Características generales y principales Entidades gestoras. Afiliación, cotización y recaudación. Acción protectora: Contingencias y prestaciones.

| Área | Estado | Preguntas | Notas |
|------|--------|-----------|-------|
| Características generales | Cubierto | ~80 | RDL 8/2015 arts generales |
| Entidades gestoras (INSS, TGSS, ISM) | **Sin preguntas** | 0 | No hay en el banco scrapeado. Crear preguntas sobre INSS, TGSS, ISM, INGESA |
| Afiliación | Cubierto | ~10 | RD 84/1996 |
| Cotización | Cubierto | ~6 | RDL 8/2015 + Ley 31/2022 |
| Recaudación | Cubierto | ~14 | RD 1415/2004 |
| Acción protectora | Bien cubierto | ~170 | RDL 8/2015 arts 140+ |

### T21 - Trabajo Colaborativo: Microsoft 365
**Epígrafe:** Herramientas y funcionalidades. Microsoft 365: Teams, Sharepoint, OneDrive y Outlook. Videoconferencias.

| Área | Estado | Preguntas | Notas |
|------|--------|-----------|-------|
| OneDrive | Bien cubierto | 33 | Arts 1 y 4 de ley virtual Microsoft 365 |
| Teams | Cubierto | 16 | Arts 2 y 5 |
| SharePoint | **Pocas preguntas** | 2 | Art 3. Necesita más contenido |
| Videoconferencias | Incluido en Teams | - | Cubierto dentro de Teams reuniones |

## Proceso para añadir contenido

1. Identificar artículos de la ley que cubren el área
2. Verificar que los artículos existen en la BD (`articles`)
3. Crear preguntas con IA o importar de fuentes
4. Vincular a los artículos correctos
5. Añadir al `topic_scope` si faltan artículos

## Psicotécnicas — Imágenes pendientes de importar

87 preguntas de "Pruebas de instrucciones" (Madrid) tienen imágenes en el JSON de importación (`preguntas-para-subir/auxiliar-madrid/por_tema_psicotecnicos/Psico_-_Pruebas_de_instrucciones.json`) pero se importaron sin procesar la imagen a `content_data`.

| Dato | Valor |
|------|-------|
| Archivo fuente | `Psico_-_Pruebas_de_instrucciones.json` |
| Preguntas con imagen | 87 / 149 |
| Imágenes descargadas | `preguntas-para-subir/auxiliar-madrid/images/q_*.png` |
| Campo en JSON | `imageLocal`, `imageOriginal`, `imageRaw` |
| Campo destino en BD | `psychometric_questions.content_data` |
| Estado actual | `content_data = {}` (vacío) → preguntas irresolubles |
| Pregunta ejemplo | `938d5801` (desactivada por impugnación de Esther) |

**Proceso para reparar:**
1. Leer imagen local de `preguntas-para-subir/auxiliar-madrid/images/`
2. Subir a Supabase Storage
3. Guardar URL pública en `content_data.imageUrl`
4. Reactivar preguntas desactivadas por este motivo

**Nota:** El check `psy_missing_figures` en admin calidad detectará futuros casos.

## Última revisión
- 2026-03-28: T11 y T21 de Madrid revisados
- 2026-03-28: Psicotécnicas con imágenes pendientes documentadas
