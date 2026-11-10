# Laboratorio de Aprendizaje y Decisión

Hub de simuladores del **Laboratorio de Aprendizaje y Decisión**. Diseño oscuro y azul eléctrico.

## Ejecutar

Abre `index.html` con servidor HTTP o publícalo con GitHub Pages desde la rama `main`, raíz `/`.

La publicación bajo HACERLO está en **https://www.hacerlofc.com/laboratorio/**. Los archivos públicos de este repositorio (`.html`, `.css`, `.js` y `.mjs`, sin tests) también se publican en la carpeta `laboratorio/` del repositorio `PaginaHacerlo`. Al actualizar un simulador, sincroniza allí exactamente los mismos archivos para mantener ambas publicaciones. La página comercial y el dominio principal conservan su configuración. Los enlaces de sala se generan con el dominio desde el que se abre SaberON.

## El botón rojo — Decisiones laborales (noviembre de 2026)

Experiencia independiente en **boton-rojo.html**, **boton-rojo.css** y **boton-rojo.js**, integrada al catálogo de experiencias sin modificar SaberON u otros simuladores. También se publica bajo https://www.hacerlofc.com/laboratorio/boton-rojo.html.

**Recorrido:** El facilitador inicia sesión con su cuenta de Firebase Authentication que tenga la autorización de facilitador, crea una sala, comparte el enlace o QR y abre la primera ronda. Cada estudiante escribe su nombre, responde una situación laboral con una de cuatro alternativas y confirma. La decisión inicial es inmutable. Cuando el facilitador revela la información adicional, cada persona responde nuevamente y puede añadir una reflexión de hasta 150 caracteres. El facilitador cierra la fase, avanza a la siguiente ronda y, tras cuatro rondas, revela los resultados colectivos sin nombres. La sala no avanza automáticamente por un temporizador.

**Casos:** 1) resultados de productividad y fallas del sistema, 2) ausencia y urgencia médica, 3) uso personal de un equipo con autorización previa, 4) negativa a ejecutar una instrucción con advertencia de riesgo de seguridad. El objetivo es reconsiderar decisiones a partir de información nueva, no asignar automáticamente aciertos o infracciones jurídicas.

**Datos y controles:**
- La colección **boton_rojo_rooms** contiene salas separadas; cada una tiene subcolecciones **participants** y **answers**. Las respuestas son documentos inmutables identificados por persona, ronda, fase y token de reapertura.
- La sala usa actualizaciones de Firestore en tiempo real, con presencia aproximada por última actividad. El facilitador ve asistentes, pendientes, distribución de A/B/C/D, cambios individuales y transiciones. La reconexión de la misma sesión de autenticación recupera su avance.
- El facilitador puede pausar, reanudar, confirmar el avance con pendientes y reabrir **la fase final de la ronda actual** antes de avanzar. Reabrir genera nuevas respuestas sin destruir las anteriores; el informe usa la versión más reciente por persona y fase.
- La pestaña **Resultados e informe** recompone el historial guardado dentro de la plataforma, sin puntuaciones automáticas, e incorpora orientaciones didácticas sobre los artículos 58, 60 y 115 del CST. La proyección colectiva es anónima; los registros nominales quedan en la vista privada del facilitador.

**Configuración obligatoria antes de utilizarla en vivo:** Publicar en Firebase Console el archivo completo [firestore.rules](./firestore.rules), que añade reglas estrictas del nuevo módulo a las colecciones existentes. Verificar que el proyecto Firebase tenga activados los proveedores de Auth **Anónimo** y **Correo/Contraseña**, y que el docente autorizado conserve la autorización **facilitator: true**. Publicar código en GitHub **no publica las reglas de Firestore**. Prueba el acceso de 11 participantes, la secuencia de dos decisiones, el cierre y la generación del informe antes de utilizarlo en clase.

## Quiz: modalidad dirigida y autónoma

SaberON (`knowledge.html`) conserva las partidas dirigidas: el facilitador abre y cierra preguntas y revela resultados. Las salas anteriores mantienen esa modalidad y sus 60 segundos por pregunta.

Para enviar un instrumento que cada persona responda a su ritmo:

