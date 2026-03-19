require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 47/2003 art.40 clasificacion economica gastos - operaciones de capital
  const exp1 = `**Articulo 40.2 de la Ley 47/2003 (LGP)** - Clasificacion economica de los gastos:

> Los creditos incluidos en los estados de gastos se clasifican en:
> - Operaciones **corrientes** (capitulos 1-4)
> - Operaciones de **capital** (capitulos 6-7)
> - Operaciones **financieras** (capitulos 8-9)
> - **Fondo de contingencia** (capitulo 5)

**Por que D es correcta (inversiones reales):**
Las **inversiones reales** (capitulo 6) son operaciones de **capital**, junto con las transferencias de capital (capitulo 7). Son gastos destinados a la creacion o adquisicion de bienes de inversion (infraestructuras, edificios, equipamiento...).

**Por que las demas son incorrectas:**

- **A)** "Gastos de personal". Falso: los gastos de personal son el **capitulo 1**, que pertenece a las operaciones **corrientes**, no de capital. Son retribuciones, cotizaciones sociales, etc.

- **B)** "Fondo de contingencia". Falso: el fondo de contingencia es el **capitulo 5**, una categoria especial que no se clasifica ni como corriente ni como de capital. Es una reserva para atender necesidades imprevistas.

- **C)** "Transferencias corrientes". Falso: las transferencias **corrientes** son el **capitulo 4**, operaciones **corrientes**. No confundir con las transferencias de **capital** (capitulo 7), que si son operaciones de capital.

**Clasificacion economica de los gastos (art. 40.2 LGP):**

| Tipo | Capitulos | Concepto |
|------|-----------|----------|
| **Corrientes** | 1-Gastos personal, 2-Bienes y servicios, 3-Gastos financieros, 4-Transferencias corrientes | Gasto ordinario |
| **Capital** | 6-**Inversiones reales**, 7-Transferencias de capital | Gasto de inversion |
| **Financieras** | 8-Activos financieros, 9-Pasivos financieros | Operaciones financieras |
| **Contingencia** | 5-Fondo de contingencia | Reserva imprevista |

**Clave:** Operaciones de capital = capitulos **6** (inversiones reales) y **7** (transferencias de capital). Los capitulos 1-4 son corrientes.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "bacfb04c-605f-40e9-89fb-88072d6671b6");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LGP clasif. economica capital (" + exp1.length + " chars)");

  // #2 - Ley 47/2003 art.2 organismos publicos EPE
  const exp2 = `**Articulo 2.2.a) de la Ley 47/2003 (LGP):**

> "Integran el sector publico institucional estatal [...]:
> a) Los **organismos publicos** vinculados o dependientes de la AGE, los cuales se clasifican en:
> 1. Organismos autonomos.
> 2. **Entidades Publicas Empresariales**.
> 3. Agencias Estatales."

**Por que B es correcta (Entidades Publicas Empresariales):**
Las EPE son una de las tres categorias de **organismos publicos** vinculados o dependientes de la AGE segun el art. 2.2.a) LGP. Junto con los organismos autonomos y las agencias estatales, conforman el nucleo del sector publico institucional como entes con personalidad juridica publica.

**Por que las demas son incorrectas:**

- **A)** "Fondos sin personalidad juridica". Falso: los fondos sin personalidad juridica (art. 2.2.f) forman parte del sector publico institucional estatal, pero **no son organismos publicos**. Al carecer de personalidad juridica, no pueden ser "vinculados o dependientes" en sentido organico.

- **C)** "Sociedades mercantiles". Falso: las sociedades mercantiles estatales (art. 2.2.d) forman parte del sector publico institucional, pero son entidades de **derecho privado**, no organismos publicos. Se rigen por el derecho mercantil, no por el administrativo.

- **D)** "Autoridades administrativas independientes". Falso: las autoridades administrativas independientes (art. 2.2.b) son una categoria **separada** de los organismos publicos vinculados. Su nota distintiva es precisamente la **independencia** de la AGE, lo que las diferencia de los organismos publicos "vinculados o dependientes".

**Sector publico institucional estatal (art. 2.2 LGP):**
- a) **Organismos publicos** (OO.AA., EPE, Agencias) - vinculados/dependientes
- b) Autoridades administrativas independientes
- c) Entidades de derecho publico con regimen especial
- d) Sociedades mercantiles estatales
- e) Consorcios con participacion estatal
- f) Fondos sin personalidad juridica

**Clave:** EPE = **organismo publico** vinculado/dependiente. Sociedades mercantiles y autoridades independientes son categorias distintas.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "c4048e4a-7f5f-4768-8de0-a12869708618");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LGP organismos publicos EPE (" + exp2.length + " chars)");
})();
