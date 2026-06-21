const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Events = Matter.Events,
      Body = Matter.Body;

const GAME_WIDTH = Math.min(window.innerWidth, 500);
const GAME_HEIGHT = window.innerHeight - 80; 
const DROP_LINE_Y = 40; 
const WALL_THICKNESS = 60;

function createPlanetTexture(radius, baseColor, level) {
    const size = Math.ceil(radius * 2);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const r = size / 2;
    const cx = r;
    const cy = r;

    // Helper to get a random point inside the sphere
    function getRandomPoint() {
        const a = Math.random() * 2 * Math.PI;
        const dist = Math.sqrt(Math.random()) * r;
        return { x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist };
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    
    // Base color
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // Planet Details
    if (level === 10) {
        // Sun - glowing, pulsing, no deep shadows
        const sunGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        sunGlow.addColorStop(0, '#ffffff');
        sunGlow.addColorStop(0.2, '#fff5cc');
        sunGlow.addColorStop(0.6, baseColor);
        sunGlow.addColorStop(0.9, '#cc2200');
        sunGlow.addColorStop(1, '#ff0000');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, size, size);
        
        // Sun spots (subtle)
        ctx.fillStyle = 'rgba(150, 0, 0, 0.2)';
        for(let i=0; i<15; i++) {
            const pt = getRandomPoint();
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r * (0.05 + Math.random() * 0.1), 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        // Surface Textures
        if (level % 3 === 0) {
            // Rocky - Depth-shaded craters
            for(let i=0; i<15; i++) {
                const pt = getRandomPoint();
                const cr = r * (0.05 + Math.random() * 0.15);
                
                ctx.lineWidth = Math.max(1, cr * 0.2);
                
                // Shadow indent
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, cr, Math.PI * 0.75, Math.PI * 1.75, false);
                ctx.stroke();
                
                // Highlight rim
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, cr, Math.PI * 1.75, Math.PI * 0.75, false);
                ctx.stroke();
            }
        } else if (level % 3 === 1) {
            // Gas Giant - Smooth swirling bands
            ctx.filter = `blur(${Math.max(1, r * 0.1)}px)`;
            for(let i=0; i<10; i++) {
                const by = Math.random() * size;
                const bh = r * (0.1 + Math.random() * 0.3);
                
                ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
                
                ctx.beginPath();
                ctx.moveTo(0, by);
                ctx.bezierCurveTo(size * 0.3, by - bh, size * 0.7, by + bh, size, by);
                ctx.lineTo(size, by + bh);
                ctx.bezierCurveTo(size * 0.7, by + bh * 2, size * 0.3, by, 0, by + bh);
                ctx.fill();
            }
            ctx.filter = 'none';
        } else {
            // Continents / Oceans - organic shapes
            ctx.filter = `blur(${Math.max(1, r * 0.05)}px)`;
            ctx.fillStyle = level === 2 ? 'rgba(50, 200, 100, 0.45)' : 
                            level === 5 ? 'rgba(255, 255, 255, 0.5)' : 
                            'rgba(0, 0, 0, 0.3)';
            
            for(let i=0; i<8; i++) {
                const pt = getRandomPoint();
                const cr = r * (0.2 + Math.random() * 0.4);
                
                ctx.beginPath();
                for(let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
                    const dist = cr * (0.7 + Math.random() * 0.3);
                    const px = pt.x + Math.cos(a) * dist;
                    const py = pt.y + Math.sin(a) * dist;
                    if (a === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.fill();
            }
            ctx.filter = 'none';
        }

        // Realistic Spherical Lighting (Directional shadow + subtle ambient)
        const shadow = ctx.createRadialGradient(
            cx - r * 0.3, cy - r * 0.3, 0,
            cx, cy, r
        );
        shadow.addColorStop(0, 'rgba(255, 255, 255, 0.1)'); // Top-left faint highlight
        shadow.addColorStop(0.3, 'rgba(0, 0, 0, 0)');       // Surface color mid
        shadow.addColorStop(0.8, 'rgba(0, 0, 0, 0.6)');     // Terminator line
        shadow.addColorStop(1, 'rgba(0, 0, 0, 0.95)');      // Pitch black back-edge

        ctx.fillStyle = shadow;
        ctx.fillRect(0, 0, size, size);
        
        // Soft atmospheric rim light on the lighted edge
        const rim = ctx.createRadialGradient(
            cx - r * 0.2, cy - r * 0.2, r * 0.7,
            cx, cy, r
        );
        rim.addColorStop(0, 'rgba(255, 255, 255, 0)');
        rim.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
        ctx.fillStyle = rim;
        ctx.fillRect(0,0,size,size);
    }

    ctx.restore();

    return canvas.toDataURL('image/png');
}

const levels = [
    { level: 0, radius: 15, color: '#9e9e9e', score: 2 },   // Rock
    { level: 1, radius: 25, color: '#ff758c', score: 4 },   // Gas
    { level: 2, radius: 35, color: '#0072ff', score: 8 },   // Earth-like
    { level: 3, radius: 45, color: '#8e2de2', score: 16 },  // Rocky Purple
    { level: 4, radius: 55, color: '#f7b733', score: 32 },  // Gas Yellow
    { level: 5, radius: 70, color: '#00c6ff', score: 64 },  // Ice Continents
    { level: 6, radius: 85, color: '#ff007f', score: 128 }, // Rocky Red
    { level: 7, radius: 105, color: '#00b09b', score: 256 },// Gas Teal
    { level: 8, radius: 125, color: '#96c93d', score: 512 },// Toxic Continents
    { level: 9, radius: 150, color: '#4a00e0', score: 1024 },// Rocky Blue
    { level: 10, radius: 180, color: '#fc4a1a', score: 2048 } // Sun
];

levels.forEach(l => {
    l.texture = createPlanetTexture(l.radius, l.color, l.level);
});

let engine, render, runner;
let currentPlanetLevel = 0;
let nextPlanetLevel = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('cosmicMergeHighScore') || '0');
let isDropping = false;
let currentDropper = null;
let gameStarted = false;

