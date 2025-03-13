const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas to fixed size
canvas.width = 200;
canvas.height = 200;

// Add a dedicated event listener for the Escape key
window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && gameStarted) {
        console.log('Escape key pressed from dedicated handler!');
        isPaused = !isPaused;
        console.log('Game paused state:', isPaused);
        event.preventDefault();
        event.stopPropagation();
    }
}, true);  // Use capture phase

// Game state variables
let gameStarted = false;
let allowMultiplePowerups = false;
let coins = 0;
let permanentUpgrades = {
    extraProjectiles: 0,
    maxHp: 0,
    speed: 0
};
let bosses = [];  // Array to hold multiple bosses
let enemiesKilled = 0;
const ENEMIES_TO_BOSS = 50;
let bossKillCount = 0;
let shieldPowerup = null;
let multiShotPowerup = null;
let mouseX = 0;
let mouseY = 0;
let bonusCoinsEnabled = false;
let isMouseDown = false;
let currentLevel = 1;
const MAX_LEVELS = 62;  // Changed from 61 to 62
let showLevelSelect = false;
let showVictoryScreen = false;
let showUpgradeChoice = true;  // Track if player has made their choice
let isEndlessMode = false;
let totalKills = 0;  // Track total kills across all levels
let isPaused = false; // Add pause state
let unlockedLevels = [1]; // Start with only level 1 unlocked
let activeCodes = []; // Track redeemed codes

// Game codes and their effects
const GAME_CODES = {
    'ULTRADUCK': { effect: 'levelDamage', value: 5, description: '+5 damage per level' },
    'QUACKMASTER': { effect: 'levelDamage', value: 3, description: '+3 damage per level' },
    'DUCKPOWER': { effect: 'levelDamage', value: 2, description: '+2 damage per level' },
    'WADDLE': { effect: 'levelDamage', value: 4, description: '+4 damage per level' },
    'FEATHERS': { effect: 'levelDamage', value: 6, description: '+6 damage per level' },
    'DUCK AND LASER': { effect: 'bulletMod', value: { multishot: 3, bounces: 2 }, description: '+3 multishot, bullets bounce 2 times' },
    'EXPLOSIVE HYPERDUCK': { effect: 'bulletMod', value: { explosive: true, explosiveDamage: 20 }, description: 'Bullets explode on impact, dealing 20 damage' }
};

