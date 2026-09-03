/**
 * Contenido legal — Ephirox
 *
 * Fuente única de verdad para el texto de la Política de Tratamiento de
 * Datos Personales y los Términos y Condiciones de Uso, mostrados por
 * AceptacionRegistro.jsx — en el gate obligatorio del primer acceso
 * (AppShell.tsx, cuando el cliente nunca aceptó nada) y en la reaceptación
 * voluntaria desde Configuración de cuenta (PanelConfiguracion.jsx).
 *
 *
 * Reglas de uso:
 * - Cualquier cambio de texto aquí debe ir acompañado de subir el número
 *   de versión correspondiente (DATA_POLICY_VERSION / TERMS_VERSION),
 *   y pasar por revisión (PR + idealmente el abogado) antes de deploy.
 *   No se edita en caliente desde un panel — el registro de qué versión
 *   aceptó cada usuario solo tiene valor probatorio si la versión
 *   cambia únicamente vía código versionado.
 * - Debe decir EXACTAMENTE lo mismo que los .docx entregados
 *   (Política de Tratamiento de Datos Personales / Términos y
 *   Condiciones de Uso). Si editas uno, edita el otro.
 * - Reemplaza los placeholders ([RAZÓN SOCIAL], [NIT], [CIUDAD],
 *   [correo de contacto], [FECHA]) por los datos reales antes de
 *   publicar a producción.
 */

export const DATA_POLICY_VERSION = "v0.3-borrador";
export const TERMS_VERSION = "v0.3-borrador";

export const DATOS_CONTENT = [
  { h: "1. Responsable del tratamiento", blocks: [
    { p: "[RAZÓN SOCIAL], identificada con NIT [___________], con domicilio en [CIUDAD, COLOMBIA] (\"Ephirox\"), es responsable del tratamiento de los datos personales de sus clientes y usuarios de la plataforma, conforme a la Ley Estatutaria 1581 de 2012, el Decreto 1377 de 2013 y las normas que los modifiquen o complementen." },
    { p: "Canal de contacto para asuntos de protección de datos: [correo de contacto] · [teléfono / dirección]." },
  ]},
  { h: "2. Aceptación y ámbito de aplicación", blocks: [
    { p: "Esta política debe ser leída y aceptada expresamente por todo cliente de la plataforma, como condición previa al uso de la plataforma y a la recolección de cualquier dato personal, mediante un mecanismo de casilla de verificación independiente presentado en tu primer acceso, o al actualizarse esta política." },
  ]},
  { h: "3. Datos que se recolectan", blocks: [
    { ul: [
      "Datos de identificación: nombre completo, documento de identidad, país, ciudad, correo electrónico, número de celular.",
      "Datos de salud y bienestar (datos sensibles): mediciones corporales (peso, grasa, masa muscular), resultados de InBody, información de sueño, recuperación y variabilidad de frecuencia cardíaca de dispositivos conectados (p. ej. Oura), motivo de consulta y notas del acompañamiento terapéutico o de mentoría.",
      "Datos de uso de la plataforma: actividad en los módulos de Workout, Nutrition, Stress, Sleep, adherencia a protocolos, rachas y participación en eventos, retiros o terapias.",
      "Datos de pago y facturación, tratados a través de las pasarelas de pago correspondientes.",
    ]},
    { note: "Los datos de salud, biométricos y de bienestar se consideran datos sensibles conforme al artículo 5 de la Ley 1581 de 2012. Su tratamiento requiere autorización previa, expresa e informada, reforzada frente a los datos ordinarios." },
  ]},
  { h: "4. Finalidades del tratamiento", blocks: [
    { ul: [
      "Gestionar el registro, la membresía y el acceso a los módulos de la plataforma según el tipo de cliente.",
      "Diseñar, personalizar y hacer seguimiento a los protocolos de Workout, Nutrition, Stress y Sleep.",
      "Permitir el acompañamiento de mentores y terapeutas dentro del panel clínico (\"Punto Ciego\").",
      "Calcular indicadores de evolución y rendimiento (Evolution, Índice de Rendimiento).",
      "Enviar comunicaciones sobre el servicio, eventos, retiros y demás beneficios de la plataforma.",
      "Fines estadísticos y de mejora del servicio, incluyendo el eventual entrenamiento de modelos internos de recomendación, sobre datos agregados o anonimizados cuando sea posible.",
      "Cumplir obligaciones legales, contables y fiscales.",
    ]},
  ]},
  { h: "5. Principios aplicables", blocks: [
    { p: "Legalidad, finalidad, libertad, veracidad o calidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad, conforme al artículo 4 de la Ley 1581 de 2012." },
  ]},
  { h: "6. Autorización", blocks: [
    { p: "Al aceptar esta política, otorgas autorización previa, expresa e informada para el tratamiento de tus datos personales conforme a lo aquí descrito. Dado que la plataforma recolecta datos sensibles de salud, esta autorización es reforzada y diferenciada: no estás obligado a suministrar dichos datos, son de carácter sensible, y su suministro es voluntario, conforme al artículo 6 de la Ley 1581 de 2012." },
  ]},
  { h: "7. Tus derechos (Habeas Data)", blocks: [
    { ul: [
      "Conocer, actualizar y rectificar tus datos personales.",
      "Solicitar prueba de la autorización otorgada.",
      "Ser informado sobre el uso dado a tus datos.",
      "Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley.",
      "Revocar la autorización y/o solicitar la supresión del dato, cuando no exista un deber legal o contractual que impida eliminarlo.",
      "Acceder de forma gratuita a tus datos personales que hayan sido objeto de tratamiento.",
    ]},
  ]},
  { h: "8. Cómo ejercer tus derechos", blocks: [
    { p: "Puedes escribir a [correo de contacto], indicando tu nombre completo, documento de identidad y el derecho que deseas ejercer. La consulta se atiende en máximo diez (10) días hábiles, y el reclamo en máximo quince (15) días hábiles, prorrogable conforme a la ley." },
  ]},
  { h: "9. Con quién compartimos tus datos", blocks: [
    { p: "Podemos compartir datos con encargados del tratamiento que prestan servicios tecnológicos a la plataforma (hosting, pasarela de pagos, integración con dispositivos wearables como Oura), obligados contractualmente a dar a los datos el mismo nivel de protección exigido por esta política. No vendemos ni comercializamos datos personales con fines ajenos a la prestación del servicio." },
  ]},
  { h: "10. Vigencia y conservación", blocks: [
    { p: "Los datos se conservan mientras exista la relación contigo y el tiempo adicional necesario para cumplir obligaciones legales, contables o para atender requerimientos de autoridades competentes." },
  ]},
  { h: "11. Modificaciones", blocks: [
    { p: "Podemos modificar esta política para reflejar cambios normativos o en nuestras prácticas de tratamiento. Los cambios sustanciales serán informados por los canales de la plataforma." },
  ]},
];