// Combos
let comboCount = 0;
let comboTimer = null;

// Shake Mechanics
let currentShakePoints = 0;
const SHAKE_POINTS_NEEDED = 100;

// High Score notification
let hasNotifiedHighScore = false;
const oldHighScore = highScore;

// Auto-Drop Timer
const DROP_TIME_LIMIT = 5000;
let dropTimeLeft = DROP_TIME_LIMIT;
let lastTime = 0;

const scoreEl = document.getElementById('score');
const nextPreviewEl = document.getElementById('next-planet-preview');
const comboDisplay = document.getElementById('combo-display');
const instructionText = document.getElementById('instruction-text');
const shakeBtn = document.getElementById('shake-btn');
const shakeFill = document.getElementById('shake-fill');
const inGameHighScoreEl = document.getElementById('in-game-high-score');
const lobbyHighScoreEl = document.getElementById('lobby-high-score');
const dropTimerBar = document.getElementById('drop-timer-bar');
const highScoreBanner = document.getElementById('high-score-banner');

function initLobby() {
    createAmbientStars();
    lobbyHighScoreEl.innerText = highScore;
    inGameHighScoreEl.innerText = highScore;
}

window.startGame = function() {
    if (gameStarted) return;
    
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    
    gameStarted = true;
    initEngine();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function updateScore(points) {
    score += points;
    scoreEl.innerText = score;
    
    // Shake points
    currentShakePoints = Math.min(currentShakePoints + points, SHAKE_POINTS_NEEDED);
    const fillPercent = (currentShakePoints / SHAKE_POINTS_NEEDED) * 100;
    shakeFill.style.height = `${fillPercent}%`;
    
    if (currentShakePoints >= SHAKE_POINTS_NEEDED) {
        shakeBtn.classList.add('ready');
    }
    
    if (score > highScore) {
        highScore = score;
        inGameHighScoreEl.innerText = highScore;
        localStorage.setItem('cosmicMergeHighScore', highScore);
        
        if (!hasNotifiedHighScore && oldHighScore > 0 && score > oldHighScore) {
            hasNotifiedHighScore = true;
            highScoreBanner.classList.add('show');
            scoreEl.classList.add('golden-score');
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate([100, 50, 100, 50, 200]);
            }
        }
    }
}

function initEngine() {
    engine = Engine.create();
    
    render = Render.create({
        element: document.getElementById('game-container'),
        engine: engine,
        options: {
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
            wireframes: false,
            background: 'transparent'
        }
    });

    const ground = Bodies.rectangle(GAME_WIDTH / 2, GAME_HEIGHT + WALL_THICKNESS/2, GAME_WIDTH + 200, WALL_THICKNESS, { 
        isStatic: true, 
        render: { fillStyle: '#24243e' }
    });
    const leftWall = Bodies.rectangle(-WALL_THICKNESS/2, GAME_HEIGHT / 2, WALL_THICKNESS, GAME_HEIGHT * 2, { 
        isStatic: true,
        render: { fillStyle: '#24243e' } 
    });
    const rightWall = Bodies.rectangle(GAME_WIDTH + WALL_THICKNESS/2, GAME_HEIGHT / 2, WALL_THICKNESS, GAME_HEIGHT * 2, { 
        isStatic: true,
        render: { fillStyle: '#24243e' } 
    });

    Composite.add(engine.world, [ground, leftWall, rightWall]);

    Events.on(engine, 'collisionStart', handleCollisions);

    const container = document.getElementById('game-container');
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointerup', handlePointerUp);

    Render.run(render);
    runner = Runner.create();
    Runner.run(runner, engine);

    setInterval(checkOverflow, 1000);

    generateNext();
    spawnDropper(GAME_WIDTH / 2);
}

