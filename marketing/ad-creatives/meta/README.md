# Creativos para anuncios de Meta (Facebook / Instagram)

Imágenes de anuncios generadas con código (Pillow), 1080×1080, listas para subir
a la cuenta publicitaria vía Meta Marketing API.

## Por qué generadas con código y no con IA
Los generadores de imágenes IA escriben mal el texto (erratas tipo "AUXILAR",
"PLATAFOMA" que aparecían en creativos antiguos). Componer con Pillow da texto
**pixel-perfect, sin erratas y on-brand**. Para fotos/ilustraciones de fondo sí
se podría usar IA (Ideogram/OpenAI), pero el texto se superpone con código.

## Estructura
```
meta/
├── generate.py        # generador parametrizable (CONFIG por oposición)
├── README.md          # este archivo
└── <oposicion>/       # variantes generadas por oposición (madrid/, valencia/, …)
```

## Generar
```bash
python3 marketing/ad-creatives/meta/generate.py
```

## Variantes A/B que produce
| Archivo | Acento | Logo | Tema |
|---------|--------|------|------|
| A_verde_logoTL    | Verde   | Arriba-izq  | Navy |
| B_verde_logoBR    | Verde   | Abajo-dcha  | Navy |
| C_rojo_logoTL     | Rojo    | Arriba-izq  | Navy |
| D_rojo_logoBR     | Rojo    | Abajo-dcha  | Navy |
| E_bandera_madrid  | Blanco  | Abajo-dcha  | Bandera CAM (carmesí + 7 estrellas) |
| F_carmesi_logoBR  | Carmesí | Abajo-dcha  | Navy |

## Crear creativos para otra oposición
Edita `generate.py`, duplica el `CONFIG` de Madrid cambiando:
- `titulo1` / `titulo2` (nombre de la oposición + ámbito)
- `numero` / `label` (p. ej. "204" / "PLAZAS LIBRES")
- carpeta de salida en la llamada `generate_all(...)`

El tema "flag" (estrellas de Madrid) es específico de la CAM; para otras
comunidades habría que adaptar el motivo o usar el tema "navy".

## Requisitos
- Pillow (`pip install pillow`)
- Fuentes Open Sans en `/usr/share/fonts/open-sans/`
- `public/vence-logo.png`
