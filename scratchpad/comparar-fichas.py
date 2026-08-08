"""¿La rama aporta ALGO que la ficha fuente no tenga ya?

No se compara por longitud —eso solo dice cuál es más larga—, sino si el texto de la rama está
CONTENIDO en el de la fuente. Si lo está, la rama es un subconjunto viejo y no hay nada que portar.
"""
import subprocess, pathlib, difflib

REPO = '/home/manuel/vence-sessions/movil3'
RAMAS = {
    'T-196': 'origin/flota/T-196-oposiciones-valencianas-idioma',
    'T-634': 'origin/flota/T-634-leon-office-2021-vs-365',
    'T-699': 'origin/flota/T-699-gate-falso-oposiciones',
}


def bloque_de(texto, tid):
    lineas = texto.split('\n')
    ini = next((i for i, l in enumerate(lineas) if l.startswith(f'### [{tid}]')), None)
    if ini is None:
        return None
    fin = next((i for i in range(ini + 1, len(lineas)) if lineas[i].startswith('### [')), len(lineas))
    return [l.rstrip() for l in lineas[ini:fin] if l.strip()]


for tid, rama in RAMAS.items():
    mono = subprocess.run(['git', '-C', REPO, 'show', f'{rama}:docs/roadmap/tareas-pendientes.md'],
                          capture_output=True, text=True).stdout
    dela_rama = bloque_de(mono, tid) or []
    fuente_p = pathlib.Path(REPO) / 'docs/roadmap/tareas' / f'{tid}.md'
    fuente = [l.rstrip() for l in fuente_p.read_text().split('\n') if l.strip()]

    faltan = [l for l in dela_rama if l not in fuente]
    print(f'── {tid}: rama {len(dela_rama)} líneas · fuente {len(fuente)} · NO presentes en la fuente: {len(faltan)}')
    for l in faltan[:6]:
        print(f'     + {l[:120]}')
