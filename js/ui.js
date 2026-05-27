/**
 * ============================================================================
 * NEON DEFENDER IA — UI & TELEMETRY MODULE
 * ============================================================================
 * Gestión interactiva de pestañas tácticas de cabina, base de datos de Lore
 * espacial y osciloscopio de FPS para computadoras de escritorio.
 * ============================================================================
 */

// Biblioteca de datos descriptivos de naves espaciales (Lore)
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
        desc: "Malla de plasma protectora que aprovecha las ondas sónicas del operador para condensar un blindaje hexagonal traslúcido. Capaz de neutralizar al 100% el impacto cinético de los Hex Invaders absorbiendo energía nuclear táctica. Requiere 3 segundos de recuperación al colapsar.",
        speed: "N/A",
        shield: "Matriz Auto-Cian",
        weapon: "Campo Repulsor",
        engine: "Sonic Condenser"
    }
};

/**
 * Gestiona el intercambio de pestañas en la cabina de escritorio
 */
function inicializarTabs() {
    const tabButtons = document.querySelectorAll(".nav-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTabId = btn.getAttribute("data-tab");
            
            tabButtons.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));

            btn.classList.add("active");
            const target = document.getElementById(targetTabId);
            if (target) target.classList.add("active");
        });
    });
}

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
                
                if (dbSpeed) dbSpeed.innerText = data.speed;
                if (dbShield) dbShield.innerText = data.shield;
                if (dbWeapon) dbWeapon.innerText = data.weapon;
                if (dbEngine) dbEngine.innerText = data.engine;
            }
        });
    });
}

/**
 * Mantiene actualizado el reloj HUD táctico
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

// Variables de medición de FPS
let ultimoTimestamp = 0;
let framesContados = 0;
let ultimoCalculoFps = 0;

/**
 * Osciloscopio de FPS reales en cabina
 */
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
