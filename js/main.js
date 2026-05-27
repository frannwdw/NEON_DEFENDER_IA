/**
 * ============================================================================
 * CONSOLA DE COMANDO NEURAL IA — v10.0 (EDICIÓN RECOMPILADA COMPLETA)
 * ============================================================================
 * Enlace neural bidireccional PoseNet/FFT. Bucle asíncrono de IA a 25 FPS,
 * motor de juego síncrono a 60 FPS y bypass de datos multimedia para móviles.
 * ============================================================================
 */

// Enlaces oficiales de los modelos entrenados en Teachable Machine de Google
const ENLACE_MODELO_POSTURA = "https://teachablemachine.withgoogle.com/models/ihP9Lqj84/";
const ENLACE_MODELO_VOZ = "https://teachablemachine.withgoogle.com/models/vuA-wzQ23/";

// variables de estado neural y captura multimedia
let modeloPostura;             // Instancia de PoseNet
let modeloVoz;                 // Instancia de Speech FFT
let camaraWeb;                 // Captura de webcam
let estadoApp = "esperando";   // Estados: esperando -> cargando -> listo -> jugando

let posturaActual = "Centro";  // Postura corporal activa ("Izquierda", "Centro", "Derecha")
let disparoDetectado = false;  // Flag de disparo acústico
let escudoDetectado = false;   // Flag de escudo acústico
let ultimaPoseDetectada = null;// Esqueleto neural calculado por TensorFlow
let teclasPresionadas = {};    // Captura de teclas físicas manuales

// Caché de elementos HTML del DOM (Optimización de velocidad de acceso)
let textoEstadoPostura, textoEstadoVoz, textoEstadoVision;
let ledPostura, ledVoz, ledVision;
let telemetryLatency, telemetryVector, telemetryFps;
let barTiltLeft, barTiltCenter, barTiltRight, labelTiltLeft, labelTiltCenter, labelTiltRight;
let barAudioShot, barAudioNoise, labelAudioShot, labelAudioNoise;
let lienzo, ctx;

// ============================================================================
// 1. SISTEMA DE NAVEGACIÓN Y BASE DE DATOS TÁCTICA (EXCLUSIVO ESCRITORIO)
// ============================================================================

/**
 * Gestiona el intercambio de pestañas centrales en la versión de PC
 */
function inicializarTabs() {
    const tabButtons = document.querySelectorAll(".nav-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTabId = btn.getAttribute("data-tab");
            
            // Limpiar clases activas previas
            tabButtons.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));

            // Habilitar la pestaña seleccionada
            btn.classList.add("active");
            const target = document.getElementById(targetTabId);
            if (target) target.classList.add("active");
        });
    });
}

// Datos descriptivos de naves espaciales
const baseDatosNaves = {
    "ship-defender": {
        title: "Neon Defender",
        sub: "Caza de Combate Clase Alfa // Interfaz Bio-Neural",
        class: "Clase A",
        desc: "El caza estelar experimental Neon Defender está diseñado con un núcleo de reactor de plasma cian líquido. Su casco ligero y alas variables de neón le permiten maniobrar lateralmente a través de corrientes de gravedad hiperbólica usando un mapeador de redes neuronales biológicas.",
        speed: "MACH 28.5",
        shield: "Activo 100%",
        weapon: "Láser Magenta v2",
        engine: "Cosmic Flamer"
    },
    "ship-invader": {
        title: "Hex Invader",
        sub: "Amenaza Biomecánica // Extraterrestre clase Delta",
        class: "Clase S-Threat",
        desc: "Estructuras cristalinas hostiles de geometría hexagonal que descienden desde cúmulos estelares. Su núcleo metálico emite un pulso gravitacional que frena a los defensores espaciales al escapar. Son inmunes al plasma convencional pero vulnerables al láser magenta.",
        speed: "MACH 12.0",
        shield: "Blindaje Pesado 80%",
        weapon: "Colisión Cinética",
        engine: "Dark Graviton"
    },
    "ship-shield": {
        title: "Force Shield",
        sub: "Campo de Fuerza Hexagonal // Matriz Tecnológica",
        class: "Clase Def-Max",
        desc: "Malla de plasma protectora que aprovecha las ondas sónicas del operador para condensar un blindaje hexagonal traslúcido. Capaz de neutralizar al 100% el impacto cinético de los Hex Invaders absorbiendo energía nuclear táctica. Requiere 3 segundos de enfriamiento al colapsar.",
        speed: "N/A",
        shield: "Matriz Auto-Cian",
        weapon: "Campo Repulsor",
        engine: "Sonic Condenser"
    }
};

