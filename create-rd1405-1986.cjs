const fs = require("fs");
fs.readFileSync("/home/manuel/Documentos/github/vence/.env.local", "utf8").split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Verificar si ya existe
  const { data: existing } = await supabase.from("laws")
    .select("id")
    .eq("short_name", "RD 1405/1986")
    .single();

  if (existing) {
    console.log("RD 1405/1986 ya existe en BD:", existing.id);
    return;
  }

  // Crear la ley
  const { data: law, error: lawError } = await supabase.from("laws").insert({
    short_name: "RD 1405/1986",
    name: "Real Decreto 1405/1986, de 6 de junio, por el que se aprueba el Reglamento del Registro Central de Personal y las normas de coordinación con los de las restantes Administraciones Públicas",
    description: "Reglamento del Registro Central de Personal. Texto consolidado con las modificaciones del RD 2073/1999.",
    type: "regulation",
    is_active: true
  }).select().single();

  if (lawError) {
    console.error("Error creando ley:", lawError.message);
    return;
  }

  console.log("✅ RD 1405/1986 creado:", law.id);

  // Artículos del texto consolidado (extraídos de las explicaciones y del RD 2073/1999)
  const articles = [
    {
      number: "1",
      title: "Naturaleza y fines del Registro Central de Personal",
      content: `1. El Registro Central de Personal es el registro administrativo de la Administración General del Estado en el que se inscribe el personal a que se refiere el artículo 5 del presente Reglamento, y en el que se anotan preceptivamente los actos que afecten a su vida administrativa.

2. El Registro Central de Personal cumple las siguientes finalidades:
a) Garantizar la constancia registral de los expedientes personales u hojas de servicio del personal en él inscrito, mediante las correspondientes inscripciones y anotaciones, como garantía para los interesados y como instrumento de ayuda a la gestión de los recursos humanos comprendidos dentro de su ámbito de inscripción.
b) Disponer de la información sobre los recursos humanos del sector público estatal que los órganos responsables de su planificación necesiten para el análisis y seguimiento de su evolución.

3. El Registro Central de Personal tiene la condición de registro único del personal comprendido en su ámbito de aplicación, sin perjuicio de que, dentro de dicho ámbito, aquellos órganos que ostenten competencias en materia de personal puedan establecer sistemas complementarios de información sobre recursos humanos para el adecuado ejercicio de sus funciones, garantizando en todo caso la coherencia de sus datos con los obrantes en el Registro Central de Personal.`
    },
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
      number: "3",
      title: "Organización del Registro Central de Personal",
      content: `1. El Registro Central de Personal depende orgánicamente del Ministerio para las Administraciones Públicas.

2. Existirán Oficinas Delegadas del Registro Central de Personal en los Departamentos Ministeriales, en la Seguridad Social, en la Administración de Justicia, en las Delegaciones del Gobierno en las Comunidades Autónomas y en aquellos otros organismos o unidades administrativas que se determinen.`
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
      number: "6",
      title: "Delegación de competencias del Registro Central de Personal",
      content: `1. Mediante Orden del Ministro para las Administraciones Públicas podrán delegarse en los órganos responsables de las Oficinas Delegadas del Registro Central de Personal las competencias necesarias para garantizar el correcto funcionamiento del Registro.

2. En todo caso, las Oficinas Delegadas del Registro Central de Personal ejercerán, bajo la dirección del Jefe del Registro Central de Personal, las competencias que correspondan al Registro en relación con el personal comprendido en su ámbito de actuación.`
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

2. Para el personal de nacionalidad extranjera, el número de identificación personal se basará en el número de identificación de extranjero o, en su defecto, en la fecha de nacimiento y en el nombre y apellidos del interesado, a fin de construir un número único e irrepetible.

3. Cuando el órgano gestor detecte la asignación de varios números de identificación distintos a una misma persona, lo pondrá en conocimiento del Registro Central de Personal, el cual procederá a unificarlos.`
    },
    {
      number: "10",
      title: "Asientos registrales",
      content: `1. La práctica de asientos en el Registro Central de Personal acredita la existencia de los actos, resoluciones o datos objeto de los mismos.

2. Los asientos del Registro Central de Personal podrán ser inscripciones, anotaciones o cancelaciones.

3. Las inscripciones registrarán el establecimiento de cualquier relación laboral o funcionarial con alguna de las Administraciones comprendidas en el ámbito del Registro Central de Personal.

4. Las anotaciones harán constar las incidencias que a lo largo de su vida administrativa afecten al personal inscrito.

5. Las cancelaciones dejarán sin efecto inscripciones o anotaciones practicadas con anterioridad.`
    },
    {
      number: "11",
      title: "Procedimiento para la práctica de los asientos",
      content: `1. El Registro Central de Personal comprobará que la información a registrar es completa y veraz, que no contradice la información que obre en las bases de datos del Registro y que la unidad que la remite es competente para hacerlo.

2. Los órganos competentes en materia de personal comunicarán al Registro Central de Personal los actos, resoluciones o cualquier otra información que deba ser registrada dentro del plazo máximo de tres días desde la fecha en que fueran dictados o desde que tuvieran conocimiento de los mismos. Una vez comunicados, se practicarán en el Registro los asientos en un plazo máximo de tres días desde la recepción de la comunicación, devolviendo ésta estampillada con el sello del Registro a la unidad gestora.

3. El Registro Central de Personal devolverá sin registrar, para su corrección, aquellas comunicaciones en las que aprecie defectos u omisiones, salvo que pueda subsanarlas de oficio.`
    },
    {
      number: "12",
      title: "Inscripciones registrales",
      content: `1. Serán objeto de inscripción las resoluciones de nombramiento de funcionarios de carrera, en prácticas, interinos, las de personal eventual, las integraciones en otros Cuerpos o Escalas y la formalización de contratos laborales.

2. A los efectos de lo dispuesto en el apartado anterior, los actos y resoluciones de nombramiento o formalización de contratos indicarán los datos identificativos del Cuerpo, Escala, Clase, Categoría o puesto de trabajo, nivel, Organismo de destino, fecha de toma de posesión o alta, y cualquier otro que se determine reglamentariamente.`
    },
    {
      number: "13",
      title: "Anotaciones registrales ordinarias",
      content: `1. Serán objeto de anotación en el Registro Central de Personal los actos administrativos, resoluciones y datos de las personas inscritas que a continuación se relacionan:
a) Para el personal funcionario de carrera, en prácticas o interino y el personal eventual, los que les sean de aplicación de entre los siguientes:
1. Tomas de posesión en plazas, destinos y puestos de trabajo.
2. Ceses en plazas, destinos y puestos de trabajo.
3. Supresión o modificación en las características de los puestos de trabajo ocupados.
4. Cambios de situación administrativa.
5. Adquisición de grados personales y sus modificaciones.
6. Adquisición de especialidades dentro de los Cuerpos o Escalas.
7. Pérdidas de la condición de funcionario.
8. Jubilaciones.
9. Prolongaciones de la permanencia en servicio activo.
10. Reconocimientos de trienios.
11. Reconocimientos de servicios previos.
12. Autorizaciones o reconocimientos de compatibilidad.
13. Titulaciones, diplomas y cursos recibidos o impartidos.
14. Premios, sanciones, condecoraciones y menciones.
15. Licencias y permisos que tuvieran repercusión en nómina o en el cómputo del tiempo de servicio activo.
16. Reducciones de jornada.
17. Reconocimientos del derecho al incremento en el complemento de destino.
18. Reconocimientos de la condición de catedrático de personal docente.
19. Reconocimientos del componente por formación permanente de personal docente.
20. Sentencias firmes relacionadas con su condición de funcionario.

2. Asimismo, se anotarán en el Registro Central de Personal cualesquiera otros actos, resoluciones y datos cuya anotación esté legal o reglamentariamente establecida o así se determine por la Secretaría de Estado para la Administración Pública.`
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
    },
    {
      number: "16",
      title: "Cancelación y modificación de asientos",
      content: `1. Podrá instarse la cancelación o sustitución de inscripciones o anotaciones registrales por el propio interesado, por el órgano que en su día las comunicó, por el responsable de la correspondiente Oficina Delegada del Registro, o por el propio Registro Central de Personal.

2. La sustitución de inscripciones o anotaciones se llevará a cabo mediante la cancelación de la inscripción o anotación anterior y la práctica de una nueva inscripción o anotación.

3. La cancelación de una inscripción o anotación producirá su anulación a todos los efectos, sin perjuicio de que sea sustituida por otra.`
    }
  ];

  // Insertar artículos
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
      console.log(`✅ Artículo ${art.number} creado`);
    }
  }

  console.log("\n✅ RD 1405/1986 creado con", articles.length, "artículos");
})();
