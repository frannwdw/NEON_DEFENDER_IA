# 🛠️ Neon Defender IA — Documentación Técnica Avanzada
Este documento detalla la arquitectura de ingeniería de software, el procesamiento matemático de la Inteligencia Artificial y la optimización de hilos e interfaces de **Neon Defender IA**. Está diseñado como referencia técnica para arquitectos de software, desarrolladores senior y profesores evaluadores.

---

## 📁 Arquitectura Modular de Archivos
Para mantener el principio de responsabilidad única (Single Responsibility Principle) y el desacoplamiento estético-lógico, el proyecto se segmenta en la siguiente estructura:

1. **`index.html` (Estructura HUD):** Define la cabina interactiva de ciencia ficción con el sistema de pestañas (Combate, Diagnósticos de IA, Base de datos y Leaderboard) y la carga de librerías TensorFlow de Google.
2. **`css/` (Diseño Modularizado):** El diseño visual premium está segmentado en archivos específicos para facilitar el mantenimiento y la legibilidad:
   * **`css/style.css` (Punto de Entrada):** El archivo principal de estilo que enlaza y unifica los módulos mediante `@import`.
   * **`css/variables.css` (Fondo, Reset e Identidad):** Contiene las variables del tema de color, fuentes, efectos de brillo de neón, restablecimiento base del navegador, la animación de la rejilla CRT y las propiedades del video de fondo.
   * **`css/landing.css` (Fase 1 - Bienvenida):** Estilos dedicados de la pantalla inicial de bienvenida, tarjetas de características y el botón de conexión neural.
   * **`css/auth.css` (Fase 1.5 - Calibración Biométrica):** Estilos dedicados del escáner facial biométrico, óvalo de mira interactivo, láser magenta y barra de progreso.
   * **`css/console.css` (Fase 2 y 3 - Cabina PC):** Estilos del panel de mandos en computadoras: la cuadrícula táctica, barras de navegación, osciloscopios de IA, visores de telemetría y el contenedor de cámara.
   * **`css/mobile.css` (Optimización Celular):** Reglas responsivas que desactivan videos de 84MB en dispositivos móviles, ocultan sidebars innecesarios y forzan el fondo negro sólido `#000000`.
3. **`js/` (Programación Lógica Modularizada):** Para facilitar el desacoplamiento de capas lógicas, el núcleo de scripting se divide en módulos:
   * **`js/main.js` (Orquestador Neural):** El núcleo del sistema de Inteligencia Artificial. Gestiona el bucle asíncrono corporal PoseNet a 25 FPS y la sincronización de refresco del canvas principal a 60 FPS.
   * **`js/ui.js` (Interfaz y Telemetría):** Controlador de los menús de navegación por pestañas de la cabina, sincronización del reloj HUD y osciloscopio de FPS en tiempo real.
   * **`js/auth.js` (Calibrador Biométrico):** Gestiona el inicio de sesión holográfico con actualización de cámara a 60 FPS por requestAnimationFrame y la precarga en segundo plano de modelos TensorFlow.
   * **`js/game.js` (Motor Gráfico y Físicas):** Controla el comportamiento mecánico del arcade (movimiento por interpolación LERP de la nave, generación de Hex Invaders, colisiones elásticas, escudo de fuerza y partículas).

---

## 🔬 Especificaciones de Ingeniería e Inteligencia Artificial

### 1. Lógica de Hilos e Hibridación Neural (Doble Bucle 25 FPS vs 60 FPS)
Para optimizar el uso de la CPU y GPU en el hilo principal del navegador (main thread), se implementó un sistema de bucle dual desacoplado:
* **Bucle Neural Asíncrono (`bucleIA` - 25 FPS):** La estimación de poses a través del canvas de la webcam (`tmPose.Webcam`) y la clasificación de tensores mediante PoseNet es una operación de alta carga computacional. Ejecutarla a 60 FPS congelaría el hilo de renderizado del navegador. Por ello, corre de forma asíncrona mediante un bucle retrasado con `setTimeout` fijado a **40ms** (aproximadamente 25 FPS), el cual computa las predicciones del modelo en segundo plano.
* **Bucle Gráfico Síncrono (`bucleDelJuego` - 60 FPS):** La física del juego, el dibujado del canvas transparente (`lienzo-juego`) y las partículas corren de forma nativa a 60 FPS utilizando la API `requestAnimationFrame` del navegador. Esto garantiza animaciones perfectas alineadas con la tasa de refresco del monitor (V-Sync).

