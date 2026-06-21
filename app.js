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

// Audio System (Procedural Web Audio)
let isMuted = false;
window.toggleMute = function() {
    isMuted = !isMuted;
    document.getElementById('mute-btn').innerText = isMuted ? '🔇' : '🔊';
}

const SoundEffects = {
    playTone: function(freq, type, duration, vol, pitchSlide = 0) {
        if (isMuted) return;
        if (!window.audioCtx) window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
        
        const oscillator = window.audioCtx.createOscillator();
        const gainNode = window.audioCtx.createGain();
        
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, window.audioCtx.currentTime);
        if (pitchSlide !== 0) {
            oscillator.frequency.exponentialRampToValueAtTime(freq * pitchSlide, window.audioCtx.currentTime + duration);
        }
        
        gainNode.gain.setValueAtTime(vol, window.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, window.audioCtx.currentTime + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(window.audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(window.audioCtx.currentTime + duration);
    },
    
    playDrop: function() {
        this.playTone(300, 'sine', 0.1, 0.1, 0.5); // Quick descending blip
    },
    
    playMerge: function(level, combo) {
        const baseFreq = 200 + (level * 60);
        const comboFreq = baseFreq * (1 + (combo * 0.1));
        this.playTone(comboFreq, 'sine', 0.15, 0.15, 1.5); // Ascending pop
        setTimeout(() => {
            this.playTone(comboFreq * 1.5, 'triangle', 0.1, 0.05, 1.2);
        }, 30);
    },
    
    playShake: function() {
        this.playTone(80, 'square', 0.4, 0.15, 0.5); // Low descending rumble
    },
    
    playHighScore: function() {
        let t = 0;
        [440, 554, 659, 880].forEach(freq => {
            setTimeout(() => {
                this.playTone(freq, 'sine', 0.3, 0.2, 1);
            }, t);
            t += 80;
        });
    },
    
    playOverflow: function() {
        this.playTone(150, 'sawtooth', 0.5, 0.2, 0.2); // Dark descending boom
    }
}

function createPlanetTexture(radius, baseColor, level) {
    const size = Math.ceil(radius * 2);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const r = size / 2;
    const cx = r;
    const cy = r;

    function getRandomPoint() {
        const a = Math.random() * 2 * Math.PI;
        const dist = Math.sqrt(Math.random()) * r;
        return { x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist };
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    if (level === 10) {
        const sunGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        sunGlow.addColorStop(0, '#ffffff');
        sunGlow.addColorStop(0.2, '#fff5cc');
        sunGlow.addColorStop(0.6, baseColor);
        sunGlow.addColorStop(0.9, '#cc2200');
        sunGlow.addColorStop(1, '#ff0000');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, size, size);
        
        ctx.fillStyle = 'rgba(150, 0, 0, 0.2)';
        for(let i=0; i<15; i++) {
            const pt = getRandomPoint();
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r * (0.05 + Math.random() * 0.1), 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        if (level % 3 === 0) {
            for(let i=0; i<15; i++) {
                const pt = getRandomPoint();
                const cr = r * (0.05 + Math.random() * 0.15);
                ctx.lineWidth = Math.max(1, cr * 0.2);
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, cr, Math.PI * 0.75, Math.PI * 1.75, false);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, cr, Math.PI * 1.75, Math.PI * 0.75, false);
                ctx.stroke();
            }
        } else if (level % 3 === 1) {
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
            ctx.filter = `blur(${Math.max(1, r * 0.05)}px)`;
            ctx.fillStyle = level === 2 ? 'rgba(50, 200, 100, 0.45)' : 
                            level === 5 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.3)';
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

        const shadow = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
        shadow.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        shadow.addColorStop(0.3, 'rgba(0, 0, 0, 0)');
        shadow.addColorStop(0.8, 'rgba(0, 0, 0, 0.6)');
        shadow.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
        ctx.fillStyle = shadow;
        ctx.fillRect(0, 0, size, size);
        
        const rim = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.7, cx, cy, r);
        rim.addColorStop(0, 'rgba(255, 255, 255, 0)');
        rim.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
        ctx.fillStyle = rim;
        ctx.fillRect(0,0,size,size);
    }
    
    ctx.restore();
    return canvas.toDataURL('image/png');
}

