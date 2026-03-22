let Titulo = document.title;

window.addEventListener('blur', () => {
    Titulo = document.title;
    document.title = "No te vayas, regresa :(";
})

window.addEventListener('focus', () => {
    document.title = Titulo;
})

let h1 = document.getElementById("Titulo");
let Boton1 = document.getElementById("B1");
let Boton12 = document.getElementById("B12");

const canvas = document.getElementById('Flor');
const ctx = canvas.getContext('2d');

let currentFlowerMode = 0;
let animationId;
let flowers = [];
let frame = 0;

// Resize canvas to fill the screen better
function resizeCanvas() {
    const florContainer = document.querySelector('.FlorContainer');
    if (florContainer && getComputedStyle(document.querySelector('.Texto')).display !== 'none') {
        canvas.width = florContainer.clientWidth;
        canvas.height = florContainer.clientHeight * 0.8; // Dejar espacio para el texto "Para la niña..."
    } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    // Reposicionar y reescalar las flores automáticamente al cambiar de tamaño la pantalla
    if (typeof rebuildFlowers === "function") {
        rebuildFlowers();
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Math & Parametrics ──────────────────────────────────────────────────────
function petal_x(angle, n, scale, twist=0) {
    return scale * Math.cos(n * angle + twist) * Math.cos(angle);
}
function petal_y(angle, n, scale, twist=0) {
    return scale * Math.cos(n * angle + twist) * Math.sin(angle);
}
function star_x(angle, petals, scale) {
    return scale * Math.pow(Math.abs(Math.cos(petals / 2 * angle)) + 0.1, 0.4) * Math.cos(angle);
}
function star_y(angle, petals, scale) {
    return scale * Math.pow(Math.abs(Math.cos(petals / 2 * angle)) + 0.1, 0.4) * Math.sin(angle);
}
function heart_x(k) {
    return 15 * Math.pow(Math.sin(k), 3);
}
function heart_y(k) {
    return (12 * Math.cos(k) - 5 * Math.cos(2*k) - 2 * Math.cos(3*k) - Math.cos(4*k));
}
function fermat_x(i, total, max_r) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const r = max_r * Math.sqrt(i / total);
    return r * Math.cos(i * golden);
}
function fermat_y(i, total, max_r) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const r = max_r * Math.sqrt(i / total);
    return r * Math.sin(i * golden);
}
function rotate(x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: x * c - y * s, y: x * s + y * c };
}

// ── Colors (Yellow/Gold variations) ──────────────────────────────────────────
function gold_color(phase, brightness=1.0) {
    let r = Math.floor(Math.min(255, (200 + 55 * Math.sin(phase)) * brightness));
    let g = Math.floor(Math.min(255, (160 + 55 * Math.sin(phase + 0.5)) * brightness));
    let b = Math.floor(Math.max(0,   (10  + 20 * Math.sin(phase)) * brightness));
    return `rgb(${r}, ${g}, ${b})`;
}
function amber_color(phase) {
    let r = Math.floor(Math.min(255, 180 + 60 * Math.sin(phase)));
    let g = Math.floor(Math.min(255, 80 + 40 * Math.sin(phase + 1)));
    let b = 0;
    return `rgb(${r}, ${g}, ${b})`;
}
function pale_yellow(phase) {
    let r = Math.floor(Math.min(255, 240 + 15 * Math.sin(phase)));
    let g = Math.floor(Math.min(255, 230 + 20 * Math.sin(phase + 0.3)));
    let b = Math.floor(Math.min(255, 80 + 60 * Math.sin(phase)));
    return `rgb(${r}, ${g}, ${b})`;
}
function center_color(phase) {
    let r = Math.floor(Math.min(255, 120 + 40 * Math.sin(phase)));
    let g = Math.floor(Math.min(255, 60 + 30 * Math.sin(phase + 1)));
    let b = 0;
    return `rgb(${r}, ${g}, ${b})`;
}

// ── Pre-calculate Geometry ──────────────────────────────────────────────────
// Duplicamos la cantidad de puntos para hacerla mucho más sólida
const STEPS_OUTER = 2400;
const STEPS_INNER = 2000;
const SEEDS = 400;
const STEPS_CORONA = 2000;
const ORBIT_COUNT = 8;
const HEART_STEPS = 160;
const STEPS_EXTRA = 1600;

const outer_pts = [];
for (let i = 0; i < STEPS_OUTER; i++) {
    outer_pts.push({ x: petal_x((i/STEPS_OUTER)*Math.PI*2, 4, 180), y: petal_y((i/STEPS_OUTER)*Math.PI*2, 4, 180) });
}

