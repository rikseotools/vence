require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.4.2 sucesion interesado cualquiera estado
  const exp1 = `**Articulo 4.2 de la Ley 39/2015:**

> "Cuando la condicion de interesado derivase de alguna **relacion juridica transmisible**, el derecho-habiente sucedera en tal condicion, **cualquiera que sea el estado del procedimiento**."

**Por que B es correcta (cualquiera que sea el estado):**
Si un interesado fallece o transmite su derecho durante el procedimiento, su sucesor (derecho-habiente) puede continuar en el procedimiento **sin ninguna restriccion temporal**. No importa si el procedimiento esta en fase de inicio, instruccion, prueba, audiencia o propuesta de resolucion. La expresion "cualquiera que sea el estado" es absoluta.

**Por que las demas son incorrectas (inventan restricciones temporales):**

- **A)** "Antes de la **propuesta de resolucion**". Falso: no existe esta restriccion. El derecho-habiente puede suceder incluso despues de la propuesta de resolucion, mientras el procedimiento siga en tramitacion.

- **C)** "Antes del **tramite de audiencia**". Falso: otra restriccion inventada. La audiencia (art. 82) es un tramite intermedio, pero la sucesion no esta limitada a producirse antes de el.

- **D)** "Antes del **periodo de prueba**". Falso: igualmente inventada. La prueba (art. 77-78) es otro tramite que no limita la posibilidad de sucesion.

**Sucesion de interesados (art. 4.2 Ley 39/2015):**
- Requisito: relacion juridica **transmisible**
- Cuando: **cualquiera que sea el estado** del procedimiento (sin restriccion temporal)
- Quien: el **derecho-habiente** (sucesor, heredero, cesionario...)

**Clave:** "Cualquiera que sea el estado" = sin limites temporales. Las trampas inventan fases del procedimiento como limite.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "2bd02a9c-d727-4680-9ba8-d2fa6b9402d2");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.4.2 sucesion (" + exp1.length + " chars)");

  // #2 - CE art.55 derecho suspendible en sitio pero no en excepcion
  const exp2 = `**Articulo 55.1 de la Constitucion Espanola:**

> "Los derechos reconocidos en los articulos 17, 18.2 y 18.3, 19, 20.1.a) y d) y 20.5, 21, 28.2 y 37.2, podran ser suspendidos cuando se acuerde la declaracion del estado de excepcion o de sitio [...]. **Se exceptua** de lo establecido anteriormente el **apartado 3 del articulo 17** para el supuesto de declaracion de estado de **excepcion**."

**Por que B es correcta (art. 17.3 informacion al detenido):**
El art. 55.1 CE lista los derechos suspendibles en excepcion y sitio, entre ellos el art. 17 completo. Pero anade una excepcion clave: el **art. 17.3** (derecho a ser informado de forma inmediata de los derechos y razones de la detencion) **NO puede suspenderse en estado de excepcion**. Sin embargo, SI puede suspenderse en estado de **sitio**.

Esto significa que el art. 17.3 es el unico derecho que puede suspenderse en sitio pero NO en excepcion.

**Por que las demas son incorrectas (se suspenden en ambos estados):**

- **A)** "Inviolabilidad del domicilio" (art. 18.2). Falso: este derecho puede suspenderse tanto en excepcion como en sitio. No es exclusivo del sitio.

- **C)** "Libertad de expresion" (art. 20.1.a). Falso: puede suspenderse tanto en excepcion como en sitio. No hay excepcion para este derecho.

- **D)** "Libertad de circulacion" (art. 19). Falso: puede suspenderse tanto en excepcion como en sitio.

**Suspension de derechos (art. 55.1 CE):**

| Derecho | Excepcion | Sitio |
|---------|-----------|-------|
| Art. 17.1, 17.2, 17.4 (libertad personal) | SI | SI |
| **Art. 17.3 (informacion al detenido)** | **NO** | **SI** |
| Art. 18.2 y 18.3 (domicilio, comunicaciones) | SI | SI |
| Art. 19 (circulacion) | SI | SI |
| Art. 20.1.a), d) y 20.5 (expresion, informacion) | SI | SI |

**Clave:** Art. 17.3 = unico derecho suspendible en **sitio** pero NO en **excepcion**. Es la excepcion mas preguntada del art. 55.1 CE.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "4aa31ac1-27e4-4730-8b17-3143b0e3307a");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.55 sitio vs excepcion (" + exp2.length + " chars)");
})();
