-- Update explanation for the bar chart question with mental calculation strategy
UPDATE psychometric_questions 
SET explanation = '**Estrategia rápida sin calculadora:**

1. **Observación visual clave**: En TODOS los años, Verduras siempre > Frutas
2. **Cálculo mental por diferencias**:
   - 2019: Verduras 20 - Frutas 15 = +5
   - 2020: Verduras 20 - Frutas 20 = 0  
   - 2021: Verduras 15 - Frutas 10 = +5
   - 2022: Verduras 10 - Frutas 5 = +5
3. **Suma rápida**: 5 + 0 + 5 + 5 = 15 kg/mes
4. **Descarte de opciones**: 5 y 10 muy bajas, 20 muy alta

**Respuesta: B) 15 kg/mes**

**Técnica clave**: Busca patrones visuales y calcula diferencias año por año, no totales.'
WHERE question_text = '¿Cuál sería la diferencia por persona entre el total de frutas y verduras consumida?'
AND question_subtype = 'bar_chart';