import pathlib, re

p = pathlib.Path('/home/manuel/vence-sessions/movil3/docs/roadmap/tareas-pendientes.md')
lineas = p.read_text().split('\n')

# localizar el bloque de T-653 (desde su cabecera hasta la siguiente cabecera ###)
ini = next(i for i, l in enumerate(lineas) if l.startswith('### [T-653]'))
fin = next((i for i in range(ini + 1, len(lineas)) if lineas[i].startswith('### [')), len(lineas))
bloque = lineas[ini:fin]

# marcar la cabecera como HECHA (el ✅ es la ÚNICA marca que se lee)
bloque[0] = ('### [T-653] ✅ [HECHA 08/08] El supervisor de la flota mira el TAMAÑO del transcript '
             'pero nunca su contenido: no se ve qué hace un trabajador mientras trabaja, ni con qué encargo')

del lineas[ini:fin]

# insertar bajo la PRIMERA sección «## Hechas» que quede después del recorte
hechas = next(i for i, l in enumerate(lineas) if l.strip() == '## Hechas')
lineas[hechas + 1:hechas + 1] = [''] + bloque

p.write_text('\n'.join(lineas))
print('T-653 movida a Hechas')
