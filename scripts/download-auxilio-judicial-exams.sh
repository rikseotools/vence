#!/bin/bash
# Script para descargar todos los exámenes oficiales de Auxilio Judicial
# Fuentes: mjusticia.gob.es, repasandosinpapeles.com

DIR="/home/manuel/Documentos/github/vence/data/examenes/auxilio-judicial/pdfs"
mkdir -p "$DIR"
cd "$DIR"

echo "=== Descargando exámenes de Auxilio Judicial ==="

# 2025 - mjusticia.gob.es
echo "--- 2025 ---"
curl -sL -o "2025-test-modelo-A.pdf" "https://www.mjusticia.gob.es/es/Ciudadano/EmpleoPublico/Documents/EJERCICIO%201%20-%20TEST%20-%20MODELO%20A.pdf"
curl -sL -o "2025-test-plantilla-A.pdf" "https://www.mjusticia.gob.es/es/Ciudadano/EmpleoPublico/Documents/PLANTILLA%20PROVISIONAL%20DE%20RESPUESTAS%20-%20PRIMER%20EJERCICIO%20-%20MODELO%20A_AuxJud1437.pdf"
curl -sL -o "2025-practico-modelo-A.pdf" "https://www.mjusticia.gob.es/es/Ciudadano/EmpleoPublico/Documents/EJERCICIO%202%20-%20CASOS%20PR%C3%81CTICOS%20-%20MODELO%20A.pdf"
curl -sL -o "2025-practico-plantilla-A.pdf" "https://www.mjusticia.gob.es/es/Ciudadano/EmpleoPublico/Documents/PLANTILLA%20PROVISIONAL%20DE%20RESPUESTAS%20-%20SEGUNDO%20EJERCICIO%20-%20MODELO%20A_Auxjud1437.pdf"
echo "2025: $(ls 2025-*.pdf 2>/dev/null | wc -l) archivos"

# 2024 - repasandosinpapeles.com
echo "--- 2024 ---"
curl -sL -o "2024-marzo-parte1.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-marzo-2024-primera-parte.pdf"
curl -sL -o "2024-marzo-parte1-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-marzo-2024-primera-parte.pdf"
curl -sL -o "2024-marzo-parte2.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-marzo-2024-segunda-parte.pdf"
curl -sL -o "2024-marzo-parte2-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-marzo-2024-segunda-parte.pdf"
curl -sL -o "2024-sep-parte1.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-septiembre-2024-primera-parte.pdf"
curl -sL -o "2024-sep-parte1-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-septiembre-2024-primera-parte.pdf"
curl -sL -o "2024-sep-parte2.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-septiembre-2024-segunda-parte.pdf"
curl -sL -o "2024-sep-parte2-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-septiembre-2024-segunda-parte.pdf"
curl -sL -o "2024-incidencias-parte1.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2024-de-incidencias-primera-parte.pdf"
curl -sL -o "2024-incidencias-parte1-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2024-de-incidencias-primera-parte.pdf"
curl -sL -o "2024-incidencias-parte2.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2024-de-incidencias-segunda-parte.pdf"
curl -sL -o "2024-incidencias-parte2-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2024-de-incidencias-segundo-ejercicio.pdf"
echo "2024: $(ls 2024-*.pdf 2>/dev/null | wc -l) archivos"

# 2023 - repasandosinpapeles.com
echo "--- 2023 ---"
curl -sL -o "2023-parte1.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2023-primera-parte.pdf"
curl -sL -o "2023-parte1-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2023-primera-parte.pdf"
curl -sL -o "2023-parte2.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2023-segunda-parte.pdf"
curl -sL -o "2023-parte2-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2023-segunda-parte.pdf"
curl -sL -o "2023-incidencias-parte1.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2023-de-incidencias-primera-parte.pdf"
curl -sL -o "2023-incidencias-parte1-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2023-de-incidencias-primera-parte.pdf"
curl -sL -o "2023-incidencias-parte2.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2023-de-incidencias-segunda-parte.pdf"
curl -sL -o "2023-incidencias-parte2-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2023-de-incidencias-segunda-parte.pdf"
echo "2023: $(ls 2023-*.pdf 2>/dev/null | wc -l) archivos"

# 2021 - repasandosinpapeles.com
echo "--- 2021 ---"
curl -sL -o "2021-parte1.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2021-primera-parte.pdf"
curl -sL -o "2021-parte1-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2021-primera-parte.pdf"
curl -sL -o "2021-parte2.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2021-segunda-parte.pdf"
curl -sL -o "2021-parte2-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2021-segunda-parte.pdf"
curl -sL -o "2021-incidencias-parte1.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2021-de-incidencias-primera-parte.pdf"
curl -sL -o "2021-incidencias-parte1-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2021-de-incidencias-primera-parte.pdf"
curl -sL -o "2021-incidencias-parte2.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2021-de-incidencias-segunda-parte.pdf"
curl -sL -o "2021-incidencias-parte2-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2021-de-incidencias-segunda-parte.pdf"
echo "2021: $(ls 2021-*.pdf 2>/dev/null | wc -l) archivos"

# 2018 - repasandosinpapeles.com
echo "--- 2018 ---"
curl -sL -o "2018-parte1.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2018-primera-parte.pdf"
curl -sL -o "2018-parte1-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2018-primera-parte.pdf"
curl -sL -o "2018-parte2.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2018-segunda-parte.pdf"
curl -sL -o "2018-parte2-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2018-segunda-parte.pdf"
echo "2018: $(ls 2018-*.pdf 2>/dev/null | wc -l) archivos"

# 2016 - repasandosinpapeles.com
echo "--- 2016 ---"
curl -sL -o "2016-parte1.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-2016-primera-parte.pdf"
curl -sL -o "2016-parte1-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-2016-primera-parte.pdf"
curl -sL -o "2016-parte2.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-2016-segunda-parte.pdf"
curl -sL -o "2016-parte2-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-2016-segunda-parte.pdf"
echo "2016: $(ls 2016-*.pdf 2>/dev/null | wc -l) archivos"

# 2012 - repasandosinpapeles.com
echo "--- 2012 ---"
curl -sL -o "2012-completo-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2012-con-respuestas.pdf"
echo "2012: $(ls 2012-*.pdf 2>/dev/null | wc -l) archivos"

# 2010 - repasandosinpapeles.com
echo "--- 2010 ---"
curl -sL -o "2010-completo-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2010-con-respuestas.pdf"
echo "2010: $(ls 2010-*.pdf 2>/dev/null | wc -l) archivos"

# 2009 - repasandosinpapeles.com
echo "--- 2009 ---"
curl -sL -o "2009-examen.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/examen-auxilio-judicial-2009.pdf"
curl -sL -o "2009-resp.pdf" "https://www.repasandosinpapeles.com/wp-content/uploads/2025/02/respuestas-examen-auxilio-judicial-2009.pdf"
echo "2009: $(ls 2009-*.pdf 2>/dev/null | wc -l) archivos"

echo ""
echo "=== Resumen ==="
echo "Total PDFs: $(ls *.pdf 2>/dev/null | wc -l)"
ls -lh *.pdf 2>/dev/null | awk '{print $9, $5}'