class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 20;
        this.speed = 5;  // Base speed
        this.bullets = [];
        this.color = '#00ff00';
        this.alive = true;
        this.score = 0;
        this.maxHp = 5;  // Base HP
        this.hp = this.maxHp;
        this.hasShield = false;
        this.hasMultiShot = false;
        this.baseDamage = 1;  // Base damage dealt TO enemies
        this.damage = this.baseDamage;  // Current damage dealt TO enemies
        this.hasBlink = false;
        this.blinkCooldown = 0;
        this.blinkMaxCooldown = 120; // 2 seconds at 60fps
        this.blinkDistance = 150; // Distance of the blink teleport
        this.blinkParticles = [];
        this.hasVoidCoil = false;
        this.voidCoilCooldown = 0;
        this.voidCoilMaxCooldown = 180; // 3 seconds
        this.afterimages = [];
        this.extraMultishot = 0;  // Track additional multishot from codes
        this.bulletBounces = 0;   // Track bullet bounces from codes
        this.explosiveBullets = false;  // Track if bullets should explode
        this.explosiveDamage = 0;  // Track explosive damage amount
        
        // Calculate additional effects from active codes
        let codeDamageBonus = 0;
        activeCodes.forEach(code => {
            if (GAME_CODES[code].effect === 'levelDamage') {
                codeDamageBonus += GAME_CODES[code].value * currentLevel;
            } else if (GAME_CODES[code].effect === 'bulletMod') {
                const mods = GAME_CODES[code].value;
                this.extraMultishot = Math.max(this.extraMultishot, mods.multishot || 0);
                this.bulletBounces = Math.max(this.bulletBounces, mods.bounces || 0);
                if (mods.explosive) {
                    this.explosiveBullets = true;
                    this.explosiveDamage = mods.explosiveDamage;
                }
            }
        });
        this.damage = this.baseDamage + codeDamageBonus;
    }

    draw() {
        ctx.save();
        // Rotate the duck to face mouse direction
        const angle = Math.atan2(mouseY - this.y, mouseX - this.x);
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);

        // Draw duck body (oval)
        ctx.beginPath();
        ctx.fillStyle = '#FFD700';  // Golden yellow
        ctx.strokeStyle = '#DAA520';  // Darker golden
        ctx.lineWidth = 2;
        ctx.ellipse(0, 0, this.radius, this.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw duck head
        ctx.beginPath();
        ctx.arc(this.radius * 0.8, -this.radius * 0.3, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw beak
        ctx.beginPath();
        ctx.fillStyle = '#FFA500';  // Orange
        ctx.moveTo(this.radius * 1.3, -this.radius * 0.3);
        ctx.lineTo(this.radius * 1.8, -this.radius * 0.4);
        ctx.lineTo(this.radius * 1.8, -this.radius * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw eye
        ctx.beginPath();
        ctx.fillStyle = 'black';
        ctx.arc(this.radius * 1.0, -this.radius * 0.4, this.radius * 0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Draw HP bar above duck
        const barWidth = 50;
        const barHeight = 5;
        const barX = this.x - barWidth/2;
        const barY = this.y - this.radius - 15;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(barX, barY, (this.hp/this.maxHp) * barWidth, barHeight);

        // Draw shield if active
        if (this.hasShield) {
            ctx.beginPath();
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw multi-shot indicator
        if (this.hasMultiShot) {
            ctx.beginPath();
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.arc(this.x, this.y, this.radius + 15, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw blink cooldown indicator if player has blink
        if (this.hasBlink) {
            const cooldownPercent = this.blinkCooldown / this.blinkMaxCooldown;
            if (cooldownPercent > 0) {
                ctx.beginPath();
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2;
                ctx.arc(this.x, this.y, this.radius + 20, 
                    -Math.PI/2, -Math.PI/2 + (1 - cooldownPercent) * Math.PI * 2);
                ctx.stroke();
            }
        }

        // Draw blink particles
        if (this.blinkParticles) {
            this.blinkParticles.forEach(particle => {
                ctx.beginPath();
                ctx.fillStyle = particle.color;
                ctx.arc(particle.x, particle.y, 
                    particle.radius * (particle.lifetime / 20), 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw afterimages
        this.afterimages.forEach(afterimage => {
            ctx.beginPath();
            ctx.fillStyle = `rgba(0, 255, 255, ${afterimage.lifetime / 120 * 0.5})`;
            ctx.arc(afterimage.x, afterimage.y, afterimage.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    update() {
        // Movement - using lowercase key checks
        if (keys['arrowleft'] || keys['a']) this.x -= this.speed;
        if (keys['arrowright'] || keys['d']) this.x += this.speed;
        if (keys['arrowup'] || keys['w']) this.y -= this.speed;
        if (keys['arrowdown'] || keys['s']) this.y += this.speed;

        // Keep player in bounds
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        // Update bullets
        this.bullets.forEach((bullet, index) => {
            bullet.update();
            if (bullet.isOffscreen()) {
                this.bullets.splice(index, 1);
            }
        });

        // Update blink cooldown
        if (this.blinkCooldown > 0) {
            this.blinkCooldown--;
        }

        // Blink ability (on Space key)
        if (this.hasBlink && keys[' '] && this.blinkCooldown <= 0) {
            const angle = Math.atan2(mouseY - this.y, mouseX - this.x);
            this.x += Math.cos(angle) * this.blinkDistance;
            this.y += Math.sin(angle) * this.blinkDistance;
            
            // Keep player in bounds after blink
            this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
            this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));
            
            // Add blink effect
            for (let i = 0; i < 10; i++) {
                const particle = {
                    x: this.x,
                    y: this.y,
                    radius: 5,
                    color: 'rgba(0, 255, 255, 0.5)',
                    lifetime: 20
                };
                this.blinkParticles.push(particle);
            }
            
            this.blinkCooldown = this.blinkMaxCooldown;
        }

        // Update blink particles
        if (this.blinkParticles) {
            for (let i = this.blinkParticles.length - 1; i >= 0; i--) {
                const particle = this.blinkParticles[i];
                particle.lifetime--;
                if (particle.lifetime <= 0) {
                    this.blinkParticles.splice(i, 1);
                }
            }
        }

        // Update Void Coil cooldown
        if (this.voidCoilCooldown > 0) {
            this.voidCoilCooldown--;
        }

        // Void Coil dash (on Shift key)
        if (this.hasVoidCoil && keys['shift'] && this.voidCoilCooldown <= 0) {
            const angle = Math.atan2(mouseY - this.y, mouseX - this.x);
            
            // Create afterimage at current position
            this.afterimages.push({
                x: this.x,
                y: this.y,
                radius: this.radius,
                lifetime: 120 // 2 seconds
            });
            
            // Dash
            this.x += Math.cos(angle) * 200;
            this.y += Math.sin(angle) * 200;
            
            // Keep in bounds
            this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
            this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));
            
            this.voidCoilCooldown = this.voidCoilMaxCooldown;
        }

        // Update afterimages
        for (let i = this.afterimages.length - 1; i >= 0; i--) {
            const afterimage = this.afterimages[i];
            afterimage.lifetime--;
            
            // Remove expired afterimages
            if (afterimage.lifetime <= 0) {
                this.afterimages.splice(i, 1);
            }
        }
    }

    shoot(targetX, targetY) {
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        
        // Use the higher of normal multishot (5) or extraMultishot from codes
        const bulletCount = Math.max(5 * (this.hasMultiShot ? 1 : 0), this.extraMultishot || 0);
        
        if (bulletCount > 0) {
            const spreadAngle = Math.PI / 8; // 22.5 degree spread
            for (let i = 0; i < bulletCount; i++) {
                const bulletAngle = angle + (i - (bulletCount-1)/2) * spreadAngle;
                const bullet = new Bullet(this.x, this.y, bulletAngle);
                bullet.maxBounces = this.bulletBounces;  // Apply bounce count
                bullet.isExplosive = this.explosiveBullets;  // Set explosive property
                bullet.explosiveDamage = this.explosiveDamage;  // Set explosive damage
                this.bullets.push(bullet);
            }
        } else {
            // Single bullet without multishot
            const bullet = new Bullet(this.x, this.y, angle);
            bullet.maxBounces = this.bulletBounces;  // Apply bounce count
            bullet.isExplosive = this.explosiveBullets;  // Set explosive property
            bullet.explosiveDamage = this.explosiveDamage;  // Set explosive damage
            this.bullets.push(bullet);
        }
    }

    activateShield() {
        this.hasShield = true;
    }

    activateMultiShot() {
        this.hasMultiShot = true;
    }
}

class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.speed = 10;
        this.radius = 4;
        this.dx = Math.cos(angle) * this.speed;
        this.dy = Math.sin(angle) * this.speed;
        this.startX = x;  // Store starting position
        this.startY = y;
        this.colors = ['#ffff00', '#ff00ff', '#00ffff', '#ff0000', '#0000ff'];
        this.bounceCount = 0;  // Track number of bounces
        this.maxBounces = 0;   // Maximum bounces allowed
        this.isExplosive = false;  // Track if bullet should explode
        this.explosiveDamage = 0;  // Track explosive damage amount
    }

    draw() {
        // Calculate distance from start position
        const dx = this.x - this.startX;
        const dy = this.y - this.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Get color based on distance
        const colorIndex = Math.min(
            Math.floor(distance / 200), // Change color every 200 pixels
            this.colors.length - 1
        );
        
        ctx.beginPath();
        ctx.fillStyle = this.colors[colorIndex];
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Optional: Add glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.colors[colorIndex];
        
        // Reset shadow for other drawings
        ctx.shadowBlur = 0;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;

        // Check for bounces if we have bounces remaining
        if (this.maxBounces > 0) {
            if (this.x <= 0 || this.x >= canvas.width) {
                if (this.bounceCount < this.maxBounces) {
                    this.dx = -this.dx;  // Reverse horizontal direction
                    this.bounceCount++;
                }
            }
            if (this.y <= 0 || this.y >= canvas.height) {
                if (this.bounceCount < this.maxBounces) {
                    this.dy = -this.dy;  // Reverse vertical direction
                    this.bounceCount++;
                }
            }
        }
    }

    isOffscreen() {
        // Only consider it offscreen if we've used all our bounces
        if (this.bounceCount >= this.maxBounces) {
            return (
                this.x < 0 || 
                this.x > canvas.width || 
                this.y < 0 || 
                this.y > canvas.height
            );
        }
        return false;
    }
}

class Enemy {
    constructor() {
        this.radius = 15;
        this.speed = 2;
        this.respawn();
    }

    respawn() {
        // Spawn from edges
        if (Math.random() < 0.5) {
            this.x = Math.random() < 0.5 ? 0 : canvas.width;
            this.y = Math.random() * canvas.height;
        } else {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() < 0.5 ? 0 : canvas.height;
        }
    }

    draw() {
        ctx.beginPath();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    update(playerX, playerY) {
        const angle = Math.atan2(playerY - this.y, playerX - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }
}

class SplittingEnemy extends Enemy {
    constructor(x, y, size = 'large') {
        super();
        this.size = size; // 'large', 'medium', or 'small'
        if (x !== undefined && y !== undefined) {
            this.x = x;
            this.y = y;
        }
        
        // Set size-specific properties
        switch(size) {
            case 'large':
                this.radius = 25;
                this.speed = 1.5;
                break;
            case 'medium':
                this.radius = 15;
                this.speed = 2;
                break;
            case 'small':
                this.radius = 8;
                this.speed = 2.5;
                break;
        }
    }

    draw() {
        ctx.beginPath();
        ctx.strokeStyle = '#ff0000';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.rect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.fill();
        ctx.stroke();
    }

    split() {
        if (this.size === 'large') {
            // Split into 4 medium pieces in different directions
            return [
                new SplittingEnemy(this.x - 20, this.y - 20, 'medium'), // Top left
                new SplittingEnemy(this.x + 20, this.y - 20, 'medium'), // Top right
                new SplittingEnemy(this.x - 20, this.y + 20, 'medium'), // Bottom left
                new SplittingEnemy(this.x + 20, this.y + 20, 'medium')  // Bottom right
            ];
        } else if (this.size === 'medium') {
            // Split into 2 small pieces in opposite directions
            return [
                new SplittingEnemy(this.x - 15, this.y, 'small'), // Left
                new SplittingEnemy(this.x + 15, this.y, 'small')  // Right
            ];
        }
        return [];
    }
}

class ExplodingEnemy extends Enemy {
    constructor() {
        super();
        this.radius = 20;
        this.isExploding = false;
        this.explosionRadius = 0;
        this.maxExplosionRadius = 60;  // Doubled from 30 to 60
        this.explosionDuration = 180;
        this.explosionTimer = 0;
        this.explosionDamage = 2;
        this.explosionFrame = 0;
    }

    draw() {
        if (this.isExploding) {
            ctx.save();
            // Calculate explosion progress
            const progress = 1 - this.explosionTimer/this.explosionDuration;
            const alpha = 0.8 * (1 - progress);  // Increased from 0.7 to 0.8 for better visibility
            
            // Create supernova gradient effect
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.explosionRadius
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
            gradient.addColorStop(0.2, `rgba(255, 150, 0, ${alpha * 0.9})`);  // Adjusted stops for larger size
            gradient.addColorStop(0.5, `rgba(255, 50, 0, ${alpha * 0.7})`);
            gradient.addColorStop(1, `rgba(255, 0, 0, ${alpha * 0.4})`);
            
            // Draw main explosion
            ctx.beginPath();
            ctx.fillStyle = gradient;
            ctx.arc(this.x, this.y, this.explosionRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Add shockwave effect
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
            ctx.lineWidth = 3;
            ctx.arc(this.x, this.y, this.explosionRadius * 0.85, 0, Math.PI * 2);
            ctx.stroke();
            
            // Add energy rays
            for (let i = 0; i < 12; i++) {  // Increased from 8 to 12 rays
                const angle = (i / 12) * Math.PI * 2 + this.explosionFrame * 0.1;
                const innerRadius = this.explosionRadius * 0.3;
                const outerRadius = this.explosionRadius;
                
                ctx.beginPath();
                ctx.strokeStyle = `rgba(255, 200, 0, ${alpha * 0.4})`;
                ctx.lineWidth = 3;
                ctx.moveTo(
                    this.x + Math.cos(angle) * innerRadius,
                    this.y + Math.sin(angle) * innerRadius
                );
                ctx.lineTo(
                    this.x + Math.cos(angle) * outerRadius,
                    this.y + Math.sin(angle) * outerRadius
                );
                ctx.stroke();
            }
            
            ctx.restore();
        } else {
            // Draw triangle
            ctx.beginPath();
            ctx.strokeStyle = '#ff8800';
            ctx.fillStyle = 'rgba(255, 136, 0, 0.5)';
            ctx.lineWidth = 2;
            
            // Draw isosceles triangle
            const height = this.radius * 2;
            const base = this.radius * 1.5;
            ctx.moveTo(this.x, this.y - height/2);
            ctx.lineTo(this.x - base/2, this.y + height/2);
            ctx.lineTo(this.x + base/2, this.y + height/2);
            ctx.closePath();
            
            ctx.fill();
            ctx.stroke();
        }
    }

    explode() {
        this.isExploding = true;
        this.explosionTimer = this.explosionDuration;
        return true;
    }

    update(playerX, playerY) {
        if (this.isExploding) {
            this.explosionRadius = this.maxExplosionRadius * 
                (1 - this.explosionTimer/this.explosionDuration);
            this.explosionTimer--;
            this.explosionFrame++;
            
            // Check for player damage
            const dx = playerX - this.x;
            const dy = playerY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.explosionRadius && !player.hasShield) {
                player.hp -= this.explosionDamage;
                if (player.hp <= 0) {
                    player.alive = false;
                }
            }
            
            return this.explosionTimer <= 0;
        } else {
            super.update(playerX, playerY);
            return false;
        }
    }
}

class ShootingEnemy extends Enemy {
    constructor() {
        super();
        this.radius = 18;
        this.shootCooldown = 0;
        this.shootDelay = 60; // 1 shot per second at 60fps
        this.bullets = [];
    }

    draw() {
        // Draw oval
        ctx.beginPath();
        ctx.strokeStyle = '#8800ff';
        ctx.fillStyle = 'rgba(136, 0, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.ellipse(this.x, this.y, this.radius * 1.5, this.radius, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw bullets
        this.bullets.forEach(bullet => {
            ctx.beginPath();
            ctx.fillStyle = '#8800ff';
            ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    update(playerX, playerY) {
        super.update(playerX, playerY);
        
        // Shooting logic
        this.shootCooldown--;
        if (this.shootCooldown <= 0) {
            const angle = Math.atan2(playerY - this.y, playerX - this.x);
            this.bullets.push({
                x: this.x,
                y: this.y,
                dx: Math.cos(angle) * 5,
                dy: Math.sin(angle) * 5
            });
            this.shootCooldown = this.shootDelay;
        }

        // Update bullets
        this.bullets = this.bullets.filter(bullet => {
            bullet.x += bullet.dx;
            bullet.y += bullet.dy;
            return !(bullet.x < 0 || bullet.x > canvas.width || 
                    bullet.y < 0 || bullet.y > canvas.height);
        });
    }
}

class Boss {
    constructor() {
        this.radius = 45;
        this.speed = 1.5;
        // Set HP based on level
        this.maxHp = currentLevel <= 12 ? 5000 : 11000;
        this.hp = this.maxHp;
        this.x = canvas.width / 2;
        this.y = 0;
        this.bullets = [];
        this.attackCooldown = 0;
        this.attackDelay = 300;
        this.rotation = 0;
        this.rotationSpeed = 0.05;
    }

    shoot(playerX, playerY) {
        // Choose random attack pattern
        const attackPattern = Math.floor(Math.random() * 3);
        
        switch(attackPattern) {
            case 0: // Line attack
                this.shootLinePattern(playerX, playerY);
                break;
            case 1: // Big projectiles
                this.shootBigProjectiles();
                break;
            case 2: // Multi-directional
                this.shootMultiDirectional();
                break;
        }
    }

    shootLinePattern(playerX, playerY) {
        const angle = Math.atan2(playerY - this.y, playerX - this.x);
        const spacing = 30; // Space between bullets
        
        for (let i = 0; i < 10; i++) {
            // Offset each bullet's starting position along the line
            const offsetX = this.x + Math.cos(angle) * (i * spacing);
            const offsetY = this.y + Math.sin(angle) * (i * spacing);
            
            this.bullets.push(new BossBullet(
                offsetX, 
                offsetY, 
                angle,
                4, // normal radius
                7  // normal speed
            ));
        }
    }

    shootBigProjectiles() {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            this.bullets.push(new BossBullet(
                this.x,
                this.y,
                angle,
                45, // big radius (same as boss)
                5   // slower speed
            ));
        }
    }

    shootMultiDirectional() {
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            this.bullets.push(new BossBullet(
                this.x,
                this.y,
                angle,
                4, // normal radius
                7  // normal speed
            ));
        }
    }

    draw() {
        // Draw rotating hexagon
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Draw hexagon
        ctx.beginPath();
        ctx.strokeStyle = '#ff0000';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 3;

        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI * 2) / 6;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();  // Restore before drawing HP bar

        // Draw HP bar without rotation
        const barWidth = this.radius * 2;
        const barHeight = 10;
        const barX = this.x - barWidth/2;
        const barY = this.y - this.radius - 20;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(barX, barY, (this.hp/this.maxHp) * barWidth, barHeight);
    }

    update(playerX, playerY) {
        const angle = Math.atan2(playerY - this.y, playerX - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;

        // Attack timing
        this.attackCooldown--;
        if (this.attackCooldown <= 0) {
            this.shoot(playerX, playerY);
            this.attackCooldown = this.attackDelay;
        }

        // Update bullets
        this.bullets.forEach((bullet, index) => {
            bullet.update();
            bullet.draw();
            
            // Check collision with player
            const dx = playerX - bullet.x;
            const dy = playerY - bullet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < player.radius + bullet.radius) {
                if (!player.hasShield) {
                    player.hp--;  // Take 1 damage from boss bullets instead of player.damage
                    if (player.hp <= 0) {
                        player.alive = false;
                    }
                }
                this.bullets.splice(index, 1);
            }
            
            // Check if bullet is offscreen
            if (bullet.isOffscreen()) {
                this.bullets.splice(index, 1);
            }
        });

        this.rotation += this.rotationSpeed;  // Update rotation
    }
}

class BossBullet {
    constructor(x, y, angle, radius, speed, color = '#ff4444', isLaser = false, isBlackHole = false, accelerating = false) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.radius = radius;
        this.speed = speed;
        this.dx = Math.cos(angle) * this.speed;
        this.dy = Math.sin(angle) * this.speed;
        this.color = color;
        this.isLaser = isLaser;
        this.isBlackHole = isBlackHole;
        this.accelerating = accelerating;
        this.lifetime = 0;
    }

    draw() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        this.lifetime++;
    }

    isOffscreen() {
        return (
            this.x < -50 || 
            this.x > canvas.width + 50 || 
            this.y < -50 || 
            this.y > canvas.height + 50
        );
    }
}

// Add Shield class
class ShieldPowerup {
    constructor() {
        this.radius = 15;
        this.x = Math.random() * (canvas.width - 2 * this.radius) + this.radius;
        this.y = Math.random() * (canvas.height - 2 * this.radius) + this.radius;
        this.color = '#00ffff';
    }

    draw() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.radius, this.y - this.radius, 
                    this.radius * 2, this.radius * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(this.x - this.radius, this.y - this.radius, 
                      this.radius * 2, this.radius * 2);
    }

    respawn() {
        this.x = Math.random() * (canvas.width - 2 * this.radius) + this.radius;
        this.y = Math.random() * (canvas.height - 2 * this.radius) + this.radius;
    }
}

// Add MultiShotPowerup class
class MultiShotPowerup {
    constructor() {
        this.radius = 15;
        this.x = Math.random() * (canvas.width - 2 * this.radius) + this.radius;
        this.y = Math.random() * (canvas.height - 2 * this.radius) + this.radius;
        this.color = '#ffff00';
    }

    draw() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// Remove all existing keydown event listeners
window.removeEventListener('keydown', window.keydownHandler);

// Create a single keydown handler
window.keydownHandler = function(e) {
    keys[e.key.toLowerCase()] = true;
    
    // Handle ESC key for pause - only when game is started
    if (e.key === 'Escape' && gameStarted) {
        console.log('Escape key pressed!');
        isPaused = !isPaused;
        console.log('Game paused:', isPaused);
    }
};

// Add the single keydown handler
window.addEventListener('keydown', window.keydownHandler);

// Remove the DOMContentLoaded event listener that adds another keydown handler
// document.addEventListener('DOMContentLoaded', () => {
//     window.addEventListener('keydown', e => {
//         if (e.key === 'Escape' && gameStarted) {
//             console.log('Escape pressed (from DOMContentLoaded), toggling pause');
//             isPaused = !isPaused;
//         }
//     });
// });

window.addEventListener('keyup', e => {
    e.preventDefault();  // Prevent default browser actions
    keys[e.key.toLowerCase()] = false;  // Convert to lowercase for consistency
});

window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

canvas.addEventListener('mousedown', () => {
    isMouseDown = true;
});

canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
});

function debugLog(message) {
    console.log(`[DEBUG] ${message}`);
}

function resetGame() {
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.alive = true;
    player.bullets = [];
    player.score = 0;
    
    // Calculate level-based bonuses
    const hpBonus = Math.floor(currentLevel / 6) * 4;  // +4 HP every 6 levels
    const levelHpBonus = currentLevel;                 // +1 HP per level
    const damageBonus = Math.floor(currentLevel / 5);  // +1 damage every 5 levels
    
    // Apply bonuses to player stats
    player.maxHp = 5 + permanentUpgrades.maxHp + hpBonus + levelHpBonus;
    player.hp = player.maxHp;
    player.speed = 5 + permanentUpgrades.speed;
    player.damage = player.baseDamage + damageBonus;
    
    // Reset enemies
    enemies.length = 0;
    for (let i = 0; i < 8; i++) {
        const type = Math.floor(Math.random() * 4); // 0-3 for different types
        switch(type) {
            case 0:
                enemies.push(new SplittingEnemy());
                break;
            case 1:
                enemies.push(new ExplodingEnemy());
                break;
            case 2:
                enemies.push(new ShootingEnemy());
                break;
            default:
                enemies.push(new Enemy()); // Normal enemy
        }
    }
    
    bosses = [];  // Clear bosses array
    enemiesKilled = 0;  // Reset current level kills
    bossKillCount = 0;  // Reset boss kill count
    shieldPowerup = null;
    player.hasShield = false;
    multiShotPowerup = null;
    player.hasMultiShot = false;
    
    if (!gameStarted) {
        gameStarted = false;
        allowMultiplePowerups = false;
    }
    loadGame();
}

function initGame() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gameStarted = false;
    loadGame();  // Load saved data
    resetGame();
    gameLoop();
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameStarted) {
        drawStartMenu();
    } else {
        runGame();
        if (isPaused) {
            console.log('Game is paused, drawing pause menu');
            drawPauseMenu();
        }
    }

    requestAnimationFrame(gameLoop);
}

function drawStartMenu() {
    // Title
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GEOMETRY WARS', canvas.width / 2, 100);

    if (showLevelSelect) {
        ctx.fillStyle = 'white';
        ctx.font = '32px Arial';
        ctx.fillText('SELECT LEVEL', canvas.width/2, 150);

        // Draw level buttons in a grid (now including level 62)
        for (let i = 1; i <= MAX_LEVELS; i++) {
            const x = canvas.width/2 - 450 + ((i-1) % 10) * 90; // 10 columns
            const y = 200 + Math.floor((i-1) / 10) * 60;        // 7 rows now
            
            // Check if level is unlocked
            const isUnlocked = unlockedLevels.includes(i);
            
            // Draw button background (gray for locked, normal for unlocked)
            ctx.fillStyle = isUnlocked ? '#444444' : '#222222';
            ctx.fillRect(x - 25, y - 25, 50, 50);
            
            // Draw level number
            ctx.fillStyle = isUnlocked ? 'white' : '#666666';
            ctx.font = '20px Arial';
            ctx.fillText(i.toString(), x, y + 7);
            
            // Draw lock icon for locked levels
            if (!isUnlocked) {
                ctx.fillStyle = '#666666';
                ctx.beginPath();
                ctx.arc(x, y - 5, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(x - 5, y - 5, 10, 12);
            }
        }

        // Move back button down further to accommodate extra row
        ctx.fillStyle = '#444444';
        ctx.fillRect(canvas.width/2 - 60, 700, 120, 40);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText('Back', canvas.width/2, 725);
    } else {
        // Normal menu items
        // Power-up mode toggle
        ctx.fillStyle = allowMultiplePowerups ? '#00ff00' : '#444444';
        ctx.fillRect(canvas.width/2 - 150, 150, 300, 40);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText(`Multiple Power-ups: ${allowMultiplePowerups ? 'ON' : 'OFF'}`, 
                    canvas.width/2, 175);

        // Select Level button
        ctx.fillStyle = '#444444';
        ctx.fillRect(canvas.width/2 - 150, 200, 300, 40);
        ctx.fillStyle = 'white';
        ctx.fillText('Select Level', canvas.width/2, 225);

        // Shop section
        ctx.fillStyle = 'white';
        ctx.font = '32px Arial';
        ctx.fillText('SHOP', canvas.width/2, 250);
        ctx.font = '20px Arial';
        ctx.fillText(`Coins: ${coins}`, canvas.width/2, 280);

        // Code redemption section
        ctx.fillStyle = '#444444';
        ctx.fillRect(canvas.width/2 - 150, 310, 300, 40);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText('Enter Code', canvas.width/2, 335);

        // Display active codes
        ctx.font = '16px Arial';
        ctx.fillStyle = '#00ff00';
        activeCodes.forEach((code, index) => {
            ctx.fillText(`Active: ${code} (${GAME_CODES[code].description})`, 
                        canvas.width/2, 365 + index * 20);
        });

        // Shop items (moved down to accommodate code section)
        const shopItems = [
            { name: 'Extra Projectile', cost: 50, key: 'extraProjectiles' },
            { name: 'Max HP +1', cost: 50, key: 'maxHp' },
            { name: 'Speed +1', cost: 50, key: 'speed' }
        ];

        shopItems.forEach((item, index) => {
            const y = 410 + (index * 50);  // Moved down by 100 pixels
            ctx.fillStyle = coins >= item.cost ? '#444444' : '#222222';
            ctx.fillRect(canvas.width/2 - 150, y, 300, 40);
            ctx.fillStyle = 'white';
            ctx.fillText(`${item.name} (${permanentUpgrades[item.key]}) - ${item.cost} coins`, 
                        canvas.width/2, y + 25);
        });

        // Start button (moved down)
        ctx.fillStyle = '#444444';
        ctx.fillRect(canvas.width/2 - 60, 600, 120, 40);  // Moved down by 100 pixels
        ctx.fillStyle = 'white';
        ctx.fillText('Start Game', canvas.width/2, 625);

        // Add bonus coins toggle button (moved down)
        ctx.fillStyle = '#444444';
        ctx.fillRect(canvas.width/2 - 150, 550, 300, 40);  // Moved down by 100 pixels
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText(`Bonus Coins: ${bonusCoinsEnabled ? 'ON' : 'OFF'}`, 
                    canvas.width/2, 575);
    }
}

function runGame() {
    // Level indicator
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    if (isEndlessMode) {
        ctx.fillText(`Endless Mode - Level ${currentLevel - 60}`, 20, 40);
    } else {
        ctx.fillText(`Level: ${currentLevel}`, 20, 40);
    }

    // Add kill counter
    ctx.textAlign = 'right';
    ctx.fillText(`Kills: ${totalKills}`, canvas.width - 20, 40);
    
    // Add test pause button
    ctx.fillStyle = '#444444';
    ctx.fillRect(canvas.width - 120, 60, 100, 30);
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText('Pause', canvas.width - 70, 80);

    // Don't update game state if paused
    if (isPaused) return;

    debugLog(`Frame - Boss: ${bosses.length > 0 ? 'Present' : 'None'}, Enemies: ${enemies.length}, Kills: ${enemiesKilled}`);
    
    if (player.alive) {
        if (isMouseDown) {
            player.shoot(mouseX, mouseY);
        }

        player.update();
        player.draw();

        player.bullets.forEach((bullet, bulletIndex) => {
            bullet.draw();
        });

        // Only update and draw regular enemies if bosses aren't present
        if (bosses.length === 0) {
            enemies.forEach((enemy, enemyIndex) => {
                if (!enemy) {
                    console.error('Invalid enemy at index:', enemyIndex);
                    return;
                }
                try {
                enemy.update(player.x, player.y);
                enemy.draw();

                // Check collision with player
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < player.radius + enemy.radius) {
                    if (!player.hasShield) {
                            player.hp--;  // Take 1 damage from enemy collisions instead of player.damage
                        if (player.hp <= 0) {
                            player.alive = false;
                        }
                    }
                    enemy.respawn();
                    }
                } catch (error) {
                    console.error('Error with enemy:', error);
                }
            });

            // Check bullet collisions with enemies
            player.bullets.forEach((bullet, bulletIndex) => {
                // Check collisions with regular enemies
                if (bosses.length === 0) {
                enemies.forEach((enemy, enemyIndex) => {
                    const dx = bullet.x - enemy.x;
                    const dy = bullet.y - enemy.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < bullet.radius + enemy.radius) {
                        player.bullets.splice(bulletIndex, 1);
                            
                        if (bullet.isExplosive) {
                            // Create explosion effect
                            const explosion = new ExplodingEnemy();
                            explosion.x = bullet.x;
                            explosion.y = bullet.y;
                            explosion.isExploding = true;
                            explosion.explosionTimer = explosion.explosionDuration;
                            explosion.explosionDamage = bullet.explosiveDamage;
                            enemies.push(explosion);
                            
                            // Remove the hit enemy
                            enemies.splice(enemyIndex, 1);
                            enemiesKilled++;
                            totalKills++;
                            player.score += 10;
                        } else if (enemy instanceof SplittingEnemy) {
                            const newEnemies = enemy.split();
                            enemies.splice(enemyIndex, 1);
                            if (newEnemies.length > 0) {
                                newEnemies.forEach(newEnemy => {
                                    enemies.push(newEnemy);
                                });
                                if (enemy.size === 'small') {
                                    enemiesKilled++;
                                    totalKills++;
                                    player.score += 10;
                                }
                            }
                        } else if (enemy instanceof ExplodingEnemy) {
                            const ex = enemy.x;
                            const ey = enemy.y;
                            enemies.splice(enemyIndex, 1);
                            
                            const explosion = new ExplodingEnemy();
                            explosion.x = ex;
                            explosion.y = ey;
                            explosion.isExploding = true;
                            explosion.explosionTimer = explosion.explosionDuration;
                            enemies.push(explosion);
                            
                            enemiesKilled++;
                            totalKills++;
                            player.score += 10;
                        } else {
                            enemies.splice(enemyIndex, 1);
                            enemiesKilled++;
                            totalKills++;
                            player.score += 10;
                        }
                    }
                });
            }

                // Check collisions with bosses
                bosses.forEach((boss, bossIndex) => {
                    const dx = bullet.x - boss.x;
                    const dy = bullet.y - boss.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < bullet.radius + boss.radius) {
                        player.bullets.splice(bulletIndex, 1);
                        
                        if (boss instanceof GalacticBehemoth) {
                            const isDead = boss.takeDamage(player.damage);
                            if (isDead) {
                                // Start death animation and grant reward
                                boss.deathAnimation().then(() => {
                                    const rewardName = boss.grantReward();
                                    bosses.splice(bossIndex, 1);
                                    player.score += 5000;
                                    coins += 500;
                                    
                                    if (bosses.length === 0) {
                                        enemiesKilled = 0;
                                        bossKillCount++;
                                        showVictoryScreen = true;
                                        // Unlock next level if not already unlocked
                                        if (currentLevel < MAX_LEVELS && !unlockedLevels.includes(currentLevel + 1)) {
                                            unlockedLevels.push(currentLevel + 1);
                                            saveGame();
                                        }
                                    }
                                });
                            }
                        } else {
                            boss.hp -= player.damage;
                            if (boss.hp <= 0) {
                                boss.bullets = [];
                                bosses.splice(bossIndex, 1);
                                player.score += 100;
                                coins += 50;
                                
                                if (bosses.length === 0) {
                                    enemiesKilled = 0;
                                    bossKillCount++;
                                    showVictoryScreen = true;
                                    // Unlock next level if not already unlocked
                                    if (currentLevel < MAX_LEVELS && !unlockedLevels.includes(currentLevel + 1)) {
                                        unlockedLevels.push(currentLevel + 1);
                                        saveGame();
                                    }
                                }
                            }
                        }
                    }
                });
            });
        }

        // Check if should spawn bosses
        if (enemiesKilled >= ENEMIES_TO_BOSS && bosses.length === 0) {
            debugLog('Spawning bosses');
            
            if (currentLevel === 61) {
                // Spawn Galactic Behemoth for level 61
                const behemoth = new GalacticBehemoth();
                behemoth.x = canvas.width / 2;
                behemoth.y = 0;
                bosses.push(behemoth);
            } else if (currentLevel === 62) {
                // Spawn Celestial Leviathan
                const leviathan = new CelestialLeviathan();
                leviathan.x = canvas.width / 2;
                leviathan.y = 0;
                bosses.push(leviathan);
                
                // Clear existing enemies and bullets
                enemies.length = 0;
                player.bullets = [];
            } else {
                // Normal boss spawning for other levels
                const numberOfBosses = isEndlessMode 
                    ? Math.floor((currentLevel - 60) / 3) + 2
                    : Math.floor(currentLevel / 6) + 1;
                
                for (let i = 0; i < numberOfBosses; i++) {
                    const boss = new Boss();
                    boss.x = (canvas.width / (numberOfBosses + 1)) * (i + 1);
                    boss.y = 0;
                    bosses.push(boss);
                }
            }
            
            debugLog('Clearing regular enemies');
            enemies.length = 0;
            enemiesKilled = 0;
            player.bullets = [];
            shieldPowerup = null;
        }

        // Boss logic
        if (bosses.length > 0) {
            bosses.forEach((boss, bossIndex) => {
                boss.update(player.x, player.y);
                boss.draw();

                // Check bullet collisions with boss
                for (let bulletIndex = player.bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
                    const bullet = player.bullets[bulletIndex];
                const dx = bullet.x - boss.x;
                const dy = bullet.y - boss.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < bullet.radius + boss.radius) {
                    player.bullets.splice(bulletIndex, 1);
                        
                        if (boss instanceof GalacticBehemoth) {
                            const isDead = boss.takeDamage(player.damage);
                            if (isDead) {
                                // Start death animation and grant reward
                                boss.deathAnimation().then(() => {
                                    const rewardName = boss.grantReward();
                                    bosses.splice(bossIndex, 1);
                                    player.score += 5000;
                                    coins += 500;
                                    
                                    if (bosses.length === 0) {
                                        enemiesKilled = 0;
                                        bossKillCount++;
                                        showVictoryScreen = true;
                                        // Unlock next level if not already unlocked
                                        if (currentLevel < MAX_LEVELS && !unlockedLevels.includes(currentLevel + 1)) {
                                            unlockedLevels.push(currentLevel + 1);
                                            saveGame();
                                        }
                                    }
                                });
                            }
                        } else {
                            boss.hp -= player.damage;
                    if (boss.hp <= 0) {
                                boss.bullets = [];
                                bosses.splice(bossIndex, 1);
                        player.score += 100;
                                coins += 50;
                                
                                if (bosses.length === 0) {
                                    enemiesKilled = 0;
                                    bossKillCount++;
                                    showVictoryScreen = true;
                                    // Unlock next level if not already unlocked
                                    if (currentLevel < MAX_LEVELS && !unlockedLevels.includes(currentLevel + 1)) {
                                        unlockedLevels.push(currentLevel + 1);
                                        saveGame();
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // Draw shield powerup
        if (shieldPowerup) {  // Only draw if it exists
            shieldPowerup.draw();

            // Check collision with shield powerup
            const dxShield = player.x - shieldPowerup.x;
            const dyShield = player.y - shieldPowerup.y;
            const distanceShield = Math.sqrt(dxShield * dxShield + dyShield * dyShield);

            if (distanceShield < player.radius + shieldPowerup.radius) {
                activateShield();
                shieldPowerup = null;
            }
        }

        if (multiShotPowerup) {
            multiShotPowerup.draw();

            // Check collision with multi-shot powerup
            const dxMultiShot = player.x - multiShotPowerup.x;
            const dyMultiShot = player.y - multiShotPowerup.y;
            const distanceMultiShot = Math.sqrt(dxMultiShot * dxMultiShot + dyMultiShot * dyMultiShot);

            if (distanceMultiShot < player.radius + multiShotPowerup.radius) {
                activateMultiShot();
                multiShotPowerup = null;
            }
        }
    } else {
        // Game over screen
        ctx.fillStyle = 'white';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);
        ctx.font = '32px Arial';
        ctx.fillText(`Score: ${player.score}`, canvas.width / 2, canvas.height / 2 + 20);
        
        // Draw reset button
        ctx.fillStyle = '#444444';
        ctx.fillRect(canvas.width/2 - 60, canvas.height/2 + 60, 120, 40);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText('Play Again', canvas.width/2, canvas.height/2 + 85);

        // Add Exit to Menu button
        ctx.fillStyle = '#444444';
        ctx.fillRect(canvas.width/2 - 60, canvas.height/2 + 110, 120, 40);
        ctx.fillStyle = 'white';
        ctx.fillText('Exit to Menu', canvas.width/2, canvas.height/2 + 135);
    }

    // Add victory screen to runGame function after the player.alive check
    if (showVictoryScreen) {
        // Victory screen background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = '64px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CONGRATULATIONS!', canvas.width / 2, canvas.height / 2 - 100);
        
        ctx.fillStyle = 'white';
        ctx.font = '32px Arial';
        ctx.fillText('You have completed all levels!', canvas.width / 2, canvas.height / 2 - 30);
        ctx.fillText(`Final Score: ${player.score}`, canvas.width / 2, canvas.height / 2 + 10);

        if (showUpgradeChoice) {
            // Show upgrade choices
            ctx.fillStyle = 'white';
            ctx.font = '24px Arial';
            ctx.fillText('Choose your upgrade:', canvas.width / 2, canvas.height / 2 + 60);

            // HP upgrade button
            ctx.fillStyle = '#444444';
            ctx.fillRect(canvas.width/2 - 220, canvas.height/2 + 80, 200, 40);
            ctx.fillStyle = 'white';
            ctx.font = '20px Arial';
            ctx.fillText('+1 Max HP', canvas.width/2 - 120, canvas.height/2 + 105);

            // Speed upgrade button
            ctx.fillStyle = '#444444';
            ctx.fillRect(canvas.width/2 + 20, canvas.height/2 + 80, 200, 40);
            ctx.fillStyle = 'white';
            ctx.fillText('+1 Speed', canvas.width/2 + 120, canvas.height/2 + 105);
        } else {
            // Next Level button
            ctx.fillStyle = '#444444';
            ctx.fillRect(canvas.width/2 - 100, canvas.height/2 + 80, 200, 40);
            ctx.fillStyle = 'white';
            ctx.font = '20px Arial';
            ctx.fillText(currentLevel < MAX_LEVELS ? 'Next Level' : 'Back to Menu', 
                        canvas.width/2, canvas.height/2 + 105);
        }
    }

    // Modify the enemy count check in runGame
    if (!bosses.length > 0 && enemies.length < 8) {
        // Only spawn new enemies if we have less than 8
        const enemiesNeeded = 8 - enemies.length;
        for (let i = 0; i < enemiesNeeded; i++) {
            const type = Math.floor(Math.random() * 4);
            switch(type) {
                case 0: enemies.push(new SplittingEnemy()); break;
                case 1: enemies.push(new ExplodingEnemy()); break;
                case 2: enemies.push(new ShootingEnemy()); break;
                default: enemies.push(new Enemy());
            }
        }
    }

    // In endless mode, increment level after each boss kill but don't show victory screen
    if (isEndlessMode && bosses.length === 0 && boss && boss.hp <= 0) {
        currentLevel++;
        enemiesKilled = 0;
        resetGame();
    }
}

// Replace the entire click event listener with this fixed version
canvas.addEventListener('click', e => {
    if (!gameStarted) {
        if (showLevelSelect) {
            // Handle level selection clicks
            for (let i = 1; i <= MAX_LEVELS; i++) {
                const x = canvas.width/2 - 450 + ((i-1) % 10) * 90;
                const y = 200 + Math.floor((i-1) / 10) * 60;
                
                if (e.clientX >= x - 25 && e.clientX <= x + 25 &&
                    e.clientY >= y - 25 && e.clientY <= y + 25) {
                    // Only allow selection if level is unlocked
                    if (unlockedLevels.includes(i)) {
                        currentLevel = i;
                        gameStarted = true;
                        showLevelSelect = false;
                        resetGame();
                        return;
                    }
                }
            }

            // Back button
            if (e.clientY >= 700 && e.clientY <= 740 &&
                e.clientX >= canvas.width/2 - 60 && e.clientX <= canvas.width/2 + 60) {
                showLevelSelect = false;
                return;
            }
        } else {
            // Main menu buttons
            // Select Level button
            if (e.clientY >= 200 && e.clientY <= 240 &&
                e.clientX >= canvas.width/2 - 150 && e.clientX <= canvas.width/2 + 150) {
                showLevelSelect = true;
                return;
            }

        // Power-up mode toggle
        if (e.clientY >= 150 && e.clientY <= 190 &&
            e.clientX >= canvas.width/2 - 150 && e.clientX <= canvas.width/2 + 150) {
            allowMultiplePowerups = !allowMultiplePowerups;
            return;
        }

        // Shop items
        const shopItems = [
            { name: 'Extra Projectile', cost: 50, key: 'extraProjectiles' },
            { name: 'Max HP +1', cost: 50, key: 'maxHp' },
            { name: 'Speed +1', cost: 50, key: 'speed' }
        ];

        shopItems.forEach((item, index) => {
            const y = 310 + (index * 50);
            if (e.clientY >= y && e.clientY <= y + 40 &&
                e.clientX >= canvas.width/2 - 150 && e.clientX <= canvas.width/2 + 150) {
                if (coins >= item.cost) {
                    coins -= item.cost;
                    permanentUpgrades[item.key]++;
                    saveGame();
                }
            }
        });

        // Start button
        if (e.clientY >= 500 && e.clientY <= 540 &&
            e.clientX >= canvas.width/2 - 60 && e.clientX <= canvas.width/2 + 60) {
            gameStarted = true;
            resetGame();
        }

        // Bonus coins toggle
        if (e.clientY >= 350 && e.clientY <= 390 &&
            e.clientX >= canvas.width/2 - 150 && e.clientX <= canvas.width/2 + 150) {
            bonusCoinsEnabled = !bonusCoinsEnabled;
            return;
            }

            // Code redemption button
            if (e.clientY >= 310 && e.clientY <= 350 &&
                e.clientX >= canvas.width/2 - 150 && e.clientX <= canvas.width/2 + 150) {
                const code = prompt('Enter code:')?.toUpperCase();
                if (code && GAME_CODES[code] && !activeCodes.includes(code)) {
                    activeCodes.push(code);
                    saveGame();  // Save activated codes
                    // Reset player to apply new code effects
                    player = new Player();
                    alert('Code redeemed successfully!');
                } else if (activeCodes.includes(code)) {
                    alert('Code already redeemed!');
                } else {
                    alert('Invalid code!');
                }
                return;
            }
        }
    } else if (isPaused) {
        const menuWidth = 400;
        const menuHeight = 300;
        const menuX = canvas.width/2 - menuWidth/2;
        const menuY = canvas.height/2 - menuHeight/2;
        
        // Resume button
        if (e.clientX >= canvas.width/2 - 100 && e.clientX <= canvas.width/2 + 100 &&
            e.clientY >= menuY + 120 && e.clientY <= menuY + 160) {
            console.log('Resume button clicked');
            isPaused = false;
        }
        
        // Main Menu button
        if (e.clientX >= canvas.width/2 - 100 && e.clientX <= canvas.width/2 + 100 &&
            e.clientY >= menuY + 180 && e.clientY <= menuY + 220) {
            console.log('Main Menu button clicked');
            isPaused = false;
            gameStarted = false;
            resetGame();
        }
    } else {
        if (!player.alive) {
            const buttonX = canvas.width/2 - 60;
            const playAgainY = canvas.height/2 + 60;
            const menuY = canvas.height/2 + 110;

            // Play Again button
            if (e.clientX >= buttonX && e.clientX <= buttonX + 120 && 
                e.clientY >= playAgainY && e.clientY <= playAgainY + 40) {
                resetGame();
            }
            // Exit to Menu button
            else if (e.clientX >= buttonX && e.clientX <= buttonX + 120 && 
                     e.clientY >= menuY && e.clientY <= menuY + 40) {
                gameStarted = false;
                resetGame();
            }
        } else if (showVictoryScreen) {
            if (showUpgradeChoice) {
                const buttonY = canvas.height/2 + 80;
                
                // HP upgrade button
                if (e.clientY >= buttonY && e.clientY <= buttonY + 40 &&
                    e.clientX >= canvas.width/2 - 220 && e.clientX <= canvas.width/2 - 20) {
                    player.maxHp += 1;
                    player.hp = player.maxHp;
                    showUpgradeChoice = false;
                }
                
                // Speed upgrade button
                if (e.clientY >= buttonY && e.clientY <= buttonY + 40 &&
                    e.clientX >= canvas.width/2 + 20 && e.clientX <= canvas.width/2 + 220) {
                    player.speed += 1;
                    showUpgradeChoice = false;
            }
        } else {
                const buttonX = canvas.width/2 - 100;
                const buttonY = canvas.height/2 + 80;
                
                if (e.clientX >= buttonX && e.clientX <= buttonX + 200 && 
                    e.clientY >= buttonY && e.clientY <= buttonY + 40) {
                    showVictoryScreen = false;
                    showUpgradeChoice = true;
                    if (currentLevel < MAX_LEVELS) {
                        currentLevel++;
                        resetGame();
                    } else {
                        gameStarted = false;
                        resetGame();
                    }
                }
            }
        } else {
            // Check for test pause button click
            if (e.clientX >= canvas.width - 120 && e.clientX <= canvas.width - 20 &&
                e.clientY >= 60 && e.clientY <= 90) {
                console.log('Pause button clicked');
                isPaused = !isPaused;
                console.log('Game paused state:', isPaused);
            }
        }
    }
});

// Add this function to handle shield power-up spawning
function spawnShieldPowerup() {
    shieldPowerup = new ShieldPowerup();
}

// Add function to spawn random power-up
function spawnRandomPowerup() {
    // Use bossKillCount to determine which power-up to spawn
    if (bossKillCount % 2 === 0) {  // Even number of boss kills
        spawnShieldPowerup();
        debugLog('Spawning shield power-up');
    } else {  // Odd number of boss kills
        multiShotPowerup = new MultiShotPowerup();
        debugLog('Spawning multi-shot power-up');
    }
}

// Add these functions to handle power-up activation
function activateShield() {
    if (!allowMultiplePowerups) {
        player.hasMultiShot = false;  // Clear other power-ups if not allowing multiple
    }
    player.hasShield = true;
}

function activateMultiShot() {
    if (!allowMultiplePowerups) {
        player.hasShield = false;  // Clear other power-ups if not allowing multiple
    }
    player.hasMultiShot = true;
}

// Add save/load functionality for upgrades and coins
function saveGame() {
    const gameData = {
        coins: coins,
        upgrades: permanentUpgrades,
        unlockedLevels: unlockedLevels,
        activeCodes: activeCodes  // Save active codes
    };
    localStorage.setItem('gameData', JSON.stringify(gameData));
}

function loadGame() {
    const savedData = localStorage.getItem('gameData');
    if (savedData) {
        const data = JSON.parse(savedData);
        coins = data.coins || 0;
        permanentUpgrades = data.upgrades || {
            extraProjectiles: 0,
            maxHp: 0,
            speed: 0
        };
        unlockedLevels = data.unlockedLevels || [1];
        activeCodes = data.activeCodes || [];  // Load active codes
    }
}

// Call loadGame when the game starts
loadGame();

// Save game when purchasing upgrades and after boss kills
function purchaseUpgrade(key) {
    // ... purchase logic ...
    saveGame();
}

const player = new Player();
const enemies = Array(7).fill().map(() => new Enemy());
const keys = {};

initGame(); 

// Add a direct document-level event listener for the Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && gameStarted) {
        console.log('Document-level Escape key pressed!');
        isPaused = !isPaused;
        console.log('Game paused state:', isPaused);
    }
});

class GalacticBehemoth extends Boss {
    constructor() {
        super();
        this.maxHp = 20000;  // Increased from 10000 to 20000
        this.hp = this.maxHp;
        this.phase = 1;
        this.phaseHp = {
            1: 20000,  // Increased from 10000 to 20000
            2: 22000,  // Increased from 12000 to 22000
            3: 25000   // Increased from 15000 to 25000
        };
        this.currentPhaseHp = this.phaseHp[1];
        this.hp = this.currentPhaseHp;
        this.initialPlayerDamage = player.damage;
        this.radius = 80;
        this.speed = 1;
        this.attackDelay = 60; // Attack every 1 second
        this.attackCooldown = 0;
        this.bullets = [];
        this.rifts = [];
        this.rotation = 0;
        this.rotationSpeed = 0.02;
        this.reverseControls = false;
        this.supernovaCountdown = null;
        this.plates = Array(8).fill().map((_, i) => ({
            angle: (i * Math.PI * 2) / 8,
            health: 100,
            active: true
        }));
        this.satellites = Array(4).fill().map((_, i) => ({
            angle: (i * Math.PI * 2) / 4,
            distance: 150,
            active: true
        }));
        this.phase3Timer = 0;  // Add timer for phase 3
        this.supernovaActive = false;
        this.supernovaRadius = 0;
        this.laserCharging = false;
        this.laserCharge = 0;
        this.laserWidth = 0;
        this.laserAngle = 0;
        this.supernovaWarningShown = false;
        this.supernovaWarningTime = 600; // 10 seconds at 60fps
    }

    takeDamage(amount) {
        this.currentPhaseHp -= amount;
        this.hp = this.currentPhaseHp;  // Update visible HP bar
        
        if (this.currentPhaseHp <= 0) {
            if (this.phase < 3) {
                this.phase++;
                this.currentPhaseHp = this.phaseHp[this.phase];
                this.hp = this.currentPhaseHp;  // Set new phase HP
                player.damage = this.initialPlayerDamage + (this.phase - 1) * 10;
                return false;
            } else {
                player.damage = this.initialPlayerDamage;
                return true;
            }
        }
        return false;
    }

    draw() {
        // Draw bullets first
        this.bullets.forEach(bullet => {
            ctx.beginPath();
            ctx.fillStyle = bullet.color;
            ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw rifts
        this.rifts.forEach(rift => {
            ctx.beginPath();
            ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * (rift.growing ? 1 : rift.duration/90)})`;
            ctx.arc(rift.x, rift.y, rift.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Draw based on current phase
        switch(this.phase) {
            case 1:
                this.drawPhaseOne();
                break;
            case 2:
                this.drawPhaseTwo();
                break;
            case 3:
                this.drawPhaseThree();
                break;
        }

        ctx.restore();

        // Draw HP bar
        const barWidth = this.radius * 3;
        const barHeight = 15;
        const barX = this.x - barWidth/2;
        const barY = this.y - this.radius - 30;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Color changes based on phase
        const hpColors = ['#ff00ff', '#00ffff', '#ff0000'];
        ctx.fillStyle = hpColors[this.phase - 1];
        ctx.fillRect(barX, barY, (this.hp/this.maxHp) * barWidth, barHeight);

        // Draw supernova if active
        if (this.supernovaActive) {
            ctx.save();
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.supernovaRadius
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(0.3, 'rgba(255, 150, 0, 0.6)');
            gradient.addColorStop(0.7, 'rgba(255, 50, 0, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.supernovaRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Add shockwave effect
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.restore();
        }

        // Draw laser charging effect
        if (this.laserCharging && this.laserCharge < 60) {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 0, 0, ${this.laserCharge / 60})`;
            ctx.lineWidth = this.laserWidth;
            ctx.moveTo(this.x, this.y);
            const endX = this.x + Math.cos(this.laserAngle) * 1000;
            const endY = this.y + Math.sin(this.laserAngle) * 1000;
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.restore();
        }

        // Draw warning message if active
        if (this.supernovaWarningShown && !this.supernovaActive) {
            ctx.save();
            
            // Flashing effect
            const alpha = Math.sin(Date.now() / 200) * 0.3 + 0.7;
            
            ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⚠ WARNING: SUPERNOVA IMMINENT ⚠', canvas.width / 2, 50);
            
            // Add countdown
            const timeLeft = Math.ceil((1800 - this.phase3Timer) / 60);
            ctx.font = 'bold 24px Arial';
            ctx.fillText(`Time until detonation: ${timeLeft} seconds`, canvas.width / 2, 90);
            
            ctx.restore();
        }
    }

    drawPhaseOne() {
        // Laser Beam attack
        if (!this.laserCharging && Math.random() < 0.2) {  // 20% chance to start laser
            this.laserCharging = true;
            this.laserCharge = 0;
            this.laserWidth = 5;
            this.laserAngle = Math.atan2(player.y - this.y, player.x - this.x);
            return;  // Skip other attacks while charging
        }

        if (this.laserCharging) {
            this.laserCharge++;
            
            // Warning line phase (2 seconds = 120 frames at 60fps)
            if (this.laserCharge < 120) {  // Changed from 300 to 120
                const warningBullet = new BossBullet(
                    this.x, this.y, this.laserAngle, 2,
                    0, 'rgba(255, 0, 0, 0.5)', true
                );
                this.bullets.push(warningBullet);
            } else {
                // Fire the laser
                this.laserWidth += 0.5;
                for (let i = 0; i < 5; i++) {
                    const laserSegment = new BossBullet(
                        this.x + Math.cos(this.laserAngle) * (i * 50),
                        this.y + Math.sin(this.laserAngle) * (i * 50),
                        this.laserAngle,
                        this.laserWidth,
                        8,
                        'rgba(255, 0, 255, 0.8)',
                        true
                    );
                    laserSegment.isLaser = true;
                    this.bullets.push(laserSegment);
                }

                if (this.laserCharge > 180) {  // 1 second firing duration after warning
                    this.laserCharging = false;
                }
            }
            return;  // Skip other attacks while laser is active
        }

        // Existing phase one attacks
        const sweepCount = 12;
        for (let i = 0; i < sweepCount; i++) {
            const sweepAngle = (i / sweepCount) * Math.PI * 2 + this.rotation;
            const bullet = new BossBullet(
                this.x, this.y, sweepAngle, 8, 4,
                'rgba(255, 0, 255, 0.8)', true
            );
            this.bullets.push(bullet);
        }

        // Sentinel Orbs
        if (Math.random() < 0.3) {
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const sentinel = new BossBullet(
                    this.x + Math.cos(angle) * 100,
                    this.y + Math.sin(angle) * 100,
                    Math.atan2(player.y - this.y, player.x - this.x),
                    10, 3, '#ff00ff'
                );
                sentinel.isHoming = true;
                sentinel.homingStrength = 0.1;
                this.bullets.push(sentinel);
            }
        }
    }

    drawPhaseTwo() {
        // Draw unstable black hole core
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.arc(0, 0, this.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Draw energy waves
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.3 - i * 0.1})`;
            ctx.lineWidth = 5 - i;
            ctx.arc(0, 0, this.radius * (1 + i * 0.2), 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    drawPhaseThree() {
        // Draw chaotic energy form
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
        
        // Create irregular shape
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const rad = this.radius * (1 + Math.sin(this.rotation * 2 + i) * 0.3);
            const x = Math.cos(angle) * rad;
            const y = Math.sin(angle) * rad;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        // Add energy effects
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    update(playerX, playerY) {
        // Move towards player
        const angle = Math.atan2(playerY - this.y, playerX - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;

        // Update rotation
        this.rotation += this.rotationSpeed;

        // Attack timing
        this.attackCooldown--;
        if (this.attackCooldown <= 0) {
            switch(this.phase) {
                case 1:
                    this.phaseOneAttack(playerX, playerY);
                    break;
                case 2:
                    this.phaseTwoAttack(playerX, playerY);
                    break;
                case 3:
                    this.phaseThreeAttack(playerX, playerY);
                    break;
            }
            this.attackCooldown = this.attackDelay;
        }

        // Update bullets with special effects
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update();
            
            // Check if bullet is offscreen first
            if (bullet.isOffscreen()) {
                this.bullets.splice(i, 1);
                continue;
            }

            // Skip damage checks for warning bullets
            if (bullet.warning || (this.laserCharging && this.laserCharge < 300)) {
                continue;
            }

            // Laser collision check
            if (bullet.isLaser) {
                const dx = playerX - bullet.x;
                const dy = playerY - bullet.y;
                const laserEndX = bullet.x + Math.cos(bullet.angle) * 1000;
                const laserEndY = bullet.y + Math.sin(bullet.angle) * 1000;
                
                const numerator = Math.abs((laserEndY - bullet.y) * playerX - 
                                         (laserEndX - bullet.x) * playerY + 
                                         laserEndX * bullet.y - 
                                         laserEndY * bullet.x);
                const denominator = Math.sqrt(Math.pow(laserEndY - bullet.y, 2) + 
                                            Math.pow(laserEndX - bullet.x, 2));
                const distance = numerator / denominator;
                
                if (distance < player.radius + bullet.radius) {
                    // Push player away from laser
                    const pushForce = 15; // Adjust this value to control push strength
                    const pushAngle = bullet.angle + Math.PI/2; // Perpendicular to laser
                    player.x += Math.cos(pushAngle) * pushForce;
                    player.y += Math.sin(pushAngle) * pushForce;
                    
                    // Keep player in bounds after push
                    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
                    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
                }
            } else {
                // Regular bullet collision
                const dx = playerX - bullet.x;
                const dy = playerY - bullet.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < player.radius + bullet.radius) {
                    if (!player.hasShield) {
                        player.hp--;
                        if (player.hp <= 0) {
                            player.alive = false;
                        }
                    }
                    this.bullets.splice(i, 1);
                }
            }
        }

        // Phase 3 supernova countdown
        if (this.phase === 3) {
            this.phase3Timer++;
            
            // Show warning 10 seconds before supernova (600 frames)
            if (this.phase3Timer >= 1200 && !this.supernovaWarningShown) { // 20 seconds
                this.supernovaWarningShown = true;
                // Warning message will be drawn in draw method
            }
            
            if (this.phase3Timer >= 1800 && !this.supernovaActive) { // 30 seconds
                this.startSupernova();
            }
        }

        // Update supernova if active
        if (this.supernovaActive) {
            this.updateSupernova(playerX, playerY);
        }
    }

    phaseOneAttack(playerX, playerY) {
        // Laser Beam attack
        if (!this.laserCharging && Math.random() < 0.2) {  // 20% chance to start laser
            this.laserCharging = true;
            this.laserCharge = 0;
            this.laserWidth = 5;
            this.laserAngle = Math.atan2(playerY - this.y, playerX - this.x);
            return;  // Skip other attacks while charging
        }

        if (this.laserCharging) {
            this.laserCharge++;
            
            // Warning line phase (2 seconds = 120 frames at 60fps)
            if (this.laserCharge < 120) {  // Changed from 300 to 120
                const warningBullet = new BossBullet(
                    this.x, this.y, this.laserAngle, 2,
                    0, 'rgba(255, 0, 0, 0.5)', true
                );
                this.bullets.push(warningBullet);
            } else {
                // Fire the laser
                this.laserWidth += 0.5;
                for (let i = 0; i < 5; i++) {
                    const laserSegment = new BossBullet(
                        this.x + Math.cos(this.laserAngle) * (i * 50),
                        this.y + Math.sin(this.laserAngle) * (i * 50),
                        this.laserAngle,
                        this.laserWidth,
                        8,
                        'rgba(255, 0, 255, 0.8)',
                        true
                    );
                    laserSegment.isLaser = true;
                    this.bullets.push(laserSegment);
                }

                if (this.laserCharge > 180) {  // 1 second firing duration after warning
                    this.laserCharging = false;
                }
            }
            return;  // Skip other attacks while laser is active
        }

        // Existing phase one attacks
        const sweepCount = 12;
        for (let i = 0; i < sweepCount; i++) {
            const sweepAngle = (i / sweepCount) * Math.PI * 2 + this.rotation;
            const bullet = new BossBullet(
                this.x, this.y, sweepAngle, 8, 4,
                'rgba(255, 0, 255, 0.8)', true
            );
            this.bullets.push(bullet);
        }

        // Sentinel Orbs
        if (Math.random() < 0.3) {
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const sentinel = new BossBullet(
                    this.x + Math.cos(angle) * 100,
                    this.y + Math.sin(angle) * 100,
                    Math.atan2(player.y - this.y, player.x - this.x),
                    10, 3, '#ff00ff'
                );
                sentinel.isHoming = true;
                sentinel.homingStrength = 0.1;
                this.bullets.push(sentinel);
            }
        }
    }

    phaseTwoAttack(playerX, playerY) {
        // Dimensional Tear - creates expanding void zones
        if (Math.random() < 0.3) {
            for (let i = 0; i < 3; i++) {
                const tearX = Math.random() * canvas.width;
                const tearY = Math.random() * canvas.height;
                const tear = {
                    x: tearX,
                    y: tearY,
                    radius: 0,
                    maxRadius: 80,
                    duration: 120,
                    growing: true,
                    damage: true
                };
                this.rifts.push(tear);
            }
        }

        // Singularity Strike - black holes that pull the player
        if (Math.random() < 0.5) {
            const angle = Math.atan2(playerY - this.y, playerX - this.x);
            for (let i = 0; i < 3; i++) {
                const spreadAngle = angle + (i - 1) * Math.PI / 4;
                const blackHole = new BossBullet(
                    this.x, this.y, spreadAngle, 15, 2,
                    'black', false, true
                );
                blackHole.isBlackHole = true; // Mark as black hole
                blackHole.lifetime = 0; // Initialize lifetime
                this.bullets.push(blackHole);
            }
        }
    }

    phaseThreeAttack(playerX, playerY) {
        // Bullet Storm Overdrive
        const bulletCount = 16;
        for (let i = 0; i < bulletCount; i++) {
            const angle = (i / bulletCount) * Math.PI * 2 + this.rotation;
            const bullet = new BossBullet(
                this.x, this.y, angle, 5, 3,
                '#ff0000', false, false, true
            );
            bullet.accelerating = true;
            bullet.acceleration = 0.2;
            this.bullets.push(bullet);
        }

        // Reality Fracture
        if (Math.random() < 0.1) {
            this.reverseControls = true;
            setTimeout(() => {
                this.reverseControls = false;
            }, 3000);

            // Add spiral pattern during control reversal
            for (let i = 0; i < 24; i++) {
                const angle = (i / 24) * Math.PI * 2;
                const distortBullet = new BossBullet(
                    this.x, this.y, angle + this.rotation, 8, 4,
                    'rgba(255, 0, 255, 0.5)', true
                );
                distortBullet.spiral = true;
                distortBullet.spiralRadius = 100;
                distortBullet.spiralSpeed = 0.1;
                this.bullets.push(distortBullet);
            }
        }

        // Supernova countdown
        if (this.currentPhaseHp < this.phaseHp[3] * 0.2 && !this.supernovaCountdown) {
            this.supernovaCountdown = 600;
            // Create expanding ring of warning bullets
            for (let i = 0; i < 36; i++) {
                const angle = (i / 36) * Math.PI * 2;
                const warningBullet = new BossBullet(
                    this.x, this.y, angle, 4, 2,
                    '#ffff00', false, false, true
                );
                warningBullet.warning = true;
                warningBullet.pulsing = true;
                this.bullets.push(warningBullet);
            }
        }
    }

    grantReward() {
        player.hasBlink = true;
        player.blinkCooldown = 0;
        player.blinkParticles = [];
        return 'Dimensional Blink';
    }

    deathAnimation() {
        return new Promise(resolve => {
            let frame = 0;
            const maxFrames = 180; // 3 seconds at 60fps
            const animate = () => {
                if (frame >= maxFrames) {
                    resolve();
                    return;
                }

                ctx.save();
                // Supernova effect
                const radius = (frame / maxFrames) * Math.max(canvas.width, canvas.height);
                const alpha = 1 - (frame / maxFrames);

                // Outer glow
                ctx.beginPath();
                const gradient = ctx.createRadialGradient(
                    this.x, this.y, 0,
                    this.x, this.y, radius
                );
                gradient.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
                gradient.addColorStop(0.5, `rgba(255, 255, 0, ${alpha * 0.7})`);
                gradient.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.3})`);
                ctx.fillStyle = gradient;
                ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
                ctx.fill();

                // Warping effect
                ctx.globalCompositeOperation = 'overlay';
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    const dist = radius * 0.5;
                    const x = this.x + Math.cos(angle) * dist;
                    const y = this.y + Math.sin(angle) * dist;
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha * 0.5})`;
                    ctx.lineWidth = 3;
                    ctx.moveTo(x, y);
                    ctx.lineTo(this.x, this.y);
                    ctx.stroke();
                }

                ctx.restore();
                frame++;
                requestAnimationFrame(animate);
            };
            animate();
        });
    }

    startSupernova() {
        this.supernovaActive = true;
        this.supernovaRadius = 0;
        
        // Create warning effect
        for (let i = 0; i < 36; i++) {
            const angle = (i / 36) * Math.PI * 2;
            const warningBullet = new BossBullet(
                this.x, this.y, angle, 4, 0,
                '#ffff00', false, false, true
            );
            warningBullet.warning = true;
            this.bullets.push(warningBullet);
        }
    }

    updateSupernova(playerX, playerY) {
        // Expand supernova
        this.supernovaRadius += 10;  // Adjust speed of expansion

        // Check if player is caught in supernova
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distToPlayer = Math.sqrt(dx * dx + dy * dy);
        
        if (distToPlayer <= this.supernovaRadius) {
            player.hp = 0;  // Instant death
            player.alive = false;
        }

        // Stop supernova when it covers the screen
        if (this.supernovaRadius > Math.max(canvas.width, canvas.height) * 1.5) {
            this.supernovaActive = false;
        }
    }
} 

class CelestialLeviathan extends Boss {
    constructor() {
        super();
        this.maxHp = 22000;  // Increased from 12000 to 22000
        this.hp = this.maxHp;
        this.phase = 1;
        this.phaseHp = {
            1: 14000,  // Increased from 4000 to 14000
            2: 14000,  // Increased from 4000 to 14000
            3: 14000   // Increased from 4000 to 14000
        };
        this.currentPhaseHp = this.phaseHp[1];
        this.radius = 40;
        this.speed = 2;
        this.segments = [];
        this.segmentCount = 12;
        this.segmentSpacing = 50;
        this.bullets = [];
        this.flickerActive = false;
        this.flickerAlpha = 1;
        this.vortexActive = false;
        this.vortexRadius = 0;
        this.chargeActive = false;
        this.beamActive = false;
        this.beamAngle = 0;
        this.beamWidth = 0;
        this.chargeTime = 0;

        // Initialize segments in a snake-like pattern
        for (let i = 0; i < this.segmentCount; i++) {
            this.segments.push({
                x: this.x - i * this.segmentSpacing,
                y: this.y,
                targetX: null,
                targetY: null
            });
        }
    }

    draw() {
        // Draw segments from tail to head
        this.segments.forEach((segment, index) => {
            const alpha = this.flickerActive ? this.flickerAlpha : 1;
            const size = this.radius * (1 - index/this.segmentCount * 0.3);
            
            ctx.save();
            ctx.globalAlpha = alpha;
            
            // Segment body with cosmic effect
            ctx.beginPath();
            const gradient = ctx.createRadialGradient(
                segment.x, segment.y, 0,
                segment.x, segment.y, size
            );
            gradient.addColorStop(0, `rgba(0, 255, 255, ${0.8 * alpha})`);
            gradient.addColorStop(1, `rgba(0, 0, 255, ${0.3 * alpha})`);
            ctx.fillStyle = gradient;
            ctx.arc(segment.x, segment.y, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Energy aura
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 * alpha})`;
            ctx.lineWidth = 3;
            ctx.arc(segment.x, segment.y, size * 1.2, 0, Math.PI * 2);
            ctx.stroke();
            
            // Cosmic particles
            if (Math.random() < 0.3) {
                for (let i = 0; i < 3; i++) {
                    const particleAngle = Math.random() * Math.PI * 2;
                    const particleDistance = size * (1 + Math.random() * 0.5);
                    ctx.beginPath();
                    ctx.strokeStyle = 'white';
                    ctx.moveTo(segment.x, segment.y);
                    ctx.lineTo(
                        segment.x + Math.cos(particleAngle) * particleDistance,
                        segment.y + Math.sin(particleAngle) * particleDistance
                    );
                    ctx.stroke();
                }
            }
            
            ctx.restore();
        });

        // Draw special effects
        this.drawSpecialEffects();

        // Draw HP bar with phase colors
        const barWidth = this.radius * 3;
        const barHeight = 15;
        const barX = this.x - barWidth/2;
        const barY = this.y - this.radius - 30;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        const phaseColors = {
            1: '#00ffff',
            2: '#ff00ff',
            3: '#ff0000'
        };
        ctx.fillStyle = phaseColors[this.phase];
        ctx.fillRect(barX, barY, (this.hp/this.maxHp) * barWidth, barHeight);
    }

    drawSpecialEffects() {
        // Draw vortex if active
        if (this.vortexActive) {
            ctx.save();
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.vortexRadius
            );
            gradient.addColorStop(0, 'rgba(0, 255, 255, 0.7)');
            gradient.addColorStop(0.5, 'rgba(0, 0, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.vortexRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Add swirling effect
            for (let i = 0; i < 8; i++) {
                const angle = this.rotation + (i * Math.PI / 4);
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(
                    this.x + Math.cos(angle) * this.vortexRadius,
                    this.y + Math.sin(angle) * this.vortexRadius
                );
                ctx.stroke();
            }
            ctx.restore();
        }

        // Draw beam if active
        if (this.beamActive) {
            ctx.save();
            ctx.beginPath();
            const beamLength = Math.max(canvas.width, canvas.height) * 2;
            const endX = this.x + Math.cos(this.beamAngle) * beamLength;
            const endY = this.y + Math.sin(this.beamAngle) * beamLength;
            
            const gradient = ctx.createLinearGradient(this.x, this.y, endX, endY);
            gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(0, 0, 255, 0)');
            
            ctx.strokeStyle = gradient;
            ctx.lineWidth = this.beamWidth;
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Add energy particles along beam
            for (let i = 0; i < 10; i++) {
                const particleX = this.x + Math.cos(this.beamAngle) * (i * 50);
                const particleY = this.y + Math.sin(this.beamAngle) * (i * 50);
                ctx.beginPath();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.arc(particleX, particleY, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            return true;  // Boss is dead
        }
        return false;
    }

    grantReward() {
        player.hasVoidCoil = true;
        return 'Void Serpent Coil';
    }
} 

function drawPauseMenu() {
    // Semi-transparent overlay (make it darker)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add a border around the pause menu
    const menuWidth = 400;
    const menuHeight = 300;
    const menuX = canvas.width/2 - menuWidth/2;
    const menuY = canvas.height/2 - menuHeight/2;
    
    // Draw menu background
    ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
    ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(menuX, menuY, menuWidth, menuHeight);
    
    // Pause menu text
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, menuY + 80);
    
    // Resume button
    ctx.fillStyle = '#666666';
    ctx.fillRect(canvas.width/2 - 100, menuY + 120, 200, 40);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('Resume (ESC)', canvas.width/2, menuY + 145);
    
    // Main Menu button
    ctx.fillStyle = '#666666';
    ctx.fillRect(canvas.width/2 - 100, menuY + 180, 200, 40);
    ctx.fillStyle = 'white';
    ctx.fillText('Main Menu', canvas.width/2, menuY + 205);
}

function drawVictoryScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', canvas.width/2, canvas.height/2 - 50);
    
    // Show "Next Level Unlocked!" message if applicable
    if (currentLevel < MAX_LEVELS && !unlockedLevels.includes(currentLevel + 1)) {
        ctx.font = '24px Arial';
        ctx.fillStyle = '#00ff00';
        ctx.fillText('Level ' + (currentLevel + 1) + ' Unlocked!', canvas.width/2, canvas.height/2);
    }
    
    ctx.fillStyle = '#444444';
    ctx.fillRect(canvas.width/2 - 100, canvas.height/2 + 50, 200, 50);
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText('Continue', canvas.width/2, canvas.height/2 + 82);
}

function handleVictoryClick(e) {
    const continueBtn = {
        x: canvas.width/2 - 100,
        y: canvas.height/2 + 50,
        width: 200,
        height: 50
    };

    if (e.clientX >= continueBtn.x && e.clientX <= continueBtn.x + continueBtn.width &&
        e.clientY >= continueBtn.y && e.clientY <= continueBtn.y + continueBtn.height) {
        
        // Unlock next level if not already unlocked
        if (currentLevel < MAX_LEVELS && !unlockedLevels.includes(currentLevel + 1)) {
            unlockedLevels.push(currentLevel + 1);
            saveGame();
        }
        
        showVictoryScreen = false;
        showLevelSelect = true;
        gameStarted = false;
        resetGame();
    }
}