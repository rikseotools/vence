# T-302 — bloque clínico TCAE, primera tanda (06/08/2026, w2)

Contribución PARCIAL y honesta al bloque clínico de [T-302] (`Comunicacion sanitaria`,
`Constantes vitales`, `Funciones del TCAE`, `Farmacologia TCAE`). Este worker no tiene
credencial de escritura en la BD de negocio (`VENCE_LECTOR_URL` es solo SELECT), así que
**no se ha aplicado nada** — el contenido queda aquí, verificado y medido, listo para que
alguien con `DATABASE_URL` de escritura lo aplique con
`node data/pilotos/t291-escalon2-30jul/aplicar-articulo.cjs '<ley>' <art> <fichero> --apply`.

## Qué se hizo

Los 4 contenedores tienen 16 artículos en total (~2.969 preguntas activas). Los 4 artículos
`.1` de cada contenedor son "cajones de sastre" con 360-770 preguntas activas cada uno,
cubriendo materias muy dispares (p. ej. `Comunicacion sanitaria` art.1 mezcla comunicación
con psicología clínica, duelo de Kübler-Ross, mecanismos de defensa freudianos, teorías del
aprendizaje de Pavlov/Skinner/Watson y desarrollo evolutivo de Piaget/Wallon) — escribir esos
4 artículos bien, sin alucinar ningún hecho, es un trabajo de investigación propio que NO
cabe en este turno. Se ha priorizado lo que sí se podía terminar de verdad esta sesión: los
**4 artículos más pequeños y tratables**, con cobertura casi completa:

| artículo | preguntas medibles | cobertura antes | cobertura después |
|---|---|---|---|
| Farmacologia TCAE art.3 (Precauciones administración) | 9 | 8/9 | 8/9 (la que falta es una meta-opción "todas las anteriores") |
| Farmacologia TCAE art.4 (Conservación/almacenaje) | 52 | 36/52 | 51/52 (la que falta es meta-opción "todos ellos") |
| Funciones del TCAE art.2 (Actividades en Hosp.) | 16 | 7/16 | 14/16 (las 2 restantes son meta-opciones) |
| Funciones del TCAE art.3 (Coordinación niveles) | 4 | 3/4 | 4/4 |

Medido con `medir-cobertura.cjs` (gemelo de solo-lectura de
`data/pilotos/t291-escalon2-30jul/aplicar-articulo.cjs`, mismo criterio de cobertura por
tokens de la clave). Las "meta-opciones" (*todas las anteriores*, *todos ellos*) no se pueden
cubrir por diseño de la métrica — no son un hecho literal, son la unión de las demás; se
verificó a mano que el contenido nuevo SÍ cubre los hechos individuales que esas preguntas
agrupan.

## Hechos añadidos, todos con fuente citada en el propio markdown
- **Anticoagulantes orales (Sintrom/acenocumarol):** precauciones ante cortes/afeitado/heridas
  (AEMPS + Clínica Universidad de Navarra).
- **Furosemida** como ejemplo de fármaco fotosensible (ficha técnica CIMA-AEMPS).
- **Agujas de plumas de insulina, un solo uso** (Preevid/Murciasalud, Asociación Diabetes
  Madrid).
- **Blísteres con caducidad en el borde:** no recortar, conservar la tira entera.
- **Colirios:** no más de 1 mes tras abrirlos (ICQO).
- **Rotura de la cadena de frío:** inmovilizar + consultar Servicio de Farmacia, NO desechar
  de inmediato (revista Farmacia Hospitalaria).
- **Tipos de equipo** (inter/intradisciplinar), **PAE** (5 fases + su ventaja de definir
  responsabilidades), **Educación para la Salud** (definición OMS), **Atención Primaria y
  salud pública** (Ley 14/1986 + RD 1030/2006, cartera de servicios del SNS).

## Un error propio, cazado antes de cerrar (dejar constancia)
Al escribir `farmacologia-tcae-art4.md` de una sentada se PERDIÓ sin querer el párrafo
original sobre SIGRE (punto de recogida de envases de farmacia) — quedó fuera de la primera
versión del fichero. Se detectó comparando línea a línea el contenido original de la BD
contra el fichero nuevo (script ad-hoc, no guardado) ANTES de dar esto por bueno, y se
restauró. **Lección para quien siga esta tanda:** verificar SIEMPRE que el enriquecimiento
es aditivo de verdad, no solo mirar que la cobertura suba — la cobertura puede subir aunque
se haya perdido contenido, si lo perdido no tenía claves que dependieran de él.

## Lo que queda (por exposición/tamaño, no tocado esta sesión)
- Los 4 artículos `.1` (562+465+746+360 ≈ 2.133 preguntas activas, la mayoría del bloque).
  **Antes de escribirlos**, conviene decidir si de verdad son UN artículo o si su contenido
  tan disperso pide partirlos — no es un problema de tamaño, es que mezclan materias que un
  epígrafe normal trataría por separado.
- `Comunicacion sanitaria` arts. 2-4 (todavía con huecos: 27/55, 56/94, 23/43).
- `Constantes vitales` arts. 2-4 (32/44, 22/41, 28/37) — contenido ya sourced/citado, más
  cerca de completarse que los de `Comunicacion sanitaria`.

## Cómo continuar
1. `node data/pilotos/t302-clinicos-06ago/medir-cobertura.cjs '<ley>' <art> <fichero.md>`
   (solo lectura, VENCE_LECTOR_URL) para medir antes de aplicar.
2. Alguien con permiso de escritura aplica con
   `aplicar-articulo.cjs ... --apply` (DATABASE_URL de escritura).
3. Invalidar caché (`teoria`, `temario`, `laws`) tras aplicar.
4. Re-verificar con agente las preguntas que quedaban `article_ok=false` sobre estos 4
   artículos (T-291 escalón 2).
