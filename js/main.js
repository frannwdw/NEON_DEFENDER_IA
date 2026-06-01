/**
 * ============================================================================
 * CONSOLA DE COMANDO NEURAL IA — v10.0 (EDICIÓN RECOMPILADA NÚCLEO)
 * ============================================================================
 * Cerebro Neural: Carga asíncrona de PoseNet, clasificación de postura
 * corporal a 25 FPS, esqueleto holográfico interactivo y bucle síncrono a 60 FPS.
 * ============================================================================
 */

// Enlaces oficiales de los modelos entrenados en Teachable Machine de Google
const ENLACE_MODELO_POSTURA = "https://teachablemachine.withgoogle.com/models/ihP9Lqj84/";
const ENLACE_MODELO_VOZ = "https://teachablemachine.withgoogle.com/models/vuA-wzQ23/";
const ES_MOVIL = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
const FPS_JUEGO_OBJETIVO = 60; // Forzamos 60 FPS en todas las plataformas para mantener la misma física y velocidad del juego
const INTERVALO_IA_MS = ES_MOVIL ? 85 : 40; // Optimización de IA: Procesamiento espaciado en móvil para ahorrar CPU y batería
const COLOR_CYAN_CANVAS = "#00ffcc";

// Variables de estado neural y captura multimedia
let modeloPostura;             // Instancia de PoseNet
let modeloVoz;                 // Instancia de Speech FFT
let camaraWeb;                 // Captura de webcam
let estadoApp = "esperando";   // Estados: esperando -> escaneando -> listo -> jugando

let posturaActual = "Centro";  // Postura corporal activa ("Izquierda", "Centro", "Derecha")
let disparoDetectado = false;  // Flag de disparo acústico
let escudoDetectado = false;   // Flag de escudo acústico
let ultimaPoseDetectada = null;// Esqueleto neural calculado por TensorFlow
let teclasPresionadas = {};    // Captura de teclas físicas manuales

// Caché de elementos HTML del DOM
let textoEstadoPostura, textoEstadoVoz, textoEstadoVision;
let ledPostura, ledVoz, ledVision;
let telemetryLatency, telemetryVector, telemetryFps;
let barTiltLeft, barTiltCenter, barTiltRight, labelTiltLeft, labelTiltCenter, labelTiltRight;
let barAudioShot, barAudioNoise, labelAudioShot, labelAudioNoise;
let lienzo, ctx;
let ultimoFrameJuego = 0;

/**
 * Dibuja el estado "Listo para despegue" con el botón interactivo
 */
function dibujarPantallaListo() {
    if (!ctx) return;
    ctx.fillStyle = "rgba(2, 2, 6, 0.95)";
    ctx.fillRect(0, 0, 640, 360);

    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00ffcc";
    ctx.fillStyle = "#00ffcc";
    ctx.font = "bold 25px 'Orbitron', monospace";
    ctx.textAlign = "center";
    ctx.fillText("ENLACE NEURAL ESTABLECIDO", 320, 120);

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 14px 'Rajdhani', sans-serif";
    ctx.fillText("REACTOR E INTELIGENCIA ARTIFICIAL INICIALIZADOS", 320, 160);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "12px 'Rajdhani', sans-serif";
    ctx.fillText("RED NEURAL: 25 FPS  |  MOTOR ARCADES: 60 FPS", 320, 185);

    ctx.fillStyle = "rgba(0, 255, 204, 0.08)";
    ctx.strokeStyle = "rgba(0, 255, 204, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(200, 220, 240, 48);
    ctx.fillRect(200, 220, 240, 48);

    ctx.fillStyle = "#00ffcc";
    ctx.font = "bold 12px 'Orbitron', monospace";
    ctx.fillText("PRESIONA AQUÍ PARA DESPEGAR", 320, 249);
    ctx.restore();

    // Lanzador interactivo del despegue táctico (Toques y Clics)
    const despegueHandler = (e) => {
        lienzo.removeEventListener("click", despegueHandler);
        lienzo.removeEventListener("touchstart", despegueTouchHandler);
        
        inicializarDatosJuego();
        estadoApp = "jugando";
        ultimoFrameJuego = 0;
        window.requestAnimationFrame(bucleDelJuego);
    };

    const despegueTouchHandler = (e) => {
        e.preventDefault();
        despegueHandler(e);
    };

    lienzo.addEventListener("click", despegueHandler);
    lienzo.addEventListener("touchstart", despegueTouchHandler, { passive: false });
}

/**
 * BUCLE ASÍNCRONO DE POSE IA (25 FPS)
 * Realiza estimaciones corporales constantes en segundo plano
 */
