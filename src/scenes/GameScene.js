import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene'); // Nombre clave de la escena para Phaser
    }

    // =================================================================
    // 1. PRELOAD: CARGA DE TODOS LOS RECURSOS (SE EJECUTA AL INICIO)
    // =================================================================
    preload() {
        // --- JUGADOR (HOJAS DE SPRITES) ---
        // Cargamos las animaciones. frameWidth/Height es el tamaño de cada cuadro.
        this.load.spritesheet('anim_run', 'assets/img/run.png', { frameWidth: 152, frameHeight: 140 });
        this.load.spritesheet('anim_jump', 'assets/img/jumpA.png', { frameWidth: 169, frameHeight: 100 });
        this.load.spritesheet('anim_pirouette', 'assets/img/jump2.png', { frameWidth: 180, frameHeight: 97 });
        this.load.spritesheet('anim_duck', 'assets/img/down.png', { frameWidth: 119, frameHeight: 100 });

        // --- ENEMIGOS ---
        this.load.spritesheet('anim_zombie', 'assets/img/zombie1.png', { frameWidth: 145, frameHeight: 140 });
        this.load.spritesheet('anim_bite', 'assets/img/morder.png', { frameWidth: 204, frameHeight: 120 });
        
        // --- FONDO ---
        this.load.image('background', 'assets/img/background.png');

        // --- OBSTÁCULOS (IMÁGENES FIJAS) ---
        // Obstáculos de suelo
        this.load.image('obstaculoBarril', 'assets/img/obstaculoBarril.png');
        this.load.image('obstaculoCoche', 'assets/img/obstaculoCoche.png');
        this.load.image('obstaculoBarricada', 'assets/img/obstaculoBarricada.png');
        // Obstáculos aéreos
        this.load.image('obstaculo_tuberia', 'assets/img/obstaculo_tuberia1.png');
        this.load.image('obstaculo_viga', 'assets/img/obstaculo_viga.png');
        this.load.image('obstaculo_grua', 'assets/img/obstaculo_grua1.png');

        // --- AUDIOS ---
        // Música de fondo
        this.load.audio('musica_fondo', 'assets/audio/musica_fondo.mp3');
        // Efectos de sonido (SFX)
        this.load.audio('sfx_salto', 'assets/audio/sonido_salto.mp3');
        this.load.audio('sfx_agacharse', 'assets/audio/sonido_agacharse.mp3');
        this.load.audio('sfx_golpe', 'assets/audio/sonido_choque.mp3'); 
        this.load.audio('sfx_muerte', 'assets/audio/sonido_morder.mp3');
        this.load.audio('sfx_zombie', 'assets/audio/sonido_zombie.mp3');
        this.load.audio('musica_final', 'assets/audio/musica_final.mp3');
    }

    // =================================================================
    // 2. CREATE: INICIALIZACIÓN DE LA ESCENA (SE EJECUTA UNA VEZ)
    // =================================================================
    create() {
        // --- VARIABLES DE ESTADO ---
        this.isGameOver = false;       // Controla si el juego ha terminado
        this.isPaused = false;         // Controla la pausa
        this.gameSpeed = 5;            // Velocidad inicial del scroll
        this.scoreDistance = 0;        // Metros recorridos
        this.mistakeTimestamps = [];   // Array para la regla de "2 golpes en 10s"
        this.zombieDistance = 100;     // Distancia del zombie (100=lejos, 0=te come)
        this.lastObstacleKey = null;   // Para evitar obstáculos repetidos
        this.obstacleCount = 0;

        // Dimensiones pantalla
        const w = this.scale.width;
        const h = this.scale.height;
        this.groundY = h - 50; // Altura del suelo

        // --- FONDO INFINITO ---
        // TileSprite permite mover la textura sin mover el objeto (efecto correr)
        const bgTexture = this.textures.get('background').getSourceImage();
        const scaleY = this.scale.height / bgTexture.height;
        const scaleX = this.scale.width / bgTexture.width;
        this.bg = this.add.tileSprite(0, 0, w, h, 'background')
            .setOrigin(0, 0).setScrollFactor(0);
        this.bg.tileScaleX = scaleX;
        this.bg.tileScaleY = scaleY;

        // --- CREAR ANIMACIONES ---
        this.createAnimations(); // Llamada a método auxiliar

        // --- SUELO FÍSICO (INVISIBLE) ---
        // Plataforma estática para que el jugador no caiga
        this.ground = this.add.rectangle(w / 2, this.groundY + 25, w, 50, 0x333333).setVisible(false);
        this.physics.add.existing(this.ground, true); // true = inamovible

        // --- JUGADOR ---
        this.player = this.physics.add.sprite(250, this.groundY, 'anim_run').setOrigin(0.5, 1);
        this.player.play('run');
        this.player.setDepth(5); // Capa 5 (encima de casi todo)
        
        // Ajuste de Hitbox (Caja de colisión)
        this.player.body.setSize(50, 120);
        this.player.body.setOffset(50, 20);
        
        this.player.setCollideWorldBounds(true);
        this.physics.add.collider(this.player, this.ground);

        // --- ZOMBIE PERSEGUIDOR ---
        this.zombieHorde = this.physics.add.sprite(50, this.groundY, 'anim_zombie').setOrigin(0.5, 1);
        this.zombieHorde.play('zombie_run');
        
        // Animación de mordisco (solo para Game Over)
        this.anims.create({ key: 'bite', frames: this.anims.generateFrameNumbers('anim_bite', { start: 0, end: -1 }), frameRate: 6, repeat: 0 });
        
        this.zombieHorde.setCollideWorldBounds(true);
        this.physics.add.collider(this.zombieHorde, this.ground);
        this.zombieHorde.setDepth(1); // Capa 1 (detrás del jugador)
        this.zombieHorde.body.setSize(50, 120);
        this.zombieHorde.body.setOffset(50, 20);
        
        // Texto flotante del zombie
        this.zombieText = this.add.text(50, this.groundY - 160, "¡RAAWR!", { fontSize: '12px', color: 'rgb(7, 7, 7)' }).setOrigin(0.5);

        // --- GRUPO DE OBSTÁCULOS ---
        // Grupo físico. immovable=true evita que salgan volando al chocar.
        this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });

        // Listas de obstáculos (Configuración)
        this.groundObstacles = [
            { key: 'obstaculoBarril', scale: 0.7, yOffset: 20, hitbox: { w: 60, h: 90, ox: 5, oy: 30 } },
            { key: 'obstaculoCoche', scale: 1.45, yOffset: 75, hitbox: { w: 100, h: 30, ox: 50, oy: 50 } },
            { key: 'obstaculoBarricada', scale: 1.3, yOffset: 35, hitbox: { w: 50, h: 50, ox: 20, oy: 90 } }
        ];
        this.airObstacles = [
            { key: 'obstaculo_tuberia', scale: 0.5, yOffset: 50, hitbox: { w: 180, h: 260, ox: 340, oy: -40 } },
            { key: 'obstaculo_viga', scale: 0.5, yOffset: 25, hitbox: { w: 140, h: 800, ox: 0, oy: 0 } },
            { key: 'obstaculo_grua', scale: 0.5, yOffset: 20, hitbox: { w: 110, h: 550, ox: 1100, oy: -50 } }
        ];

        // Detección de colisión Jugador vs Obstáculo
        this.physics.add.overlap(this.player, this.obstacles, (player, obstacle) => this.handleCollision(obstacle));

        // --- CONTROLES ---
        this.createMobileControls(w, h); // Botones táctiles
        this.cursors = this.input.keyboard.createCursorKeys(); // Teclado

        // Generador de obstáculos (Timer)
        this.spawnEvent = this.time.addEvent({ delay: 1800, callback: this.spawnObstacle, callbackScope: this, loop: true });

        // --- SISTEMA DE AUDIO ---
        
        // 1. Música de fondo (Volumen bajo 0.2)
        this.bgMusic = this.sound.add('musica_fondo');
        try {
            this.bgMusic.play({ volume: 0.2, loop: true });
        } catch (e) { console.log("Audio esperando interacción del usuario"); }

        // 2. Sonido Ambiente Zombie (Efecto 3D)
        // Se crea aquí y se actualiza el volumen en updateZombies
        this.zombieLoop = this.sound.add('sfx_zombie');
        this.zombieLoop.play({ 
            loop: true, 
            volume: 0, // Empieza en silencio
            rate: 1.0 
        });

        // --- UI (INTERFAZ) ---
        this.scoreText = this.add.text(20, 22, 'Distancia: 0m', { fontSize: '20px', fill: '#fff' });
        this.add.text(w - 220, 22, 'Peligro:', { fontSize: '16px', fill: '#fff' });
        this.dangerBar = this.add.rectangle(w - 30, 30, 100, 10, 0xff0000).setOrigin(1, 0.5);
    }

    // =================================================================
    // 3. UPDATE: BUCLE PRINCIPAL (60 VECES POR SEGUNDO)
    // =================================================================
    update(time, delta) {
        // Si estamos muertos o pausados, paramos toda la lógica
        if (this.isGameOver) return;
        if (this.isPaused) return;

        // 1. Mover Fondo y Calcular Puntuación
        this.bg.tilePositionX += this.gameSpeed;
        this.scoreDistance += 0.05 * this.gameSpeed;
        this.scoreText.setText(`Distancia: ${Math.floor(this.scoreDistance)}m`);
        this.gameSpeed += 0.002; // Aceleración progresiva

        // 2. Detectar inputs
        const isDucking = this.cursors.down.isDown || this.duckBtnDown;

        // 3. Salto
        if ((this.cursors.up.isDown || this.jumpBtnDown) && this.player.body.touching.down) {
            this.performJump();
        }
        // 4. Agacharse
        this.performDuck(isDucking);

        // 5. Mover Obstáculos hacia la izquierda
        this.obstacles.getChildren().forEach(obstacle => {
            obstacle.x -= this.gameSpeed;
            // Borrar si sale muy lejos por la izquierda (limpieza de memoria)
            if (obstacle.x < -1200) obstacle.destroy();
        });

        // 6. Actualizar Zombie (Posición, Sonido, Muerte)
        this.updateZombies();

        // 7. Recuperar animación de correr
        if (this.player.body.touching.down && this.player.body.velocity.y >= 0 && !isDucking) {
            if (this.player.anims.currentAnim && this.player.anims.currentAnim.key !== 'run') {
                this.player.play('run', true);
                this.player.body.setSize(50, 120);
                this.player.body.setOffset(50, 20);
            }
        }

        // 8. Seguridad: Evitar que el jugador atraviese el suelo
        if (this.player.y > this.groundY) {
            this.player.y = this.groundY;
            this.player.body.velocity.y = 0;
            this.player.body.touching.down = true;
        }
    }

    // =================================================================
    // 4. MÉTODOS AUXILIARES
    // =================================================================

    // Crea todas las animaciones del juego
    createAnimations() {
        this.anims.create({ key: 'run', frames: this.anims.generateFrameNumbers('anim_run', { start: 0, end: -1 }), frameRate: 12, repeat: -1 });
        this.anims.create({ key: 'jump', frames: this.anims.generateFrameNumbers('anim_jump', { start: 0, end: -1 }), frameRate: 6, repeat: 0 });
        this.anims.create({ key: 'pirouette', frames: this.anims.generateFrameNumbers('anim_pirouette', { start: 0, end: -1 }), frameRate: 6, repeat: 0 });
        this.anims.create({ key: 'duck', frames: this.anims.generateFrameNumbers('anim_duck', { start: 0, end: -1 }), frameRate: 9, repeat: -1 });
        this.anims.create({ key: 'zombie_run', frames: this.anims.generateFrameNumbers('anim_zombie', { start: 0, end: -1 }), frameRate: 10, repeat: -1 });
    }

    // Acción de Saltar
    performJump() {
        this.player.setVelocityY(-450); // Impulso vertical
        this.sound.play('sfx_salto', { volume: 0.8 }); // Sonido Alto

        this.player.body.setSize(35, 90); // Hitbox reducida
        this.player.body.setOffset(49, 10); 
        
        // Animación aleatoria
        if (Math.random() > 0.4) this.player.play('jump');
        else this.player.play('pirouette');
    }

    // Acción de Agacharse
    performDuck(isDucking) {
        if (isDucking) {
            this.player.body.setSize(50, 60); // Hitbox muy baja
            this.player.body.setOffset(34, 40); 
            
            if (this.player.anims.currentAnim.key !== 'duck') {
                this.player.play('duck', true);
                this.sound.play('sfx_agacharse', { volume: 1 });
            }
            // Forzar posición Y
            if (this.player.body.touching.down) this.player.y = this.groundY;
        } 
    }

    // Generar obstáculo
    spawnObstacle() {
        if (this.isGameOver || this.isPaused) return;

        const w = this.scale.width;

        this.obstacleCount++;
        
        // Elegir aleatoriamente suelo (low) o aire (high)
        const type = Math.random() > 0.5 ? 'low' : 'high';
        let data;
        let pool = (type === 'low') ? this.groundObstacles : this.airObstacles;
        
        // FILTRO: No repetir el último obstáculo
        let candidates = pool.filter(o => o.key !== this.lastObstacleKey);
        if (candidates.length === 0) candidates = pool; // Seguridad
        
        data = Phaser.Utils.Array.GetRandom(candidates);
        this.lastObstacleKey = data.key;

        let obstacle = this.physics.add.sprite(w + 100, this.groundY + data.yOffset, data.key)
            .setOrigin(0.5, 1).setScale(data.scale);
        
        
        // Configurar Hitbox personalizada del obstáculo
        obstacle.body.setSize(data.hitbox.w, data.hitbox.h);
        obstacle.body.setOffset(data.hitbox.ox, data.hitbox.oy);        
        this.obstacles.add(obstacle);
        obstacle.body.setAllowGravity(false);
        obstacle.body.setImmovable(true);

        //AÑADIR FLECHAS DE TURORIAL=======================
        if (this.obstacleCount <= 10) {
        if (type === 'low') {
            this.showTutorialHint('⬆', '#00ff00'); // Verde
        } else {
            this.showTutorialHint('⬇', '#ffa500'); // Naranja
        }
    }
}
//  ========= TUTORIAL ====================

    showTutorialHint(symbol, color) {
        const w = this.scale.width;
        const h = this.scale.height;

        const hintText = this.add.text(w - 150, h / 2, symbol, {
            fontSize: '100px',
            fontStyle: 'bold',
            fill: color,
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(100);

        this.tweens.add({
            targets: hintText,
            alpha: 0,
            scale: 1.5,
            x: w - 300,
            duration: 1800,
            ease: 'Power1',
            onComplete: () => { hintText.destroy(); }
        });
    }
    // Manejar colisión (Golpe)==================
    handleCollision(obstacle) {
        // Si ya hemos chocado con este objeto, ignorar (para no restar vidas 60 veces seguidas)
        if (this.isGameOver || obstacle.hit) return; 
        
        obstacle.hit = true;
        obstacle.fillColor = 0x555555; // Oscurecer obstáculo visualmente
        
        this.sound.play('sfx_golpe', { volume: 1.0 }); // Sonido Fuerte

        this.zombieDistance -= 40; // Penalización
        this.cameras.main.shake(200, 0.01); // Temblor

        // Regla: 2 fallos en 10 segundos = Muerte
        const now = Date.now();
        this.mistakeTimestamps.push(now);
        this.mistakeTimestamps = this.mistakeTimestamps.filter(time => now - time < 10000);

        if (this.mistakeTimestamps.length >= 2) {
            this.zombieDistance = 0; // Muerte forzada
        }
    }

    // Lógica del Zombie
    updateZombies() {
        // 1. Recuperar distancia lentamente si corremos bien
        if (this.zombieDistance < 150) {
            this.zombieDistance += 0.05;
        }
        
        // Actualizar barra visual
        this.dangerBar.width = Math.max(0, this.zombieDistance);
        
        // 2. Mover zombie hacia el jugador (Interpolación suave)
        const targetX = this.player.x - (this.zombieDistance * 3);
        this.zombieHorde.x = Phaser.Math.Linear(this.zombieHorde.x, targetX, 0.1);
        this.zombieText.x = this.zombieHorde.x + 50;

        // --- CORRECCIÓN: VISIBILIDAD DEL ZOMBIE ---
        // Si se queda muy atrás (recuperamos mucha distancia), lo ocultamos
        if (this.zombieHorde.x < -150) {
            this.zombieHorde.setVisible(false);
            this.zombieText.setVisible(false);
        } else {
            this.zombieHorde.setVisible(true);
            this.zombieText.setVisible(true);
        }

        // --- SONIDO 3D DEL ZOMBIE ---
        // Calcular volumen basado en distancia (Más cerca = Más fuerte)
        let newVolume = 1 - (this.zombieDistance / 150);
        newVolume = Phaser.Math.Clamp(newVolume, 0, 1.2);
        
        if (this.zombieLoop && this.zombieLoop.isPlaying) {
            this.zombieLoop.setVolume(newVolume);
        }

        // --- CORRECCIÓN: MUERTE POR CONTACTO VISUAL ---
        // Si el zombie está tocando visualmente al jugador (menos de 30px), muere.
        // Esto evita que corra a tu lado sin comerte.
        if ((this.player.x - this.zombieHorde.x) < 30) {
            this.triggerGameOver();
        }

        // Respaldo por lógica numérica
        if (this.zombieDistance <= 0) this.triggerGameOver();
    }

    // =================================================================
    // CONTROLES: UNO A CADA LADO (IZQUIERDA = AGACHARSE, DERECHA = SALTAR)
    // =================================================================
    createMobileControls(w, h) {
        const btnSize = 80;
        const cornerRadius = 25; 
        const buttonAlpha = 0.15; 

        // --- BOTÓN PAUSA (Centro Arriba) ---
        const pauseBtn = this.add.text(w / 2, 30, '⏸ PAUSA', { 
            fontSize: '20px', fill: '#fff', backgroundColor: '#00000088', padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(100);

        pauseBtn.on('pointerdown', () => {
            if (this.isPaused) {
                this.isPaused = false;
                this.physics.resume(); this.anims.resumeAll(); this.spawnEvent.paused = false;
                if(this.bgMusic.isPaused) this.bgMusic.resume();
                if(this.zombieLoop.isPaused) this.zombieLoop.resume(); 
                pauseBtn.setText('⏸ PAUSA'); pauseBtn.setStyle({ fill: '#fff' });
            } else {
                this.isPaused = true;
                this.physics.pause(); this.anims.pauseAll(); this.spawnEvent.paused = true;
                if(this.bgMusic.isPlaying) this.bgMusic.pause();
                if(this.zombieLoop.isPlaying) this.zombieLoop.pause(); 
                pauseBtn.setText('▶ SEGUIR'); pauseBtn.setStyle({ fill: '#0f0' });
            }
        });

        // --- COORDENADAS BOTONES ---
        const btnY = h - 50;      // Altura común (abajo)
        const duckX = 60;         // Izquierda
        const jumpX = w - 60;     // Derecha

        // --- DIBUJO VISUAL (Graphics) ---
        const graphics = this.add.graphics();
        graphics.setScrollFactor(0);
        graphics.setDepth(99); 
        graphics.fillStyle(0xffffff, buttonAlpha);
        
        // Dibujar Rectángulo Izquierdo (Agacharse)
        graphics.fillRoundedRect(duckX - btnSize/2, btnY - btnSize/2, btnSize, btnSize, cornerRadius);
        // Dibujar Rectángulo Derecho (Saltar)
        graphics.fillRoundedRect(jumpX - btnSize/2, btnY - btnSize/2, btnSize, btnSize, cornerRadius);

        // --- HITBOXES E ICONOS ---

        // 1. AGACHARSE (IZQUIERDA)
        const duckBtnHitbox = this.add.rectangle(duckX, btnY, btnSize, btnSize, 0xffffff, 0.001)
            .setInteractive().setScrollFactor(0).setDepth(100);
        this.add.text(duckX, btnY, '⬇', { fontSize: '30px' }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        
        duckBtnHitbox.on('pointerdown', () => this.duckBtnDown = true);
        duckBtnHitbox.on('pointerup', () => this.duckBtnDown = false);
        duckBtnHitbox.on('pointerout', () => this.duckBtnDown = false);

        // 2. SALTAR (DERECHA)
        const jumpBtnHitbox = this.add.rectangle(jumpX, btnY, btnSize, btnSize, 0xffffff, 0.001)
            .setInteractive().setScrollFactor(0).setDepth(100);
        this.add.text(jumpX, btnY, '⬆', { fontSize: '30px' }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        
        jumpBtnHitbox.on('pointerdown', () => this.jumpBtnDown = true);
        jumpBtnHitbox.on('pointerup', () => this.jumpBtnDown = false);
        jumpBtnHitbox.on('pointerout', () => this.jumpBtnDown = false);
    }

    // GAME OVER
    triggerGameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;

        this.tweens.killAll(); // Esto evita el congelamiento si hay una flecha en pantalla

        // 1. Parar música de fondo y loops
        if (this.bgMusic) this.bgMusic.stop();
        if (this.zombieLoop) this.zombieLoop.stop();

        // 2. Reproducir sonido de mordisco
        this.sound.play('sfx_muerte', { volume: 0.8 });

        // 3. Congelar físicas
        this.physics.pause();
        this.spawnEvent.paused = true;
        
        // 4. Ocultar sprites normales
        this.player.setVisible(false);
        this.zombieHorde.setVisible(false);
        this.zombieText.setVisible(false); 

        // 5. Mostrar sprite de muerte (encima de todo)
        const deathSprite = this.add.sprite(this.player.x, this.groundY, 'anim_bite');
        deathSprite.setOrigin(0.5, 1); 
        deathSprite.setDepth(100); 
        deathSprite.play('bite');

        // 6. Guardar récord
        const currentBest = localStorage.getItem('parkour_highscore') || 0;
        if (this.scoreDistance > currentBest) {
            localStorage.setItem('parkour_highscore', Math.floor(this.scoreDistance));
        }

        // 7. Esperar 3 segundos y cambiar escena
        this.time.delayedCall(2500, () => {
            this.scene.start('GameOverScene', { score: Math.floor(this.scoreDistance) });
            this.sound.stopAll();
        });
    }
}