function createSpecialTexture(type) {
    const size = 60;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const r = size/2; const cx = r; const cy = r;
    
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    
    if (type === 'meteor') {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, '#ffff00');
        grad.addColorStop(0.5, '#ff5500');
        grad.addColorStop(1, '#880000');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,size,size);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for(let i=0; i<10; i++) {
            ctx.beginPath();
            ctx.arc(cx + (Math.random()-0.5)*size, cy + (Math.random()-0.5)*size, 5 + Math.random()*10, 0, Math.PI*2);
            ctx.fill();
        }
    } else if (type === 'wildcard') {
        const grad = ctx.createLinearGradient(0,0, size, size);
        grad.addColorStop(0, '#ff0000');
        grad.addColorStop(0.33, '#00ff00');
        grad.addColorStop(0.66, '#0000ff');
        grad.addColorStop(1, '#ff00ff');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,size,size);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(cx - r*0.3, cy - r*0.3, r*0.4, 0, Math.PI*2); ctx.fill();
    } else if (type === 'bomb') {
        ctx.fillStyle = '#222';
        ctx.fillRect(0,0,size,size);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, '#ff0000');
        grad.addColorStop(0.3, '#aa0000');
        grad.addColorStop(0.6, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,size,size);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r*0.5, cy - r*1.2); ctx.stroke();
    }
    
    const shadow = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    shadow.addColorStop(0, 'rgba(255, 255, 255, 0.2)'); 
    shadow.addColorStop(0.3, 'rgba(0, 0, 0, 0)');       
    shadow.addColorStop(0.8, 'rgba(0, 0, 0, 0.6)');     
    shadow.addColorStop(1, 'rgba(0, 0, 0, 0.95)');      
    ctx.fillStyle = shadow;
    ctx.fillRect(0, 0, size, size);
    
    return canvas.toDataURL('image/png');
}

function createBlackHoleTexture() {
    const size = 120;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size/2; const cy = size/2;
    
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size/2);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.2, '#000000');
    grad.addColorStop(0.4, '#330066');
    grad.addColorStop(0.8, '#aa00ff');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,size,size);
    
    return canvas.toDataURL('image/png');
}

// Pre-generate textures for performance
const PLANET_LEVELS = [
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

const planetTextures = {};
for (let i = 0; i < PLANET_LEVELS.length; i++) {
    planetTextures[i] = createPlanetTexture(PLANET_LEVELS[i].radius, PLANET_LEVELS[i].color, i);
}

const specialTextures = {
    'meteor': createSpecialTexture('meteor'),
    'wildcard': createSpecialTexture('wildcard'),
    'bomb': createSpecialTexture('bomb')
};

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
    
    SoundEffects.playDrop();
}

let engine, render, runner;
let nextPlanet = null;
let currentDropper = null;
let isDropping = false;
let score = 0;
let highScore = parseInt(localStorage.getItem('cosmicMergeHighScore') || '0');
let hasNotifiedHighScore = false;
let oldHighScore = highScore;
let dropCount = 0;
let gameStarted = false;

let dropTimeLeft = 0;
const DROP_TIME_LIMIT = 5000;
let lastTime = 0;
let comboCount = 0;
let comboTimer = null;
let currentShakePoints = 0;
const SHAKE_POINTS_NEEDED = 1000;

// Hazards state
let blackHole = null;
let orbitingMoons = [];
const blackHoleTexture = createBlackHoleTexture();

// Visual effects state
let canvasParticles = [];

function generateNext() {
    dropCount++;
    // 8% chance of special item after the first 5 drops
    if (dropCount > 5 && Math.random() < 0.08) {
        const r = Math.random();
        if (r < 0.33) return { specialType: 'meteor' };
        if (r < 0.66) return { specialType: 'wildcard' };
        return { specialType: 'bomb' };
    }
    
    // Normal planet logic
    const maxLevel = Math.max(3, Math.min(Math.floor(score / 500) + 3, 5));
    return { level: Math.floor(Math.random() * maxLevel) };
}

function updateNextPreview() {
    nextPreviewEl.innerHTML = '';
    
    if (nextPlanet.specialType) {
        nextPreviewEl.style.backgroundImage = `url(${specialTextures[nextPlanet.specialType]})`;
        nextPreviewEl.style.width = `40px`;
        nextPreviewEl.style.height = `40px`;
        nextPreviewEl.style.backgroundColor = 'transparent';
    } else {
        const config = PLANET_LEVELS[nextPlanet.level];
        nextPreviewEl.style.backgroundImage = `url(${planetTextures[nextPlanet.level]})`;
        nextPreviewEl.style.width = `${Math.max(24, config.radius)}px`;
        nextPreviewEl.style.height = `${Math.max(24, config.radius)}px`;
    }
}