async function bucleIA() {
    if (estadoApp === "esperando" || estadoApp === "cargando") return;

    const tStart = performance.now();

    try {
        if (camaraWeb) {
            camaraWeb.update();
            if (modeloPostura) {
                const { pose, posenetOutput } = await modeloPostura.estimatePose(camaraWeb.canvas);
                const preds = await modeloPostura.predict(posenetOutput);

                let ganadora = "Centro";
                let maxP = 0;
                let probLeft = 0;
                let probCenter = 0;
                let probRight = 0;

                preds.forEach(p => {
                    const probPct = Math.round(p.probability * 100);
                    if (p.className === "Izquierda") probLeft = probPct;
                    else if (p.className === "Centro") probCenter = probPct;
                    else if (p.className === "Derecha") probRight = probPct;

                    if (p.probability > maxP) {
                        maxP = p.probability;
                        ganadora = p.className;
                    }
                });

                posturaActual = ganadora;
                ultimaPoseDetectada = pose;

                // Control de precisión continuo por la nariz (Bypassea el snapping rígido)
                const nose = pose.keypoints.find(k => k.part === "nose");
                if (nose && nose.score >= 0.40) {
                    const camWidth = (camaraWeb && camaraWeb.canvas) ? camaraWeb.canvas.width : 280;
                    const camX = nose.position.x;
                    
                    // Calibración elástica dinámica basada en el ancho de la cámara.
                    // Usamos un margen del 20% a cada extremo para mayor sensibilidad de giro sin salirse.
                    const margen = camWidth * 0.20;
                    const minX = margen;
                    const maxX = camWidth - margen;
                    
                    let fraccion = (camX - minX) / (maxX - minX);
                    fraccion = Math.max(0, Math.min(1, fraccion));
                    
                    // NOTA: Con la cámara en espejo (flip = true), inclinarse físicamente a la derecha
                    // mueve la cabeza hacia la derecha de la imagen de la cámara (mayor X).
                    // Para que la nave también vuele a la derecha (mayor X del canvas), la relación
                    // debe ser directa. ¡Eliminamos la inversión errónea de espejo!
                    
                    if (typeof jugador !== 'undefined') {
                        // El avión se desplaza fluidamente entre X = 60 y X = 580 en el canvas
                        jugador.carrilObjetivo = 60 + fraccion * (580 - 60);
                    }
                }

                if (textoEstadoPostura) textoEstadoPostura.innerText = `${ganadora.toUpperCase()} (${Math.round(maxP * 100)}%)`;

                if (barTiltLeft) {
                    barTiltLeft.style.width = `${probLeft}%`;
                    labelTiltLeft.innerText = `${probLeft}%`;
                    barTiltCenter.style.width = `${probCenter}%`;
                    labelTiltCenter.innerText = `${probCenter}%`;
                    barTiltRight.style.width = `${probRight}%`;
                    labelTiltRight.innerText = `${probRight}%`;
                }

                if (telemetryVector) {
                    let vectorVal = "0.00";
                    if (ganadora === "Izquierda") vectorVal = `-${maxP.toFixed(2)}`;
                    else if (ganadora === "Derecha") vectorVal = `+${maxP.toFixed(2)}`;
                    telemetryVector.innerText = vectorVal;
                }
            }
        }
    } catch (err) {
        console.warn("Pose omitida:", err.message);
    }

    const tEnd = performance.now();
    const latencia = Math.round(tEnd - tStart);
    if (telemetryLatency) {
        telemetryLatency.innerText = `${latencia} ms`;
    }

    setTimeout(bucleIA, INTERVALO_IA_MS);
}

/**
 * Dibuja un puntero holográfico de precisión (un solo puntito brillante) en la nariz del jugador
 */