/**
 * Carga la interacción de la biblioteca de Lore y Naves
 */
function inicializarDatabase() {
    const dbButtons = document.querySelectorAll(".db-item-btn");
    const dbTitle = document.getElementById("db-detail-title");
    const dbSub = document.getElementById("db-detail-sub");
    const dbClass = document.getElementById("db-detail-class");
    const dbDesc = document.getElementById("db-detail-desc");
    
    const dbSpeed = document.getElementById("db-spec-speed");
    const dbShield = document.getElementById("db-spec-shield");
    const dbWeapon = document.getElementById("db-spec-weapon");
    const dbEngine = document.getElementById("db-spec-engine");

    dbButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            dbButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const shipKey = btn.getAttribute("data-ship");
            const data = baseDatosNaves[shipKey];

            if (data && dbTitle) {
                dbTitle.innerText = data.title;
                dbSub.innerText = data.sub;
                dbClass.innerText = data.class;
                dbDesc.innerText = data.desc;
                
                dbSpeed.innerText = data.speed;
                dbShield.innerText = data.shield;
                dbWeapon.innerText = data.weapon;
                dbEngine.innerText = data.engine;
            }
        });
    });
}

/**
 * Mantiene actualizado el HUD de hora al pie de PC
 */
function actualizarRelojHUD() {
    const hudTimer = document.getElementById("hud-timer");
    const tick = () => {
        const ahora = new Date();
        const hrs = String(ahora.getHours()).padStart(2, "0");
        const mins = String(ahora.getMinutes()).padStart(2, "0");
        const segs = String(ahora.getSeconds()).padStart(2, "0");
        if (hudTimer) hudTimer.innerText = `SYS_TIME: ${hrs}:${mins}:${segs}`;
    };
    setInterval(tick, 1000);
    tick();
}

// ============================================================================
// 2. MONITOREO DE FPS GRÁFICOS
// ============================================================================
let ultimoTimestamp = 0;
let framesContados = 0;
let ultimoCalculoFps = 0;

function medirFps(timestamp) {
    if (!ultimoTimestamp) ultimoTimestamp = timestamp;
    framesContados++;

    if (timestamp - ultimoCalculoFps >= 1000) {
        const fps = Math.round((framesContados * 1000) / (timestamp - ultimoCalculoFps));
        if (telemetryFps) telemetryFps.innerText = `${fps.toFixed(1)} FPS`;
        framesContados = 0;
        ultimoCalculoFps = timestamp;
    }
    ultimoTimestamp = timestamp;
}

// ============================================================================
// 3. CARGA DE SISTEMAS NEURALES Y MODELOS TENSORFLOW
// ============================================================================
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
    
    // Dibujo de cargador
    ctx.strokeStyle = "rgba(0, 255, 204, 0.2)";
    ctx.strokeRect(220, 210, 200, 8);
    ctx.fillStyle = "#00ffcc";
    const w = 45 + Math.sin(Date.now() * 0.005) * 35;
    ctx.fillRect(320 - w/2, 212, w, 4);
    ctx.textAlign = "left";
}

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

    // Botón virtual central
    ctx.fillStyle = "rgba(0, 255, 204, 0.08)";
    ctx.strokeStyle = "rgba(0, 255, 204, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(200, 220, 240, 48);
    ctx.fillRect(200, 220, 240, 48);

    ctx.fillStyle = "#00ffcc";
    ctx.font = "bold 12px 'Orbitron', monospace";
    ctx.fillText("PRESIONA AQUÍ PARA DESPEGAR", 320, 249);
    ctx.restore();

    // Evento de despegue táctico (Soporta toques rápidos en móviles y clicks en PC)
    const despegueHandler = (e) => {
        lienzo.removeEventListener("click", despegueHandler);
        lienzo.removeEventListener("touchstart", despegueTouchHandler);
        
        inicializarDatosJuego();
        estadoApp = "jugando";
        
        // Iniciar refresco del juego a 60 FPS
        window.requestAnimationFrame(bucleDelJuego);
    };

    const despegueTouchHandler = (e) => {
        e.preventDefault(); // Evitar disparo repetido o zoom de doble click
        despegueHandler(e);
    };

    lienzo.addEventListener("click", despegueHandler);
    lienzo.addEventListener("touchstart", despegueTouchHandler, { passive: false });
}