### 2. Suavizado de Control Corporal mediante Interpolación Lineal (LERP)
Debido a que el bucle de IA entrega coordenadas espaciales a 25 FPS y con cierta vibración (noise) natural de la webcam, el movimiento directo de la nave provocaría saltos bruscos (jittering). Para resolverlo, implementamos una ecuación de **Interpolación Lineal (LERP)** para calcular la posición en el eje X de la nave en el ciclo físico de 60 FPS:
```javascript
// Ecuación LERP en game.js
nave.x += (posicionObjetivoX - nave.x) * 0.12;
```
Esto significa que en cada fotograma, la nave avanza únicamente el **12%** de la distancia restante hacia la postura real del jugador. El resultado es un efecto de inercia física suave, fluido y orgánico de transición constante.

### 3. Procesamiento de Audio por Transformada Rápida de Fourier (FFT)
El micrófono captura el audio continuo en crudo y lo pasa al modelo de comandos de voz entrenado sobre un clasificador neuronal **BROWSER_FFT**.
* El hardware del micrófono muestrea el aire. La API de Web Audio realiza una **Transformada Rápida de Fourier (FFT)** para separar la señal de audio en sus componentes espectrales de frecuencia y amplitud en tiempo real.
* El modelo estima la probabilidad de los comandos y los compara contra el umbral crítico establecido en `probabilityThreshold: 0.70` (70% de confianza). Las activaciones por ráfagas acumuladas alimentan una cola de temporizador (`tiempoFuegoContinuo = 12`) que mantiene el láser disparando consecutivamente sin exigir que el jugador grite a cada milisegundo.

### 4. Despliegue Adaptativo del Viewport en Celular (Bypass)
Para el formato móvil, se configuró un bypass de carga en Javascript y reglas de renderizado en CSS:
* **JS Media Bypass:** En celulares, el script detecta las cabeceras móviles e inmediatamente detiene (`.pause()`), limpia (`.src = ""`), recarga (`.load()`) y remueve del DOM el elemento de video pesado de fondo, cortando de raíz la descarga de **84MB** de datos de red.
* **CSS Viewport Reset:** A través de media queries (`@media (max-width: 768px)`), el CSS oculta las barras laterales de la cabina y reescribe el layout de la pestaña de combate para usar `display: block !important`, forzando al canvas a ocupar la pantalla completa manteniendo un aspect-ratio de `16/9` e inyectando un fondo `#000000` puro para ahorrar batería y aumentar contraste.

### 5. Calibración Biométrica y Preloader Concurrente (Patrón UX Oculto)
Para mitigar el impacto de la latencia en la carga inicial de los modelos de TensorFlow.js (~3-4 segundos de inicialización asíncrona), se desarrolló un patrón de diseño interactivo de precarga:
* **Autenticación Biométrica Simulada:** Al dispararse el evento del botón de ingreso, se inicializa de inmediato la captura multimedia (`tmPose.Webcam`) en un viewport circular de `280px` x `280px`. En paralelo, se dibuja un óvalo de vector calibrado y una línea de barrido magenta que emula un escáner facial por cámara.
* **Preloader de Modelos en Segundo Plano:** Mientras el escáner realiza la animación y progresa del 0% al 100%, el motor realiza concurrentemente las peticiones HTTPS y la compilación WebGL de los modelos PoseNet y Speech de Teachable Machine. Esto oculta de manera elegante el tiempo de espera técnico del usuario bajo una experiencia inmersiva e interactiva de ciencia ficción.

---

## 🎤 Guía de Exposición Técnica para el Lunes (Puntos Clave)
Al exponer ante un jurado o profesor evaluador, enfoca tu presentación en los siguientes argumentos de ingeniería:

1. **Optimización de Hilo Principal (Thread Isolation):** *"Procesar redes neuronales de estimación de pose en tiempo real en la web satura la CPU. Nuestra arquitectura aisla el cómputo de TensorFlow en un bucle asíncrono a 25 FPS para mantener el hilo de renderizado a 60 FPS estables sin caídas de frames."*
2. **Mitigación de Ruido Físico (LERP Filtering):** *"Las coordenadas corporales estimadas por la cámara web contienen ruido y jittering de alta frecuencia. En lugar de mapear la nave a la entrada cruda de la cámara web, aplicamos un filtro matemático de interpolación lineal (LERP). Esto reduce el ruido, aportando inercia física suave."*
3. **Procesamiento de Voz Espectral (FFT Analysis):** *"El micrófono procesa el sonido ambiente mediante una Transformada Rápida de Fourier (FFT). El clasificador neuronal no analiza texto, sino la firma espectral de frecuencia del grito 'PUM' sobrepasando el umbral de ruido del aula."*
4. **Hibridación Responsiva y Optimización de Viewport:** *"La aplicación realiza un bypass de recursos multimedia. Si se ejecuta en un móvil, cancela la descarga de videos pesados mediante script, purga la memoria de video y reestructura el viewport a un canvas escalado proporcional con fondo negro absoluto `#000000` para maximizar el contraste y el ahorro de batería."*
