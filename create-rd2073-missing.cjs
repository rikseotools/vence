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
      number: "2",
      title: "Funciones del Registro Central de Personal",
      content: `El Registro Central de Personal realizará las siguientes funciones:
a) Inscribir y anotar los actos administrativos relativos al personal comprendido en su ámbito de aplicación.
b) Llevar a cabo las actuaciones precisas para que los órganos responsables de la ordenación, planificación y gestión de los recursos humanos del sector público estatal dispongan de la información necesaria al efecto.
c) Desarrollar las acciones necesarias para coordinar el Registro Central de Personal con los Registros de Personal de las restantes Administraciones públicas.
d) Desarrollar la gestión informática del Sistema de Información del Registro Central de Personal.
e) Impulsar la implantación y el desarrollo de procesos informáticos de ayuda a la gestión de recursos humanos.`
    },
    {
      number: "4",
      title: "Soporte informatizado al Registro Central de Personal",
      content: `1. El sistema de información del Registro Central de Personal es el instrumento técnico para el soporte informatizado a la gestión del Registro Central de Personal y está formado, en todo caso, por los siguientes subsistemas:
a) Base de datos de expedientes personales.
b) Base de datos de gestión de recursos humanos, que integrará las estructuras orgánicas y las relaciones de puestos de trabajo, catálogos y plazas de la Administración General del Estado y sus organismos públicos con los expedientes personales de los efectivos inscritos en el Registro Central de Personal.
c) Base de datos de información sobre recursos humanos del sector público, que almacenará indicadores e información acerca de los efectivos empleados por el sector público estatal y las restantes Administraciones públicas.`
    },
    {
      number: "7",
      title: "Documentos registrales",
      content: `1. Los documentos registrales constituyen los soportes que permiten la constancia de los datos que hayan de ser incorporados al Registro. Los documentos registrales serán normalizados por el Registro Central de Personal.

2. Las unidades gestoras de recursos humanos estarán obligadas a utilizar los documentos normalizados con los datos en ellos definidos.

3. Los documentos registrales normalizados podrán adoptar la forma de transacciones informáticas o documentos informáticos susceptibles de ser firmados electrónicamente, transmitirse por medios telemáticos y conservarse en soporte óptico, magnético o electrónico, siempre que se garanticen la integridad y seguridad de las transmisiones, la inalterabilidad del contenido de los documentos, la fecha y hora de la transacción y la identidad de emisores, receptores y firmantes.`
    },
    {
      number: "8",
      title: "El número de registro de personal",
      content: `1. El número de registro de personal es el que sirve para identificar la relación existente entre una persona y la correspondiente Administración, en los términos a que se refiere el artículo 5 del presente Reglamento.

2. A efectos de identificación de esta relación el número de registro de personal se estructurará de acuerdo con las especificaciones que establezca el órgano responsable del Registro Central de Personal.

3. A una misma persona le corresponderán tantos números de registro de personal como nombramientos como funcionario de Cuerpos o Escalas o personal eventual haya tenido, o contratos laborales haya suscrito.`
    },
    {
      number: "9",
      title: "El número de identificación personal",
      content: `1. El Registro Central de Personal asignará un número de identificación personal, que estará basado en el número del documento nacional de identidad cuando inscriba ciudadanos españoles. Este número será el mismo durante toda la vida administrativa de los interesados, por lo que no podrá ser modificado una vez asignado, salvo para corregir errores materiales.

En ningún caso podrán figurar inscritas dos personas con el mismo número, ni podrá reutilizarse uno que hubiera sido asignado anteriormente a otra persona, aunque ésta ya no estuviera de alta en el Registro.

2. Para el personal de nacionalidad extranjera, el número de identificación personal se basará en el número de identificación de extranjero o, en su defecto, en la fecha de nacimiento y en el nombre y apellidos del interesado, a fin de construir un número único e irrepetible.`
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
