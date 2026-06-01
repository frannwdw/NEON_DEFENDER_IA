/**
 * ============================================================================
 * MOTOR DE JUEGO: NEON DEFENDER IA — v7.0 (EDICIÓN FINAL OPTIMIZADA)
 * ============================================================================
 * Lógica física a 60 FPS, sistemas interactivos de partículas de neón,
 * estelas de burbujas holográficas y disparo vocal sostenido acumulativo.
 * 
 * Diseñado y refactorizado de forma modular, libre de redundancias y
 * completamente documentado en español para máxima legibilidad pedagógica.
 * ============================================================================
 */

// ============================================================================
// 1. CONFIGURACIÓN Y ESTADO GLOBAL DEL JUGADOR
// ============================================================================
const ES_MOVIL_JUEGO = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
const TOTAL_ESTRELLAS = ES_MOVIL_JUEGO ? 28 : 60;
const MAX_PARTICULAS = ES_MOVIL_JUEGO ? 80 : 180;


// ============================================================================
// 0. SISTEMA DE SEGURIDAD Y CALIBRACIÓN DE RENDIMIENTO GRÁFICO (AUTO-GLOW REGULATION)
// ============================================================================
let HABILITAR_SOMBRAS = !ES_MOVIL_JUEGO; // Desactivado por defecto en móviles, activado en PC
let MAX_BLUR_NEON = 4; // Cota superior de radio para evitar el alto coste de Gaussian Blur en CPU de PC

function aplicarSombraNeon(ctx, color, blur) {
    if (HABILITAR_SOMBRAS && blur > 0) {
        ctx.shadowBlur = Math.min(blur, MAX_BLUR_NEON);
        ctx.shadowColor = color;
    } else {
        ctx.shadowBlur = 0;
    }
}

function desactivarSombraNeon(ctx) {
    ctx.shadowBlur = 0;
}

let jugador = {
    // Coordenadas en el espacio 2D
    x: 320,
    y: 300,
    carrilObjetivo: 320,
    
    // Interpolación lineal (LERP) para un movimiento suave controlado por IA
    velocidadSuave: 0.09,
    
    // Estadísticas vitales y de puntuación
    vida: 3,
    puntuacion: 0,
    invulnerable: 0,        // Duración (en frames) de inmunidad tras recibir daño
    combo: 0,               // Multiplicador de impactos consecutivos
    ultimoCombo: 0,         // Timestamp del último impacto para el desvanecimiento visual
    
    // SISTEMA DE ESCUDO DE ENERGÍA CYBERPUNK (Activación por tecla 'S' / Shift / voz "escudo")
    escudoActivo: false,
    energiaEscudo: 100,
    escudoBloqueado: false, // Bloqueo de seguridad si la barra se vacía al 100%
    tiempoRecarga: 0,       // Temporizador de recarga de escudo en frames
    
    // NUEVO: SISTEMA DE DISPARO ACÚSTICO CONTINUO (Cantar "PUM" carga esta duración)
    tiempoFuegoContinuo: 0  // Duración restante (en frames) de la ráfaga continua sostenida
};

// ============================================================================
// 2. ARRAYS DE ENTIDADES Y CONTROL DE FÍSICA
// ============================================================================
let disparos = [];          // Contenedor de proyectiles láser magenta activos
let enemigos = [];          // Contenedor de amenazas alienígenas de carril activas
let particulas = [];         // Contenedor de explosiones y estelas de burbujas
let estrellas = [];          // Campo estelar parallax de fondo
let sacudida = { x: 0, y: 0, fuerza: 0 }; // Estructura de vibración del visor táctico

let temporizadorEnemigos = 0; // Control de spawn para sincronizar la entrada de asteroides
let juegoTerminado = false;   // Estado de fin de partida
let ultimoDisparo = 0;        // Filtro para controlar la cadencia de entrada del audio