function dibujarEsqueletoHolografico(ctx, keypoints, minConfidence = 0.40) {
    ctx.save();
    
    // Buscar la nariz para dibujar el puntito táctico de precisión
    const nose = keypoints.find(k => k.part === "nose");
    if (nose && nose.score >= minConfidence) {
        // Usamos la misma coordenada X corregida que la nave para alinear el espejo
        const camWidth = (typeof camaraWeb !== 'undefined' && camaraWeb && camaraWeb.canvas) ? camaraWeb.canvas.width : 280;
        const drawX = typeof jugador !== 'undefined' ? jugador.carrilObjetivo : (nose.position.x * 640 / camWidth);
        
        // Mapeamos el eje Y de la cámara al canvas de forma proporcional
        const camHeight = (typeof camaraWeb !== 'undefined' && camaraWeb && camaraWeb.canvas) ? camaraWeb.canvas.height : 280;
        const drawY = nose.position.y * 360 / camHeight;

        // Círculo exterior táctico (neón cian)
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLOR_CYAN_CANVAS;
        ctx.strokeStyle = COLOR_CYAN_CANVAS;
        ctx.fillStyle = "rgba(0, 255, 204, 0.18)";
        ctx.lineWidth = 1.8;
        
        ctx.beginPath();
        ctx.arc(drawX, drawY, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();

        // Píxel fotónico central (blanco puro)
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(drawX, drawY, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * BUCLE DE GRÁFICOS DEL VIDEOJUEGO (60 FPS CONSTANTES)
 */
function bucleDelJuego(timestamp) {
    if (estadoApp !== "jugando") return;

    const intervaloFrame = 1000 / FPS_JUEGO_OBJETIVO;
    if (ultimoFrameJuego && timestamp - ultimoFrameJuego < intervaloFrame) {
        window.requestAnimationFrame(bucleDelJuego);
        return;
    }
    ultimoFrameJuego = timestamp;

    medirFps(timestamp);
    ctx.clearRect(0, 0, 640, 360);

    // Dibujar esqueleto neural de burbujitas
    if (ultimaPoseDetectada) {
        dibujarEsqueletoHolografico(ctx, ultimaPoseDetectada.keypoints, 0.40);
    }

    const activarEscudo = teclasPresionadas["KeyS"] || teclasPresionadas["ShiftLeft"] || teclasPresionadas["KeyE"] || escudoDetectado;

    // Actualizar físicas y render del canvas
    actualizarYDibujarJuego(ctx, posturaActual, disparoDetectado, activarEscudo);
    
    const scoreActual = typeof jugador !== 'undefined' ? jugador.puntuacion : 0;
    const currentScoreRow = document.getElementById("leaderboard-current-score");
    if (currentScoreRow) {
        currentScoreRow.innerText = `${String(scoreActual * 1000).padStart(3, "0")} pts`;
    }

    disparoDetectado = false;
    escudoDetectado = false;

    window.requestAnimationFrame(bucleDelJuego);
}

// Inicialización del DOM y bootstraper
document.addEventListener("DOMContentLoaded", () => {
    // Cachear referencias DOM
    textoEstadoPostura = document.querySelector("#estado-postura .prediccion");
    textoEstadoVoz = document.querySelector("#estado-voz .prediccion");
    textoEstadoVision = document.querySelector("#estado-vision .prediccion");

    ledPostura = document.getElementById("led-postura");
    ledVoz = document.getElementById("led-voz");
    ledVision = document.getElementById("led-vision");

    telemetryLatency = document.getElementById("telemetry-latency");
    telemetryVector = document.getElementById("telemetry-vector");
    telemetryFps = document.getElementById("telemetry-fps");

    barTiltLeft = document.getElementById("bar-tilt-left");
    barTiltCenter = document.getElementById("bar-tilt-center");
    barTiltRight = document.getElementById("bar-tilt-right");
    labelTiltLeft = document.getElementById("label-tilt-left");
    labelTiltCenter = document.getElementById("label-tilt-center");
    labelTiltRight = document.getElementById("label-tilt-right");

    barAudioShot = document.getElementById("bar-audio-shot");
    barAudioNoise = document.getElementById("bar-audio-noise");
    labelAudioShot = document.getElementById("label-audio-shot");
    labelAudioNoise = document.getElementById("label-audio-noise");

    lienzo = document.getElementById("lienzo-juego");
    ctx = lienzo.getContext("2d");

    // Inicializar cabina y relojes
    inicializarTabs();
    inicializarDatabase();
    if (!ES_MOVIL) actualizarRelojHUD();

    const btnIngresar = document.getElementById("btn-ingresar");
    const landingPage = document.getElementById("landing-page");
    const bgVideo = document.getElementById("bg-video");

    if (bgVideo) {
        if (ES_MOVIL) {
            bgVideo.pause();
            bgVideo.src = "";
            bgVideo.load();
            bgVideo.remove();
        } else {
            bgVideo.style.display = "block";
            bgVideo.play().catch(err => {
                console.warn("Auto-play blocked:", err.message);
            });
        }
    }

    if (btnIngresar) {
        btnIngresar.addEventListener("click", () => {
            const authScreen = document.getElementById("auth-screen");
            if (landingPage && authScreen) {
                landingPage.style.display = "none";
                authScreen.style.display = "flex";
            }
            
            if (!ES_MOVIL && bgVideo) {
                const bgVideoDesktop = document.getElementById("bg-video");
                if (bgVideoDesktop) {
                    bgVideoDesktop.src = "fondo2.mp4";
                    bgVideoDesktop.load();
                    bgVideoDesktop.play().catch(err => {
                        console.warn("Auto-play blocked:", err.message);
                    });
                }
            }
            
            // Disparar preloader y escaneo biométrico
            iniciarEscaneoBiometrico();
        });
    }

    // Soporte teclado físico manual
    window.addEventListener("keydown", e => {
        teclasPresionadas[e.code] = true;
        if (e.code === "Space" || e.code === "KeyF" || e.code === "Enter") {
            disparoDetectado = true;
        }
    });

    window.addEventListener("keyup", e => {
        teclasPresionadas[e.code] = false;
    });
});
