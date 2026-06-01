/**
 * ============================================================================
 * NEON DEFENDER IA — BIOMETRIC AUTHENTICATOR & PRELOADER MODULE
 * ============================================================================
 * Escáner facial biométrico simulado a 60 FPS por requestAnimationFrame
 * y cargador asíncrono concurrente de modelos de Google Teachable Machine.
 * ============================================================================
 */

/**
 * Realiza un escaneo facial biométrico simulado que sirve además
 * como una hermosa pantalla de carga interactiva para las redes neuronales.
 */
async function iniciarEscaneoBiometrico() {
    const authProgress = document.getElementById("auth-progress");
    const authLogText = document.getElementById("auth-log-text");
    const authScreen = document.getElementById("auth-screen");
    const consoleContainer = document.getElementById("console-container");
    const esMovil = typeof ES_MOVIL !== "undefined" && ES_MOVIL;
    const tamanoCamara = esMovil ? 200 : 280;
    const intervaloScanCamara = esMovil ? 100 : 16;

    // LEDs en parpadeo táctico de inicio
    if (ledPostura) ledPostura.className = "status-led loading";
    if (ledVoz) ledVoz.className = "status-led loading";
    if (ledVision) ledVision.className = "status-led loading";
    
    if (textoEstadoPostura) textoEstadoPostura.innerText = "Conectando...";
    if (textoEstadoVoz) textoEstadoVoz.innerText = "Conectando...";
    if (textoEstadoVision) textoEstadoVision.innerText = "Calibrando...";

    // A. INICIAR WEBCAM DE FORMA INMEDIATA PARA EL ESCÁNER BIOMÉTRICO
    try {
        camaraWeb = new tmPose.Webcam(tamanoCamara, tamanoCamara, true);
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

        // Bucle de actualización a 60 FPS de la webcam en el canvas del escáner
        estadoApp = "escaneando";
        let ultimoScanCamara = 0;
        const actualizarCamaraScan = (timestamp) => {
            if (estadoApp === "escaneando" && camaraWeb) {
                if (!ultimoScanCamara || timestamp - ultimoScanCamara >= intervaloScanCamara) {
                    camaraWeb.update();
                    ultimoScanCamara = timestamp;
                }
                requestAnimationFrame(actualizarCamaraScan);
            }
        };
        requestAnimationFrame(actualizarCamaraScan);

    } catch (eWebcam) {
        console.warn("Acceso a webcam bloqueado para escaneo:", eWebcam.message);
        if (authLogText) authLogText.innerText = "ERROR: WEBCAM NO HABILITADA";
    }

    // B. INICIAR CARGA DE MODELOS TENSORFLOW EN SEGUNDO PLANO
    let modelosCargados = false;
    let errorCargaModelos = null;
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
                    else if (maxP >= 0.70 && (
                             etiquetaNorm.includes("escudo") || 
                             etiquetaNorm.includes("shield") || 
                             etiquetaNorm.includes("proteger") || 
                             etiquetaNorm.includes("protect"))) {
                        escudoDetectado = true;
                        if (textoEstadoVoz) textoEstadoVoz.innerText = `🛡️ ESCUDO: ${ganadora.toUpperCase()}`;
                    } 
                    else {
                        const visualLabel = (ganadora === "Class 2") ? "PUM" : ganadora;
                        if (textoEstadoVoz) textoEstadoVoz.innerText = `${visualLabel} (${Math.round(maxP * 100)}%)`;
                    }
                }, {
                    includeSpectrogram: false,
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
            errorCargaModelos = errModelos;
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
        if (errorCargaModelos) {
            clearInterval(intervaloScan);
            if (authProgress) authProgress.style.width = "100%";
            if (authLogText) {
                authLogText.style.color = "var(--rojo-neon)";
                authLogText.innerText = "ERROR ENLACE NEURAL: RECARGA LA PÁGINA";
            }
            if (ledPostura) ledPostura.className = "status-led";
            if (ledVision) ledVision.className = "status-led";
            return;
        }

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