function getRandomLevel() {
    return Math.floor(Math.random() * 3);
}

function generateNext() {
    nextPlanetLevel = getRandomLevel();
    const config = levels[nextPlanetLevel];
    nextPreviewEl.style.background = `url(${config.texture})`;
    nextPreviewEl.style.backgroundSize = 'cover';
}

function spawnDropper(x) {
    currentPlanetLevel = nextPlanetLevel;
    generateNext();
    
    isDropping = false;
    dropTimeLeft = DROP_TIME_LIMIT; 
    
    const config = levels[currentPlanetLevel];
    const safeX = Math.max(config.radius, Math.min(GAME_WIDTH - config.radius, x));

    currentDropper = Bodies.circle(safeX, DROP_LINE_Y, config.radius, {
        isStatic: true,
        isSensor: true,
        level: currentPlanetLevel,
        render: { sprite: { texture: config.texture } }
    });

    Composite.add(engine.world, currentDropper);
}

function handlePointerMove(e) {
    if (isDropping || !currentDropper) return;
    
    const rect = render.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const config = levels[currentPlanetLevel];
    const safeX = Math.max(config.radius, Math.min(GAME_WIDTH - config.radius, x));
    
    Body.setPosition(currentDropper, { x: safeX, y: DROP_LINE_Y });
}

function handlePointerDown(e) {
    if (instructionText && !instructionText.classList.contains('fade-out')) {
        instructionText.classList.add('fade-out');
    }
    if (isDropping || !currentDropper) return;
    handlePointerMove(e);
}

function handlePointerUp(e) {
    if (isDropping || !currentDropper) return;
    performDrop();
}

function performDrop() {
    isDropping = true;
    
    Body.setStatic(currentDropper, false);
    currentDropper.isSensor = false;
    currentDropper.restitution = 0.4;
    currentDropper.friction = 0.5;
    currentDropper = null;
    
    dropTimerBar.style.width = '0%';
    
    setTimeout(() => {
        spawnDropper(GAME_WIDTH / 2);
    }, 1000);
}

function gameLoop(time) {
    if (!lastTime) lastTime = time;
    const dt = time - lastTime;
    lastTime = time;
    
    if (gameStarted && !isDropping && currentDropper) {
        dropTimeLeft -= dt;
        if (dropTimeLeft <= 0) {
            dropTimeLeft = 0;
            performDrop();
        } else {
            const percent = (dropTimeLeft / DROP_TIME_LIMIT) * 100;
            dropTimerBar.style.width = `${percent}%`;
            
            if (percent < 25) {
                dropTimerBar.style.backgroundColor = '#ff0000';
            } else {
                dropTimerBar.style.backgroundColor = '#ff007f';
            }
        }
    }
    
    requestAnimationFrame(gameLoop);
}

function handleCollisions(event) {
    const pairs = event.pairs;
    const bodiesToRemove = new Set();
    const mergesToProcess = [];

    pairs.forEach(pair => {
        const { bodyA, bodyB } = pair;
        
        if (bodyA.level !== undefined && bodyB.level !== undefined) {
            if (bodyA.level === bodyB.level && bodyA.level < levels.length - 1) {
                
                if (bodiesToRemove.has(bodyA.id) || bodiesToRemove.has(bodyB.id)) return;
                
                bodiesToRemove.add(bodyA.id);
                bodiesToRemove.add(bodyB.id);
                
                const newX = (bodyA.position.x + bodyB.position.x) / 2;
                const newY = (bodyA.position.y + bodyB.position.y) / 2;
                const newLevel = bodyA.level + 1;
                
                mergesToProcess.push({ x: newX, y: newY, level: newLevel });
                
                comboCount++;
                if (comboCount > 1) {
                    comboDisplay.innerText = `COMBO x${comboCount}!`;
                    comboDisplay.style.opacity = 1;
                    comboDisplay.style.transform = `scale(${1 + Math.min(comboCount * 0.1, 0.5)})`;
                    setTimeout(() => comboDisplay.style.transform = 'scale(1)', 100);
                }
                
                clearTimeout(comboTimer);
                comboTimer = setTimeout(() => {
                    comboCount = 0;
                    comboDisplay.style.opacity = 0;
                }, 2000);

                const points = levels[newLevel].score * Math.max(1, comboCount);
                updateScore(points);
                createFloatingScore(newX, newY, `+${points}`);

                if (window.navigator && window.navigator.vibrate) {
                    window.navigator.vibrate(15);
                }
            }
        }
    });

    if (bodiesToRemove.size > 0) {
        const allBodies = Composite.allBodies(engine.world);
        const toRemove = allBodies.filter(b => bodiesToRemove.has(b.id));
        Composite.remove(engine.world, toRemove);
        
        mergesToProcess.forEach(merge => {
            const config = levels[merge.level];
            const newBody = Bodies.circle(merge.x, merge.y, config.radius, {
                level: merge.level,
                restitution: 0.4,
                friction: 0.5,
                render: { sprite: { texture: config.texture } }
            });
            Composite.add(engine.world, newBody);
            
            createPopEffect(merge.x, merge.y, config.color);
        });
    }
}