const inner_pts = [];
for (let i = 0; i < STEPS_INNER; i++) {
    inner_pts.push({ x: petal_x((i/STEPS_INNER)*Math.PI*2, 5, 110, Math.PI/10), y: petal_y((i/STEPS_INNER)*Math.PI*2, 5, 110, Math.PI/10) });
}

const fermat_pts = [];
for (let i = 0; i < SEEDS; i++) {
    fermat_pts.push({ x: fermat_x(i, SEEDS, 70), y: fermat_y(i, SEEDS, 70) });
}

const corona_pts = [];
for (let i = 0; i < STEPS_CORONA; i++) {
    corona_pts.push({ x: star_x((i/STEPS_CORONA)*Math.PI*2, 12, 225), y: star_y((i/STEPS_CORONA)*Math.PI*2, 12, 225) });
}

const extra_pts = [];
for (let i = 0; i < STEPS_EXTRA; i++) {
    extra_pts.push({ x: petal_x((i/STEPS_EXTRA)*Math.PI*2, 3, 140, Math.PI/6), y: petal_y((i/STEPS_EXTRA)*Math.PI*2, 3, 140, Math.PI/6) });
}

// ── Rendering logic ─────────────────────────────────────────────────────────

function dot(x, y, color, size=2) {
    ctx.fillStyle = color;
    // Si son muchas flores saltamos muchos puntos, así que los hacemos más gruesos para compensar visualmente
    size = currentFlowerMode === 12 ? size * 2.5 : size * 1.8; 
    ctx.fillRect(x - size/2, y - size/2, size, size);
}

function drawFlower(cx, cy, scale_global=1.0, f_offset=0) {
    const isMany = currentFlowerMode === 12;
    const ROT_SPEED = isMany ? 0.045 : 0.015; // 3 veces más rápido si son muchas
    const PULSE_SPEED = isMany ? 0.12 : 0.04; 
    const TWIST_SPEED = isMany ? 0.06 : 0.02; 
    const ORBIT_SPEED = isMany ? 0.08 : 0.03; 
    const COLOR_SPEED = isMany ? 0.15 : 0.05; 

    const f = frame + f_offset;

    const rot = (f * ROT_SPEED); 
    const pulse = (1.0 + 0.10 * Math.sin(f * PULSE_SPEED)) * scale_global;
    const twist = f * TWIST_SPEED;
    const orbit = f * ORBIT_SPEED;
    const cp = f * COLOR_SPEED;

    // Saltamos 4 veces más puntos para reducir radicalmente los cálculos y evitar tirones
    const skip = isMany ? 5 : 1; 

    ctx.save();
    ctx.translate(cx, cy);

    // Layer 0: Outer Rose (slow rot)
    for (let i = 0; i < STEPS_OUTER; i += skip) {
        let p = outer_pts[i];
        let r_pt = rotate(p.x * pulse, p.y * pulse, rot);
        dot(r_pt.x, r_pt.y, gold_color(cp + i * 0.002), 2 * scale_global);
    }

    // Layer 1: Inner Rose (counter-rot + dynamic twist)
    for (let i = 0; i < STEPS_INNER; i += skip) {
        let angle = (i / STEPS_INNER) * Math.PI * 2;
        let bx = petal_x(angle, 5, 110 * pulse, Math.PI/10 + twist);
        let by = petal_y(angle, 5, 110 * pulse, Math.PI/10 + twist);
        let r_pt = rotate(bx, by, -rot * 0.7);
        dot(r_pt.x, r_pt.y, pale_yellow(cp * 1.2 + i * 0.003), 2 * scale_global);
    }

    // Layer 2: Fermat Spiral (center)
    for (let i = 0; i < SEEDS; i++) {
        let p = fermat_pts[i];
        let seed_pulse = (1.0 + 0.15 * Math.sin(f * PULSE_SPEED + i * 0.05)) * scale_global;
        let r_pt = rotate(p.x * seed_pulse, p.y * seed_pulse, rot * 0.5);
        let size = i < 80 ? 3 : 2;
        dot(r_pt.x, r_pt.y, center_color(cp + i * 0.01), size * scale_global);
    }

    // Layer 3: Corona / Star
    for (let i = 0; i < STEPS_CORONA; i += skip * 2) {
        let p = corona_pts[i];
        let corona_pulse = (1.0 + 0.08 * Math.sin(f * PULSE_SPEED * 1.5 + i * 0.001)) * scale_global;
        let r_pt = rotate(p.x * corona_pulse, p.y * corona_pulse, -rot * 1.3);
        dot(r_pt.x, r_pt.y, pale_yellow(cp * 0.8 + i * 0.001), 1.5 * scale_global);
    }

    // Layer 4: Orbiting Hearts
    for (let h = 0; h < ORBIT_COUNT; h++) {
        let cur_orbit = (h / ORBIT_COUNT) * Math.PI * 2 + orbit;
        let ox = 265 * scale_global * Math.cos(cur_orbit);
        let oy = 265 * scale_global * Math.sin(cur_orbit);
        let heart_pulse = (1.0 + 0.12 * Math.sin(f * PULSE_SPEED + h)) * scale_global;

        for (let i = 0; i < HEART_STEPS; i+=2) {
            let k = (i / HEART_STEPS) * Math.PI * 2;
            let hx = heart_x(k) * 3.5 * heart_pulse;
            let hy = -heart_y(k) * 3.5 * heart_pulse;
            let r_pt = rotate(hx, hy, cur_orbit + rot);
            dot(ox + r_pt.x, oy + r_pt.y, amber_color(cp + h * 0.8 + i * 0.02), 2 * scale_global);
        }
    }

    // Layer 5: Extra 3-petal rose (opposite pulse)
    let anti_pulse = (1.0 + 0.08 * Math.sin(f * PULSE_SPEED + Math.PI)) * scale_global;
    for (let i = 0; i < STEPS_EXTRA; i += skip) {
        let p = extra_pts[i];
        let r_pt = rotate(p.x * anti_pulse, p.y * anti_pulse, rot * 1.5);
        dot(r_pt.x, r_pt.y, gold_color(cp * 1.4 + i * 0.002, 0.75), 1.5 * scale_global);
    }

    ctx.restore();
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    flowers.forEach(fl => {
        drawFlower(fl.x, fl.y, fl.scale, fl.offset);
    });

    frame++;
    animationId = requestAnimationFrame(animate);
}

