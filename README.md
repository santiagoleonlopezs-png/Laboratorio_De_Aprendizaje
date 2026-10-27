# Laboratorio de Aprendizaje y Decisión

Hub de simuladores de **Santiago León López**. Diseño oscuro y azul eléctrico.

## Ejecutar

Abre `index.html` con servidor HTTP o publícalo con GitHub Pages desde la rama `main`, raíz `/`.

Experiencias: **Talento & Riesgo**, **Knowledge Challenge**, **Las reglas del juego** (Ultimátum y Empresa en crisis), **Proyecto NEXUS**, **El Flaco** y **SATURNO**.

- Talento & Riesgo y SATURNO funcionan en el navegador.
- Knowledge Challenge, Las reglas del juego y El Flaco utilizan Firebase; NEXUS usa Supabase.
- Estudiantes ingresan mediante nombre y código de sala según cada experiencia.
- El acceso de facilitadores se autentica mediante correo y contraseña (Firebase Auth o Supabase Auth). Ya no hay contraseñas de facilitador escritas en el código público.

## Configuración obligatoria antes de sesiones grupales

**La autenticación desde la interfaz no es una autorización completa.** Configura las reglas reales de Firestore y las políticas RLS de Supabase antes de cargar información o iniciar sesiones con participantes:

1. Crear cuentas de facilitador; en Firebase Auth asignar **custom claim** `facilitator: true` con Admin SDK desde entorno confiable. En Supabase Auth asignar `app_metadata.facilitator: true` con privilegios de administrador del lado servidor; **nunca** mediante código público o user_metadata.
2. Proteger las escrituras de facilitador en Firestore por `request.auth.token.facilitator == true` **y** propiedad/rol de la sala, y limitar al estudiante a su propio registro o decisiones autorizadas. No utilizar reglas universales `allow write: if true`.
3. En Supabase activar RLS en `change_leadership_scores` y `change_leadership_decisions` y aplicar políticas por sala, rol y propiedad. No confiar en verificaciones exclusivas de JavaScript.
4. Verificar autenticación, ingreso de participantes, acceso a sala y ranking antes de usar en una clase real.
5. Revisar los datos de prueba ya persistidos y las reglas existentes del backend. **No se han configurado los permisos en Firebase ni en Supabase mediante este repositorio**.

Las claves web de configuración Firebase y la `sb_publishable_...` de Supabase son claves *públicas de cliente* (no service-role). No colocar nunca API keys privadas, credenciales de administrador ni secretos en este repositorio.

© 2026 Santiago León López. Todos los derechos reservados.
