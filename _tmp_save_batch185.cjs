require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Word Ctrl+Mayús+F5 insertar marcador
  const exp1 = `**Atajos de teclado con F5 en Microsoft Word:**

**Por que C es correcta (Ctrl + Mayusculas + F5):**
La combinacion **Ctrl + Mayus + F5** abre el cuadro de dialogo **Marcador** en Word. Si previamente se ha seleccionado un texto, al abrir este cuadro se puede escribir un nombre para el marcador y hacer clic en "Agregar" para insertarlo en la posicion del texto seleccionado.

**Por que las demas son incorrectas (son otros atajos de F5):**

- **A)** "**Ctrl + F5**". Falso: Ctrl + F5 no abre el cuadro de marcador. En algunas versiones de Word, esta combinacion no tiene funcion asignada o puede actualizar campos. No esta relacionada con marcadores.

- **B)** "**Mayusculas + F5**". Falso: Mayus + F5 sirve para **volver al ultimo punto de edicion**. Mueve el cursor a la posicion donde se realizo el ultimo cambio en el documento. Es util para saltar rapidamente a donde se estaba trabajando, pero no inserta marcadores.

- **D)** "**Alt + Mayusculas + F5**". Falso: esta combinacion no tiene una funcion estandar asignada en Word para marcadores. No abre el cuadro de dialogo de marcadores.

**Atajos con F5 en Word:**

| Combinacion | Funcion |
|-------------|---------|
| **F5** | Abrir cuadro de dialogo **Ir a** |
| **Mayus + F5** | Ir al **ultimo punto de edicion** |
| **Ctrl + Mayus + F5** | Abrir cuadro de **Marcador** |
| **Alt + F5** | Restaurar tamano de ventana |

**Clave:** Ctrl + Mayus + F5 = Marcador. Mayus + F5 = Volver al ultimo cambio. F5 solo = Ir a.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "7b327e92-d02c-4a54-807f-e7e7fba37f44");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Word Ctrl+Mayus+F5 marcador (" + exp1.length + " chars)");
})();
