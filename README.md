# Laboratorio de Aprendizaje y Decisión

Hub de simuladores de **Santiago León López**. Diseño oscuro y azul eléctrico.

## Ejecutar

Abre `index.html` con servidor HTTP o publícalo con GitHub Pages desde la rama `main`, raíz `/`.

Experiencias: **Talento & Riesgo**, **Knowledge Challenge**, **Las reglas del juego** (Ultimátum y Empresa en crisis), **Proyecto NEXUS**, **El Flaco** y **SATURNO**.

- Talento & Riesgo Lab v2 es una **competencia por equipos en una misma sala**: 8 escenarios (legislación y formación, ascensos, movilidad laboral y dilemas de desarrollo), presupuesto y métricas acumuladas, consecuencias diferidas, ranking en tiempo real y descarga CSV para el facilitador. Incluye modo práctica individual sin servidor.
- SATURNO funciona en el navegador y guarda el progreso localmente.
- Knowledge Challenge, Las reglas del juego y El Flaco utilizan Firebase; NEXUS usa Supabase.
- Estudiantes ingresan mediante nombre y código de sala según cada experiencia.
- El acceso de facilitadores se autentica mediante correo y contraseña (Firebase Auth o Supabase Auth). Ya no hay contraseñas de facilitador escritas en el código público.

## Radar de Cultura de Equipos — adaptación CVF / OCAI

**Corrección verificada de permisos (29/10/2026).** El primer intento con reglas largas fue rechazado por el límite de 1.000 expresiones evaluadas por solicitud de Firestore, confirmado en el emulador (error `PERMISSION_DENIED`). Se optimizó `cvfRow` para revisar las cuatro puntuaciones no negativas que suman 100, sin repetir validaciones costosas. La interfaz sigue exigiendo enteros entre 0 y 100. GitHub Actions [Validar reglas Radar de Cultura](./.github/workflows/validate-cvf-rules.yml) verifica automáticamente que el envío de las 12 distribuciones se autorice y que se bloqueen duplicados, identidades ajenas, equipos inexistentes y sumas incorrectas. **La prueba terminó correctamente:** [Ejecución de validación](https://github.com/santiagoleonlopezs-png/Laboratorio_De_Aprendizaje/actions/runs/40828300555). Para usarlo en producción es obligatorio **publicar manualmente `firestore.rules` en Firebase** o configurar un despliegue autorizado: el repositorio no dispone de conexión para desplegar reglas directamente. No cargar datos personales en los tests.



El nuevo instrumento está en [`cultura-cvf.html`](./cultura-cvf.html), accesible desde el hub.

**Metodología.** Adaptación educativa independiente, con textos originales, del Marco de Valores en Competencia de Cameron y Quinn. Mantiene seis dimensiones: identidad dominante, liderazgo, gestión de las personas, vínculo, énfasis estratégico y criterios de éxito. En cada una la persona reparte **100 puntos** entre cuatro orientaciones —Clan/Colaborar, Adhocracia/Crear, Mercado/Lograr y Jerarquía/Organizar— para **Hoy** y otros **100 puntos** para la cultura **Deseada**. Se promedian los seis puntajes de cada tipo (puntuaciones ipsativas) y luego se calcula el promedio simple de los perfiles individuales de cada equipo. No es el instrumento oficial OCAI™ ni debe anunciarse como una aplicación psicométrica validada o autorizada.

**Participantes.** Entran con código y eligen un equipo de los definidos por el facilitador, sin solicitar nombres, documentos, correo, fecha de nacimiento o datos sensibles. Reciben su mapa actual/deseado, interpretación de las brechas, seis dimensiones y recomendaciones prácticas conectadas con el perfil deseado. Tras publicar el facilitador, pueden consultar también un agregado de su equipo si hay al menos 3 respuestas. Pueden experimentar antes en modo práctica sin enviar datos.

**Facilitador.** Requiere Firebase Auth con custom claim `facilitator: true`. Crea una sala con equipos predefinidos, comparte código, observa respuestas agregadas por equipo y total (mínimo 3), compara perfiles actuales y deseados, observa brechas y propuestas conductuales; puede cerrar/reabrir recepción, exportar promedios a CSV y publicar un resumen grupal consultable por participantes. No visualiza respuestas identificadas en la interfaz. Una sola respuesta por UID anónimo y sala.

**Firebase.** El archivo [`FIRESTORE_CULTURA_CVF.rules`](./FIRESTORE_CULTURA_CVF.rules) contiene las reglas del módulo. Están integradas en [`firestore.rules`](./firestore.rules), junto con las de los demás simuladores. Se deben **publicar manualmente** en Firebase Console tras revisar su compatibilidad con las reglas activas: GitHub no modifica la base de datos. Las respuestas viven en `ocai_rooms/{codigo}/responses/{auth.uid}`; el agregado publicado, en `ocai_rooms/{codigo}/summary/public`. El facilitador puede consultar respuestas para calcular el promedio, y solo publica agregados con tamaño mínimo de grupo de 3. En el frontend no se importan ni publican las bases de personal que pudieran adjuntarse accidentalmente.

Fuentes de referencia metodológica: https://www.ocai-official.com/about-ocai y https://www.ocai-official.com/intro-to-cvf. Para usar el **cuestionario oficial OCAI™** se deben verificar las condiciones de licencia con Cameron Institute.

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

**La autenticación desde la interfaz no es una autorización completa.** Configura las reglas reales de Firestore y las políticas RLS de Supabase antes de cargar información o iniciar sesiones con participantes:

1. Crear cuentas de facilitador; en Firebase Auth asignar **custom claim** `facilitator: true` con Admin SDK desde entorno confiable. En Supabase Auth asignar `app_metadata.facilitator: true` con privilegios de administrador del lado servidor; **nunca** mediante código público o user_metadata.
2. Proteger las escrituras de facilitador en Firestore por `request.auth.token.facilitator == true` **y** propiedad/rol de la sala, y limitar al estudiante a su propio registro o decisiones autorizadas. No utilizar reglas universales `allow write: if true`.
3. En Supabase activar RLS en `change_leadership_scores` y `change_leadership_decisions` y aplicar políticas por sala, rol y propiedad. No confiar en verificaciones exclusivas de JavaScript.
4. Verificar autenticación, ingreso de participantes, acceso a sala y ranking antes de usar en una clase real.
5. Revisar los datos de prueba ya persistidos y las reglas existentes del backend. **No se han configurado los permisos en Firebase ni en Supabase mediante este repositorio**.

Las claves web de configuración Firebase y la `sb_publishable_...` de Supabase son claves *públicas de cliente* (no service-role). No colocar nunca API keys privadas, credenciales de administrador ni secretos en este repositorio.

© 2026 Santiago León López. Todos los derechos reservados.
