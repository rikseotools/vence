require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.12 asistencia electronica - senale incorrecta
  const exp1 = `**Articulo 12.2 de la Ley 39/2015** (Asistencia en el uso de medios electronicos):

> "Las Administraciones Publicas asistiran en el uso de medios electronicos a los interesados [...] especialmente en lo referente a la **identificacion y firma electronica**, **presentacion de solicitudes** a traves del registro electronico general, y la **obtencion de copias autenticas**."

**Por que B es la incorrecta (y por tanto la respuesta):**
La opcion B dice: "Presentacion de **declaraciones responsables** a traves de la **sede electronica**."

El art. 12.2 enumera tres ambitos concretos de asistencia:
1. Identificacion y firma electronica
2. Presentacion de **solicitudes** a traves del **registro electronico general**
3. Obtencion de copias autenticas

La opcion B cambia dos elementos: sustituye "**solicitudes**" por "**declaraciones responsables**" y "**registro electronico general**" por "**sede electronica**". La presentacion de declaraciones responsables por sede electronica no esta en la lista del art. 12.2.

**Por que las demas SI estan en el art. 12.2:**

- **A)** "Identificacion y firma electronica". **SI**: primer ambito de asistencia listado en el art. 12.2.

- **C)** "Presentacion de solicitudes a traves del registro electronico general". **SI**: segundo ambito de asistencia listado en el art. 12.2.

- **D)** "Obtencion de copias autenticas". **SI**: tercer ambito de asistencia listado en el art. 12.2.

**Los 3 ambitos de asistencia electronica (art. 12.2):**
1. Identificacion y firma electronica
2. Solicitudes via registro electronico general
3. Copias autenticas

**Clave:** "Declaraciones responsables por sede electronica" NO esta en el art. 12.2. La trampa es cambiar "solicitudes" por "declaraciones responsables" y "registro" por "sede".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "7962595d-8618-4e7e-952e-1116b473aa38");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 asistencia electronica (" + exp1.length + " chars)");

  // #2 - CE Titulo Preliminar principios fundamentales
  const exp2 = `**Titulo Preliminar de la Constitucion Espanola (articulos 1 a 9):**

El Titulo Preliminar contiene los **principios fundamentales** del regimen politico espanol: la forma de Estado, la soberania, la estructura territorial, los valores superiores, los partidos politicos, los sindicatos, las Fuerzas Armadas, etc.

**Por que A es correcta (Titulo Preliminar):**
Los arts. 1-9 CE establecen las bases del sistema politico:
- Art. 1: Estado social y democratico de Derecho, valores superiores, soberania, monarquia parlamentaria
- Art. 2: Unidad de la nacion, autonomia de nacionalidades y regiones
- Art. 3: Castellano como lengua oficial
- Art. 4: Bandera de Espana
- Art. 6: Partidos politicos
- Art. 7: Sindicatos y asociaciones empresariales
- Art. 8: Fuerzas Armadas
- Art. 9: Principio de legalidad, libertad e igualdad, publicidad de normas

**Por que las demas son incorrectas:**

- **B)** "Disposiciones Adicionales". Falso: las Disposiciones Adicionales de la CE (son 4) tratan cuestiones especificas como los derechos historicos de los territorios forales o el regimen economico de Canarias. No contienen los principios fundamentales del regimen politico.

- **C)** "Titulo I". Falso: el Titulo I (arts. 10-55) regula los **derechos y deberes fundamentales**. Aunque son fundamentales, los "principios del regimen politico" (forma de Estado, soberania, estructura territorial) estan en el Titulo Preliminar, no en el Titulo I.

- **D)** "Titulo II". Falso: el Titulo II (arts. 56-65) regula la **Corona** (el Rey, sucesion, funciones). No contiene los principios generales del regimen politico.

**Clave:** Principios fundamentales del regimen politico = **Titulo Preliminar** (arts. 1-9). Derechos y deberes = Titulo I. Corona = Titulo II.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "8754c66c-887f-4427-a9e4-ae40adc87ea2");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE Titulo Preliminar (" + exp2.length + " chars)");
})();
