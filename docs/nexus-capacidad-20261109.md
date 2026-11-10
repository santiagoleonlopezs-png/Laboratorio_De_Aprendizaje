# NEXUS: prueba aislada de concurrencia

Fecha local: 9 de noviembre de 2026, Medellín (Colombia).
Código del transporte y simulación evaluado: `4f431141afc507b818f3000e8df83a028669bb64`.

**Resultado práctico:** en este ensayo, 10 y 25 equipos completaron las cinco rondas con ranking completo en menos de 1,4 segundos. Con 50 equipos se conservaron las 250 decisiones, pero la propagación completa del ranking tardó hasta 8,48 segundos. Con 100 equipos hubo transacciones abortadas y no se completó el escenario; se repitió desde un emulador nuevo con el mismo tipo de fallo. El ensayo respalda un piloto inicial de hasta 25 dispositivos de equipo. No certifica ese número en producción ni establece el máximo de Firebase.

## Qué se ejecutó

- Firestore Emulator 1.19.8, proyecto exclusivo `demo-nexus-load`, en `127.0.0.1:8080`.
- Las reglas reales `firestore.rules`, sin abrir permisos ni modificarlas.
- El archivo real `nexus-firebase.js`: ingreso, documento privado del equipo, ranking público, transacciones, suscripciones y control de la sala.
- SDK Firebase 13.1.0 / rules-unit-testing 6.0.0 y Node 24.22.1. Las páginas publicadas cargan Firebase Compat 10.14.1, por lo que no se equiparan versiones ni tiempos de cliente.
- Clientes con identidades autenticadas de prueba independientes. Un facilitador con rol de prueba y cada equipo con su identidad propia. No se midió el proveedor real de autenticación.
- Cada equipo mantuvo un listener de ranking y otro de sala. El facilitador mantuvo el listener de equipos privados. Cinco rondas guiadas con envíos simultáneos en cada una, cierre para conversar y apertura de la siguiente.
- Decisiones generadas con los efectos y el cálculo de puntaje reales, con historial acumulado, predicciones, consecuencias y deuda cuando correspondía.
- Lectura final confirmada desde el servidor emulado, comprobando cinco decisiones por equipo e igualdad entre ranking y puntaje privado.
- Ninguna escritura ni solicitud de carga a la base de datos de producción.

## Resultados del servicio emulado

Los tiempos son el peor p95 observado entre las cinco rondas. El tiempo de ranking cuenta desde el inicio del envío simultáneo hasta que cada suscriptor ve la lista completa de puntajes de esa ronda; no es la latencia de una sola actualización.

| Equipos simultáneos | Decisiones verificadas | Guardado p95, máximo entre rondas | Ranking completo p95, máximo entre rondas | Resultado |
| ---: | ---: | ---: | ---: | --- |
| 10 | 50/50 | 0,50 s | 0,51 s | Cinco rondas sin errores |
| 25 | 125/125 | 1,03 s | 1,36 s | Cinco rondas sin errores |
| 50 | 250/250 | 3,56 s | 8,48 s | Íntegro, con demora visible |
| 100 | No se completó la primera ronda | No comparable | No convergió el escenario | `ABORTED: Transaction lock timeout` |

En la repetición independiente de 100 equipos se reprodujeron los bloqueos de transacción. Esto es un fallo de la prueba en ese entorno, no evidencia suficiente para atribuir un límite de 100 equipos al servicio real.

## Panel del facilitador

También se ejecutaron en Chromium diez renderizados por tamaño, con la función real del panel y cinco rondas de historia por equipo. Se midió creación de DOM y cálculo de layout con transporte simulado, por separado de la prueba del servicio emulado.

| Equipos cargados en el panel | Mediana por renderizado | Mayor tiempo observado |
| ---: | ---: | ---: |
| 10 | 6,0 ms | 27,4 ms |
| 25 | 12,3 ms | 13,4 ms |
| 50 | 24,3 ms | 33,2 ms |
| 100 | 44,2 ms | 48,0 ms |

La primera muestra pequeña incluye más trabajo de calentamiento; estas cifras no prueban que 25 equipos sean más rápidos que 10. La prueba de interfaz no mide la red ni el rendimiento de un teléfono físico.

## Interpretación y siguiente validación

Para una sesión con conversación, usar inicialmente 10–25 equipos y un dispositivo por equipo. Con 25 equipos de cinco integrantes serían 125 personas y 25 dispositivos de equipo, además del facilitador; es una equivalencia de organización del grupo, no una prueba con 125 clientes independientes.

Antes de prometer grupos de 50 o 100 dispositivos, se requiere una prueba escalonada en un proyecto de staging de Firebase, usando el SDK publicado y navegadores/dispositivos independientes, con red representativa y observación de latencia, errores y consumo. El emulador comparte máquina con todos los clientes de este ensayo y tiene diferencias conocidas de concurrencia y transacciones respecto de producción.

Documentación oficial: https://firebase.google.com/docs/emulator-suite/connect_firestore#how_the_cloud_firestore_emulator_differs_from_production

## Reproducir

Desde la raíz del repositorio, con Java 21 y Node disponibles:

```sh
npm install --no-save --no-package-lock firebase-tools@14.22.0 @firebase/rules-unit-testing@6.0.0 firebase@13.1.0
npx firebase emulators:exec --only firestore --project demo-nexus-load 'node tests/nexus-load.cjs --sizes=10,25,50,100 --out=nexus-concurrency.json'
```

El arnés rechaza configuración remota y usa únicamente el proyecto demo local. Conserva resultados parciales y sale con código distinto de cero cuando un escenario falla. No debe interpretarse un fallo de entorno como un máximo certificado de la aplicación.

Archivos de evidencia: `tests/results/nexus-concurrency-20261109.json`, `tests/results/nexus-100-repeat-20261109.json` y `tests/results/nexus-ui-20261109.json`.