function spawnDropper(x) {
    isDropping = false;
    dropTimeLeft = DROP_TIME_LIMIT;
    
    if (nextPlanet.specialType) {
        const radius = 20; // Fixed size for special items
        currentDropper = Bodies.circle(x || GAME_WIDTH / 2, DROP_LINE_Y, radius, {
            isStatic: true,
            isSensor: true,
            restitution: 0.2,
            friction: 0.1,
            label: nextPlanet.specialType,
            render: {
                sprite: {
                    texture: specialTextures[nextPlanet.specialType],
                    xScale: (radius * 2) / 60,
                    yScale: (radius * 2) / 60
                }
            }
        });
        currentDropper.specialType = nextPlanet.specialType;
    } else {
        const config = PLANET_LEVELS[nextPlanet.level];
        currentDropper = Bodies.circle(x || GAME_WIDTH / 2, DROP_LINE_Y, config.radius, {
            isStatic: true,
            isSensor: true, // Don't collide until dropped
            restitution: 0.2,
            friction: 0.1,
            render: {
                sprite: {
                    texture: planetTextures[nextPlanet.level],
                    xScale: (config.radius * 2) / Math.ceil(config.radius * 2),
                    yScale: (config.radius * 2) / Math.ceil(config.radius * 2)
                }
            }
        });
        currentDropper.level = nextPlanet.level;
    }
    
    Composite.add(engine.world, currentDropper);
    nextPlanet = generateNext();
    updateNextPreview();
}

function handleCollisions(event) {
    const pairs = event.pairs;
    const bodiesToRemove = new Set();
    const mergesToProcess = [];

    pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        if (bodyA.isSensor || bodyB.isSensor) return;

        // Handle Special Planet Collisions
        if (bodyA.specialType || bodyB.specialType) {
            handleSpecialCollision(bodyA, bodyB);
            return;
        }

        // Must be same level to merge
        if (bodyA.level !== undefined && bodyB.level !== undefined && bodyA.level === bodyB.level && bodyA.level < PLANET_LEVELS.length - 1) {
            
            if (bodiesToRemove.has(bodyA.id) || bodiesToRemove.has(bodyB.id)) return;
            
            bodiesToRemove.add(bodyA.id);
            bodiesToRemove.add(bodyB.id);
            
            const newX = (bodyA.position.x + bodyB.position.x) / 2;
            const newY = (bodyA.position.y + bodyB.position.y) / 2;
            const newLevel = bodyA.level + 1;
            
            mergesToProcess.push({ x: newX, y: newY, level: newLevel });
            
            // Combo system
            comboCount++;
            if (comboCount > 1) {
                comboDisplay.innerText = `COMBO x${comboCount}!`;
                comboDisplay.style.opacity = 1;
                comboDisplay.style.transform = `scale(${1 + Math.min(comboCount * 0.1, 0.5)})`;
                setTimeout(() => comboDisplay.style.transform = 'scale(1)', 100);
            }
            
            SoundEffects.playMerge(newLevel, comboCount);
            
            clearTimeout(comboTimer);
            comboTimer = setTimeout(() => {
                comboCount = 0;
                comboDisplay.style.opacity = 0;
            }, 2000);

            const points = PLANET_LEVELS[newLevel].score * Math.max(1, comboCount);
            updateScore(points);
            createFloatingScore(newX, newY, `+${points}`);

            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(15);
            }
        }
    });

    if (bodiesToRemove.size > 0) {
        const allBodies = Composite.allBodies(engine.world);
        const toRemove = allBodies.filter(b => bodiesToRemove.has(b.id));
        Composite.remove(engine.world, toRemove);
        
        mergesToProcess.forEach(merge => {
            const config = PLANET_LEVELS[merge.level];
            const newBody = Bodies.circle(merge.x, merge.y, config.radius, {
                level: merge.level,
                restitution: 0.4,
                friction: 0.5,
                render: { sprite: { texture: planetTextures[merge.level] } }
            });
            newBody.createdAt = Date.now();
            Composite.add(engine.world, newBody);
            
            createPopEffect(merge.x, merge.y, config.color);
            
            // Orbiting Moons mechanic for large planets
            if (merge.level >= 7) {
                const moonCount = merge.level - 5;
                for(let i=0; i<moonCount; i++) {
                    const moon = Bodies.circle(merge.x, merge.y - 80, 12, {
                        restitution: 0.8, mass: 0.5, friction: 0.1,
                        render: { sprite: { texture: specialTextures['meteor'], xScale: 0.4, yScale: 0.4 } }
                    });
                    moon.parentPlanet = newBody;
                    Composite.add(engine.world, moon);
                    orbitingMoons.push(moon);
                    
                    // Initial kick
                    Body.setVelocity(moon, { x: (Math.random()-0.5)*10, y: -5 });
                }
            }
        });
    }
}

