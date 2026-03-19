require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Agenda 2030 ODS 1 Fin de la pobreza y ODS 17 Alianzas
  const exp1 = `**Los 17 Objetivos de Desarrollo Sostenible (ODS) de la Agenda 2030:**

> ODS 1: **"Fin de la pobreza"** - Poner fin a la pobreza en todas sus formas y en todo el mundo.
> ODS 17: **"Alianzas para lograr los objetivos"** - Fortalecer los medios de implementacion y revitalizar la alianza mundial para el desarrollo sostenible.

**Por que D es correcta (Fin de la pobreza + Alianzas):**
El **primero** de los 17 ODS es "**Fin de la pobreza**" (ODS 1) y el **ultimo** es "**Alianzas para lograr los objetivos**" (ODS 17). La Agenda 2030 comienza abordando la pobreza como problema mas urgente y cierra con las alianzas globales necesarias para alcanzar todos los objetivos.

**Por que las demas son incorrectas:**

- **A)** Dice "**Hambre cero** y paz, justicia e instituciones solidas". Falso en el primero: "Hambre cero" es el ODS **2**, no el 1. El ODS 1 es "Fin de la pobreza". Ademas, "Paz, justicia e instituciones solidas" es el ODS **16**, no el ultimo (17).

- **B)** Dice "Fin de la pobreza y **paz, justicia e instituciones solidas**". Acierta en el primero (ODS 1 = Fin de la pobreza) pero yerra en el ultimo: "Paz, justicia e instituciones solidas" es el ODS **16**, no el 17. El ultimo es "Alianzas para lograr los objetivos".

- **C)** Dice "**Hambre cero** y alianzas". Acierta en el ultimo (ODS 17 = Alianzas) pero yerra en el primero: "Hambre cero" es el ODS **2**. El primero es "Fin de la pobreza" (ODS 1).

**Primeros y ultimos ODS:**

| ODS | Nombre |
|-----|--------|
| **1** | **Fin de la pobreza** (primero) |
| 2 | Hambre cero |
| 16 | Paz, justicia e instituciones solidas |
| **17** | **Alianzas para lograr los objetivos** (ultimo) |

**Clave:** ODS 1 = Fin de la pobreza (no Hambre cero, que es el 2). ODS 17 = Alianzas (no Paz y justicia, que es el 16).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "17118a2e-a823-451a-881c-acccf22bba9a");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Agenda 2030 ODS 1 y 17 (" + exp1.length + " chars)");

  // #2 - Word Copiar formato doble clic para pegar múltiples veces
  const exp2 = `**Copiar formato en procesadores de texto (Word / LibreOffice Writer):**

**Por que B es correcta (doble clic en Copiar formato):**
Para copiar formato y pegarlo **mas de una vez** sin volver a hacer clic en el boton, hay que hacer **doble clic** en el boton "Copiar formato" (icono de brocha/pincel). Esto **bloquea** la herramienta en modo activo, permitiendo aplicar el formato a multiples selecciones de texto. Para desactivarla, se pulsa **ESC** o se hace clic de nuevo en el boton.

**Modos de Copiar formato:**
- **Un clic**: aplica el formato una sola vez al siguiente texto seleccionado
- **Doble clic**: bloquea la herramienta para aplicar el formato multiples veces
- **ESC**: desactiva el modo de copiar formato

**Por que las demas son incorrectas:**

- **A)** "**Control** + clic en Copiar formato". Falso: mantener Control no activa el modo multiple de Copiar formato. Ctrl se usa para otros atajos (Ctrl+C = copiar contenido, no formato), pero no modifica el comportamiento del boton Copiar formato.

- **C)** "**Alt** + clic en Copiar formato". Falso: mantener Alt no activa el modo multiple. Alt se utiliza para acceder a menus y atajos de la cinta de opciones, no para modificar Copiar formato.

- **D)** "**Mayus** + clic en Copiar formato". Falso: Mayus (Shift) no activa el modo multiple. Shift se usa para extender selecciones de texto, pero no para bloquear la herramienta de formato.

**Clave:** Doble clic = modo multiple (bloquea la brocha). Un solo clic = una sola aplicacion. ESC para salir del modo.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "1ea32b01-225f-4fec-96d8-3d4602de383c");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Word copiar formato doble clic (" + exp2.length + " chars)");

  // #3 - Gobierno Abierto I Plan aprobación Ley Transparencia
  const exp3 = `**Planes de Accion de Gobierno Abierto de Espana:**

> "El **primer Plan de Accion** se centro en tres grandes objetivos: el primero fue el **aumento de la integridad y transparencia publica** y se puso de manifiesto con la **aprobacion de la Ley de Transparencia**, Acceso a la Informacion y Buen Gobierno."

**Por que C es correcta (I Plan de Accion):**
La aprobacion de la Ley 19/2013 de Transparencia fue un objetivo del **I Plan de Accion** de Gobierno Abierto de Espana (2012-2014). Este primer plan se centro en tres ejes: (1) transparencia publica (Ley de Transparencia), (2) gestion eficaz de recursos (Ley de Estabilidad Presupuestaria), y (3) mejora de servicios publicos.

**Por que las demas son incorrectas:**

- **A)** "De la Alianza para el Gobierno Abierto". Falso: la Alianza para el Gobierno Abierto (Open Government Partnership, OGP) es la **organizacion internacional** a la que Espana se adhirio. Los Planes de Accion se elaboran en el marco de esta Alianza, pero la aprobacion de la Ley fue un compromiso del **I Plan** de Espana, no de la Alianza en si.

- **B)** "Del **III** Plan de Accion". Falso: el III Plan (2017-2019) tenia otros compromisos diferentes. La Ley de Transparencia ya se habia aprobado en 2013, durante el I Plan. El III Plan se ocupo de retos posteriores como datos abiertos, participacion y rendicion de cuentas.

- **D)** "Del **II** Plan de Accion". Falso: el II Plan (2014-2016) se centro en compromisos de apertura de datos, integridad y participacion. La Ley de Transparencia ya estaba aprobada para entonces.

**Cronologia de los Planes de Gobierno Abierto:**

| Plan | Periodo | Hito principal |
|------|---------|---------------|
| **I Plan** | 2012-2014 | **Ley de Transparencia (Ley 19/2013)** |
| II Plan | 2014-2016 | Datos abiertos, participacion |
| III Plan | 2017-2019 | Rendicion de cuentas |

**Clave:** La Ley de Transparencia fue un compromiso del **I Plan** (primer plan de accion), no del II ni del III.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "fcd752e4-2f0d-4030-b8d6-a95d75873422");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Gobierno Abierto I Plan Transparencia (" + exp3.length + " chars)");
})();