1. En **Facilitador**, crea una nueva partida y elige **Autónoma: compartir instrumento**. Esta modalidad no tiene límite de tiempo por pregunta ni para todo el quiz; no necesita configurar temporizadores. La modalidad dirigida conserva su límite por pregunta.
2. Abre **Banco de preguntas**, elige o importa el banco y aplica la selección de preguntas.
3. Pulsa **Habilitar instrumento → Copiar enlace**. El enlace identifica esa partida concreta, aunque después se cree otra para la misma clase.
4. Cada persona ingresa su nombre o cédula, según la configuración de la sala, y pulsa **Comenzar quiz**. La rapidez de la primera pregunta se registra desde ese momento; en las siguientes se registra desde que se guardó la respuesta anterior, incluyendo la espera antes de pulsar **Siguiente pregunta**. Esto se explica antes de comenzar y se recuerda entre preguntas. No necesita que el facilitador permanezca conectado.
5. El panel del facilitador muestra avance, aciertos, puntos y ranking en vivo. Los participantes ven el ranking según la opción elegida para esa sala. **Cerrar instrumento** detiene nuevas respuestas; reabrir conserva los avances y los tiempos registrados.

En la modalidad autónoma, un acierto da de **1 a 10 puntos**: 10 en los primeros seis segundos y un punto menos por cada tramo adicional de seis segundos, con un mínimo de 1. Un error da **0 puntos**. No se rechazan respuestas ni se cierran intentos por tardanza. El ranking se ordena por puntos, luego por cantidad de aciertos y menor tiempo acumulado en todas las respuestas, incluyendo las esperas entre preguntas. La posición es provisional mientras otras personas continúan respondiendo.

El inicio del intento y la última respuesta se guardan con marcas de tiempo de Firestore en el documento del participante. Recargar, salir o abrir otra pestaña conserva el tiempo transcurrido que cuenta para el ranking. Los antiguos límites de tiempo almacenados ya no se aplican a la modalidad autónoma; los resultados que ya estaban guardados se conservan. Las transacciones evitan guardar dos respuestas para una misma pregunta. Las preguntas quedan fijas después de habilitar el instrumento; para cambiarlas se crea una nueva partida o se usa el reinicio explícito. Reiniciar conserva el nombre de la clase, el banco y la modalidad, borra los resultados de esa partida e invalida los intentos anteriores.

**Ingreso y configuración de participantes (noviembre de 2026):**

- El inicio y las pantallas de respuesta usan un fondo azul noche, tarjetas de respuestas con letras e indicadores de avance. **Entrar al quiz** es la acción principal; **Facilitador** queda discreto en la esquina superior derecha. Las herramientas administrativas mantienen su tema claro.
- Al abrir o recargar `knowledge.html`, incluso con un enlace o una sesión guardada, se muestra el inicio. La sesión anterior solo se recupera al pulsar **Continuar mi quiz**. **Volver al inicio** y **Facilitador** detienen los listeners del participante para evitar que una actualización de la partida vuelva a abrir esa pantalla.
- En ambas modalidades, al crear una partida o en **Experiencia de participantes**, el facilitador elige **Durante el quiz y al finalizar**, **Solo al finalizar** o **No mostrar**. El facilitador siempre conserva el ranking. La visibilidad puede modificarse en una partida ya habilitada sin cambiar respuestas ni puntajes. Al ocultarlo se vacían las filas, se oculta la posición individual y se detiene la suscripción al ranking del participante.
- En la modalidad autónoma, **Solo al finalizar** muestra el ranking cuando esa persona completa todas las preguntas; la posición puede cambiar mientras otras personas responden. En la dirigida se muestra al revelar la última pregunta de la selección, aunque se haya cambiado su orden.
- **Comparte el acceso a esta sala** muestra un QR mediano (180 × 180 px), **Copiar enlace** y **Abrir sala** en ambas modalidades. El QR y el enlace fijan la misma partida concreta y ocultan el campo de código en el ingreso. El acceso general conserva la alternativa de escribir el código. En la modalidad autónoma, el QR y el enlace se habilitan después de publicar el instrumento.
- **Dato para ingresar** permite elegir **Nombre**, **Cédula: solo números** o **Nombre y cédula**, tanto al crear la sala como en **Experiencia de participantes**. La tercera opción pide dos campos y muestra el nombre en todos los rankings. Se determina a partir de la sala y se conserva al reabrirla. La cédula rechaza espacios, puntos, signos, letras y saltos de línea; los nombres admiten espacios. El tipo queda fijo desde la primera inscripción para conservar la recuperación de sesiones.
- **Firebase guarda la cédula completa y el nombre cuando se solicitan ambos**, en `gc_quiz_live/{partida}/identities/{participante}` (campos `cedula`, `name`, `identityType`). La cédula se guarda como texto para conservar ceros iniciales. En **Cédula** se guarda el número y el nombre queda vacío, porque no se solicita; en **Nombre** se guarda el nombre en `players`. Los registros completos solo pueden consultarlos los facilitadores autenticados. No se copian cédulas completas al ranking ni a la sesión local. La inscripción y la identidad se escriben juntas; si no se puede guardar la identidad, no se crea una inscripción incompleta.
- La recuperación conserva una huella SHA-256 específica de la partida. En **Cédula** el ranking muestra una etiqueta con los últimos cuatro dígitos; en **Nombre y cédula** muestra el nombre. Volver a ingresar la misma cédula recupera el mismo participante y su puntaje, aunque se escriba un nombre diferente. Los registros anteriores sin cédula completa se completan cuando esa persona vuelve a ingresar; no se pueden reconstruir números que antes solo se guardaron como huella. Las personas con el mismo nombre y distinta cédula tienen participaciones separadas. Es un identificador pedagógico, sin verificación de identidad ni garantía de autenticación.

