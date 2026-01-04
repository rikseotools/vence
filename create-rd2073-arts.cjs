const fs = require("fs");
fs.readFileSync("/home/manuel/Documentos/github/vence/.env.local", "utf8").split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: law } = await supabase.from("laws").select("id").eq("short_name", "RD 2073/1999").single();
  if (!law) { console.log("Ley no encontrada"); return; }

  const articles = [
    {
      number: "5",
      title: "Personal objeto de inscripción",
      content: `Se inscribirá en el Registro Central de Personal el personal siguiente, siempre que sus relaciones de servicios se rijan por derecho administrativo o laboral:
a) El personal de la Administración General del Estado.
b) El personal de los Organismos Autónomos, Entidades Gestoras y Servicios Comunes de la Seguridad Social.
c) El personal de los Organismos públicos a que se refiere el título III de la Ley 6/1997, de 14 de abril, de Organización y Funcionamiento de la Administración General del Estado.
d) El personal al servicio de la Administración de Justicia.
e) El personal de cualquier otra Administración, organismo o entidad, cuando así se establezca por disposición con rango de ley.`
    },
    {
      number: "12",
      title: "Inscripciones registrales",
      content: `1. Serán objeto de inscripción las resoluciones de nombramiento de funcionarios de carrera, en prácticas, interinos, las de personal eventual, las integraciones en otros Cuerpos o Escalas y la formalización de contratos laborales.

2. A los efectos de lo dispuesto en el apartado anterior, los actos y resoluciones de nombramiento o formalización de contratos indicarán los datos identificativos del Cuerpo, Escala, Clase, Categoría o puesto de trabajo, nivel, Organismo de destino, fecha de toma de posesión o alta, y cualquier otro que se determine reglamentariamente.`
    },
    {
      number: "14",
      title: "Anotaciones provisionales",
      content: `1. Se anotarán de forma provisional en el Registro Central de Personal los actos, resoluciones y datos de las personas inscritas cuando, por su naturaleza, pendencia de recurso, incomplitud o por cualquier otra circunstancia, convenga así hacerlo a efectos de constancia registral.

2. Las anotaciones provisionales se convertirán en definitivas cuando desaparezcan las circunstancias que dieron lugar a su práctica en tales términos.`
    },
    {
      number: "15",
      title: "Anotaciones marginales",
      content: `1. El Registro Central de Personal podrá efectuar anotaciones marginales con las que se amplíen, aclaren, detallen o documenten otros asientos, con el fin de mejorar la calidad e integridad de la información.

2. Las anotaciones marginales carecen de autonomía registral, quedando su validez y eficacia vinculadas a las del asiento que amplían, aclaran, detallan o documentan.`
    }
  ];

  for (const art of articles) {
    const { data, error } = await supabase.from("articles").insert({
      law_id: law.id,
      article_number: art.number,
      title: art.title,
      content: art.content,
      is_active: true
    }).select();

    if (error) {
      console.error(`❌ Error art. ${art.number}:`, error.message);
    } else {
      console.log(`✅ Artículo ${art.number} RD 2073/1999 creado:`, data[0].id);
    }
  }
})();
