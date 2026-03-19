require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE Titulo II Corona Rey Jefe del Estado
  const exp1 = `**Articulo 56.1 de la Constitucion Espanola:**

> "El Rey es el **Jefe del Estado**, simbolo de su unidad y permanencia, arbitra y modera el funcionamiento regular de las instituciones, asume la mas alta representacion del Estado espanol en las relaciones internacionales [...] y ejerce las funciones que le atribuyen expresamente la Constitucion y las leyes."

**Por que B es correcta (la Corona como organo del Estado):**
El Titulo II CE (arts. 56-65) configura la Corona como un **organo constitucional del Estado**. El art. 56.1 define al Rey como "Jefe del Estado", lo que lo situa como titular de este organo. La opcion B recoge fielmente esta doble idea: la Corona es un organo del Estado y el Rey es el Jefe del Estado.

**Por que las demas son incorrectas:**

- **A)** "No existe distincion alguna de preferencia entre los hijos varones y las mujeres". Falso: el art. **57.1** CE establece expresamente que, **en el mismo grado, el varon sera preferido a la mujer**. La CE si distingue por sexo en la sucesion a la Corona. La trampa niega una preferencia que el texto constitucional recoge de forma explicita.

- **C)** "Cualquier duda sobre abdicaciones o renuncias se resolvera por **ley ordinaria**". Falso: el art. **57.5** CE dice que estas dudas se resolveran "por una **ley organica**", no por ley ordinaria. La trampa cambia el tipo de ley: organica requiere mayoria absoluta del Congreso, ordinaria solo mayoria simple.

- **D)** "Para ejercer la tutela **no es preciso ser espanol**, salvo en ciertos casos". Falso: el art. **60.1** CE exige que el tutor del Rey menor sea "**espanol de nacimiento** y mayor de edad". La CE impone la nacionalidad espanola de origen como requisito obligatorio, no opcional.

**Resumen de articulos clave del Titulo II:**

| Articulo | Contenido |
|----------|-----------|
| Art. 56.1 | Rey = Jefe del Estado |
| Art. 57.1 | Sucesion: varon preferido a mujer (mismo grado) |
| Art. 57.5 | Dudas de sucesion = ley **organica** |
| Art. 60.1 | Tutor = espanol de nacimiento + mayor de edad |

**Clave:** Rey = Jefe del Estado (art. 56.1). Sucesion con preferencia masculina (art. 57.1). Dudas por ley organica (no ordinaria). Tutor debe ser espanol de nacimiento (no opcional).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "de86ad33-651d-46aa-9df1-52dd2fe3a21c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE Corona Rey Jefe Estado (" + exp1.length + " chars)");

  // #2 - TUE art.16 presidencias rotatorias 2025 Polonia Dinamarca Chipre
  const exp2 = `**Articulo 16.9 del TUE - Presidencia rotatoria del Consejo de la UE:**

> "La presidencia de las formaciones del Consejo [...] sera desempenada por los representantes de los Estados miembros en el Consejo mediante un sistema de rotacion igual [...]"

**Por que A es correcta (Polonia, Dinamarca y Chipre):**
A partir del 1 de enero de 2025, el trio de presidencias rotatorias del Consejo de la UE lo componen:
- **Polonia**: enero - junio 2025
- **Dinamarca**: julio - diciembre 2025
- **Chipre**: enero - junio 2026

Los trios se organizan en periodos de **18 meses** con una agenda comun. Cada pais ejerce la presidencia durante 6 meses.

**Por que las demas son incorrectas (trios de otros periodos o inventados):**

- **B)** "Francia, Republica Checa y Suecia". Este fue el trio de **2022-2023**: Francia (ene-jun 2022), Republica Checa (jul-dic 2022), Suecia (ene-jun 2023). No corresponde al periodo desde enero de 2025.

- **C)** "Espana, Suecia y Francia". Este trio **no existe** como tal. Mezcla paises de trios distintos: Espana fue parte del trio 2023-2024 (con Belgica y Hungria), mientras que Suecia y Francia pertenecen al trio 2022-2023. La trampa combina presidencias reales de periodos diferentes.

- **D)** "Suecia, Belgica y Hungria". Este trio **tampoco existe** como tal. Mezcla a Suecia (del trio 2022-2023) con Belgica y Hungria (del trio 2023-2024). El trio real de 2023-2024 fue **Espana**, Belgica y Hungria, no Suecia.

**Trios recientes de presidencias:**

| Periodo | Paises |
|---------|--------|
| 2022-2023 | Francia, Rep. Checa, Suecia |
| 2023-2024 | Espana, Belgica, Hungria |
| **2025-2026** | **Polonia, Dinamarca, Chipre** |

**Clave:** Desde enero 2025: Polonia, Dinamarca, Chipre. Las opciones B, C y D mezclan presidencias de 2022-2024.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "d0656264-5355-4f99-a32e-84a2782c0535");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - TUE presidencias 2025 (" + exp2.length + " chars)");
})();