**Antes de publicar esta actualización de SaberON:** desplegar las reglas de `identities` incluidas en `firestore.rules`. Publicar GitHub no actualiza los permisos de Firebase. El borrado de salas y participantes también elimina sus identidades privadas; reiniciar puntajes conserva los datos de identificación.

**Descargar respuestas:** en el panel de cada partida, junto a **Mis salas / nueva partida**, el facilitador encuentra **Descargar respuestas**. Genera un CSV para Excel con todas las personas inscritas, no solo el Top 10, y una fila por pregunta, incluidas las no respondidas. Contiene sala, partida, modalidad, nombre, cédula completa cuando se guardó, fecha de ingreso en hora de Colombia, pregunta, opción y respuesta elegidas, respuesta correcta, acierto, tiempo y puntajes registrados. Usa las preguntas guardadas en la partida y conserva las respuestas que quedaron fuera de la selección actual; si la pregunta no está disponible o el registro corresponde a un intento anterior, lo indica sin inventar el texto. En la modalidad dirigida señala los puntajes pendientes de revelar. Los registros antiguos sin cédula completa se exportan con ese dato vacío y se informa la cantidad.

La descarga verifica la sesión y el rol de facilitador y lee `players` e `identities` de la partida elegida directamente del servidor. Si falta permiso o conexión, no produce una descarga parcial. No modifica respuestas ni puntajes. El archivo tiene UTF-8 con BOM, separador `;` y encabezado `sep=;` para Excel. Las cédulas numéricas se representan como literales de texto controlados para conservar ceros iniciales y dígitos largos; los demás textos se protegen frente a fórmulas de hoja de cálculo. **Exportar CSV**, dentro del banco de preguntas, sigue descargando únicamente las preguntas.

**Eliminar salas:** en **Facilitador → Mis salas**, cada sala tiene **Eliminar sala**. La confirmación identifica la sala y la cantidad de partidas que se borrarán. Requiere una sesión con rol de facilitador; elimina también partidas históricas que ya no figuren en el historial limitado a 100 entradas, sus participantes, respuestas y tableros públicos accesibles. Los bancos de preguntas y otras salas se conservan. Primero se bloquea el ingreso y la creación de partidas en esa sala; las inscripciones usan una transacción para impedir registros durante el borrado. Las operaciones se dividen en lotes de hasta 400. Si la conexión se interrumpe, la sala queda con **Reintentar eliminación**, sin perder las referencias necesarias para continuar. Cuando Firebase no permite consultar o borrar la subcolección pública de ranking, se elimina la información accesible y se informa expresamente de esa limitación. La app no afirma haber borrado esos tableros restringidos.

Las pantallas y los créditos de todos los simuladores usan **Laboratorio de Aprendizaje y Decisión**. Las preguntas y respuestas de SaberON emplean una tipografía más ligera, conservando contraste y legibilidad.

La implementación usa las colecciones existentes `gc_quiz_live` y `gc_quiz_banks`, sin agregar colecciones, índices ni cambios a `firestore.rules`. Conserva el modelo de confianza del quiz pedagógico: no convierte los puntajes calculados en el navegador en una evaluación protegida contra manipulación.

Validación local sin credenciales ni escrituras a producción: `node --test tests/quiz-*.test.mjs`. La comprobación automática **Validar modalidades del quiz** ejecuta esos casos en GitHub Actions.