window.shakeBox = function() {
    if (currentShakePoints < SHAKE_POINTS_NEEDED) return;
    
    currentShakePoints = 0;
    shakeFill.style.height = '0%';
    shakeBtn.classList.remove('ready');
    
    SoundEffects.playShake();
    
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
        if (p.createdAt && Date.now() - p.createdAt < 2000) continue;
        if (p.position.y - PLANET_LEVELS[p.level].radius < DROP_LINE_Y + 50) {
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
        SoundEffects.playOverflow();
        
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate([50, 50, 50]); 
        }
        
        scoreEl.style.color = '#ff0000';
        setTimeout(() => scoreEl.style.color = '#ffffff', 500);
    }
}

function spawnBlackHole() {
    if (blackHole) return;
    const x = GAME_WIDTH * 0.2 + Math.random() * (GAME_WIDTH * 0.6);
    const y = GAME_HEIGHT * 0.3 + Math.random() * (GAME_HEIGHT * 0.4);
    
    blackHole = Bodies.circle(x, y, 60, {
        isStatic: true,
        isSensor: true,
        render: {
            sprite: { texture: blackHoleTexture }
        }
    });
    Composite.add(engine.world, blackHole);
    
    setTimeout(() => {
        if (blackHole) {
            Composite.remove(engine.world, blackHole);
            blackHole = null;
        }
    }, 6000);
}

setInterval(() => {
    // 30% chance every 10s to spawn a black hole if score > 500
    if (gameStarted && !blackHole && score > 500 && Math.random() < 0.3) {
        spawnBlackHole();
    }
}, 10000);

function updateScore(points) {
    score += points;
    scoreEl.innerText = score;
    
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
            SoundEffects.playHighScore();
            setTimeout(() => highScoreBanner.classList.remove('show'), 3000);
        }
    }
}

