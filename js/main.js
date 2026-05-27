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

/**
 * Dibuja la pantalla de carga en el lienzo del juego
 */
function dibujarPantallaCarga(mensaje) {
    if (!ctx) return;
    ctx.fillStyle = "#020206";
    ctx.fillRect(0, 0, 640, 360);
    
    ctx.font = "bold 13px 'Orbitron', monospace";
    ctx.fillStyle = "#00ffcc";
    ctx.textAlign = "center";
    ctx.fillText("ESTABLECIENDO ENLACE NEURAL", 320, 145);
    
    ctx.font = "12px 'Rajdhani', sans-serif";
    ctx.fillStyle = "rgba(209, 226, 247, 0.7)";
    ctx.fillText(mensaje.toUpperCase(), 320, 180);
    
    ctx.strokeStyle = "rgba(0, 255, 204, 0.2)";
    ctx.strokeRect(220, 210, 200, 8);
    ctx.fillStyle = "#00ffcc";
    const w = 45 + Math.sin(Date.now() * 0.005) * 35;
    ctx.fillRect(320 - w/2, 212, w, 4);
    ctx.textAlign = "left";
}

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

    setTimeout(bucleIA, 40);
}

/**
 * Dibuja las articulaciones como hermosas burbujas de neón flotantes
 */
function dibujarEsqueletoHolografico(ctx, keypoints, minConfidence = 0.40) {
    ctx.save();
    
    const conexiones = [
        ["leftShoulder", "rightShoulder"],
        ["leftShoulder", "leftElbow"],
        ["leftElbow", "leftWrist"],
        ["rightShoulder", "rightElbow"],
        ["rightElbow", "rightWrist"],
        ["leftShoulder", "leftHip"],
        ["rightShoulder", "rightHip"],
        ["leftHip", "rightHip"]
    ];

    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(255, 0, 255, 0.5)";
    ctx.strokeStyle = "rgba(255, 0, 255, 0.22)";
    
    conexiones.forEach(([p1, p2]) => {
        const pt1 = keypoints.find(k => k.part === p1);
        const pt2 = keypoints.find(k => k.part === p2);
        
        if (pt1 && pt2 && pt1.score >= minConfidence && pt2.score >= minConfidence) {
            ctx.beginPath();
            ctx.moveTo(pt1.position.x, pt1.position.y);
            ctx.lineTo(pt2.position.x, pt2.position.y);
            ctx.stroke();
        }
    });

    ctx.shadowColor = "rgba(0, 255, 204, 0.8)";
    ctx.strokeStyle = "rgba(0, 255, 204, 0.8)";
    ctx.lineWidth = 1.3;

    keypoints.forEach(k => {
        const partesHolograma = [
            "nose", "leftShoulder", "rightShoulder", 
            "leftElbow", "rightElbow", "leftWrist", "rightWrist"
        ];
        
        if (k.score >= minConfidence && partesHolograma.includes(k.part)) {
            ctx.shadowBlur = 6;
            ctx.fillStyle = "rgba(0, 255, 204, 0.1)";
            ctx.beginPath();
            ctx.arc(k.position.x, k.position.y, 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(k.position.x, k.position.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    ctx.restore();
}

/**
 * BUCLE DE GRÁFICOS DEL VIDEOJUEGO (60 FPS CONSTANTES)
 */
function bucleDelJuego(timestamp) {
    if (estadoApp !== "jugando") return;

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
    actualizarRelojHUD();

    const btnIngresar = document.getElementById("btn-ingresar");
    const landingPage = document.getElementById("landing-page");
    const bgVideo = document.getElementById("bg-video");

    const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    if (bgVideo) {
        if (esMovil) {
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
            
            if (!esMovil && bgVideo) {
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