# Migración Manual: Añadir Columna BOE

## Pasos para ejecutar en Supabase SQL Editor

### 1. Añadir la columna
```sql
ALTER TABLE laws ADD COLUMN IF NOT EXISTS last_update_boe TEXT;
```

### 2. Verificar que se añadió correctamente
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'laws' 
  AND column_name = 'last_update_boe';
```

### 3. Poblar la columna con datos iniciales (opcional)
```sql
-- Inicializar con NULL, se poblará automáticamente en la próxima verificación
UPDATE laws 
SET last_update_boe = NULL 
WHERE boe_url IS NOT NULL;
```

### 4. Verificar datos actuales
```sql
SELECT id, short_name, last_update_boe, last_checked 
FROM laws 
WHERE boe_url IS NOT NULL 
ORDER BY short_name;
```

## Después de ejecutar la migración

1. ✅ La API `/api/law-changes` ya está actualizada para usar fechas BOE
2. ✅ La lógica cambiará de hash a comparación de fechas automáticamente
3. ✅ Los cambios serán mucho más precisos (solo cambios reales de contenido legal)

## ¿Por qué es mejor?

- **Hash HTML**: Detecta cualquier cambio (scripts, metadatos, timestamps)
- **Fecha BOE**: Solo detecta actualizaciones oficiales de contenido legal

La fecha "Última actualización publicada el XX/XX/XXXX" solo cambia cuando hay modificaciones reales en la ley.