function handlePointerMove(e) {
    if (isDropping || !currentDropper) return;
    
    const rect = render.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const config = currentDropper.specialType ? { radius: 20 } : PLANET_LEVELS[currentDropper.level];
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
    SoundEffects.playDrop();
    
    Body.setStatic(currentDropper, false);
    currentDropper.isSensor = false;
    currentDropper.restitution = 0.4;
    currentDropper.friction = 0.5;
    currentDropper.createdAt = Date.now();
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

function handleSpecialCollision(bodyA, bodyB) {
    const special = bodyA.specialType ? bodyA : bodyB;
    const normal = bodyA.specialType ? bodyB : bodyA;
    
    if (special.specialType === 'meteor') {
        if (!normal.isSensor && normal.level !== undefined) {
            createPopEffect(normal.position.x, normal.position.y, '#ff5500', 15);
            Composite.remove(engine.world, [special, normal]);
            SoundEffects.playOverflow(); // Reuse boom sound
        } else if (normal.label === 'Rectangle Body') { // Hit ground
            createPopEffect(special.position.x, special.position.y, '#ff5500', 8);
            Composite.remove(engine.world, special);
        }
    } else if (special.specialType === 'wildcard') {
        if (!normal.isSensor && normal.level !== undefined && normal.level < PLANET_LEVELS.length - 1) {
            const newLevel = normal.level + 1;
            const newX = normal.position.x;
            const newY = normal.position.y;
            
            Composite.remove(engine.world, [special, normal]);
            
            const config = PLANET_LEVELS[newLevel];
            const newBody = Bodies.circle(newX, newY, config.radius, {
                level: newLevel,
                restitution: 0.4,
                friction: 0.5,
                render: { sprite: { texture: planetTextures[newLevel] } }
            });
            newBody.createdAt = Date.now();
            Composite.add(engine.world, newBody);
            
            createPopEffect(newX, newY, '#00ffff');
            SoundEffects.playMerge(newLevel, 1);
            
            const points = config.score;
            updateScore(points);
            createFloatingScore(newX, newY, `+${points}`);
        } else if (normal.label === 'Rectangle Body') {
            createPopEffect(special.position.x, special.position.y, '#00ffff', 8);
            Composite.remove(engine.world, special);
        }
    } else if (special.specialType === 'bomb') {
        if (!normal.isSensor) {
            // Explode
            createPopEffect(special.position.x, special.position.y, '#ff0000', 30);
            SoundEffects.playShake();
            
            if (window.navigator && window.navigator.vibrate) window.navigator.vibrate([100, 50, 100]);
            
            const allBodies = Composite.allBodies(engine.world);
            const planets = allBodies.filter(b => b.level !== undefined);
            
            let pointsGained = 0;
            planets.forEach(p => {
                const dx = special.position.x - p.position.x;
                const dy = special.position.y - p.position.y;
                if (dx*dx + dy*dy < 150*150) { // Radius
                    Composite.remove(engine.world, p);
                    createPopEffect(p.position.x, p.position.y, PLANET_LEVELS[p.level].color, 5);
                    pointsGained += PLANET_LEVELS[p.level].score;
                }
            });
            
            Composite.remove(engine.world, special);
            
            if (pointsGained > 0) {
                updateScore(pointsGained);
                createFloatingScore(special.position.x, special.position.y, `+${pointsGained}`);
            }
            
            const container = document.getElementById('game-container');
            if(container) {
                container.classList.add('shake');
                setTimeout(() => container.classList.remove('shake'), 500);
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
    
    Events.on(engine, 'beforeUpdate', function() {
        const allBodies = Composite.allBodies(engine.world);
        
        // Black Hole gravity
        if (blackHole) {
            Body.setAngle(blackHole, blackHole.angle + 0.05);
            const planets = allBodies.filter(b => !b.isStatic && !b.isSensor);
            planets.forEach(p => {
                const dx = blackHole.position.x - p.position.x;
                const dy = blackHole.position.y - p.position.y;
                const distSq = dx*dx + dy*dy;
                if (distSq < 60000) { // Range
                    const forceMag = 0.000015 * p.mass;
                    Body.applyForce(p, p.position, {
                        x: (dx / Math.sqrt(distSq)) * forceMag,
                        y: (dy / Math.sqrt(distSq)) * forceMag
                    });
                }
            });
        }
        
        // Orbiting Moons logic
        orbitingMoons = orbitingMoons.filter(moon => {
            if (!allBodies.includes(moon.parentPlanet) || !allBodies.includes(moon)) {
                if (allBodies.includes(moon)) Composite.remove(engine.world, moon);
                return false;
            }
            const dx = moon.parentPlanet.position.x - moon.position.x;
            const dy = moon.parentPlanet.position.y - moon.position.y;
            const distSq = Math.max(100, dx*dx + dy*dy);
            
            const forceMag = 0.0003 * moon.mass;
            Body.applyForce(moon, moon.position, {
                x: (dx / Math.sqrt(distSq)) * forceMag,
                y: (dy / Math.sqrt(distSq)) * forceMag
            });
            return true;
        });
    });

    Events.on(render, 'afterRender', function() {
        const ctx = render.context;
        const allBodies = Composite.allBodies(engine.world);
        const planets = allBodies.filter(b => !b.isStatic && !b.isSensor);
        
        // Falling Trails
        planets.forEach(p => {
            if (Math.abs(p.velocity.y) > 6 || Math.abs(p.velocity.x) > 6) {
                if (Math.random() < 0.4) {
                    const color = p.level !== undefined ? PLANET_LEVELS[p.level].color : '#ffffff';
                    canvasParticles.push({
                        x: p.position.x + (Math.random() - 0.5) * 10,
                        y: p.position.y + (Math.random() - 0.5) * 10,
                        vx: -p.velocity.x * 0.1,
                        vy: -p.velocity.y * 0.1,
                        life: 1.0,
                        color: color
                    });
                }
            }
        });
        
        ctx.globalCompositeOperation = 'lighter';
        for (let i = canvasParticles.length - 1; i >= 0; i--) {
            const pt = canvasParticles[i];
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.life -= 0.05;
            
            if (pt.life <= 0) {
                canvasParticles.splice(i, 1);
                continue;
            }
            
            ctx.fillStyle = pt.color;
            ctx.globalAlpha = pt.life * 0.5;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2 + pt.life * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
        
        // Dynamic Lighting (Sun Burst)
        const suns = planets.filter(p => p.level === 10);
        if (suns.length > 0) {
            ctx.globalCompositeOperation = 'screen';
            suns.forEach(sun => {
                const grad = ctx.createRadialGradient(sun.position.x, sun.position.y, 0, sun.position.x, sun.position.y, GAME_HEIGHT * 0.8);
                grad.addColorStop(0, 'rgba(255, 180, 0, 0.3)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            });
            ctx.globalCompositeOperation = 'source-over';
        }
    });

    const container = document.getElementById('game-container');
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointerup', handlePointerUp);

    Render.run(render);
    runner = Runner.create();
    Runner.run(runner, engine);

    setInterval(checkOverflow, 1000);

    nextPlanet = generateNext();
    spawnDropper(GAME_WIDTH / 2);
    requestAnimationFrame(gameLoop);
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