Experiencias: **Talento & Riesgo**, **SaberON**, **Las reglas del juego** (Ultimátum y Empresa en crisis), **Proyecto NEXUS**, **El Flaco** y **SATURNO**.

- Talento & Riesgo Lab v2 es una **competencia por equipos en una misma sala**: 8 escenarios (legislación y formación, ascensos, movilidad laboral y dilemas de desarrollo), presupuesto y métricas acumuladas, consecuencias diferidas, ranking en tiempo real y descarga CSV para el facilitador. Incluye modo práctica individual sin servidor.
- SATURNO funciona en el navegador y guarda el progreso localmente.
- SaberON, Las reglas del juego, El Flaco y **Proyecto NEXUS** utilizan Firebase Authentication y Firestore. NEXUS ya no depende de Supabase.
- Estudiantes ingresan mediante nombre y código de sala según cada experiencia.
- El acceso de facilitadores utiliza Firebase Authentication con correo y contraseña y el rol `facilitator: true`. No se guardan contraseñas en el código público.

## Radar de Cultura de Equipos — adaptación CVF / OCAI

**Corrección verificada de permisos (29/10/2026).** El primer intento con reglas largas fue rechazado por el límite de 1.000 expresiones evaluadas por solicitud de Firestore, confirmado en el emulador (error `PERMISSION_DENIED`). Se optimizó `cvfRow` para revisar las cuatro puntuaciones no negativas que suman 100, sin repetir validaciones costosas. La interfaz sigue exigiendo enteros entre 0 y 100. GitHub Actions [Validar reglas Radar de Cultura](./.github/workflows/validate-cvf-rules.yml) verifica automáticamente que el envío de las 12 distribuciones se autorice y que se bloqueen duplicados, identidades ajenas, equipos inexistentes y sumas incorrectas. **La prueba terminó correctamente:** [Ejecución de validación](https://github.com/santiagoleonlopezs-png/Laboratorio_De_Aprendizaje/actions/runs/40828300555). Para usarlo en producción es obligatorio **publicar manualmente `firestore.rules` en Firebase** o configurar un despliegue autorizado: el repositorio no dispone de conexión para desplegar reglas directamente. No cargar datos personales en los tests.



El nuevo instrumento está en [`cultura-cvf.html`](./cultura-cvf.html), accesible desde el hub.

**Metodología.** Adaptación educativa independiente, con textos originales, del Marco de Valores en Competencia de Cameron y Quinn. Mantiene seis dimensiones: identidad dominante, liderazgo, gestión de las personas, vínculo, énfasis estratégico y criterios de éxito. En cada una la persona reparte **100 puntos** entre cuatro orientaciones —Clan/Colaborar, Adhocracia/Crear, Mercado/Lograr y Jerarquía/Organizar— para **Hoy** y otros **100 puntos** para la cultura **Deseada**. Se promedian los seis puntajes de cada tipo (puntuaciones ipsativas) y luego se calcula el promedio simple de los perfiles individuales de cada equipo. No es el instrumento oficial OCAI™ ni debe anunciarse como una aplicación psicométrica validada o autorizada.

**Participantes.** Entran con código y eligen un equipo de los definidos por el facilitador, sin solicitar nombres, documentos, correo, fecha de nacimiento o datos sensibles. Reciben su mapa actual/deseado, interpretación de las brechas, seis dimensiones y recomendaciones prácticas conectadas con el perfil deseado. Tras publicar el facilitador, pueden consultar también un agregado de su equipo si hay al menos 3 respuestas. Pueden experimentar antes en modo práctica sin enviar datos.

**Facilitador.** Requiere Firebase Auth con custom claim `facilitator: true`. Crea una sala con equipos predefinidos, comparte código, observa respuestas agregadas por equipo y total (mínimo 3), compara perfiles actuales y deseados, observa brechas y propuestas conductuales; puede cerrar/reabrir recepción, exportar promedios a CSV y publicar un resumen grupal consultable por participantes. No visualiza respuestas identificadas en la interfaz. Una sola respuesta por UID anónimo y sala.

**Firebase.** El archivo [`FIRESTORE_CULTURA_CVF.rules`](./FIRESTORE_CULTURA_CVF.rules) contiene las reglas del módulo. Están integradas en [`firestore.rules`](./firestore.rules), junto con las de los demás simuladores. Se deben **publicar manualmente** en Firebase Console tras revisar su compatibilidad con las reglas activas: GitHub no modifica la base de datos. Las respuestas viven en `ocai_rooms/{codigo}/responses/{auth.uid}`; el agregado publicado, en `ocai_rooms/{codigo}/summary/public`. El facilitador puede consultar respuestas para calcular el promedio, y solo publica agregados con tamaño mínimo de grupo de 3. En el frontend no se importan ni publican las bases de personal que pudieran adjuntarse accidentalmente.

Fuentes de referencia metodológica: https://www.ocai-official.com/about-ocai y https://www.ocai-official.com/intro-to-cvf. Para usar el **cuestionario oficial OCAI™** se deben verificar las condiciones de licencia con Cameron Institute.

## NEXUS — Controles para sesiones dirigidas (noviembre de 2026)

En la modalidad **Dirigida por rondas**, el panel **Control de rondas** permite: **Abrir ronda** (la habilita), **Cerrar ronda y conversar** (pausa nuevas decisiones), **Reabrir ronda** (recibe respuestas de equipos pendientes, sin borrar decisiones ya confirmadas), **Avanzar a la siguiente** (la deja *preparada*, el facilitador debe abrirla) y **Finalizar experiencia** al cerrar la quinta ronda. Las salas antiguas en fase de decisión se pueden cerrar sin reiniciarlas.

En la tabla de ranking el facilitador propietario puede **Retirar** un equipo: se borran sus decisiones y su posición; el equipo queda impedido de reincorporarse a esa generación de la sala. **Reiniciar a todos** elimina los documentos de equipos y ranking, restablece ronda 1 y crea una nueva generación con el **mismo código**. Requiere escribir REINICIAR para confirmar. Ante una interrupción de red durante un reinicio, **Completar reinicio** permite continuar; mientras tanto, los envíos permanecen bloqueados. Los participantes vuelven a la pantalla de ingreso y pueden empezar desde cero tras el reinicio. El reinicio es destructivo; guarda antes lo que necesites del historial.

Las decisiones ya registradas se mantienen inmutables al reabrir una ronda; solo los equipos que aún no hayan decidido pueden responder. No se aplica una reapertura retrospectiva después de avanzar a otra ronda.

**Requisitos de Firebase:** publicar el archivo completo y actualizado de [firestore.rules](./firestore.rules) en Firebase Console. Las reglas permiten al facilitador propietario retirar equipos, gestionar el reinicio y controlar el acceso por generación de sala. Sin publicar las reglas, los botones de administración pueden producir errores de permisos. GitHub no publica automáticamente las reglas en Firebase. Conserva Authentication Anónimo (equipos) y Correo/Contraseña con el claim facilitator para el facilitador.

## Proyecto NEXUS — Firebase y financiación (31/10/2026)

Se conservaron las cinco rondas y las 15 intervenciones. NEXUS usa ahora el mismo proyecto Firebase `simuladores-juegos` que los demás módulos, sin conectarse a Supabase.

- **Facilitador:** cuenta de Firebase Auth (Correo/Contraseña) con custom claim `facilitator: true`. Abre el panel, ingresa un código de clase (p. ej., `LID-CAMBIO`), pulsa **CREAR SALA** y comparte el código. El tablero muestra puntaje, deuda e historial de decisiones en tiempo real.
- **Equipos:** acceden con código y nombre ficticio usando Firebase Auth anónimo. Los registros privados (hipótesis, métricas, historial) se guardan en `nexus_rooms/{codigo}/teams/{uid}`. La clasificación compartida (`ranking/{uid}`) almacena solo nombre, puntaje, ronda y deuda. Ambos registros se guardan en una operación atómica.
- **Préstamos:** bolsa inicial de **120 créditos**. Si un equipo necesita más, puede solicitar financiación en bloques de 20 créditos, automáticamente al escoger una intervención costosa o con el botón **SOLICITAR +20 CRÉDITOS**. El comité simulado aprueba el préstamo: el juego continúa, la deuda se muestra en rojo y resta **0,4 puntos por crédito** al ranking (hasta un máximo de 50 puntos). Ejemplo: 40 créditos prestados penalizan 16 puntos.
- **Puntaje:** indicador base = media de las siete dimensiones de cambio y el KPI de negocio. Clasificación = indicador base menos penalización de deuda (sin bajar de cero).
- **Activación pendiente del usuario:** reemplazar las reglas actuales de **Firebase Console → Firestore Database → Reglas** por el archivo unificado [`firestore.rules`](./firestore.rules), y pulsar **Publicar**. GitHub no actualiza las reglas activas. Deben estar habilitados los proveedores **Anónimo** y **Correo/Contraseña** y autorizado el dominio de GitHub Pages.
- **Migración de históricos:** los registros antiguos de Supabase no se importan automáticamente. El progreso local de un navegador se puede recuperar al entrar por primera vez con el mismo nombre y código. Para migrar datos históricos de Supabase se requiere exportación autorizada.

Los puntajes se generan en el navegador con fines pedagógicos. No son adecuados como resultados a prueba de manipulación para concursos con premios sin liquidación en servidor.

## Talento & Riesgo Lab V2.3 — bitácora de decisiones para el facilitador

Sin cambiar las partidas, los puntajes o las reglas de acceso existentes, el facilitador propietario dispone de un **resumen para conversar sobre las decisiones de sus equipos**:

- Acceso desde el lateral de su sala y después del debriefing y del ranking final. No se presenta a los participantes.
- **Por ronda cerrada:** distribución de estrategias (cantidades y porcentajes), nivel de participación, aciertos normativos, decisiones que elevaron el riesgo, norma más pertinente y preguntas de reflexión contextualizadas.
- **Por equipo:** alternativa estratégica elegida, fundamento/efecto pedagógico, norma que seleccionó, descripción, corrección y puntos de esa ronda, costo y consecuencias diferidas.
- **Consolidado:** comparación transversal de equipos, aciertos, omisiones y puntos; se puede desplegar el historial por equipo para volver a las ocho decisiones.
- **Exportar bitácora CSV:** una fila por equipo y ronda cerrada, con las decisiones y consecuencias explicadas, lista para analizar posteriormente.
- Todo se reconstruye con el campo `history` que ya guardan los equipos en `talento_lab_rooms/{codigo}/teams/{uid}`; no se crean colecciones nuevas ni se requieren permisos adicionales en Firebase. La bitácora comienza a llenarse cuando el facilitador **cierra y liquida** cada ronda. Reiniciar la partida o eliminar un equipo elimina su historial correspondiente, de acuerdo con el funcionamiento previo.
- Los casos y las referencias legales son orientaciones didácticas. No sustituyen una valoración jurídica individualizada.

## Talento & Riesgo Lab V2.2 — siete minutos por ronda

- **Cada ronda nueva dura exactamente 7 minutos (420 segundos), sin selector de duración.** Ese tiempo único incluye la decisión estratégica y la selección de la referencia normativa.
- El contador `07:00` se sincroniza usando `roundStartedAt` (marca de tiempo Firestore) y `roundDurationSec: 420`. Reconectarse o recargar no reinicia la cuenta. Las rondas antiguas ya iniciadas conservan el límite con el que comenzaron y las siguientes usan 7 minutos.
- En los últimos 30 segundos el contador cambia de color; a `00:00` se bloquean las respuestas. El cálculo existente penaliza a equipos que no enviaron ambas decisiones.
- Si el facilitador mantiene abierto su panel, el vencimiento provoca el cierre y la revelación automática cuando hay equipos inscritos; si el panel está cerrado, la publicación queda pendiente hasta recuperarlo o cerrar manualmente.
- El archivo `firestore.rules` limita nuevas respuestas según `request.time` y el tiempo almacenado en la sala, incluso si se manipula el reloj del navegador. **Publicar en GitHub no actualiza automáticamente las reglas de Firebase.**
- Se preservan los ocho casos, la selección jurídica, el ranking por sala, las consecuencias diferidas, el modo práctica, la eliminación de equipos y el reinicio de partida.

## Talento & Riesgo Lab V2.1 — desafíos normativos (octubre 2026)

Se preserva el juego anterior: ocho rondas, presupuesto, cinco indicadores, efectos acumulados y diferidos, salas independientes, modo práctica, ranking en vivo y CSV.

- En **cada ronda**, además de escoger la estrategia organizacional, el equipo lee un microtexto y elige el **marco jurídico más pertinente** entre tres opciones, cada una con breve descripción. Ambas selecciones son obligatorias y se envían juntas.
- **Identificación jurídica acertada:** +25 puntos al consolidado de la ronda y −4 unidades de exposición jurídica. **Incorrecta u omitida:** −15 puntos y +7 de exposición jurídica. La elección empresarial sigue generando sus propios resultados y costos; acertar la norma no vuelve lícita una decisión problemática.
- Después de cerrar la ronda, el debriefing revela la referencia, una explicación y un enlace a su fuente oficial. El facilitador ve las respuestas y bonificaciones de cada equipo.
- En el panel del facilitador, **Eliminar equipo** retira solo ese equipo tras una confirmación. **Reiniciar partida** vuelve al lobby y restablece a cero puntajes, riesgos, presupuesto y respuestas, **conservando sala y equipos**. Se requiere ser el facilitador propietario.
- El CSV exporta número de aciertos normativos y total de puntos normativos, además del historial de elecciones por ronda.
- El archivo `talento-normas.js` contiene las lecturas y referencias de los ocho episodios. Se trata de un recurso didáctico, no asesoría legal ni un mecanismo antifraude: al ser una web estática, los datos públicos de los casos pueden inspeccionarse en el navegador. Si se requiere evaluación sumativa controlada, la validación de respuestas debe migrarse a un backend confiable.
- **IMPORTANTE:** el archivo `firestore.rules` se actualizó para permitir guardar `legalChoice` por los equipos. **Debes publicar manualmente las reglas unificadas en Firebase** antes de competir en salas. La subida a GitHub no modifica reglas ya desplegadas.

## Talento & Riesgo Lab v2: habilitación multijugador

1. En Firebase Authentication habilita proveedores **Correo/Contraseña** (facilitadores) y **Anónimo** (equipos). Verifica que el dominio de GitHub Pages figure en **Authorized domains**.
2. Asigna el atributo de autorización `facilitator: true` a la cuenta docente usando **Firebase Admin SDK** en un entorno confiable; la interfaz exige el atributo.
3. Abre [`firestore.rules`](./firestore.rules), el **archivo completo y unificado** construido con las reglas anteriores proporcionadas para este proyecto y el bloque de Talento & Riesgo. En Firebase Console → Firestore Database → **Reglas**, reemplaza el contenido del editor por el contenido íntegro de `firestore.rules` (no pegues el fragmento además: duplicaría las reglas). El archivo [`FIRESTORE_TALENTO_LAB.rules`](./FIRESTORE_TALENTO_LAB.rules) se conserva solo como referencia del módulo nuevo. Antes de publicar, comprueba que las reglas activas de Firebase no hayan cambiado desde la versión suministrada para la integración.
4. Haz clic en **Publicar** en Firebase y comprueba la creación de una sala y la inscripción de un equipo. **Subir el archivo a GitHub no cambia las reglas activas de Firebase.**
5. El facilitador crea una sala, comunica el código de seis caracteres, cada equipo entra desde un dispositivo y una identidad de autenticación anónima persistente; al cerrar una ronda se asignan los puntajes y se actualiza el ranking. Si el equipo cambia de navegador o borra sus datos locales no recuperará la identidad automáticamente.
6. Para juego competitivo con premios o calificaciones de alta integridad, traslada la liquidación de puntajes del navegador del facilitador a Cloud Functions o un servidor confiable. Este MVP usa resultados pedagógicos calculados en el cliente autorizado.

## Configuración obligatoria antes de sesiones grupales

**La autenticación desde la interfaz no es una autorización completa.** Configura y publica las reglas reales de Firestore antes de iniciar sesiones con participantes:

1. Crear cuentas de facilitador; en Firebase Auth asignar **custom claim** `facilitator: true` con Admin SDK desde un entorno confiable, nunca mediante código público.
2. Proteger las escrituras de facilitador en Firestore por `request.auth.token.facilitator == true` **y** propiedad/rol de la sala, y limitar al estudiante a su propio registro o decisiones autorizadas. No utilizar reglas universales `allow write: if true`.
3. En NEXUS, mantener privados los registros completos de `teams` y separados del `ranking` compartido. No confiar solo en verificaciones JavaScript.
4. Verificar autenticación, ingreso de participantes, acceso a sala y ranking antes de usar en una clase real.
5. Revisar los datos de prueba y las reglas existentes. **Las reglas se deben publicar manualmente en Firebase Console**.

Las claves web de Firebase son claves *públicas de cliente*, no credenciales administrativas. Nunca colocar claves privadas, credenciales de administrador ni secretos en este repositorio.

© 2026 Laboratorio de Aprendizaje y Decisión. Todos los derechos reservados.