window.shakeBox = function() {
    if (currentShakePoints < SHAKE_POINTS_NEEDED) return;
    
    currentShakePoints = 0;
    shakeFill.style.height = '0%';
    shakeBtn.classList.remove('ready');
    
    const allBodies = Composite.allBodies(engine.world);
    const planets = allBodies.filter(b => !b.isStatic && !b.isSensor && b.level !== undefined);
    
    planets.forEach(p => {
        const forceMagnitude = 0.08 * p.mass;
        Body.applyForce(p, p.position, {
            x: (Math.random() - 0.5) * forceMagnitude * 0.5,
            y: -forceMagnitude
        });
    });
    
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate([30, 50, 30]);
}

function checkOverflow() {
    const allBodies = Composite.allBodies(engine.world);
    const planets = allBodies.filter(b => !b.isStatic && !b.isSensor && b.level !== undefined);
    
    if (planets.length === 0) return;

    let isOverflowing = false;
    for (let p of planets) {
        if (p.position.y - levels[p.level].radius < DROP_LINE_Y + 50) {
            if (Matter.Vector.magnitude(p.velocity) < 0.5) {
                isOverflowing = true;
                break;
            }
        }
    }

    if (isOverflowing) {
        let smallest = planets[0];
        for (let p of planets) {
            if (p.level < smallest.level) {
                smallest = p;
            }
        }
        
        createPopEffect(smallest.position.x, smallest.position.y, '#000000', 15);
        Composite.remove(engine.world, smallest);
        
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate([50, 50, 50]); 
        }
        
        scoreEl.style.color = '#ff0000';
        setTimeout(() => scoreEl.style.color = '#ffffff', 500);
    }
}

function createAmbientStars() {
    const particleContainer = document.getElementById('particle-container');
    for (let i = 0; i < 40; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.width = `${Math.random() * 3 + 1}px`;
        star.style.height = star.style.width;
        star.style.left = `${Math.random() * 100}vw`;
        star.style.top = `${Math.random() * 100}vh`;
        star.style.animationDuration = `${Math.random() * 3 + 1}s`;
        star.style.animationDelay = `${Math.random() * 2}s`;
        particleContainer.appendChild(star);
    }
}

function createPopEffect(x, y, color, particleCount = 8) {
    const particleContainer = document.getElementById('particle-container');
    const containerRect = document.getElementById('game-container').getBoundingClientRect();
    
    const absX = containerRect.left + x;
    const absY = containerRect.top + y;

    for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div');
        p.className = 'star';
        p.style.width = '6px';
        p.style.height = '6px';
        p.style.backgroundColor = color;
        p.style.boxShadow = `0 0 10px ${color}`;
        p.style.position = 'absolute';
        p.style.left = absX + 'px';
        p.style.top = absY + 'px';
        p.style.zIndex = 10;
        
        particleContainer.appendChild(p);
        
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 80 + 30;
        const targetX = absX + Math.cos(angle) * velocity;
        const targetY = absY + Math.sin(angle) * velocity;
        
        p.animate([
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            { transform: `translate(${targetX - absX}px, ${targetY - absY}px) scale(0)`, opacity: 0 }
        ], {
            duration: 800,
            easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)'
        }).onfinish = () => p.remove();
    }
}

function createFloatingScore(x, y, text) {
    const el = document.createElement('div');
    el.className = 'floating-score';
    el.innerText = text;
    
    const containerRect = document.getElementById('game-container').getBoundingClientRect();
    const absX = containerRect.left + x;
    const absY = containerRect.top + y;
    
    el.style.left = absX + 'px';
    el.style.top = absY + 'px';
    
    document.body.appendChild(el);
    
    setTimeout(() => {
        el.remove();
    }, 1000);
}

// Start in Lobby Mode
window.onload = initLobby;
