import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    // =================================================================
    // 1. PRELOAD: CARGA DE IMÁGENES Y RECURSOS
    // =================================================================
    preload() {
        // --- JUGADOR ---
        // Correr 
        this.load.spritesheet('anim_run', 'assets/img/run.png', {
            frameWidth: 152, frameHeight: 140
        });

        // Saltar 
        this.load.spritesheet('anim_jump', 'assets/img/jump.png', {
            frameWidth: 126, frameHeight: 100
        });

        // Pirueta 
        this.load.spritesheet('anim_pirouette', 'assets/img/jump2.png', {
            frameWidth: 143, frameHeight: 89
        });

        // Agacharse 
        this.load.spritesheet('anim_duck', 'assets/img/down.png', { 
            frameWidth: 119, frameHeight: 100 
        });

        // --- ENEMIGOS Y FONDO ---
        // Zombie (145x140)
        this.load.spritesheet('anim_zombie', 'assets/img/zombie1.png', { 
            frameWidth: 145, frameHeight: 140
        });

        // Fondo
        this.load.image('background', 'assets/img/background.png');
    }

    // =================================================================
    // 2. CREATE: CONFIGURACIÓN INICIAL DEL MUNDO
    // =================================================================
    create() {
        // Variables globales del juego
        this.isGameOver = false;
        this.gameSpeed = 6;            // Velocidad de desplazamiento
        this.scoreDistance = 0;        // Puntuación
        this.mistakeTimestamps = [];   // Registro de golpes (para la regla de los 10s)
        this.zombieDistance = 100;     // Distancia de la horda

        const w = this.scale.width;
        const h = this.scale.height;

        // --- LÍNEA DEL SUELO ---
        // 'groundY' marca la posición Y exacta donde apoyan los pies.
        this.groundY = h - 80; 

        // --- FONDO INFINITO ---
        const bgTexture = this.textures.get('background').getSourceImage();
        const scaleY = this.scale.height / bgTexture.height;
        const scaleX = this.scale.width / bgTexture.width;

        this.bg = this.add.tileSprite(0, 0, w, h, 'background')
            .setOrigin(0, 0)
            .setScrollFactor(0);
        this.bg.tileScaleX = scaleX;
        this.bg.tileScaleY = scaleY;

        // --- CREACIÓN DE ANIMACIONES ---
        this.createAnimations();

        // --- SUELO FÍSICO (INVISIBLE) ---
        // Creamos un rectángulo físico para que el jugador no caiga al vacío.
        // Lo ponemos invisible con setVisible(false).
        this.ground = this.add.rectangle(w / 2, this.groundY + 25, w, 50, 0x333333);
        this.ground.setVisible(false); 
        this.physics.add.existing(this.ground, true); // true = Estático (muro)

        // --- JUGADOR ---
        // setOrigin(0.5, 1): El punto de anclaje son los PIES.
        // Posición: X=250 (adelantado), Y=groundY (pegado al suelo).
        this.player = this.physics.add.sprite(250, this.groundY, 'anim_run').setOrigin(0.5, 1);
        this.player.play('run');

        // Configuración de Hitbox (Caja de colisión) para CORRER
        this.player.body.setSize(50, 120); // Caja alta
        this.player.body.setOffset(50, 20); // Ajuste para centrarla

        this.player.setCollideWorldBounds(true);
        this.physics.add.collider(this.player, this.ground);

        // --- ZOMBIE ---
        this.zombieHorde = this.physics.add.sprite(50, this.groundY, 'anim_zombie').setOrigin(0.5, 1);
        this.zombieHorde.play('zombie_run');
        
        this.zombieHorde.setCollideWorldBounds(true);
        this.physics.add.collider(this.zombieHorde, this.ground);
        this.zombieHorde.setDepth(1); // Se dibuja delante del fondo

        // Hitbox del Zombie
        this.zombieHorde.body.setSize(50, 120);
        this.zombieHorde.body.setOffset(50, 20);

        this.zombieText = this.add.text(50, this.groundY - 160, "¡RAAWR!", { fontSize: '12px', color: '#0f0' }).setOrigin(0.5);

        // --- GRUPO DE OBSTÁCULOS ---
        this.obstacles = this.physics.add.group({
            allowGravity: false, // Flotan
            immovable: true      // Son sólidos como rocas
        });

        // Detectar colisión Jugador vs Obstáculo
        this.physics.add.overlap(this.player, this.obstacles, (player, obstacle) => {
            this.handleCollision(obstacle);
        });

        // --- CONTROLES Y UI ---
        this.createMobileControls(w, h);
        this.cursors = this.input.keyboard.createCursorKeys();

        // Generador de obstáculos (cada 1.5 segundos)
        this.time.addEvent({
            delay: 1500, 
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: true
        });

        // Interfaz de Usuario (UI)
        this.scoreText = this.add.text(20, 22, 'Distancia: 0m', { fontSize: '20px', fill: '#fff' });
        this.add.text(w - 200, 22, 'Peligro:', { fontSize: '16px', fill: '#fff' });
        this.dangerBar = this.add.rectangle(w - 20, 30, 100, 10, 0xff0000).setOrigin(1, 0.5);
    }

    // =================================================================
    // 3. UPDATE: BUCLE PRINCIPAL (60 VECES/SEG)
    // =================================================================
    update(time, delta) {
        if (this.isGameOver) return;

        // 1. Mover fondo (Scroll infinito)
        this.bg.tilePositionX += this.gameSpeed;

        // 2. Calcular puntuación
        this.scoreDistance += 0.05 * this.gameSpeed;
        this.scoreText.setText(`Distancia: ${Math.floor(this.scoreDistance)}m`);
        this.gameSpeed += 0.001; // Aumentar dificultad poco a poco

        // 3. Detectar si el jugador quiere agacharse
        const isDucking = this.cursors.down.isDown || this.duckBtnDown;

        // --- LÓGICA DE CONTROLES ---
        
        // SALTAR (Solo si toca el suelo)
        if ((this.cursors.up.isDown || this.jumpBtnDown) && this.player.body.touching.down) {
            this.performJump();
        }

        // AGACHARSE (Llamamos a la función pasando true/false)
        this.performDuck(isDucking);

        // --- MOVER OBSTÁCULOS ---
        this.obstacles.getChildren().forEach(obstacle => {
            obstacle.x -= this.gameSpeed;
            // Borrar si sale de pantalla para ahorrar memoria
            if (obstacle.x < -100) obstacle.destroy();
        });

        // --- ZOMBIES ---
        this.updateZombies();

        // --- RECUPERACIÓN DE ANIMACIÓN (Caída de salto) ---
        // Si caemos al suelo tras un salto y NO estamos pulsando agacharse...
        if (this.player.body.touching.down && this.player.body.velocity.y >= 0 && !isDucking) {
            // Aseguramos que volvemos a correr
            if (this.player.anims.currentAnim && this.player.anims.currentAnim.key !== 'run') {
                this.player.play('run', true);
            }
        }
    }

    // =================================================================
    // 4. MÉTODOS DE ACCIÓN (Lógica del personaje)
    // =================================================================

    createAnimations() {
        this.anims.create({ key: 'run', frames: this.anims.generateFrameNumbers('anim_run', { start: 0, end: -1 }), frameRate: 12, repeat: -1 });
        this.anims.create({ key: 'jump', frames: this.anims.generateFrameNumbers('anim_jump', { start: 0, end: -1 }), frameRate: 12, repeat: 0 });
        this.anims.create({ key: 'pirouette', frames: this.anims.generateFrameNumbers('anim_pirouette', { start: 0, end: -1 }), frameRate: 15, repeat: 0 });
        this.anims.create({ key: 'duck', frames: this.anims.generateFrameNumbers('anim_duck', { start: 0, end: -1 }), frameRate: 12, repeat: -1 });
        this.anims.create({ key: 'zombie_run', frames: this.anims.generateFrameNumbers('anim_zombie', { start: 0, end: -1 }), frameRate: 10, repeat: -1 });
    }

    performJump() {
        this.player.setVelocityY(-650); // Impulso hacia arriba

        // Caja pequeña para el salto (40x80)
        this.player.body.setSize(40, 80);
        this.player.body.setOffset(45, 10); 

        // Probabilidad de hacer pirueta (30%)
        if (Math.random() > 0.3) {
            this.player.play('jump');
        } else {
            this.player.play('pirouette');
        }
    }

   performDuck(isDucking) {
        if (isDucking) {
            // --- MODO AGACHADO ---
            this.player.body.setSize(50, 60);
            this.player.body.setOffset(34, 40); // Ajustado para imagen 119x100
            
            if (this.player.anims.currentAnim.key !== 'duck') {
                this.player.play('duck', true);
            }
        } else {
            // --- MODO DE PIE ---
            // Solo restauramos la CAJA FÍSICA. 
            // NO tocamos la animación aquí para no romper el salto.
            this.player.body.setSize(50, 120);
            this.player.body.setOffset(50, 20);
        }
    }

    spawnObstacle() {
        if (this.isGameOver) return;

        const w = this.scale.width;
        // 50% de probabilidad
        const type = Math.random() > 0.5 ? 'low' : 'high';
        let obstacle;

        if (type === 'low') {
            // --- CAJA EN EL SUELO (Hay que saltar) ---
            const height = 70;
            // La colocamos pegada al suelo
            const yPos = this.groundY - (height / 2);
            obstacle = this.add.rectangle(w + 50, yPos, 50, height, 0xff0000);
        } else {
            // --- MURO AÉREO (Hay que agacharse) ---
            const height = 400;
            const gap = 100; // Hueco libre debajo del muro
            // La colocamos flotando arriba
            const yPos = this.groundY - gap - (height / 2);
            obstacle = this.add.rectangle(w + 50, yPos, 50, height, 0xff0000);
        }

        this.physics.add.existing(obstacle);
        this.obstacles.add(obstacle);
        
        // El obstáculo flota y es duro
        obstacle.body.setAllowGravity(false);
        obstacle.body.setImmovable(true);
    }

    handleCollision(obstacle) {
        if (obstacle.hit) return; // Evitar múltiples impactos
        obstacle.hit = true;
        obstacle.fillColor = 0x555555; // Cambiar color al chocar

        this.zombieDistance -= 40; // Penalización

        // Regla: 2 fallos en 10 segundos = Muerte
        const now = Date.now();
        this.mistakeTimestamps.push(now);
        this.mistakeTimestamps = this.mistakeTimestamps.filter(time => now - time < 10000);

        if (this.mistakeTimestamps.length >= 2) {
            this.zombieDistance = 0; // Game Over
        }
        this.cameras.main.shake(200, 0.01);
    }

    updateZombies() {
        // Recuperación lenta de distancia
        if (this.zombieDistance < 150) {
            this.zombieDistance += 0.05;
        }

        // UI Barra Roja
        const barWidth = Math.max(0, this.zombieDistance);
        this.dangerBar.width = barWidth;

        // Movimiento suave del zombie
        const targetX = this.player.x - (this.zombieDistance * 3);
        this.zombieHorde.x = Phaser.Math.Linear(this.zombieHorde.x, targetX, 0.1);
        this.zombieText.x = this.zombieHorde.x;

        // Chequeo de Game Over (Distancia o Contacto físico)
        if (this.zombieDistance <= 0) this.triggerGameOver();

        const playerBounds = this.player.getBounds();
        const zombieBounds = this.zombieHorde.getBounds();

        if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, zombieBounds)) {
            this.triggerGameOver();
        }
    }

    createMobileControls(w, h) {
        const btnSize = 60;
        const btnY = h - 50;

        // Botón Salto
        const jumpBtn = this.add.rectangle(w - 60, btnY, btnSize, btnSize, 0xffffff, 0.3).setInteractive().setScrollFactor(0);
        this.add.text(w - 60, btnY, '⬆', { fontSize: '30px' }).setOrigin(0.5);
        jumpBtn.on('pointerdown', () => this.jumpBtnDown = true);
        jumpBtn.on('pointerup', () => this.jumpBtnDown = false);
        jumpBtn.on('pointerout', () => this.jumpBtnDown = false);

        // Botón Agacharse
        const duckBtn = this.add.rectangle(60, btnY, btnSize, btnSize, 0xffffff, 0.3).setInteractive().setScrollFactor(0);
        this.add.text(60, btnY, '⬇', { fontSize: '30px' }).setOrigin(0.5);
        duckBtn.on('pointerdown', () => this.duckBtnDown = true);
        duckBtn.on('pointerup', () => this.duckBtnDown = false);
        duckBtn.on('pointerout', () => this.duckBtnDown = false);
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.physics.pause();
        this.player.setTint(0xff0000);

        const currentBest = localStorage.getItem('parkour_highscore') || 0;
        if (this.scoreDistance > currentBest) {
            localStorage.setItem('parkour_highscore', Math.floor(this.scoreDistance));
        }

        this.time.delayedCall(1500, () => {
            this.scene.start('GameOverScene', { score: Math.floor(this.scoreDistance) });
        });
    }
}