// Constantes del motor físico
const CADENCIA_ACCESO = 220;  // Tiempo mínimo (ms) de espera entre recargas del disparo sónico
const RITMO_DISPARO = 12;     // Cadencia de disparo interna: 1 láser cada 12 frames (~5 disparos/seg)

// ============================================================================
// 3. CAMPO DE ESTRELLAS DE PARALLAX DE RESPALDO
// ============================================================================
/**
 * Inicializa el campo estelar con posiciones, velocidades y tamaños aleatorios
 */
function inicializarEstrellas() {
    estrellas = [];
    for (let i = 0; i < TOTAL_ESTRELLAS; i++) {
        estrellas.push({
            x: Math.random() * 640,
            y: Math.random() * 360,
            radio: Math.random() * 1.0 + 0.2,
            velocidad: Math.random() * 0.35 + 0.1,
            alpha: Math.random() * 0.5 + 0.2,
            parpadeo: Math.random() * Math.PI * 2
        });
    }
}
inicializarEstrellas();

/**
 * Mueve y renderiza el campo de estrellas de fondo
 * @param {CanvasRenderingContext2D} ctx - Contexto 2D del canvas
 */
function dibujarEstrellas(ctx) {
    estrellas.forEach(s => {
        s.y += s.velocidad;
        s.parpadeo += 0.025; // Control de destello
        
        // Reciclaje de estrellas cuando salen de la pantalla
        if (s.y > 360) {
            s.y = 0;
            s.x = Math.random() * 640;
        }
        
        const alpha = s.alpha * (0.7 + 0.3 * Math.sin(s.parpadeo));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radio, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0; // Restablecer opacidad
}

// ============================================================================
// 4. SISTEMA DE PARTÍCULAS: EXPLOSIONES Y ESTELAS DE BURBUJAS HOLOGRÁFICAS
// ============================================================================
/**
 * Genera partículas circulares expansivas simulando una detonación o impacto
 * @param {number} x - Coordenada X central
 * @param {number} y - Coordenada Y central
 * @param {string} color - Color neón del destello
 * @param {number} cantidad - Número de partículas a emitir
 */
function crearExplosion(x, y, color, cantidad = 12) {
    const total = ES_MOVIL_JUEGO ? Math.max(2, Math.ceil(cantidad * 0.55)) : cantidad;
    for (let i = 0; i < total; i++) {
        const angulo = (Math.PI * 2 / total) * i + Math.random() * 0.3;
        const spd = Math.random() * 3.5 + 1.2;
        particulas.push({
            x: x,
            y: y,
            vx: Math.cos(angulo) * spd,
            vy: Math.sin(angulo) * spd,
            vida: 1.0,
            decaimiento: 0.035 + Math.random() * 0.035,
            color: color,
            radio: Math.random() * 2.5 + 1.2,
            esFlash: false,
            esBurbujaTrail: false
        });
    }
    
    // Añadir un destello fotónico blanco instantáneo en el epicentro
    particulas.push({
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        vida: 1.0,
        decaimiento: 0.12,
        color: "#ffffff",
        radio: 8,
        esFlash: true,
        esBurbujaTrail: false
    });

    if (particulas.length > MAX_PARTICULAS) {
        particulas.splice(0, particulas.length - MAX_PARTICULAS);
    }
}

/**
 * Actualiza, filtra y renderiza todas las partículas activas
 * @param {CanvasRenderingContext2D} ctx - Contexto 2D del canvas
 */
function actualizarParticulas(ctx) {
    if (particulas.length > MAX_PARTICULAS) {
        particulas.splice(0, particulas.length - MAX_PARTICULAS);
    }

    for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i];
        
        // Mover partícula basándose en su velocidad y fricción (frenado suave)
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92;
        p.vy *= 0.92;
        
        // Reducir ciclo de vida
        p.vida -= p.decaimiento;

        // Eliminar del array si ha expirado
        if (p.vida <= 0) {
            particulas.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = p.vida;

        const r = Math.max(0.1, p.radio * p.vida);

        if (p.esBurbujaTrail) {
            // RENDIMIENTO E ILUSIÓN ÓPTICA DE BURBUJAS DE NEÓN FLOTANTES
            aplicarSombraNeon(ctx, p.color, 8);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1.3;
            
            // Dibujar aro exterior brillante
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.stroke();
            
            // Relleno interior ultra-translúcido para simular cuerpo esférico
            ctx.fillStyle = p.color.replace("0.8", "0.08");
            ctx.fill();
        } else {
            // RENDERIZADO DE CHISPAS DE EXPLOSIÓN Y DESTELLOS DE CAÑÓN
            aplicarSombraNeon(ctx, p.color, p.esFlash ? 16 : 6);
            ctx.fillStyle = p.color;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// ============================================================================
// 5. EFECTO SÍSMICO DE SACUDIDA DE PANTALLA
// ============================================================================
/**
 * Inyecta una fuerza de vibración física a la interfaz (usado en choques)
 * @param {number} fuerza - Magnitud en píxeles de la vibración
 */
function aplicarSacudida(fuerza) {
    sacudida.fuerza = fuerza;
}

// ============================================================================
// 6. INICIALIZAR / EMPEZAR NUEVA PARTIDA
// ============================================================================
/**
 * Reestablece todas las variables de jugador, física y arrays a sus valores por defecto
 */
function inicializarDatosJuego() {
    jugador.vida = 3;
    jugador.puntuacion = 0;
    jugador.x = 320;
    jugador.carrilObjetivo = 320;
    jugador.invulnerable = 0;
    jugador.combo = 0;
    
    // Reestablecer matriz de escudo
    jugador.escudoActivo = false;
    jugador.energiaEscudo = 100;
    jugador.escudoBloqueado = false;
    jugador.tiempoRecarga = 0;
    
    // Reestablecer acumulador de disparo sónico
    jugador.tiempoFuegoContinuo = 0;
    
    // Limpieza de arrays de entidades
    disparos = [];
    enemigos = [];
    particulas = [];
    juegoTerminado = false;
    temporizadorEnemigos = 0;
    sacudida = { x: 0, y: 0, fuerza: 0 };
}

// ============================================================================
// 7. RENDERIZADO DE PANTALLAS DE INTERFAZ Y MODELOS GRÁFICOS
// ============================================================================
/**
 * Dibuja la pantalla retro-futurista de Game Over al interrumpir conexión
 */
function dibujarPantallaFin(ctx) {
    ctx.fillStyle = "rgba(3, 3, 10, 0.88)";
    ctx.fillRect(0, 0, 640, 360);

    // Líneas horizontales de scanline decorativas de neón tenue
    ctx.strokeStyle = "rgba(255, 0, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const y = 80 + i * 42;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke();
    }

    ctx.save();
    aplicarSombraNeon(ctx, "#ff0055", 25);
    ctx.fillStyle = "#ff0055";
    ctx.font = "bold 38px 'Orbitron', monospace";
    ctx.textAlign = "center";
    ctx.fillText("CONEXIÓN INTERRUMPIDA", 320, 130);

    aplicarSombraNeon(ctx, "#00ffcc", 5);
    ctx.strokeStyle = "rgba(0, 255, 204, 0.4)";
    ctx.beginPath(); ctx.moveTo(180, 150); ctx.lineTo(460, 150); ctx.stroke();

    ctx.fillStyle = "#00ffcc";
    ctx.font = "bold 20px 'Orbitron', monospace";
    ctx.fillText(`SCORE MÁXIMO: ${jugador.puntuacion * 1000} PTS`, 320, 195);

    desactivarSombraNeon(ctx);
    ctx.fillStyle = "rgba(209, 226, 247, 0.7)";
    ctx.font = "bold 13px 'Rajdhani', sans-serif";
    ctx.fillText("INCLÍNATE A LA IZQUIERDA O DERECHA PARA RECONECTAR EL REACTOR", 320, 255);
    ctx.restore();
}

/**
 * Renderiza la nave espacial experimental Neon Defender y su escudo cian
 */
function dibujarNave(ctx, x, y, invulnerable) {
    // Parpadeo visual estroboscópico de inmunidad tras impacto cinético
    const alpha = invulnerable > 0 ? (Math.sin(Date.now() * 0.02) > 0 ? 0.35 : 1.0) : 1.0;
    
    ctx.save();
    ctx.globalAlpha = alpha;

    // --- DIBUJAR CAMPO DE FUERZA HEXAGONAL (Si está activo) ---
    if (jugador.escudoActivo && jugador.energiaEscudo > 0) {
        ctx.save();
        ctx.translate(x, y - 2);
        
        aplicarSombraNeon(ctx, "#00d9ff", 15 + Math.sin(Date.now() * 0.025) * 5);
        ctx.strokeStyle = "rgba(0, 217, 255, 0.85)";
        ctx.lineWidth = 2 + Math.sin(Date.now() * 0.015) * 0.5;
        
        // Esfera externa de energía
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();

        // Relleno hexagonal rotativo holográfico
        ctx.fillStyle = "rgba(0, 217, 255, 0.1)";
        ctx.beginPath();
        const lados = 6;
        const rHex = 27;
        for (let i = 0; i < lados; i++) {
            const a = (Math.PI * 2 / lados) * i + (Date.now() * 0.0006);
            if (i === 0) {
                ctx.moveTo(Math.cos(a) * rHex, Math.sin(a) * rHex);
            } else {
                ctx.lineTo(Math.cos(a) * rHex, Math.sin(a) * rHex);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // --- RENDERIZAR MOTOR PROPULSOR DE PLASMA ---
    const flamaAlpha = 0.4 + 0.4 * Math.sin(Date.now() * 0.015);
    aplicarSombraNeon(ctx, "#ff6600", 12);
    ctx.fillStyle = `rgba(255, 100, 0, ${flamaAlpha})`;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 22);
    ctx.lineTo(x, y + 33 + Math.sin(Date.now() * 0.02) * 5);
    ctx.lineTo(x + 8, y + 22);
    ctx.closePath();
    ctx.fill();

    // --- CASCO Y ALAS DE NEÓN DE LA NAVE DEFENDER ---
    aplicarSombraNeon(ctx, "#00ffcc", 18);
    ctx.fillStyle = "#00ffcc";
    ctx.beginPath();
    ctx.moveTo(x, y - 22);
    ctx.lineTo(x + 18, y + 14);
    ctx.lineTo(x + 8, y + 8);
    ctx.lineTo(x, y + 16);
    ctx.lineTo(x - 8, y + 8);
    ctx.lineTo(x - 18, y + 14);
    ctx.closePath();
    ctx.fill();

    // --- CABINA INTERIOR DE MANDO NEGRA ---
    ctx.fillStyle = "rgba(3, 3, 10, 0.85)";
    desactivarSombraNeon(ctx);
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + 6, y + 4);
    ctx.lineTo(x - 6, y + 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

/**
 * Renderiza una amenaza alienígena cristalina hexagonal (Hex Invader)
 */
function dibujarEnemigo(ctx, ene) {
    const t = Date.now() * 0.002 + ene.fase;
    const lados = 6;
    const r = ene.ancho / 2;

    ctx.save();
    ctx.translate(ene.x, ene.y);
    ctx.rotate(t); // Rotación angular constante

    // Halo y contorno neón brillante
    aplicarSombraNeon(ctx, "#ffcc00", 14);
    ctx.strokeStyle = "rgba(255, 204, 0, 0.55)";
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    for (let i = 0; i < lados; i++) {
        const a = (Math.PI * 2 / lados) * i - Math.PI / 2;
        if (i === 0) {
            ctx.moveTo(Math.cos(a) * (r + 4), Math.sin(a) * (r + 4));
        } else {
            ctx.lineTo(Math.cos(a) * (r + 4), Math.sin(a) * (r + 4));
        }
    }
    ctx.closePath();
    ctx.stroke();

    // Relleno sólido amarillo ámbar
    ctx.fillStyle = "#ffcc00";
    ctx.beginPath();
    for (let i = 0; i < lados; i++) {
        const a = (Math.PI * 2 / lados) * i - Math.PI / 2;
        if (i === 0) {
            ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        } else {
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
    }
    ctx.closePath();
    ctx.fill();

    // Núcleo cristalino oscuro
    ctx.fillStyle = "rgba(3, 3, 10, 0.8)";
    desactivarSombraNeon(ctx);
    ctx.beginPath();
    for (let i = 0; i < lados; i++) {
        const a = (Math.PI * 2 / lados) * i - Math.PI / 2;
        if (i === 0) {
            ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
        } else {
            ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
        }
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

/**
 * Pinta los marcadores superiores de vidas (corazones), escudo y combo en el lienzo
 */
function dibujarHUD(ctx) {
    ctx.save();
    
    // --- MARCADOR DE VIDAS (Corazones de neón magenta) ---
    aplicarSombraNeon(ctx, "#ff0044", 8);
    ctx.font = "bold 15px 'Orbitron', monospace";
    ctx.fillStyle = "#ff4466";
    for (let i = 0; i < jugador.vida; i++) {
        ctx.fillText("♥", 18 + i * 24, 28);
    }
    // Corazones vacíos/gastados
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    desactivarSombraNeon(ctx);
    for (let i = jugador.vida; i < 3; i++) {
        ctx.fillText("♥", 18 + i * 24, 28);
    }

    // --- INDICADOR DE ESCUDO CYBERPUNK ---
    aplicarSombraNeon(ctx, jugador.escudoBloqueado ? "#ff0055" : "#00d9ff", 6);
    ctx.fillStyle = "rgba(0, 217, 255, 0.15)";
    ctx.fillRect(18, 40, 100, 6);
    ctx.fillStyle = jugador.escudoBloqueado ? "#ff0055" : "#00d9ff";
    ctx.fillRect(18, 40, Math.max(0, jugador.energiaEscudo), 6);
    
    desactivarSombraNeon(ctx);
    ctx.font = "bold 8px 'Orbitron', monospace";
    ctx.fillStyle = jugador.escudoBloqueado ? "rgba(255, 0, 85, 0.85)" : "rgba(0, 217, 255, 0.85)";
    ctx.fillText(jugador.escudoBloqueado ? "SHIELD SYSTEM: LOCK / COOLDOWN" : "SHIELD MATRIX STATUS", 18, 56);

    // --- MARCADOR TÁCTICO DE SCORE ---
    aplicarSombraNeon(ctx, "#00ffcc", 10);
    ctx.fillStyle = "#00ffcc";
    ctx.font = "bold 14px 'Orbitron', monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${String(jugador.puntuacion * 1000).padStart(6, "0")}`, 626, 28);

    desactivarSombraNeon(ctx);
    ctx.fillStyle = "rgba(0, 255, 204, 0.4)";
    ctx.font = "9px 'Orbitron', monospace";
    ctx.fillText("SCORE", 626, 40);

    // --- INDICADOR DE COMBO DE IMPACTOS ---
    if (jugador.combo > 1) {
        // Desvanecimiento del combo pasados 500ms
        const comboAlpha = Math.min(1, (500 - (Date.now() - jugador.ultimoCombo)) / 500);
        if (comboAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = comboAlpha;
            aplicarSombraNeon(ctx, "#ff00ff", 15);
            ctx.fillStyle = "#ff00ff";
            ctx.font = `bold ${14 + jugador.combo}px 'Orbitron', monospace`;
            ctx.textAlign = "center";
            ctx.fillText(`x${jugador.combo} COMBO`, 320, 50);
            ctx.restore();
        }
    }

    ctx.restore();
}

// ============================================================================
// 8. FÍSICAS, DETECCIÓN DE COLISIONES Y ACTUALIZACIÓN FRAME A FRAME
// ============================================================================
/**
 * Bucle principal de físicas de game.js ejecutado a 60 FPS por requestAnimationFrame
 * @param {CanvasRenderingContext2D} ctx - Contexto 2D del canvas
 * @param {string} postura - Postura ganadora detectada por IA ("Izquierda", "Centro", "Derecha")
 * @param {boolean} disparoSonido - Flag de disparo sónico disparado en este frame
 * @param {boolean} activarEscudo - Flag indicando si el escudo está presionado/activado
 */
function actualizarYDibujarJuego(ctx, postura, disparoSonido, activarEscudo) {

    // --- A: COMPROBACIÓN DE GAME OVER ---
    if (juegoTerminado) {
        dibujarPantallaFin(ctx);
        // Si el jugador se inclina a los lados en Game Over, reinicia automáticamente
        if (postura === "Izquierda" || postura === "Derecha") {
            inicializarDatosJuego();
        }
        return;
    }

    // --- B: MANEJO DEL ESCUDO DE FUERZA HOLOGRÁFICO ---
    if (activarEscudo && !jugador.escudoBloqueado) {
        jugador.escudoActivo = true;
        jugador.energiaEscudo -= 0.65; // Ritmo de vaciado de la barra
        
        // Bloqueo total si llega a cero
        if (jugador.energiaEscudo <= 0) {
            jugador.energiaEscudo = 0;
            jugador.escudoActivo = false;
            jugador.escudoBloqueado = true;
            jugador.tiempoRecarga = 180; // 3 segundos de penalización a 60 FPS
        }
    } else {
        jugador.escudoActivo = false;
        
        // Temporizador de penalización por vaciado
        if (jugador.escudoBloqueado) {
            jugador.tiempoRecarga--;
            if (jugador.tiempoRecarga <= 0) {
                jugador.escudoBloqueado = false;
            }
        }
        
        // Recarga regenerativa pasiva de energía del escudo si está apagado
        if (!jugador.escudoBloqueado && jugador.energiaEscudo < 100) {
            jugador.energiaEscudo = Math.min(100, jugador.energiaEscudo + 0.22);
        }
    }

    // --- C: PROCESAR VIBRACIÓN SÍSMICA DE PANTALLA ---
    let ox = 0, oy = 0;
    if (sacudida.fuerza > 0.3) {
        ox = (Math.random() - 0.5) * sacudida.fuerza;
        oy = (Math.random() - 0.5) * sacudida.fuerza;
        sacudida.fuerza *= 0.78; // Atenuación progresiva
        ctx.save();
        ctx.translate(ox, oy);
    }

    // --- D: RENDERIZAR CAMPO PARALLAX Y RETÍCULA CIBERNÉTICA ---
    dibujarEstrellas(ctx);

    // Dibujar guías verticales de los 3 carriles de combate
    ctx.strokeStyle = "rgba(255, 0, 255, 0.08)";
    ctx.lineWidth = 1;
    [[240, 0, 240, 360], [400, 0, 400, 360]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });
    ctx.setLineDash([8, 12]);
    ctx.strokeStyle = "rgba(0, 255, 204, 0.06)";
    ctx.beginPath(); ctx.moveTo(320, 0); ctx.lineTo(320, 360); ctx.stroke();
    ctx.setLineDash([]);

    // --- E: FÍSICAS DE MOVIMIENTO SUAVE DEL JUGADOR (LERP) ---
    // carrilObjetivo ahora es calculado continuamente por la nariz en main.js, 
    // lo que da una precisión milimétrica instantánea y sin fricción de carriles rígidos.

    // Almacenar coordenada anterior para estimar la inercia del movimiento
    const anteriorX = jugador.x;
    jugador.x += (jugador.carrilObjetivo - jugador.x) * jugador.velocidadSuave;
    
    if (jugador.invulnerable > 0) {
        jugador.invulnerable--;
    }

    // --- F: EMITIR BURBUJITAS DE SEGUIMIENTO EN EL RASTRO DE LA NAVE ---
    const velocidadMovimiento = Math.abs(jugador.x - anteriorX);
    // Probabilidad base combinada con la velocidad lateral de la nave
    const probabilidadTrail = ES_MOVIL_JUEGO ? 0.10 + (velocidadMovimiento * 0.06) : 0.25 + (velocidadMovimiento * 0.15);
    if (Math.random() < probabilidadTrail) {
        particulas.push({
            x: jugador.x + (Math.random() - 0.5) * 15,
            y: jugador.y + 14,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 1.8 + Math.random() * 2.5, // Fluyen verticalmente hacia abajo
            vida: 1.0,
            decaimiento: 0.02 + Math.random() * 0.02,
            color: Math.random() > 0.4 ? "rgba(0, 255, 204, 0.8)" : "rgba(255, 0, 255, 0.8)",
            radio: 1.8 + Math.random() * 4.5,
            esFlash: false,
            esBurbujaTrail: true
        });
    }

    // --- G: DIBUJAR NAVE ESPACIAL ---
    dibujarNave(ctx, jugador.x, jugador.y, jugador.invulnerable);

    // --- H: INTEGRACIÓN DEL DISPARO CONTINUO SOSTENIDO POR VOZ (ACUMULATIVO) ---
    const ahora = Date.now();
    
    // Si se activa el comando de disparo (voz "PUM" o tecla Espacio) con filtro de latencia sónica
    if (disparoSonido && (ahora - ultimoDisparo > CADENCIA_ACCESO)) {
        // Agrega 45 frames de disparo automático continuo (~0.75 segundos de fuegos rápidos)
        // Permite acumularse hasta un tope de 150 frames (2.5 segundos) al cantar "PUM PUM" reiteradas veces
        jugador.tiempoFuegoContinuo = Math.min(150, jugador.tiempoFuegoContinuo + 45);
        
        // Destello táctico instantáneo en las puntas de las alas
        crearExplosion(jugador.x, jugador.y - 22, "rgba(255, 0, 255, 0.85)", 3);
        ultimoDisparo = ahora;
    }

    // Procesar la cola de disparo continuo cuadro a cuadro
    if (jugador.tiempoFuegoContinuo > 0) {
        jugador.tiempoFuegoContinuo--;
        
        // Detona un proyectil láser magenta a un intervalo constante de RITMO_DISPARO
        if (jugador.tiempoFuegoContinuo % RITMO_DISPARO === 0) {
            disparos.push({ x: jugador.x, y: jugador.y - 22, velocidad: 9.5 });
            
            // Microdestello térmico del disparo
            crearExplosion(jugador.x, jugador.y - 22, "rgba(255, 0, 255, 0.5)", 1);
        }
    }

    // --- I: RENDERIZAR Y DESPLAZAR LÁSERES MAGENTA ACTIVOS ---
    ctx.save();
    aplicarSombraNeon(ctx, "#ff00ff", 12);
    for (let i = disparos.length - 1; i >= 0; i--) {
        const las = disparos[i];
        las.y -= las.velocidad;

        // Degradado de estela difusa en los proyectiles láser
        const gradienteLaser = ctx.createLinearGradient(las.x, las.y, las.x, las.y + 18);
        gradienteLaser.addColorStop(0, "#ffffff");
        gradienteLaser.addColorStop(0.3, "#ff00ff");
        gradienteLaser.addColorStop(1, "rgba(255, 0, 255, 0)");
        
        ctx.fillStyle = gradienteLaser;
        ctx.fillRect(las.x - 2, las.y, 4, 18);

        // Descartar si el proyectil sale del plano táctico superior
        if (las.y < -20) {
            disparos.splice(i, 1);
        }
    }
    ctx.restore();

    // --- J: SPAWN Y EQUILIBRIO DE OBSTÁCULOS EN CARRILES ---
    temporizadorEnemigos++;
    // Frecuencia dinámica: a mayor score, los enemigos ingresan más rápido
    const frecuenciaEnemigos = 85 - Math.min(45, Math.floor(jugador.puntuacion / 40));
    
    if (temporizadorEnemigos > frecuenciaEnemigos) {
        const carriles = [140, 320, 500];
        const carrilAleatorio = carriles[Math.floor(Math.random() * carriles.length)];
        
        enemigos.push({
            x: carrilAleatorio,
            y: -25,
            // Velocidad equilibrada a la mitad respecto al arcade inicial para permitir maniobrabilidad
            velocidad: 1.3 + Math.random() * 1.2 + jugador.puntuacion * 0.0015,
            ancho: 26,
            alto: 26,
            fase: Math.random() * Math.PI * 2 // Fase de desfase para la rotación
        });
        temporizadorEnemigos = 0;
    }

    // --- K: DETECCIÓN FÍSICA DE COLISIONES ---
    for (let i = enemigos.length - 1; i >= 0; i--) {
        const ene = enemigos[i];
        ene.y += ene.velocidad;

        dibujarEnemigo(ctx, ene);

        // A. Colisión física contra el área cinemática de la nave
        if (jugador.invulnerable === 0 && Math.abs(ene.x - jugador.x) < 24 && Math.abs(ene.y - jugador.y) < 24) {
            if (jugador.escudoActivo && jugador.energiaEscudo > 0) {
                // ¡El escudo absorbe cinéticamente la colisión!
                crearExplosion(ene.x, ene.y, "#00d9ff", 16);
                enemigos.splice(i, 1);
                
                // Drenaje cinético severo (35% de capacidad)
                jugador.energiaEscudo -= 35;
                if (jugador.energiaEscudo <= 0) {
                    jugador.energiaEscudo = 0;
                    jugador.escudoActivo = false;
                    jugador.escudoBloqueado = true;
                    jugador.tiempoRecarga = 240; // Penalización por rotura total de 4 segundos
                }
                aplicarSacudida(13); // Sacudida táctica del visor
            } else {
                // Daño directo a la estructura de la nave (pérdida de vida)
                crearExplosion(ene.x, ene.y, "#ffcc00", 12);
                enemigos.splice(i, 1);
                jugador.vida--;
                jugador.combo = 0;
                jugador.invulnerable = 90; // Frame de inmunidad ~1.5s
                aplicarSacudida(10);
                
                if (jugador.vida <= 0) {
                    juegoTerminado = true;
                }
            }
            continue;
        }

        // B. Colisión de láseres magenta contra obstáculos
        let impactoLaser = false;
        for (let j = disparos.length - 1; j >= 0; j--) {
            const las = disparos[j];
            
            if (Math.abs(las.x - ene.x) < 20 && Math.abs(las.y - ene.y) < 20) {
                // ¡Impacto directo y destrucción!
                crearExplosion(ene.x, ene.y, "#ffcc00", 8);
                enemigos.splice(i, 1);
                disparos.splice(j, 1);
                
                // Incrementar score y combos
                jugador.puntuacion += 10;
                jugador.combo++;
                jugador.ultimoCombo = Date.now();
                
                // Bonificador de score por rachas de combos activos (x3 o mayor)
                if (jugador.combo >= 3) {
                    jugador.puntuacion += jugador.combo * 2;
                }
                
                impactoLaser = true;
                break;
            }
        }
        if (impactoLaser) continue;

        // C. Penalización de score si el obstáculo evade las defensas y cruza la frontera
        if (ene.y > 385) {
            enemigos.splice(i, 1);
            jugador.puntuacion = Math.max(0, jugador.puntuacion - 2);
            jugador.combo = 0; // Se corta la racha
        }
    }

    // --- L: ACTUALIZAR Y PINTAR SISTEMA DE PARTÍCULAS ---
    actualizarParticulas(ctx);

    // --- M: DIBUJAR CAPAS HUD ---
    dibujarHUD(ctx);

    // Restaurar transformación de sacudida
    if (sacudida.fuerza > 0.3) {
        ctx.restore();
    }
}
