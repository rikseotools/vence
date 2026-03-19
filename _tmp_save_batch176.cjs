require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Bloc de notas Windows accesorio editor de textos
  const exp1 = `**Accesorios de Windows - Editor de textos para anotaciones:**

**Por que A es correcta (Bloc de notas):**
El **Bloc de notas** (Notepad) es el **accesorio** de Windows que funciona como editor de textos basico para realizar anotaciones y guardarlas como documentos de texto plano (.txt). Viene preinstalado con Windows y es la herramienta por defecto para editar texto sin formato.

**Caracteristicas del Bloc de notas:**
- Editor de texto **plano** (sin formato)
- Guarda por defecto en formato **.txt**
- Preinstalado como **accesorio** de Windows
- En Windows 11: pestanas, modo oscuro, autoguardado

**Por que las demas son incorrectas:**

- **B)** "**WordPad**". Falso: WordPad es un **procesador de textos** basico (no un simple editor de textos). Permite formato enriquecido (negrita, cursiva, fuentes, colores), guarda en .rtf y .docx. No es un simple editor para anotaciones de texto plano, sino un procesador con capacidades de formato.

- **C)** "**Microsoft Word**". Falso: Word es un **procesador de textos profesional** que no viene como accesorio de Windows, sino como parte del paquete Microsoft Office (de pago o suscripcion Microsoft 365). No es un "accesorio" de Windows y va mucho mas alla de un simple editor para anotaciones.

- **D)** "Todas son correctas". Falso: solo el Bloc de notas cumple todas las condiciones de la pregunta: ser un **accesorio** de Windows, ser un **editor de textos** (no procesador) y servir para **anotaciones** almacenadas como documentos de texto.

**Editor vs procesador de textos:**

| Herramienta | Tipo | Accesorio de Windows | Formato |
|------------|------|---------------------|---------|
| **Bloc de notas** | **Editor** de textos | **SI** | .txt (plano) |
| WordPad | Procesador basico | SI (hasta W10) | .rtf, .docx |
| Word | Procesador profesional | NO (Office) | .docx |

**Clave:** Bloc de notas = editor de textos (plano). WordPad y Word = procesadores de textos (con formato). Solo el Bloc de notas es un "editor para anotaciones".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "16e98187-6bd4-485c-b241-ca071f5757a5");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Bloc de notas accesorio Windows (" + exp1.length + " chars)");

  // #2 - Operadores booleanos búsqueda Windows comillas para frase exacta
  const exp2 = `**Operadores de busqueda en el Explorador de Windows:**

**Por que D es correcta (comillas " "):**
Las **comillas** son el operador que busca varias palabras **en el mismo orden** en que se han escrito. Por ejemplo, **"informe anual"** encontrara archivos que contengan exactamente esa secuencia de palabras, pero no "anual informe". Es la busqueda de **frase exacta**.

**Por que las demas son incorrectas:**

- **A)** "**Parentesis** ( )". Falso: los parentesis buscan las palabras en **cualquier orden**. Por ejemplo, **(informe anual)** encontrara tanto "informe anual" como "anual informe". Los parentesis agrupan terminos sin imponer orden, que es lo contrario de lo que pide la pregunta.

- **B)** "**Llaves** { }". Falso: las llaves no son un operador de busqueda reconocido en el Explorador de Windows. No tienen funcion especifica en las busquedas del sistema de archivos.

- **C)** "**Corchetes** [ ]". Falso: los corchetes tampoco son un operador de busqueda del Explorador de Windows. No cumplen ninguna funcion en las busquedas de archivos.

**Operadores de busqueda en Windows:**

| Operador | Funcion | Ejemplo |
|----------|---------|---------|
| **" "** (comillas) | **Frase exacta** (mismo orden) | "informe anual" |
| ( ) (parentesis) | Palabras en cualquier orden | (informe anual) |
| NOT o - | Excluir un termino | informe NOT borrador |
| OR | Uno u otro termino | informe OR acta |

**Clave:** Comillas = palabras **en el mismo orden** (frase exacta). Parentesis = palabras en **cualquier orden**. No confundir ambos operadores.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "b0a57f3f-1247-4db2-b564-616b0074612d");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Operadores busqueda comillas (" + exp2.length + " chars)");
})();
