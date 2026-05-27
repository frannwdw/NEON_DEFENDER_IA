# 🚀 Neon Defender IA — Videojuego Controlado por Inteligencia Artificial
¡Bienvenido a **Neon Defender IA**! Este es un arcade espacial súper futurista donde piloteas una nave usando los movimientos de tu cuerpo frente a la cámara web y disparas láseres usando tu voz con el micrófono.

Este documento está escrito de forma súper sencilla para **Junior Developers** o estudiantes que quieren entender el proyecto de forma rápida y divertida en 5 minutos.

> [!NOTE]
> Si buscas la documentación técnica avanzada con fórmulas matemáticas de física, análisis espectral de sonido o lógica de rendimiento de hilos para profesores, lee la guía avanzada aquí: [README_TECHNICAL.md](file:///C:/Users/usuario/.gemini/antigravity/scratch/teachable-game/README_TECHNICAL.md).

---

## 📁 ¿Cómo está ordenado el código? (Arquitectura)
Para que el proyecto sea limpio y profesional, no pusimos todo en un solo archivo gigante. Lo dividimos en cajones ordenados:

* 📄 **`index.html` (El esqueleto):** Es la estructura de la página. Define dónde va el juego, los menús de ciencia ficción y los botones para arrancar.
* 📁 **`css/` (La ropa/diseño):** Estilos cyberpunk con luces de neón y rejillas.
  * **`style.css` (El organizador):** Simplemente junta todos los archivos de diseño usando `@import`.
  * **`variables.css`:** Los colores de neón (cian, magenta), letras y video de fondo.
  * **`landing.css`:** El diseño de la pantalla de bienvenida y el gran botón de inicio.
  * **`console.css`:** El diseño de la cabina espacial en PC (menús, pestañas, ranking).
  * **`mobile.css`:** El diseño especial para celulares (apaga el video pesado y pone la pantalla negra).
* 📁 **`js/` (Los músculos y el cerebro):**
  * **`js/main.js` (El Cerebro IA):** Carga los modelos neuronales de Google, captura la cámara web/micrófono y dibuja tu esqueleto de neón en pantalla.
  * **`js/game.js` (Los Músculos del Juego):** Controla el movimiento de la nave, genera los asteroides hostiles, las colisiones, el escudo cian y las explosiones.

---

## 🌱 Explicación del Proyecto en 5 Minutos (Con Analogías Divertidas)

### 1. El Bucle Dual (¿Por qué el juego va tan fluido?)
* **La analogía del Restaurante:** Imagina un restaurante de hamburguesas.
  * El **Chef (la IA de la cámara)** es muy meticuloso y se toma su tiempo para cocinar cada hamburguesa difícil. Solo puede entregar 25 platos por minuto (25 FPS).
  * El **Mesero (el motor del juego)** es súper veloz y lleva bebidas a las mesas volando, haciendo 60 viajes por minuto (60 FPS).
  * Si obligáramos al mesero a ir a la velocidad lenta del chef, los clientes verían todo a tirones. En este juego los separamos: el mesero corre rápido a 60 FPS (el juego se mueve súper fluido) y, cuando el chef termina una hamburguesa, el mesero simplemente la recoge y la entrega (la nave se actualiza con la posición de la IA en segundo plano).

### 2. El Movimiento LERP (¿Por qué la nave flota tan suave?)
* **La analogía de la Banda Elástica:** Si moviéramos la nave exactamente a donde dice la cámara web en crudo, la nave daría saltos mágicos e instantáneos de un lado a otro cada vez que te mueves un centímetro. Se vería muy tosco.
* Para solucionarlo, usamos **LERP (Interpolación Lineal)**. Imagina que atas la nave a tu cuerpo usando una **banda elástica**. Cuando te inclinas a la derecha, la banda se estira y jala de la nave de forma gradual y suave hacia esa dirección. La nave no "teletransporta" su posición; se desliza flotando con inercia, lo que da esa sensación premium de control espacial.

### 3. La Voz - FFT (¿Cómo nos escucha disparar y activar el escudo?)
* **La analogía del Afinador de Guitarra:** Cuando gritas *"¡PUM!"*, la Inteligencia Artificial no está escuchando la palabra en sí ni intentando leer tus labios. Lo que hace el micrófono es dividir tu voz en "tonos" (frecuencias graves, medias y agudas), igual que un afinador de guitarra detecta qué nota estás tocando.
* El sistema busca el "dibujo" característico de energía que genera tu voz cuando dices *"PUM"* (un pico de energía repentino) y lo separa del ruido ambiental. Si ese patrón coincide, ¡la nave dispara sus láseres!

### 4. El "Bypass" de Video en Celular (Ahorrar datos como Netflix)
* **La analogía del Ahorro de Datos:** El hermoso video del astronauta flotando de fondo pesa bastantes megabytes. En una PC con internet fijo es genial. Pero en un celular, intentar descargar ese video usando tus datos móviles mientras procesas la cámara y el juego haría que tu teléfono arda en llamas y te consumas tus megas.
* Por eso, el código tiene una puerta de seguridad inteligente: si detecta que estás jugando desde un celular, **destruye el video por completo antes de que empiece a descargarse** y pinta la pantalla de negro sólido. ¡Es como cuando Netflix te baja la resolución para que no gastes tus megabytes!

---

## 🎤 Puntos para Explicar y Lucirte el Lunes ante tus Compañeros
Si quieres explicar este proyecto de forma clara y que todos te entiendan a la primera, resume tu exposición en estos 4 puntos sencillos:

1. **Orden Profesional:** *"El código está 100% separado. No hay nada mezclado. El HTML hace la estructura, el CSS da la pintura visual de neón por carpetas, y el JavaScript controla los dos motores principales."*
2. **Control por Torso:** *"La Inteligencia Artificial de Google estima la postura del cuerpo en tiempo real. En lugar de usar botones rígidos, el jugador se inclina a los lados y la nave se desliza de forma fluida usando inercia física (LERP)."*
3. **Disparos Acústicos:** *"El micrófono escucha y analiza las ondas del sonido. No reconoce palabras, sino frecuencias de energía. Cuando dices 'PUM', la IA detecta la frecuencia ganadora y dispara ráfagas continuas de láser magenta."*
4. **Híbrido Inteligente:** *"El juego detecta si estás en computadora o celular de forma inteligente. En PC te da una cabina táctica con videos interactivos de fondo, y en móvil apaga los videos pesados para no gastar datos y fuerza una pantalla 100% negra adaptada para celular."*
