require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.26.3 documentos informativos identificar origen
  const exp1 = `**Articulo 26.3 de la Ley 39/2015 (LPAC) - Documentos electronicos informativos:**

> "En los documentos administrativos electronicos que se publiquen con caracter **meramente informativo**, asi como aquellos que no formen parte de un expediente administrativo, debera **identificarse su origen**."

**Por que B es correcta (identificar el origen):**
El art. 26.3 establece que cuando un documento electronico es meramente informativo o no forma parte de un expediente, no necesita firma electronica, pero **si** es obligatorio **identificar su origen**. Esto permite al ciudadano saber que organo o entidad lo ha emitido, garantizando la trazabilidad aunque no tenga firma.

**Por que las demas son incorrectas:**

- **A)** "**Clasificar** la informacion contenida." Falso: el art. 26.3 no exige clasificar la informacion de estos documentos. La clasificacion puede ser una buena practica, pero no es el requisito legal del articulo.

- **C)** "Identificar el **contenido** de los documentos." Falso: el articulo exige identificar el **origen** (quien lo emite), no el contenido (de que trata). La diferencia es sutil pero importante: origen = emisor; contenido = materia.

- **D)** "Garantizar la **veracidad** de los documentos." Falso: el art. 26.3 no exige garantizar la veracidad de estos documentos informativos. La veracidad se presume en la actuacion administrativa, pero el requisito especifico del art. 26.3 es la identificacion del origen.

**Documentos electronicos administrativos (art. 26 Ley 39/2015):**

| Tipo de documento | Requisito |
|-------------------|-----------|
| Documentos validos (art. 26.2) | Firma electronica + metadatos |
| **Informativos / fuera de expediente (art. 26.3)** | **Solo identificar el origen** |

**Clave:** Documentos informativos = identificar el **origen** (no necesitan firma electronica, pero si deben indicar quien los emite).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f1e3b84f-2a53-4153-ae9d-0cdd12b40dc3");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.26.3 identificar origen (" + exp1.length + " chars)");

  // #2 - CE art.68.5 Estado facilita sufragio españoles fuera
  const exp2 = `**Articulo 68.5 de la Constitucion Espanola - Sufragio de espanoles en el exterior:**

> "Son electores y elegibles todos los espanoles que esten en pleno uso de sus derechos politicos. La ley **reconocera** y el **Estado facilitara** el ejercicio del derecho de sufragio a los espanoles que se encuentren fuera del territorio de Espana."

**Por que B es correcta (el Estado):**
El art. 68.5 CE atribuye al **Estado** la funcion de **facilitar** el ejercicio del derecho de sufragio a los espanoles en el extranjero. El articulo distingue dos acciones y dos sujetos: la **ley** reconoce el derecho, y el **Estado** lo facilita (proporcionando medios para votar desde el exterior).

**Por que las demas son incorrectas:**

- **A)** "El **Presidente del Gobierno**." Falso: el art. 68.5 atribuye esta funcion al "Estado", no al Presidente del Gobierno como persona individual. El Estado actua a traves de sus instituciones (consulados, embajadas, etc.), pero el sujeto constitucional es "el Estado".

- **C)** "La **Ley**." Falso: la ley **reconoce** el derecho, pero no lo **facilita**. El art. 68.5 distingue las dos funciones: reconocer (ley) y facilitar (Estado). La pregunta pregunta por quien facilita, no por quien reconoce.

- **D)** "El **Rey**." Falso: el Rey no tiene asignada esta funcion en la CE. Las funciones del Rey estan en el art. 62, y facilitar el voto exterior no es una de ellas. Es el Estado como conjunto institucional.

**Art. 68.5 CE - Dos acciones, dos sujetos:**

| Accion | Sujeto |
|--------|--------|
| **Reconocer** el derecho de sufragio exterior | La **ley** |
| **Facilitar** el ejercicio del sufragio exterior | El **Estado** |

**Clave:** La ley RECONOCE, el Estado FACILITA. La pregunta es "quien facilita" = el Estado.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "b6cf3ebf-1043-4bda-b184-84087170e9cc");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.68.5 sufragio exterior (" + exp2.length + " chars)");

  // #3 - Orden DSA/819/2020 Consejo Desarrollo Sostenible 60 vocalías
  const exp3 = `**Orden DSA/819/2020 - Composicion del Consejo de Desarrollo Sostenible:**

**Por que B es correcta (60 vocalias):**
Segun la Orden DSA/819/2020, el Consejo de Desarrollo Sostenible esta integrado, ademas de por la Presidencia, Vicepresidencia y Secretaria, por **60 vocalias** en representacion de la sociedad civil, designadas por la persona titular de la Secretaria de Estado de Derechos Sociales y Agenda 2030.

**Por que las demas son incorrectas (numeros equivocados):**

- **A)** "**Cincuenta y cinco** vocalias." Falso: son 60, no 55. La diferencia de 5 vocalias puede parecer pequena, pero el numero exacto esta fijado en la Orden.

- **C)** "**Cuarenta** vocalias." Falso: 40 es significativamente inferior al numero real de 60 vocalias. No coincide con la composicion establecida en la norma.

- **D)** "**Cincuenta** vocalias." Falso: 50 no es el numero correcto. Son 60 vocalias las previstas en la Orden DSA/819/2020.

**Composicion del Consejo de Desarrollo Sostenible:**

| Cargo | Detalle |
|-------|---------|
| Presidencia | Titular de la Secretaria de Estado de Derechos Sociales y Agenda 2030 |
| Vicepresidencia | Designada entre los vocales |
| Secretaria | Funcionario del Ministerio |
| **Vocalias** | **60** representantes de la sociedad civil |

**Clave:** El Consejo de Desarrollo Sostenible tiene **60** vocalias de la sociedad civil. No confundir con 40, 50 ni 55.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "ae3e5960-689a-4222-b762-ca64ec1ee81c");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Orden DSA/819/2020 60 vocalias (" + exp3.length + " chars)");
})();