/**
 * Realiza un escaneo facial biométrico simulado que sirve además
 * como una hermosa pantalla de carga interactiva para las redes neuronales.
 */
async function iniciarEscaneoBiometrico() {
    const authProgress = document.getElementById("auth-progress");
    const authLogText = document.getElementById("auth-log-text");
    const authScreen = document.getElementById("auth-screen");
    const consoleContainer = document.getElementById("console-container");

    // LEDs en parpadeo táctico de inicio
    if (ledPostura) ledPostura.className = "status-led loading";
    if (ledVoz) ledVoz.className = "status-led loading";
    if (ledVision) ledVision.className = "status-led loading";
    
    if (textoEstadoPostura) textoEstadoPostura.innerText = "Conectando...";
    if (textoEstadoVoz) textoEstadoVoz.innerText = "Conectando...";
    if (textoEstadoVision) textoEstadoVision.innerText = "Calibrando...";

    // A. INICIAR WEBCAM DE FORMA INMEDIATA PARA EL ESCÁNER BIOMÉTRICO
    try {
        camaraWeb = new tmPose.Webcam(280, 280, true);
        await camaraWeb.setup();
        await camaraWeb.play();

        // Inyectar cámara en el visor del escáner facial
        const authWebcamContainer = document.getElementById("auth-webcam-container");
        if (authWebcamContainer) {
            authWebcamContainer.innerHTML = "";
            camaraWeb.canvas.style.width = "100%";
            camaraWeb.canvas.style.height = "100%";
            camaraWeb.canvas.style.objectFit = "cover";
            authWebcamContainer.appendChild(camaraWeb.canvas);
        }
    } catch (eWebcam) {
        console.warn("Acceso a webcam bloqueado para escaneo:", eWebcam.message);
        if (authLogText) authLogText.innerText = "ERROR: WEBCAM NO HABILITADA";
    }

    // B. INICIAR CARGA DE MODELOS TENSORFLOW EN SEGUNDO PLANO
    let modelosCargados = false;
    (async () => {
        try {
            // 1. Descargar PoseNet
            modeloPostura = await tmPose.load(
                ENLACE_MODELO_POSTURA + "model.json",
                ENLACE_MODELO_POSTURA + "metadata.json"
            );
            if (textoEstadoPostura) textoEstadoPostura.innerText = "Postura: Conectada";
            if (ledPostura) ledPostura.className = "status-led ready";

            // 2. Descargar e iniciar Audio FFT
            try {
                modeloVoz = speechCommands.create(
                    "BROWSER_FFT", undefined,
                    ENLACE_MODELO_VOZ + "model.json",
                    ENLACE_MODELO_VOZ + "metadata.json"
                );
                await modeloVoz.ensureModelLoaded();
                
                // Conectar receptor continuo de sonido
                modeloVoz.listen(resultado => {
                    const clases = modeloVoz.wordLabels();
                    let ganadora = "";
                    let maxP = 0;
                    let probDisparo = 0;
                    let probRuido = 0;

                    for (let i = 0; i < clases.length; i++) {
                        const label = clases[i].toLowerCase();
                        const score = resultado.scores[i];
                        if (score > maxP) {
                            maxP = score;
                            ganadora = clases[i];
                        }
                        if (label.includes("class 2") || label.includes("pum") || label.includes("pew")) {
                            probDisparo = score;
                        } else if (label.includes("ruido") || label.includes("noise") || label.includes("background")) {
                            probRuido = score;
                        }
                    }

                    if (barAudioShot) {
                        const pctDisparo = Math.round(probDisparo * 100);
                        const pctRuido = Math.round(probRuido * 100);
                        barAudioShot.style.width = `${pctDisparo}%`;
                        labelAudioShot.innerText = `${pctDisparo}%`;
                        barAudioNoise.style.width = `${pctRuido}%`;
                        labelAudioNoise.innerText = `${pctRuido}%`;
                    }

                    const etiquetaNorm = ganadora.toLowerCase();
                    if (maxP >= 0.70 && (
                        etiquetaNorm.includes("disparo") || 
                        etiquetaNorm.includes("pum") || 
                        etiquetaNorm.includes("pew") || 
                        etiquetaNorm.includes("class 2") || 
                        etiquetaNorm.includes("shoot")
                    )) {
                        disparoDetectado = true;
                        const visualLabel = (ganadora === "Class 2") ? "PUM" : ganadora.toUpperCase();
                        if (textoEstadoVoz) textoEstadoVoz.innerText = `💥 DISPARO: ${visualLabel}`;
                    } 
                    else if (etiquetaNorm.includes("escudo") || 
                             etiquetaNorm.includes("shield") || 
                             etiquetaNorm.includes("proteger") || 
                             etiquetaNorm.includes("protect")) {
                        escudoDetectado = true;
                        if (textoEstadoVoz) textoEstadoVoz.innerText = `🛡️ ESCUDO: ${ganadora.toUpperCase()}`;
                    } 
                    else {
                        const visualLabel = (ganadora === "Class 2") ? "PUM" : ganadora;
                        if (textoEstadoVoz) textoEstadoVoz.innerText = `${visualLabel} (${Math.round(maxP * 100)}%)`;
                    }
                }, {
                    includeSpectrogram: true,
                    probabilityThreshold: 0.70,
                    invokeCallbackOnNoiseAndUnknown: true,
                    overlapFactor: 0.50
                });
                
                if (textoEstadoVoz) textoEstadoVoz.innerText = "Audio: En Escucha";
                if (ledVoz) ledVoz.className = "status-led ready";
            } catch (eAudio) {
                console.error("Fallo audio:", eAudio);
                if (textoEstadoVoz) textoEstadoVoz.innerText = "Audio Fallido";
                if (ledVoz) ledVoz.className = "status-led";
            }
            
            modelosCargados = true;
        } catch (errModelos) {
            console.error("Fallo carga de modelos:", errModelos);
            if (authLogText) authLogText.innerText = "ERROR ENLACE NEURAL: " + errModelos.message;
        }
    })();

    // C. CONTROLADOR DE LA ANIMACIÓN DE AUTENTICACIÓN BIOMÉTRICA
    let progreso = 0;
    const logsEscaneo = [
        "Estableciendo enlace cuántico...",
        "Detectando firma biométrica facial...",
        "Escaneando área ocular y simetría...",
        "Calibrando vectores neurales PoseNet...",
        "Sintonizando frecuencias acústicas FFT...",
        "Encriptando canal en túnel Secure-Line...",
        "Estableciendo sinapsis artificial...",
        "Autenticación completada. Enlace en línea."
    ];

    const intervaloScan = setInterval(() => {
        // Avance irregular para hacerlo realista
        if (progreso < 95) {
            progreso += Math.random() * 9 + 3;
            if (progreso > 95) progreso = 95;
        } else if (progreso >= 95 && modelosCargados) {
            progreso = 100;
        }

        progreso = Math.min(progreso, 100);

        if (authProgress) authProgress.style.width = `${progreso}%`;
        
        if (authLogText) {
            const indexLog = Math.min(Math.floor((progreso / 100) * logsEscaneo.length), logsEscaneo.length - 1);
            authLogText.innerText = `[${Math.round(progreso)}%] ${logsEscaneo[indexLog]}`;
        }

        // AL COMPLETAR EL ESCANEO FACIAL CON ÉXITO
        if (progreso >= 100) {
            clearInterval(intervaloScan);
            
            if (authLogText) {
                authLogText.style.color = "var(--cyan)";
                authLogText.innerText = "[ACCESS GRANTED] BIENVENIDO OPERADOR. DESPEGUE AUTORIZADO.";
            }

            // Transferir la cámara web activa al mini-visor PIP de la cabina de juego
            const pip = document.getElementById("pip-camara");
            if (pip && camaraWeb) {
                pip.innerHTML = "";
                camaraWeb.canvas.style.width = "100%";
                camaraWeb.canvas.style.height = "100%";
                camaraWeb.canvas.style.objectFit = "cover";
                pip.appendChild(camaraWeb.canvas);
            }

            // Activar estimación corporal e inicio de FPS de IA
            estadoApp = "listo";
            if (textoEstadoVision) textoEstadoVision.innerText = "Red Activa";
            if (ledVision) ledVision.className = "status-led ready";
            bucleIA();

            // Transición elegante y dramática a la consola
            setTimeout(() => {
                if (authScreen && consoleContainer) {
                    authScreen.style.display = "none";
                    consoleContainer.style.display = "flex";
                }
                
                // Mostrar la interfaz del canvas "Listo para despegue"
                dibujarPantallaListo();
            }, 1200);
        }
    }, 160);
}

