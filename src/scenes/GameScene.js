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
            frameWidth: 152, 
            frameHeight: 140
        });

        // Saltar 
        this.load.spritesheet('anim_jump', 'assets/img/jumpA.png', {
            frameWidth: 169, 
            frameHeight: 100
        });

        // Pirueta 
        this.load.spritesheet('anim_pirouette', 'assets/img/jump2.png', {
            frameWidth: 180, 
            frameHeight: 97
        });

        // Agacharse 
        this.load.spritesheet('anim_duck', 'assets/img/down.png', { 
            frameWidth: 119, 
            frameHeight: 100 
        });

        // --- ENEMIGOS Y FONDO ---
        // Zombie 
        this.load.spritesheet('anim_zombie', 'assets/img/zombie1.png', { 
            frameWidth: 145, 
            frameHeight: 140
        });

        // Animación de Muerte (Zombie mordiendo)
        this.load.spritesheet('anim_bite', 'assets/img/morder.png', { 
            frameWidth: 204, 
            frameHeight: 120 
        });
    // --- Fondo tileable ---
    this.load.image('background', 'assets/img/background.png');

    // --- OBSTÁCULOS ---
    // Obstaculos Suelo
    this.load.image('obstaculoBarril', 'assets/img/obstaculoBarril.png');
    this.load.image('obstaculoCoche', 'assets/img/obstaculoCoche.png');
    this.load.image('obstaculoBarricada', 'assets/img/obstaculoBarricada.png');
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
        this.groundY = h - 50; 

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
        // Morder
        this.anims.create({
            key: 'bite',
            frames: this.anims.generateFrameNumbers('anim_bite', { start: 0, end: -1 }),
            frameRate: 3, // Ajusta la velocidad si muerden muy rápido
            repeat: 0      // 0 = Lo hace una vez y para (no queremos que lo muerda infinitamente en bucle)
        });
        
        this.zombieHorde.setCollideWorldBounds(true);
        this.physics.add.collider(this.zombieHorde, this.ground);
        this.zombieHorde.setDepth(1); // Se dibuja delante del fondo

        // Hitbox del Zombie
        this.zombieHorde.body.setSize(50, 120);
        this.zombieHorde.body.setOffset(50, 20);

        this.zombieText = this.add.text(50, this.groundY - 160, "¡RAAWR!", { fontSize: '12px', color: 'rgb(7, 7, 7)' }).setOrigin(0.5);

        // --- 6. GRUPO DE OBSTÁCULOS ---
this.obstacles = this.physics.add.group({
    allowGravity: false, // Importante: Los obstáculos flotan (para los aéreos)
    immovable: true      // CORREGIDO: Debe ser true o saldrán volando al chocar
});

