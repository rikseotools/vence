"""Quita las fichas duplicadas que dejó la fusión.

- T-277: dos cabeceras SEGUIDAS; la de `origin/main` (la que anota «implementado y probado»)
  es la buena, y la anterior quedó huérfana sin cuerpo.
- T-677 / T-682: otra sesión las cerró y las movió a «## Hechas»; la fusión conservó también la
  copia ABIERTA de antes. Se queda la cerrada (✅), que es la marca que manda.
"""
import pathlib

p = pathlib.Path('/home/manuel/vence-sessions/movil3/docs/roadmap/tareas-pendientes.md')
lineas = p.read_text().split('\n')


def bloque(idx):
    fin = next((i for i in range(idx + 1, len(lineas)) if lineas[i].startswith('### [')), len(lineas))
    return idx, fin


def cabeceras(tid):
    return [i for i, l in enumerate(lineas) if l.startswith(f'### [{tid}]')]


borrar = []

# T-277: quitar la cabecera huérfana (la que NO trae el ✅ ni la nota, y va pegada a la otra)
c277 = cabeceras('T-277')
if len(c277) == 2 and c277[1] == c277[0] + 1:
    borrar.append((c277[0], c277[0] + 1))

# T-677 / T-682: quitar la copia ABIERTA, conservar la ✅
for tid in ('T-677', 'T-682'):
    cs = cabeceras(tid)
    if len(cs) == 2:
        abierta = [i for i in cs if '✅' not in lineas[i]]
        if len(abierta) == 1:
            borrar.append(bloque(abierta[0]))

for ini, fin in sorted(borrar, reverse=True):
    print(f'  – quitando {lineas[ini][:70]}  ({fin - ini} líneas)')
    del lineas[ini:fin]

p.write_text('\n'.join(lineas))
print('listo')