// ============================================================================
// 4. BUCLE ASÍNCRONO DE POSE IA (25 FPS)
// Corre en segundo plano sin ralentizar los gráficos de la pantalla de juego
// ============================================================================
async function bucleIA() {
    if (estadoApp === "esperando" || estadoApp === "cargando") return;

    const tStart = performance.now();

    try {
        if (camaraWeb) {
            camaraWeb.update();
            if (modeloPostura) {
                // Procesamiento neural pesado
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

                // Actualizar LEDs y telemetría de PC
                if (textoEstadoPostura) textoEstadoPostura.innerText = `${ganadora.toUpperCase()} (${Math.round(maxP * 100)}%)`;

                // Sincronizar barras en pestaña Diagnósticos de PC
                if (barTiltLeft) {
                    barTiltLeft.style.width = `${probLeft}%`;
                    labelTiltLeft.innerText = `${probLeft}%`;
                    barTiltCenter.style.width = `${probCenter}%`;
                    labelTiltCenter.innerText = `${probCenter}%`;
                    barTiltRight.style.width = `${probRight}%`;
                    labelTiltRight.innerText = `${probRight}%`;
                }

                // Actualizar coordenada del vector de telemetría de PC
                if (telemetryVector) {
                    let vectorVal = "0.00";
                    if (ganadora === "Izquierda") vectorVal = `-${maxP.toFixed(2)}`;
                    else if (ganadora === "Derecha") vectorVal = `+${maxP.toFixed(2)}`;
                    telemetryVector.innerText = vectorVal;
                }
            }
        }
    } catch (err) {
        console.warn("Detección de pose omitida (no crítico):", err.message);
    }

    const tEnd = performance.now();
    const latencia = Math.round(tEnd - tStart);
    if (telemetryLatency) {
        telemetryLatency.innerText = `${latencia} ms`;
    }

    // Intervalo de repetición en 40ms (~25 FPS ideales)
    setTimeout(bucleIA, 40);
}