// ── Responsive Scaling ──────────────────────────────────────────────────────
function getResponsiveScale(baseScale, referenceSize) {
    // Escala la flor con relación a su espacio disponible (referenceSize)
    // El diámetro virtual de la flor sin escalar es aprox 650
    return baseScale * (referenceSize / 650);
}

function rebuildFlowers() {
    if (currentFlowerMode === 1) {
        // Tomamos el lado más pequeño del canvas para que no se corte arriba ni a los lados
        const minDim = Math.min(canvas.width, canvas.height);
        let currentScale = getResponsiveScale(0.95, minDim); // 0.95 deja un pequeño margen para respirar
        
        flowers = [
            { x: canvas.width / 2, y: canvas.height / 2, scale: currentScale, offset: 0 }
        ];
    } else if (currentFlowerMode === 12) {
        flowers = [];
        
        // Adaptar cuadrícula si es celular
        const isMobile = window.innerWidth < 768; // punto de corte más seguro
        const cols = isMobile ? 3 : 4; 
        const rows = isMobile ? 4 : 3;

        const padX = canvas.width / cols;
        const padY = canvas.height / rows;
        
        // Para 12 flores, el espacio disponible es la cuadrícula (celda)
        const cellMinDim = Math.min(padX, padY);
        
        // baseScale 0.85 las hace más grandes pero todavía deja un pequeño margen para que no choquen
        let currentScale = getResponsiveScale(0.85, cellMinDim);

        for (let i = 0; i < 12; i++) {
            let col = i % cols;
            let row = Math.floor(i / cols);
            flowers.push({
                x: padX * col + padX / 2,
                y: padY * row + padY / 2,
                scale: currentScale,
                offset: i * 50 // offset phase so they look diverse
            });
        }
    }
}

// ── Button Logic ────────────────────────────────────────────────────────────

Boton1.addEventListener('click', function() {
    const ContenedorBotones = document.querySelector(".Con");
    document.querySelector(".Texto").style.display = "flex"; // Se cambió a flex
    ContenedorBotones.style.display = "none";
    
    currentFlowerMode = 1;
    resizeCanvas(); // Fuerza a tomar el tamaño del contenedor recién visible, redimensiona y redespliega las flores

    if(animationId) cancelAnimationFrame(animationId);
    animate();

    if(h1) h1.remove();
});

Boton12.addEventListener('click', function() {
    const ContenedorBotones = document.querySelector(".Con");
    ContenedorBotones.style.display = "none";
    document.querySelector(".Texto").style.display = "flex"; // Se cambió a flex
    
    currentFlowerMode = 12;
    resizeCanvas(); // Fuerza a tomar el tamaño del contenedor recién visible, redimensiona y redespliega las flores

    if(animationId) cancelAnimationFrame(animationId);
    animate();

    if(h1) h1.remove();
});
