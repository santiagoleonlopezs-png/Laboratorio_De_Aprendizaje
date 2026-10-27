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