// ============================================================================
// 5. DIBUJAR ESQUELETO HOLOGRÁFICO TRANSPARENTE
// Dibuja las articulaciones como hermosas burbujas de neón flotantes
// ============================================================================
function dibujarEsqueletoHolografico(ctx, keypoints, minConfidence = 0.40) {
    ctx.save();
    
    // Conexiones de malla cian/magenta
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

    // Líneas neón magenta traslúcidas
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

    // Nodos clave en forma de BURBUJAS cian brillante con centro blanco
    ctx.shadowColor = "rgba(0, 255, 204, 0.8)";
    ctx.strokeStyle = "rgba(0, 255, 204, 0.8)";
    ctx.lineWidth = 1.3;

    keypoints.forEach(k => {
        const partesHolograma = [
            "nose", "leftShoulder", "rightShoulder", 
            "leftElbow", "rightElbow", "leftWrist", "rightWrist"
        ];
        
        if (k.score >= minConfidence && partesHolograma.includes(k.part)) {
            // Aro exterior de la burbuja
            ctx.shadowBlur = 6;
            ctx.fillStyle = "rgba(0, 255, 204, 0.1)";
            ctx.beginPath();
            ctx.arc(k.position.x, k.position.y, 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fill();

            // Píxel fotónico central
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(k.position.x, k.position.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    ctx.restore();
}

// ============================================================================
// 6. BUCLE DE GRÁFICOS DEL VIDEOJUEGO (60 FPS CONSTANTES)
// ============================================================================
function bucleDelJuego(timestamp) {
    if (estadoApp !== "jugando") return;

    // Calcular FPS reales
    medirFps(timestamp);

    // 1. Limpieza total de píxeles para mantener 100% transparente el lienzo
    ctx.clearRect(0, 0, 640, 360);

    // 2. Renderizar esqueleto de burbujas holográficas corporales
    if (ultimaPoseDetectada) {
        dibujarEsqueletoHolografico(ctx, ultimaPoseDetectada.keypoints, 0.40);
    }

    // 3. Evaluar señales de escudo (teclado manual o voz)
    const activarEscudo = teclasPresionadas["KeyS"] || teclasPresionadas["ShiftLeft"] || teclasPresionadas["KeyE"] || escudoDetectado;

    // 4. Simulación física del motor (movimientos, lásers, enemigos, burbujitas)
    actualizarYDibujarJuego(ctx, posturaActual, disparoDetectado, activarEscudo);
    
    // Sincronizar tabla de ranking en tiempo real en PC
    const scoreActual = typeof jugador !== 'undefined' ? jugador.puntuacion : 0;
    const currentScoreRow = document.getElementById("leaderboard-current-score");
    if (currentScoreRow) {
        currentScoreRow.innerText = `${String(scoreActual * 1000).padStart(3, "0")} pts`;
    }

    // 5. Restablecer banderas
    disparoDetectado = false;
    escudoDetectado = false;

    // 6. Agendar siguiente refresco a 60 FPS
    window.requestAnimationFrame(bucleDelJuego);
}

// ============================================================================
// 7. GESTOR DE CARGA DOM E INTEGRACIÓN RESPONSIVA
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Inicializar selectores de PC cacheados
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

    // Inicializar módulos interactivos de la cabina de escritorio
    inicializarTabs();
    inicializarDatabase();
    actualizarRelojHUD();

    const btnIngresar = document.getElementById("btn-ingresar");
    const landingPage = document.getElementById("landing-page");
    const consoleContainer = document.getElementById("console-container");

    // 📱 DETECCIÓN INTELIGENTE DE CELULARES (Bypass de videos de 84MB en móviles)
    const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const bgVideo = document.getElementById("bg-video");

    if (bgVideo) {
        if (esMovil) {
            // Detener la descarga del video inmediatamente en celulares y liberar ancho de banda
            bgVideo.pause();
            bgVideo.src = "";
            bgVideo.load();
            bgVideo.remove();
            console.log("📱 Celular detectado: Se canceló la descarga del video para ahorrar datos.");
        } else {
            // PC: Mantener visible (el reproductor nativo del HTML ya inició el auto-play al parsear)
            bgVideo.style.display = "block";
            bgVideo.play().catch(err => {
                console.warn("Auto-play nativo restringido:", err.message);
            });
        }
    }

    if (btnIngresar) {
        btnIngresar.addEventListener("click", () => {
            const authScreen = document.getElementById("auth-screen");
            // Ocultar landing de bienvenida y mostrar pantalla de escaneo facial
            if (landingPage && authScreen) {
                landingPage.style.display = "none";
                authScreen.style.display = "flex";
            }
            
            // Reemplazar video por fondo2.mp4 (Solo en PC de escritorio)
            if (!esMovil && bgVideo) {
                const bgVideoDesktop = document.getElementById("bg-video");
                if (bgVideoDesktop) {
                    bgVideoDesktop.src = "fondo2.mp4"; // Ruta relativa perfecta
                    bgVideoDesktop.load();
                    bgVideoDesktop.play().catch(err => {
                        console.warn("Auto-play de video bloqueado por políticas de navegador:", err.message);
                    });
                }
            }
            
            // Iniciar webcam e inicio de sesión biométrico simulado
            iniciarEscaneoBiometrico();
        });
    }

    // Entrada híbrida física de teclado
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

console.log("main.js v10.0 cargado con cabina multi-tab de escritorio y docking responsivo de celular ✅");