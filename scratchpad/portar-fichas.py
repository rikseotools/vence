"""Porta a `docs/roadmap/tareas/T-nnn.md` lo que una rama escribió en el MONOLITO.

Desde [T-532] el monolito es un ÍNDICE GENERADO: una rama que solo lo edita se pierde en cuanto
alguien regenera. Estas tres ramas (T-196, T-634, T-699) son de antes del cambio y solo tocan el
monolito, así que mergearlas no serviría de nada — hay que llevar su ficha al fichero fuente.
"""
import subprocess, pathlib, sys

REPO = '/home/manuel/vence-sessions/movil3'
RAMAS = {
    'T-196': 'origin/flota/T-196-oposiciones-valencianas-idioma',
    'T-634': 'origin/flota/T-634-leon-office-2021-vs-365',
    'T-699': 'origin/flota/T-699-gate-falso-oposiciones',
}


def bloque_de(texto, tid):
    """La ficha de `tid` dentro de un monolito: de su cabecera a la siguiente."""
    lineas = texto.split('\n')
    ini = next((i for i, l in enumerate(lineas) if l.startswith(f'### [{tid}]')), None)
    if ini is None:
        return None
    fin = next((i for i in range(ini + 1, len(lineas)) if lineas[i].startswith('### [')), len(lineas))
    return '\n'.join(lineas[ini:fin]).rstrip() + '\n'


for tid, rama in RAMAS.items():
    mono = subprocess.run(
        ['git', '-C', REPO, 'show', f'{rama}:docs/roadmap/tareas-pendientes.md'],
        capture_output=True, text=True)
    if mono.returncode != 0:
        print(f'  ! {tid}: no se pudo leer el monolito de la rama'); continue
    nuevo = bloque_de(mono.stdout, tid)
    if not nuevo:
        print(f'  ! {tid}: sin ficha en esa rama'); continue

    destino = pathlib.Path(REPO) / 'docs/roadmap/tareas' / f'{tid}.md'
    actual = destino.read_text() if destino.exists() else ''
    if actual.strip() == nuevo.strip():
        print(f'  ⏭  {tid}: la ficha fuente ya tiene ese contenido'); continue
    destino.write_text(nuevo)
    print(f'  · {tid}: portada ({len(actual.splitlines())} → {len(nuevo.splitlines())} líneas)')
