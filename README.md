# FANTASY GAMES — Servidor online (kit inicial)

Este proyecto agrega un servidor Node.js + Socket.IO para salas de ajedrez y Damas clásicas, y una ruta protegida para desbloquear la dedicatoria. El servidor valida los movimientos de ambos juegos; no confía únicamente en lo que envía el navegador.

## Qué contiene

- `server.js`: API HTTP, salas online, Socket.IO y validación de la clave privada.
- `src/checkers.js`: reglas de Damas clásicas replicadas en el servidor.
- `scripts/hash-password.js`: genera un hash bcrypt de la contraseña sin guardarla en el repositorio.
- `test/`: pruebas automatizadas de reglas de Damas.
- `Fantasy_Games_8_7_Cliente_Online.html`: cliente que se conecta al servidor.
- `.env.example`: nombres de configuración; no contiene secretos.

## Requisitos

Node.js 20 o superior (recomendado Node.js 22) y npm.

## Probar el servidor en tu computadora

1. Instala Node.js desde https://nodejs.org/.
2. Abre una terminal dentro de esta carpeta.
3. Ejecuta `npm install`.
4. Ejecuta `npm test` para correr las pruebas de reglas de Damas.
5. Ejecuta `npm start` para iniciar el servidor local.
6. Abre `http://localhost:3000/health`. Debes recibir JSON con `ok: true`.

Para probar el cliente local, abre `Fantasy_Games_8_7_Cliente_Online.html`, entra a **Multijugador online**, escribe `http://localhost:3000` en dirección del servidor y pulsa **Conectar con el reino**. La excepción HTTP se permite únicamente para localhost.

## Publicar en Render desde un repositorio privado de GitHub

1. Crea un repositorio **Private** en GitHub.
2. Sube a la raíz del repositorio todos los archivos de esta carpeta, incluyendo `package.json`, `server.js`, `src/`, `scripts/`, `test/` y el HTML 8.7.
3. En https://render.com/ inicia sesión con GitHub y autoriza el acceso a ese repositorio privado.
4. Selecciona **New + → Web Service**, elige el repositorio y configura:
   - Runtime: `Node`
   - Root Directory: vacío (raíz del repositorio)
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: `Free` para pruebas iniciales
   - Health Check Path: `/health` (si el campo aparece)
5. Publica el servicio. Render asignará una URL HTTPS, por ejemplo `https://fantasy-games-server.onrender.com`.
6. Abre la URL terminada en `/health` y comprueba que responde `ok: true`.
7. En Render abre **Environment** y configura las variables privadas indicadas abajo.

## Variables privadas de Render

Configúralas en el panel de Render > tu servicio > Environment. No las guardes en el HTML ni las pegues en GitHub.

- `DEDICATION_PASSWORD_HASH`: hash bcrypt generado en tu equipo (ver siguiente sección).
- `DEDICATION_TITLE`: `PARA LA NIÑA MÁS BONITA DEL MUNDO`
- `DEDICATION_SIGNATURE`: `alejandra c.`
- `DEDICATION_MESSAGE`: el mensaje privado que quieres mostrar después de desbloquear.
- `CLIENT_ORIGINS`: déjalo vacío mientras abras el HTML descargado desde tu computadora. Cuando publiques el HTML en una web, coloca el origen exacto del sitio (sin ruta).

## Crear el hash de la contraseña privada

En una terminal dentro de la carpeta del proyecto:

1. Ejecuta `npm install` si aún no lo hiciste.
2. Ejecuta `npm run hash-password`.
3. Escribe una contraseña única de al menos 10 caracteres. No se mostrará mientras escribes.
4. Copia el hash que se imprime (empieza por `$2a$` o `$2b$`) y pégalo como valor de `DEDICATION_PASSWORD_HASH` en Render > Environment.
5. Guarda los cambios en Render y espera a que termine el nuevo despliegue.

No guardes la contraseña original en archivos, commits, capturas públicas ni mensajes. Si la pierdes, genera un hash nuevo y actualiza la variable en Render.

## Conectar el HTML

1. Abre `Fantasy_Games_8_7_Cliente_Online.html`.
2. Entra a **Multijugador online**.
3. Pega la URL HTTPS de Render en **Dirección del servidor**.
4. Pulsa **Conectar con el reino**.
5. Selecciona Ajedrez o Damas, crea una sala y comparte el código de seis caracteres.
6. El segundo jugador abre su copia del mismo HTML, introduce la misma URL, se conecta y escribe el código.

La dedicatoria usa la misma dirección del servidor. Cuando el hash esté configurado, el servidor comprobará la contraseña y solo entonces enviará el texto privado.

## Límites importantes del plan gratuito

Las salas y partidas viven en memoria del servidor. Al reiniciar, volver a desplegar o suspenderse el servicio, las salas activas se pierden. El nivel gratuito de Render puede suspender servicios inactivos; es adecuado para pruebas, no para prometer disponibilidad continua. Para partidas permanentes habrá que elegir un plan que no suspenda el servicio y, más adelante, persistir estadísticas si se desean conservar entre reinicios.

## Seguridad

- El repositorio debe permanecer **Private**.
- Nunca subas `.env`, contraseñas ni credenciales.
- Render usa HTTPS para el servicio público.
- La API de dedicatoria tiene límite de intentos y compara el hash bcrypt en el servidor.
- Las salas usan códigos aleatorios y el servidor comprueba turnos y movimientos.
- Para el sitio web publicado, configura `CLIENT_ORIGINS` con el dominio exacto del juego.

## Estado de pruebas

Las pruebas automatizadas incluidas cubren la posición inicial de Damas, el rechazo de turnos incorrectos y la aceptación de una jugada inicial legal. Deben ejecutarse además pruebas integrales con dos navegadores/dispositivos una vez desplegado el servidor. Aún no se ha probado una publicación real en Render desde esta sesión.
