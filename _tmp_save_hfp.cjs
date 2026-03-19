require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 5 de la Orden HFP/134/2018** (Regimen de sustituciones del Foro de Gobierno Abierto):

> **5.1:** "El Presidente sera sustituido por el **Vicepresidente Primero** en caso de vacante, ausencia o enfermedad o cualquier otra causa justificada."
> **5.2:** Los vocales de departamentos ministeriales: suplentes con rango de **Subdirector General** del mismo ministerio.
> **5.3:** Los vocales de otras AAPP: funcionario del mismo departamento o consejeria.
> **5.4:** Los representantes de la sociedad civil: miembro de la misma institucion/entidad o suplentes designados.

**La pregunta pide la respuesta INCORRECTA.**

**Por que C es incorrecta (y por tanto la respuesta correcta):**
La opcion C dice que el Presidente sera sustituido por el Vicepresidente Primero (correcto hasta ahi) **"o por un miembro de la Comision permanente segun un turno ordinario establecido por el propio presidente"**. Esta segunda parte es inventada: el art. 5.1 solo establece la sustitucion por el Vicepresidente Primero. No existe ninguna "Comision permanente" ni "turno ordinario" en este contexto.

**Por que las demas son correctas (y por tanto NO son la respuesta):**

- **A)** Reproduce el art. 5.4: los representantes de la sociedad civil pueden ser sustituidos por un miembro de su institucion/entidad/fundacion/asociacion o por suplentes designados. Correcto.

- **B)** Reproduce el art. 5.2: vocales de ministerios sustituidos por suplentes con rango de Subdirector General del mismo ministerio. Correcto.

- **D)** Reproduce el art. 5.3: vocales de otras AAPP sustituidos por funcionario del mismo departamento o consejeria segun normas de organizacion interna. Correcto.

**Regla de sustitucion por tipo de miembro:**

| Miembro | Sustituido por |
|---------|---------------|
| Presidente | Vicepresidente Primero |
| Vocales ministeriales | Subdirector General del mismo ministerio |
| Vocales otras AAPP | Funcionario del mismo departamento/consejeria |
| Sociedad civil | Miembro de su entidad o suplentes designados |`;

  const { error } = await supabase.from("questions").update({ explanation }).eq("id", "5db0fef8-b0b4-46fd-9171-0a02887397b8");
  if (error) console.error("Error:", error);
  else console.log("OK - Orden HFP/134/2018 art.5 sustituciones (" + explanation.length + " chars)");
})();