export const TERMINOS_CONTENT = [
  { h: "1. Objeto", blocks: [
    { p: "Estos Términos y Condiciones (\"los Términos\") regulan el acceso y uso de la plataforma Ephirox, incluyendo su sitio web, aplicación y todos sus módulos (Baseline, Workout, Nutrition, Stress, Sleep, The Circle, Evolution y demás funcionalidades presentes o futuras), operada por [RAZÓN SOCIAL] (\"Ephirox\")." },
  ]},
  { h: "2. Aceptación", blocks: [
    { p: "El acceso a la plataforma requiere la aceptación expresa e independiente de estos Términos, junto con la Política de Tratamiento de Datos Personales. Quien no acepte ambos documentos no podrá usar los servicios." },
  ]},
  { h: "3. Cuenta y tipo de cliente", blocks: [
    { p: "El alta de cuentas es gestionada por el equipo de Ephirox, que asigna a cada cliente un tipo (Cliente 1:1 o Breakthrough Sessions) con acceso a distintos módulos según la matriz de roles y perfiles definida por Ephirox. Ephirox se reserva el derecho de admisión y permanencia respecto de las membresías de pago, y podrá suspender o revocar el acceso de cualquier cliente que incumpla estos Términos." },
  ]},
  { h: "4. Licencia de uso", blocks: [
    { p: "Ephirox te otorga una licencia limitada, personal, intransferible, no exclusiva y revocable para acceder y usar la plataforma exclusivamente para tu propósito previsto (gestión personal de bienestar, entrenamiento, nutrición y acompañamiento personalizado), mientras tu membresía se encuentre activa. Esta licencia no constituye una venta ni una cesión de derechos sobre el software." },
  ]},
  { h: "5. Propiedad intelectual y restricciones expresas de uso", blocks: [
    { p: "Todo el software, código fuente, código objeto, arquitectura, bases de datos, algoritmos (incluyendo el cálculo del Índice de Rendimiento), diseño de interfaz, elementos gráficos, marca \"Ephirox\", logotipos, protocolos, metodologías, contenidos, textos y materiales disponibles en la plataforma son propiedad exclusiva de Ephirox o de sus licenciantes, protegidos por las normas de derecho de autor y propiedad industrial vigentes en Colombia (Decisión Andina 351 de 1993, Ley 23 de 1982, Ley 1915 de 2018 y Decisión Andina 486 de 2000)." },
    { p: "El uso de la plataforma NO te transfiere ningún derecho de propiedad intelectual. En consecuencia, te obligas a NO, bajo ninguna circunstancia:" },
    { ul: [
      "Usar el software o cualquiera de sus componentes fuera del propósito personal para el que fue habilitado tu acceso.",
      "Copiar, reproducir, distribuir, publicar o poner a disposición de terceros, total o parcialmente, el software, el código, el diseño, los protocolos o los contenidos de la plataforma.",
      "Descompilar, desensamblar, aplicar ingeniería inversa o intentar extraer el código fuente o la lógica interna del software, salvo en los casos en que la ley disponga expresamente lo contrario.",
      "Crear obras derivadas basadas en el software, su diseño o sus protocolos.",
      "Apropiarte, registrar a tu nombre o de un tercero, o explotar comercialmente, directa o indirectamente, cualquier elemento de propiedad intelectual de Ephirox.",
      "Utilizar bots, scraping u otros medios automatizados para recolectar información de la plataforma.",
      "Remover, ocultar o alterar avisos de derechos de autor, marcas o cualquier indicación de titularidad.",
    ]},
    { note: "El incumplimiento de esta cláusula constituye una infracción grave que habilita a Ephirox para suspender inmediatamente tu acceso, sin perjuicio de las acciones civiles y penales a que haya lugar conforme a la Ley 256 de 1996 y demás normas aplicables." },
  ]},
  { h: "6. Contenido generado por ti", blocks: [
    { p: "Las mediciones, resultados de InBody y demás información que cargues a la plataforma siguen siendo de tu titularidad, sin perjuicio de la licencia que otorgas a Ephirox para tratarlos conforme a la Política de Tratamiento de Datos Personales y con el único fin de prestarte el servicio." },
  ]},
  { h: "7. Servicios de terceros", blocks: [
    { p: "La plataforma puede integrarse con servicios de terceros (p. ej. dispositivos wearables o pasarelas de pago). El uso de dichos servicios se rige adicionalmente por los términos propios de cada proveedor, sobre los cuales Ephirox no tiene control ni responsabilidad." },
  ]},
  { h: "8. Uso aceptable", blocks: [
    { p: "Te comprometes a hacer un uso diligente y de buena fe de la plataforma, a no compartir tus credenciales de acceso, y a no utilizar el servicio para fines ilícitos o contrarios a estos Términos." },
  ]},
  { h: "9. Descargo de responsabilidad y naturaleza del servicio", blocks: [
    { p: "BIO360 es una plataforma de bienestar y optimización de hábitos, no un dispositivo médico ni un servicio de salud clínica. No diagnostica, trata, cura ni previene ninguna enfermedad o condición médica o de salud mental. Los protocolos y recomendaciones se basan en datos de wearables, marcadores biológicos y hábitos, revisados y aprobados por nuestro equipo — no sustituyen la consulta con un médico, psicólogo u otro profesional de salud licenciado." },
    { p: "BIO360 puede usar inteligencia artificial para generar borradores de contenido y análisis de datos; como tal, puede ser incompleto o impreciso. Confirma siempre decisiones de salud importantes con un profesional licenciado. Si tú o alguien más está en una situación de emergencia médica o de salud mental, comunícate de inmediato con los servicios de emergencia de tu país o con la línea de atención en crisis correspondiente." },
    { p: "Sobre los reportes para tu empresa: cuando el programa se contrata como beneficio corporativo, tu empleador puede recibir información agregada y/o comparativa derivada de tus datos, según los términos definidos en tu contrato de servicio y con tu consentimiento explícito. Estos reportes son informativos y no constituyen asesoría legal, de gobierno corporativo, ni una evaluación de idoneidad laboral." },
    { p: "Tus datos son tuyos. Nunca se venden ni se usan para publicidad. Puedes solicitar una copia de tus datos o su eliminación completa en cualquier momento, incluyendo si dejas de usar la plataforma o finaliza tu programa." },
  ]},
  { h: "10. Suspensión y terminación", blocks: [
    { p: "Ephirox podrá suspender o cancelar tu cuenta si incumples estos Términos, sin perjuicio de las demás acciones legales a que haya lugar. Puedes solicitar la cancelación de tu cuenta en cualquier momento a través de los canales dispuestos por Ephirox." },
  ]},
  { h: "11. Modificaciones", blocks: [
    { p: "Ephirox podrá actualizar estos Términos para reflejar cambios en el servicio o en la normativa aplicable. Los cambios sustanciales serán notificados, y el uso continuado de la plataforma tras la notificación constituye aceptación de los Términos actualizados." },
  ]},
  { h: "12. Ley aplicable y jurisdicción", blocks: [
    { p: "Estos Términos se rigen por las leyes de la República de Colombia. Cualquier controversia derivada de su interpretación o ejecución se someterá a los jueces competentes de [CIUDAD], Colombia." },
  ]},
  { h: "13. Contacto", blocks: [
    { p: "Para consultas relacionadas con estos Términos: [correo de contacto]." },
  ]},
];