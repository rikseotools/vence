"""El merge de la rama de T-278 dejó su informe («T10 La velocidad») bajo una cabecera
[T-277] equivocada, así que hay DOS fichas T-277 y el informe está en la que no es.
Se mueve el cuerpo a la ficha de T-278 y se borra la cabecera duplicada."""
import pathlib

p = pathlib.Path('/home/manuel/vence-sessions/movil3/docs/roadmap/tareas-pendientes.md')
lineas = p.read_text().split('\n')

# 1) localizar la cabecera T-277 IMPOSTORA: la que va seguida del informe de T10
impostora = None
for i, l in enumerate(lineas):
    if l.startswith('### [T-277]') and i + 1 < len(lineas) and 'T10 "La velocidad"' in lineas[i + 1]:
        impostora = i
        break
assert impostora is not None, 'no encontrada la cabecera impostora'

fin = next(i for i in range(impostora + 1, len(lineas)) if lineas[i].startswith('### ['))
cuerpo = [l for l in lineas[impostora + 1:fin] if l.strip()]  # sin la cabecera ni líneas vacías de borde

del lineas[impostora:fin]

# 2) pegarlo al FINAL de la ficha real de T-278
t278 = next(i for i, l in enumerate(lineas) if l.startswith('### [T-278]'))
fin278 = next(i for i in range(t278 + 1, len(lineas)) if lineas[i].startswith('### ['))
# retroceder sobre las líneas vacías finales para insertar pegado al contenido
ins = fin278
while ins > t278 and not lineas[ins - 1].strip():
    ins -= 1
lineas[ins:ins] = [''] + cuerpo

p.write_text('\n'.join(lineas))
print(f'movidas {len(cuerpo)} líneas del informe de T10 a la ficha de T-278')
