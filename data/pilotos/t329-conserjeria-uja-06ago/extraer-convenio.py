#!/usr/bin/env python3
"""
extraer-convenio.py — extrae los 71 artículos del IV Convenio Colectivo del Personal
Laboral de las Universidades Públicas de Andalucía (BOJA nº 36, 23/02/2004) desde el
PDF oficial mirror de la propia UJA. [T-329, Tema 1]

Por qué el PDF y no el HTML de la Junta de Andalucía (que era la fuente original
propuesta en el spec): el HTML tiene un artículo (33, "Permisos, licencias...")
TRUNCADO a mitad de una enumeración por un widget "Descargar PDF" que la web inyecta
en medio del flujo del documento — sin aviso de que falta nada, el texto simplemente
termina en dos puntos. Verificado el 06/08/2026 comparando los dos: el PDF del propio
ujaen.es SÍ trae la lista completa (i, j, k...) que el HTML se comía. El PDF además usa
"Artículo N.-" en vez de "Artículo N. " (guion, no espacio) — dos fuentes, dos formatos,
verificar SIEMPRE los dos antes de asumir cuál es completo.

Gotchas de este documento (los 3 primeros ya los había dejado escritos una sesión
anterior el 31/07 sobre la copia HTML; se confirman aquí sobre el PDF):
  1. El patrón tiene que exigir "A" mayúscula en "Artículo": el texto cita el convenio
     internamente ("conforme al artículo 5") y eso NO es un encabezado.
  2. Un artículo-cajón (aquí el 71) se traga los ANEXOS si no se corta en su frontera
     real. El patrón de corte de ANEXO/Disposición TAMBIÉN necesita mayúscula inicial
     ("ANEXO I" encabezado vs "anexo I" referencia interna dentro del propio artículo
     71 — con el patrón case-insensitive el 71 se cortaba 1.300 caracteres antes de
     tiempo, a mitad de frase).
  3. "Disposición Transitoria." (con mayúscula, singular) es un encabezado real que el
     patrón original (buscaba "DISPOSICIÓN" en mayúsculas, plural/genérico) no veía —
     el artículo 71 se tragaba 9.000 caracteres de anexos antes de arreglar esto.

Uso:  python3 extraer-convenio.py <texto_plano.txt> <salida.json>

El <texto_plano.txt> se obtiene del PDF con node_modules/pdfjs-dist (este repo NO tiene
pdftotext ni pdfminer/PyPDF2/pypdf instalados) — ver README.md de este directorio para el
comando exacto de Node usado. Este fichero solo contiene el TROCEADO (la parte que hay que
volver a acertar con cada documento nuevo), no la extracción de texto del PDF en sí.
"""
import sys
import re
import json


PATRON_ARTICULO = re.compile(r'(?<![A-Za-zÁÉÍÓÚáéíóúñ])Artículo\s+(\d+)\.-?\s')
# CASE-SENSITIVE a propósito (ver gotcha 2 y 3 arriba).
PATRON_CORTE = re.compile(
    r'(ANEXO\s+[IVX]+\b|ANEXOS\b|Disposici[óo]n\s+(?:Adicional|Transitoria|Final|Derogatoria)\.)'
)
RUIDO_CABECERA = re.compile(
    r'IV CONVENIO COLECTIVO DEL PERSONAL LABORAL DE LAS UNIVERSIDADES P.BLICAS DE ANDALUC.A\.\s*\d+'
)


def trocear(texto: str) -> dict:
    """Dado el texto plano completo del PDF, devuelve {numero: contenido} de los 71
    artículos. Lanza AssertionError si no salen exactamente 1..71 sin huecos ni duplicados."""
    texto = RUIDO_CABECERA.sub(' ', texto)
    matches = sorted(PATRON_ARTICULO.finditer(texto), key=lambda m: m.start())
    nums = [int(m.group(1)) for m in matches]
    assert nums == list(range(1, 72)), f'no salen 1..71 secuenciales: {nums}'

    articulos = {}
    for i, m in enumerate(matches):
        inicio = m.start()
        fin = matches[i + 1].start() if i + 1 < len(matches) else len(texto)
        tramo = texto[inicio:fin]
        corte = None
        for cm in PATRON_CORTE.finditer(tramo):
            if cm.start() > 30:  # no confundir con la propia cabecera del artículo
                corte = cm.start()
                break
        contenido = tramo[:corte] if corte else tramo
        contenido = re.sub(r'[ \t]+', ' ', contenido)
        contenido = re.sub(r'\n{2,}', '\n', contenido)
        articulos[int(m.group(1))] = contenido.strip()
    return articulos


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Uso: extraer-convenio.py <texto_plano.txt> <salida.json>')
        print('(el texto plano se genera con pdfjs-dist en Node — ver README.md de este directorio)')
        sys.exit(2)
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        texto = f.read()
    articulos = trocear(texto)
    with open(sys.argv[2], 'w', encoding='utf-8') as f:
        json.dump({str(k): v for k, v in sorted(articulos.items())}, f, ensure_ascii=False, indent=1)
    total = sum(len(c) for c in articulos.values())
    print(f'{len(articulos)} artículos, {total} caracteres totales.')
