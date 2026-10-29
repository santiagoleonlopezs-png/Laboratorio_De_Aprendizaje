'use strict';
// Adaptación independiente y educativa del Marco de Valores en Competencia.
// Redacción original para evaluación de equipos; no es el cuestionario OCAI oficial.
window.CVF_TYPES=[
 {id:'clan',label:'Colaborar',name:'Clan · colaboración',short:'Personas, confianza y desarrollo',color:'#54D6CA',
  strength:'Facilita cooperación, aprendizaje mutuo y pertenencia.',
  tension:'Si domina en exceso, puede retrasar conversaciones difíciles y decisiones exigentes.',
  actions:['Establecer retrospectivas breves con acuerdos observables.','Crear mentorías entre pares y espacios para compartir conocimiento.','Hacer explícitos los criterios de participación y escuchar las voces menos visibles.']},
 {id:'adhocracy',label:'Crear',name:'Adhocracia · innovación',short:'Exploración, autonomía y experimentación',color:'#B697FF',
  strength:'Permite adaptarse, explorar posibilidades y aprender de los experimentos.',
  tension:'Sin prioridades y límites claros, puede generar dispersión y sobrecarga.',
  actions:['Lanzar experimentos pequeños con hipótesis, responsables y fechas.','Definir qué decisiones pueden tomarse con autonomía.','Registrar aprendizajes y decidir qué prácticas se escalan o abandonan.']},
 {id:'market',label:'Lograr',name:'Mercado · resultados',short:'Metas, usuarios y desempeño',color:'#FFB76B',
  strength:'Orienta esfuerzos hacia logros verificables y necesidades externas.',
  tension:'Una presión excesiva por metas puede debilitar colaboración y cuidado de las personas.',
  actions:['Traducir la estrategia en dos o tres resultados medibles.','Acordar métricas compartidas y revisar sus efectos no deseados.','Equilibrar objetivos con retroalimentación y aprendizaje sobre el proceso.']},
 {id:'hierarchy',label:'Organizar',name:'Jerarquía · coordinación',short:'Claridad, consistencia y confiabilidad',color:'#75ACFF',
  strength:'Da continuidad, orden y previsibilidad a tareas interdependientes.',
  tension:'El exceso de controles puede desincentivar iniciativa y respuesta rápida.',
  actions:['Clarificar roles, decisiones y reglas que realmente agregan valor.','Eliminar aprobaciones que no previenen riesgos relevantes.','Acordar estándares mínimos y mecanismos ágiles para revisar excepciones.']}
];
window.CVF_DIMENSIONS=[
 {title:'Identidad del equipo',prompt:'¿Qué rasgos caracterizan el día a día de este equipo?',options:[
  'Se siente como un grupo cercano en el que las personas se apoyan y comparten lo que saben.',
  'Predomina un ambiente explorador: se proponen posibilidades nuevas y se prueban ideas.',
  'Se percibe un equipo orientado a cumplir desafíos exigentes y demostrar resultados.',
  'Se distingue por roles definidos, procesos conocidos y una forma ordenada de trabajar.'
 ]},
 {title:'Forma de liderar',prompt:'¿Qué estilo de liderazgo se observa y cuál ayudaría más en el futuro?',options:[
  'Los líderes acompañan, escuchan, desarrollan capacidades y favorecen la cooperación.',
  'Los líderes impulsan nuevas perspectivas, cuestionan lo establecido y permiten experimentar.',
  'Los líderes fijan metas retadoras, hacen seguimiento a resultados y movilizan al logro.',
  'Los líderes coordinan, aclaran responsabilidades y procuran que se cumplan los acuerdos.'
 ]},
 {title:'Gestión de las personas',prompt:'¿Cómo se organiza el trabajo y se moviliza el talento del equipo?',options:[
  'Se promueven la participación, el aprendizaje compartido y las decisiones conversadas.',
  'Se impulsa la autonomía para probar soluciones, aprender de errores y adaptarse.',
  'Se valora la responsabilidad individual por metas y el desempeño frente a desafíos.',
  'Se priorizan la consistencia, las responsabilidades explícitas y los procedimientos.'
 ]},
 {title:'Lo que mantiene unido al equipo',prompt:'¿Qué crea cohesión, compromiso y sentido de pertenencia?',options:[
  'La confianza, la ayuda mutua y el compromiso con las personas.',
  'El entusiasmo por construir algo distinto y explorar oportunidades.',
  'La ambición compartida por alcanzar resultados y superar retos.',
  'Los acuerdos, las reglas claras y una manera confiable de coordinarse.'
 ]},
 {title:'Prioridades estratégicas',prompt:'¿En qué pone el equipo su energía cuando debe escoger prioridades?',options:[
  'En fortalecer relaciones, desarrollar capacidades y sostener el bienestar colectivo.',
  'En anticiparse, generar alternativas y experimentar mejoras importantes.',
  'En satisfacer a los usuarios, cumplir objetivos y aumentar el impacto observable.',
  'En ordenar procesos, reducir errores y asegurar continuidad y calidad.'
 ]},
 {title:'Cómo se reconoce el éxito',prompt:'¿Qué hechos hacen que se diga “este equipo está funcionando bien”?',options:[
  'Que las personas crecen, colaboran y se sienten comprometidas con el equipo.',
  'Que surgen soluciones originales y el equipo aprende mientras innova.',
  'Que se cumplen los resultados comprometidos y los usuarios reciben valor.',
  'Que el trabajo se entrega con calidad, estabilidad y coordinación confiable.'
 ]}
];
window.CVF_SOURCE='https://www.ocai-official.com/about-ocai';
