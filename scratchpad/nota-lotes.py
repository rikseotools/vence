"""Anota en las cuatro fichas de generación en qué punto quedan tras integrar sus veredictos."""
import pathlib

NOTAS = {
    'T-278': """
**✅ VEREDICTO ATENDIDO Y MERGEADA (08/08).** El hallazgo de la revisión —la cita del art. 48.1.c).1º
omitía una cláusula sin marcar la elipsis mientras la explicación la llamaba «literal»— **ya lo había
arreglado el propio trabajador** tras la revisión (commit `8e0987893`): verificado que el `(...)` está
en la cita y en la explicación. Nada que rehacer. **Lo que queda es insertar el lote** (Paso 4 en
adelante del manual), que es escritura en BD de negocio.
""",
    'T-679': """
**✅ VEREDICTO ATENDIDO Y MERGEADA (08/08).** Desarrollada la sigla «CETIC» en la explicación de Q5,
que era el hallazgo. **Y arreglado el motivo por el que se coló**, que es lo que evita el siguiente:
el gate fallaba por partida doble —CETIC no estaba en el diccionario Y `analizarSiglas` solo BUSCABA
las siglas en enunciado + opciones, nunca en la explicación—. Las dos mitades cerradas, con el coste
medido antes de tocar el núcleo (64 preguntas de los 4 lotes: 0 marcadas → 0 con el cambio).
**Comprobado además el aviso que dejó [T-683]:** sus 12 preguntas ya están vivas en esta misma norma,
y el solape medido contra este lote es sólo el TÍTULO de la norma que las vivas llevan de preámbulo —
leídas enteras no se pisan (`scratchpad/solape-t679-t683.cjs`). **Queda insertar el lote.**
""",
    'T-680': """
**✅ VEREDICTO ATENDIDO Y MERGEADA (08/08).** Los dos distractores inventados de Q3, sustituidos por
organismos REALES verificados contra fuente: «Conferencia Sectorial de Administración Local» → el
nombre exacto **«Conferencia Sectorial para Asuntos Locales»** (mpt.gob.es y el Diccionario
panhispánico del español jurídico de la RAE), y «Consejo de Cabildos» —que no existe— → **Federación
Canaria de Municipios**, que sí existe y agrupa a los MUNICIPIOS, no a los cabildos: un dato real mal
atribuido, que es la técnica correcta. `simular:batch` tras el cambio: 0 bloqueantes.
**Queda insertar el lote**, y después los 41 artículos restantes de los 48 del scope — hay un usuario
premium (Iván González) esperando esto.
""",
    'T-681': """
**✅ VEREDICTO ATENDIDO Y MERGEADA (08/08).** Corregida la fecha del Código Penal en la opción B de Q1:
la auditoría ciega ya había cazado el número (10/2015 → 10/1995) pero **no la fecha que lo acompañaba**,
que quedó «de 11 de enero» — la de la LO 4/2000, copiada al cambiar sólo el número. El Código Penal es
**de 23 de noviembre**, y esto estaba en una OPCIÓN visible, no en el feedback. `simular:batch`:
0 bloqueantes. **Queda insertar el lote** y, después, los 33 artículos restantes (225-257).
""",
}

p = pathlib.Path('/home/manuel/vence-sessions/movil3/docs/roadmap/tareas-pendientes.md')
lineas = p.read_text().split('\n')

for tid, nota in NOTAS.items():
    idx = next((i for i, l in enumerate(lineas) if l.startswith(f'### [{tid}]')), None)
    if idx is None:
        print(f'  ! {tid} sin ficha, se omite')
        continue
    fin = next((i for i in range(idx + 1, len(lineas)) if lineas[i].startswith('### [')), len(lineas))
    ins = fin
    while ins > idx and not lineas[ins - 1].strip():
        ins -= 1
    lineas[ins:ins] = nota.rstrip('\n').split('\n')
    print(f'  · nota añadida a {tid}')

p.write_text('\n'.join(lineas))
