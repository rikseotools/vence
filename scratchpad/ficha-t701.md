### [T-701] 🟡 [ABIERTO 08/08] El log de un trabajador no crece hasta que termina el turno: sin streaming no se puede mirar en vivo

**De dónde sale:** tercer punto de [T-653], separado a ficha propia al cerrarla. Los otros dos
(ver *qué* está haciendo un trabajador, y *con qué encargo*) están hechos y desplegados; éste no se
aplicó **a propósito**, y el porqué es lo que da valor a esta ficha.

**El síntoma, medido en vivo:** el log de un trabajador (`~/flota-<w>.log`) se queda en **0 bytes**
mientras el turno está activo y sólo se escribe entero al terminar. Así que mirar el log de alguien
que lleva 40 minutos trabajando no dice nada — y es justo cuando querrías mirarlo.

**La causa está reproducida como CLASE, no como hecho:** un intérprete con buffering de aplicación
(`python3` sin `-u`) da el MISMO síntoma al pipearlo a `tee`, y **`stdbuf -oL` NO lo arregla**
(medido); sólo lo arregla asignar una pseudo-terminal (`script -qec "…" /dev/null`, medido: crece en
vivo). Eso descarta `stdbuf` antes de probarlo contra el trabajador real. Lo que NO se pudo hacer fue
probar el binario `claude` de verdad: `claude -p` devolvió *«Not logged in»* porque el
`CLAUDE_CODE_OAUTH_TOKEN` vive en `/etc/vence-flota/<w>.env`, de `root` con permisos 0600. Quien lo
midió **rehusó ampliarse el permiso**, que es la regla de la casa.

**Y el mecanismo oficial existe:** `claude -p --help` documenta
`--output-format stream-json --include-partial-messages`. No es una suposición.

**⚠️ POR QUÉ NO SE APLICA SIN MÁS, que es el meollo:** `stream-json` cambia el formato del log de
texto plano a **NDJSON**, y `AUT.clasificar` —el guardarraíl de cuota de [T-617]— hace **regex plano**
contra ese log (`/hit your (weekly|daily|5-hour|usage) limit/i`). Cambiar el formato sin re-verificar
esa detección es tocar a ciegas el mecanismo que evitó **27 relanzamientos** contra una cuota agotada.

**Qué haría falta para cerrarlo** (con la credencial adecuada, que un trabajador no tiene):
1. Un turno real y corto con `--output-format stream-json --include-partial-messages`, comprobando
   que el log **crece en vivo**.
2. Que un mensaje sintético de cuota agotada embebido en el NDJSON **siga casando** con el regex de
   `AUT.clasificar` — o adaptar el clasificador a JSON si no, con su test.
3. Sólo entonces cambiar el comando en `mandarEncargo`.

**Relacionadas:** [T-653] (los otros dos puntos, cerrados), [T-617] (el regex de cuota que esto
podría romper), [T-486] (la flota).