// Definimos los tipos de obstáculos del suelo con sus datos en un array
this.groundObstacles = [
    {
        key: 'obstaculoBarril',
        scale: 0.6,
        yOffset: 10, // Para ajustar la posición vertical si es necesario
        hitbox: { w: 60, h: 90, ox: 5, oy: 30 }
    },
    {
        key: 'obstaculoCoche',
        scale: 1.35,
        yOffset: 60, // El coche es más alto, así que lo bajamos un poco para que toque el suelo
        hitbox: { w: 90, h: 40, ox: 45, oy: 50 } // Especificamos hitbox personalizada para el coche
    },
    {
        key: 'obstaculoBarricada',
        scale: 1.3,
        yOffset: 20,
        hitbox: { w: 50, h: 50, ox: 18, oy: 30 }
    }
];

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
        this.scoreText = this.add.text(20, 22, 'Distancia: 0m', { 
            fontSize: '20px', fill: '#fff' });
        this.add.text(w - 200, 22, 'Peligro:', { 
            fontSize: '16px', fill: '#fff' });
        this.dangerBar = this.add.rectangle(w - 20, 30, 100, 10, 0xff0000).setOrigin(1, 0.5);
    }

    // =================================================================
    // 3. UPDATE: BUCLE PRINCIPAL (60 VECES/SEG)
    // =================================================================
    // --- UPDATE: Bucle principal ---
    update(time, delta) {
        if (this.isGameOver) return;

        // 1. Mover fondo y calcular puntuación
        this.bg.tilePositionX += this.gameSpeed;
        this.scoreDistance += 0.05 * this.gameSpeed;
        this.scoreText.setText(`Distancia: ${Math.floor(this.scoreDistance)}m`);
        this.gameSpeed += 0.002;// Aumento de la velocidad según avanzamos

        // 2. Detectar intención de agacharse
        const isDucking = this.cursors.down.isDown || this.duckBtnDown;

        // --- CONTROLES ---
        
        // Salto (Solo si toca el suelo)
        if ((this.cursors.up.isDown || this.jumpBtnDown) && this.player.body.touching.down) {
            this.performJump();
        }

        // Agacharse
        this.performDuck(isDucking);

        // --- OBSTÁCULOS ---
        this.obstacles.getChildren().forEach(obstacle => {
            obstacle.x -= this.gameSpeed;
            if (obstacle.x < -100) obstacle.destroy();
        });

        this.updateZombies();

        // --- RECUPERACIÓN DE ANIMACIÓN (Correr) ---
        // Si tocamos el suelo y NO estamos agachados, volvemos a correr
        if (this.player.body.touching.down && this.player.body.velocity.y >= 0 && !isDucking) {
            if (this.player.anims.currentAnim && this.player.anims.currentAnim.key !== 'run') {
                this.player.play('run', true);
                // Restaurar caja grande
                this.player.body.setSize(50, 120);
                this.player.body.setOffset(50, 20);
            }
        }

        // =================================================================
        // ¡¡CANDADO DE SEGURIDAD (ANTI-HUNDIMIENTO)!!
        // =================================================================
        // Esto comprueba 60 veces por segundo si el personaje se ha hundido
        // por culpa de un choque o un cambio de tamaño.
        
        if (this.player.y > this.groundY) {
            // 1. Lo forzamos a volver a la línea del suelo
            this.player.y = this.groundY;
            
            // 2. Frenamos cualquier velocidad de caída residual
            this.player.body.velocity.y = 0;
            
            // 3. Le decimos que estamos tocando suelo
            this.player.body.touching.down = true; 
        }
    }
    // =================================================================
    // 4. MÉTODOS DE ACCIÓN (Lógica del personaje)
    // =================================================================

    createAnimations() {
        this.anims.create({ key: 'run', 
            frames: this.anims.generateFrameNumbers('anim_run', { 
                start: 0, end: -1 
            }), 
            frameRate: 12, repeat: -1 
        });
        this.anims.create({ key: 'jump', 
            frames: this.anims.generateFrameNumbers('anim_jump', { 
                start: 0, end: -1 
            }), 
            frameRate: 6, repeat: 0 
        });
        this.anims.create({ key: 'pirouette', 
            frames: this.anims.generateFrameNumbers('anim_pirouette', { 
                start: 0, end: -1 
            }), 
            frameRate: 6, repeat: 0 
        });
        this.anims.create({ key: 'duck', 
            frames: this.anims.generateFrameNumbers('anim_duck', { 
                start: 0, end: -1 
            }), 
            frameRate: 9, repeat: -1 
        });
        this.anims.create({ key: 'zombie_run', 
            frames: this.anims.generateFrameNumbers('anim_zombie', { 
                start: 0, end: -1 
            }), 
            frameRate: 10, repeat: -1 
        });
    }

    performJump() {
        this.player.setVelocityY(-450); // Impulso hacia arriba

        // Caja pequeña para el salto 
        this.player.body.setSize(35, 90);
        this.player.body.setOffset(49, 10); 

        // Probabilidad de hacer pirueta (30%)
        if (Math.random() > 0.4) {
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
            // 3. ¡CORRECCIÓN ANTI-HUNDIMIENTO!
            // Si estamos en el suelo, forzamos la posición Y para que no se hunda por el cambio de tamaño
            if (this.player.body.touching.down) {
                this.player.y = this.groundY;
            }
        } /*else {
            // --- MODO DE PIE ---
            // Solo restauramos la CAJA FÍSICA. 
            // NO tocamos la animación aquí para no romper el salto.
            this.player.body.setSize(50, 120);
            this.player.body.setOffset(50, 20);
        }*/
    }

   spawnObstacle() {
    if (this.isGameOver) return;

        const w = this.scale.width;
        // 50% de probabilidad
        const type = Math.random() > 0.5 ? 'low' : 'high';
        let obstacle;

    if (type === 'low') {
        const data = Phaser.Utils.Array.GetRandom(this.groundObstacles);

        obstacle = this.physics.add.sprite(
            w + 100,
            this.groundY + data.yOffset,
            data.key
        )
        .setOrigin(0.5, 1)
        .setScale(data.scale);

        // HITBOX CONTROLADA POR VARIABLES
        obstacle.body.setSize(
            data.hitbox.w,
            data.hitbox.h
        );

        obstacle.body.setOffset(
            data.hitbox.ox,
            data.hitbox.oy
        );

        // Alternar obstáculo
        this.groundObstacleIndex =
            (this.groundObstacleIndex + 1) % this.groundObstacles.length;

    } else {
        // OBSTÁCULO AÉREO
        const height = 400;
        const gap = 80;
        const yPos = this.groundY - gap - (height / 2);

        obstacle = this.add.rectangle(w + 50, yPos, 70, height, 0xff0000, 0);
        this.physics.add.existing(obstacle);
    }

    this.obstacles.add(obstacle);

    obstacle.body.setAllowGravity(false);
    obstacle.body.setImmovable(true);
}

    handleCollision(obstacle) {
        //return;
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
        // Evitar que se ejecute dos veces
        if (this.isGameOver) return;
        this.isGameOver = true;

        // 1. Congelar físicas y movimientos
        this.physics.pause();
        
        // 2. Ocultar los personajes que están corriendo
        this.player.setVisible(false);
        this.zombieHorde.setVisible(false);
        // Opcional: Ocultar texto "RAAWR"
        this.zombieText.setVisible(false); 

        // 3. CREAR EL SPRITE DE LA MORDIDA
        // Lo ponemos en la X del jugador y la Y del suelo (groundY)
        const deathSprite = this.add.sprite(this.player.x, this.groundY, 'anim_bite');
        
        // Configuración para que pise bien el suelo
        deathSprite.setOrigin(0.5, 1); 
        // Si se ve pequeño, descomenta la siguiente línea:
        // deathSprite.setScale(1.2); 

        // 4. Reproducir la animación
        deathSprite.play('bite');

        // 5. Guardar récord
        const currentBest = localStorage.getItem('parkour_highscore') || 0;
        if (this.scoreDistance > currentBest) {
            localStorage.setItem('parkour_highscore', Math.floor(this.scoreDistance));
        }

        // 6. Esperar 3 segundos (para que nos dé tiempo a ver la animación) e ir a Game Over
        this.time.delayedCall(3000, () => {
            this.scene.start('GameOverScene', { score: Math.floor(this.scoreDistance) });
        });
    }
}