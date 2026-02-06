import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        // Llama al constructor de la clase padre (Phaser.Scene)
        super('GameScene');
    }

    // --- PRELOAD: Carga de recursos antes de iniciar el juego ---
    preload() {
        // Cargamos las hojas de sprites. 
        // Es vital que frameWidth y frameHeight coincidan con tus imágenes.

        // Animación de correr (Tamaño imagen: 152x140)
        this.load.spritesheet('anim_run', 'assets/img/run.png', {
            frameWidth: 152,
            frameHeight: 140
        });

        // Animación de salto (Tamaño imagen: 129x100)
        this.load.spritesheet('anim_jump', 'assets/img/jump.png', {
            frameWidth: 129,
            frameHeight: 100
        });

        // Animación de pirueta (Tamaño imagen: 161x98)
        this.load.spritesheet('anim_pirouette', 'assets/img/jump2.png', {
            frameWidth: 161,
            frameHeight: 98
        });

        // Animación del Zombie (Tamaño imagen: 145x140)
        this.load.spritesheet('anim_zombie', 'assets/img/zombie1.png', { 
            frameWidth: 145, 
            frameHeight: 140
        });

        // Fondo del juego
        this.load.image('background', 'assets/img/background.png');
    }

    // --- CREATE: Se ejecuta una vez al montar la escena ---
    create() {
        // --- 1. CONFIGURACIÓN INICIAL (VARIABLES) ---
        this.isGameOver = false;       // Controla si el juego ha terminado
        this.gameSpeed = 6;            // Velocidad del suelo y obstáculos
        this.scoreDistance = 0;        // Puntuación en metros
        this.mistakeTimestamps = [];   // Array para guardar los tiempos de los choques
        this.zombieDistance = 100;     // Distancia de la horda (100 = lejos, 0 = muerte)

        const w = this.scale.width;
        const h = this.scale.height;

        // --- DEFINICIÓN CRÍTICA DEL SUELO ---
        // groundY define la línea exacta donde pisarán los pies de los personajes.
        this.groundY = h - 80; 

        // --- FONDO (TILESPRITE) ---
        // Calculamos la escala para que el fondo cubra la pantalla
        const bgTexture = this.textures.get('background').getSourceImage();
        const scaleFactorY = this.scale.height / bgTexture.height;
        const scaleFactorX = this.scale.width / bgTexture.width;

        // Creamos un fondo que se repite (TileSprite)
        this.bg = this.add.tileSprite(0, 0, w, h, 'background')
            .setOrigin(0, 0)
            .setScrollFactor(0);
        this.bg.tileScaleX = scaleFactorX;
        this.bg.tileScaleY = scaleFactorY;

        // --- 2. DEFINIR ANIMACIONES ---
        // Correr (Loop infinito)
        this.anims.create({
            key: 'run',
            frames: this.anims.generateFrameNumbers('anim_run', { start: 0, end: -1 }),
            frameRate: 12,
            repeat: -1
        });
        // Saltar (Una vez)
        this.anims.create({
            key: 'jump',
            frames: this.anims.generateFrameNumbers('anim_jump', { start: 0, end: -1 }),
            frameRate: 12,
            repeat: 0
        });
        // Pirueta (Una vez)
        this.anims.create({
            key: 'pirouette',
            frames: this.anims.generateFrameNumbers('anim_pirouette', { start: 0, end: -1 }),
            frameRate: 15,
            repeat: 0
        });
        // Zombie Corriendo (Loop infinito)
        this.anims.create({
            key: 'zombie_run',
            frames: this.anims.generateFrameNumbers('anim_zombie', { start: 0, end: -1 }),
            frameRate: 10,
            repeat: -1
        });

        // --- 3. SUELO FÍSICO ---
        // Creamos la plataforma invisible. +25 para que el borde superior coincida con groundY.
        this.ground = this.add.rectangle(w / 2, this.groundY + 25, w, 50, 0x333333);
        this.ground.setVisible(false); // Suelo invisible
        this.physics.add.existing(this.ground, true); // true = Estático (no se cae)

        // --- 4. JUGADOR ---
        // setOrigin(0.5, 1) pone el punto de anclaje en los PIES.
        // Al ponerlo en 'this.groundY', pisa el suelo perfectamente.
        this.player = this.physics.add.sprite(250, this.groundY, 'anim_run').setOrigin(0.5, 1);
        this.player.play('run');

        // AJUSTE DE HITBOX JUGADOR (Caja morada)
        // setSize: Define el ancho y alto de la caja física (50x120)
        this.player.body.setSize(50, 120);
        // setOffset: Centra la caja dentro de la imagen.
        this.player.body.setOffset(50, 20);

        this.player.setCollideWorldBounds(true); // No salir de pantalla
        this.physics.add.collider(this.player, this.ground); // Chocar con el suelo

        // --- 5. ZOMBIE ---
        // Usamos la misma técnica del Origin en los pies
        this.zombieHorde = this.physics.add.sprite(50, this.groundY, 'anim_zombie').setOrigin(0.5, 1);
        this.zombieHorde.play('zombie_run');
        
        // Físicas del Zombie
        this.zombieHorde.setCollideWorldBounds(true);
        this.physics.add.collider(this.zombieHorde, this.ground);
        this.zombieHorde.setDepth(1); // Dibujar por encima del fondo

        // Hitbox del Zombie
        this.zombieHorde.body.setSize(50, 120);
        this.zombieHorde.body.setOffset(50, 20);

        // Texto de peligro sobre el zombie
        this.zombieText = this.add.text(50, this.groundY - 160, "¡RAAWR!", { fontSize: '12px', color: '#0f0' }).setOrigin(0.5);

        // --- 6. GRUPO DE OBSTÁCULOS ---
        this.obstacles = this.physics.add.group({
            allowGravity: false, // Flotan (no caen por gravedad)
            immovable: true      // Son duros como paredes
        });

        // Detectar choque Jugador vs Obstáculo
        this.physics.add.overlap(this.player, this.obstacles, (player, obstacle) => {
            this.handleCollision(obstacle);
        });

        // --- 7. CONTROLES Y UI ---
        this.createMobileControls(w, h);
        this.cursors = this.input.keyboard.createCursorKeys();

        // TIMER DE GENERACIÓN
        // CAMBIO: delay 1500 (antes 2000) para que salgan más rápido al principio
        this.time.addEvent({
            delay: 1500, 
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: true
        });

        // Textos de UI
        this.scoreText = this.add.text(20, 22, 'Distancia: 0m', { fontSize: '20px', fill: '#fff' });
        this.add.text(w - 200, 22, 'Peligro:', { fontSize: '16px', fill: '#fff' });
        this.dangerBar = this.add.rectangle(w - 20, 30, 100, 10, 0xff0000).setOrigin(1, 0.5);
    }

    // --- UPDATE: Bucle principal (60 veces por segundo) ---
    update(time, delta) {
        if (this.isGameOver) return;

        // Mover el fondo para efecto de velocidad
        this.bg.tilePositionX += this.gameSpeed;

        // Calcular puntuación y aumentar velocidad
        this.scoreDistance += 0.05 * this.gameSpeed;
        this.scoreText.setText(`Distancia: ${Math.floor(this.scoreDistance)}m`);
        this.gameSpeed += 0.001;

        // --- CONTROLES ---
        
        // Saltar (Flecha arriba o Botón)
        if ((this.cursors.up.isDown || this.jumpBtnDown) && this.player.body.touching.down) {
            this.performJump();
        }

        // Agacharse (Flecha abajo o Botón)
        if (this.cursors.down.isDown || this.duckBtnDown) {
            this.performDuck(true);
        } else {
            this.performDuck(false);
        }

        // --- GESTIÓN DE OBSTÁCULOS ---
        this.obstacles.getChildren().forEach(obstacle => {
            obstacle.x -= this.gameSpeed; // Mover hacia la izquierda
            // Eliminar si sale de la pantalla
            if (obstacle.x < -100) obstacle.destroy();
        });

        // Actualizar persecución de Zombies
        this.updateZombies();

        // --- GESTIÓN DE ANIMACIONES ---
        // Si tocamos el suelo y no estamos saltando, volver a animación de correr
        if (this.player.body.touching.down && this.player.body.velocity.y >= 0) {
            if (this.player.anims.currentAnim && this.player.anims.currentAnim.key !== 'run') {
                this.player.play('run', true);
                // IMPORTANTE: Restaurar Hitbox de Correr
                this.player.body.setSize(50, 120);
                this.player.body.setOffset(50, 20);
            }
        }
    }

    // --- MÉTODOS DE ACCIÓN ---

    performJump() {
        this.player.setVelocityY(-650); // Fuerza de salto

        // Hitbox Salto (Más pequeña para saltar mejor)
        this.player.body.setSize(40, 80);
        this.player.body.setOffset(45, 10); 

        // Animación aleatoria
        if (Math.random() > 0.3) {
            this.player.play('jump');
        } else {
            this.player.play('pirouette');
        }
    }

    performDuck(isDucking) {
        if (isDucking) {
            // --- MODO AGACHADO ---
            // Hitbox muy bajita (60px) para pasar por debajo de muros
            this.player.body.setSize(50, 60);
            // Offset Y de 80 para pegar la caja al suelo (140 total - 60 caja = 80)
            this.player.body.setOffset(50, 80); 
        } else {
            // --- MODO DE PIE ---
            // Restaurar Hitbox normal
            this.player.body.setSize(50, 120);
            this.player.body.setOffset(50, 20);
        }
    }

    spawnObstacle() {
        if (this.isGameOver) return;

        const w = this.scale.width;
        
        // 50% probabilidad de obstáculo bajo o alto
        const type = Math.random() > 0.5 ? 'low' : 'high';
        let obstacle;

        // Usamos lógica de centro estándar para obstáculos simples
        
        if (type === 'low') {
            // --- CAJA BAJA (Saltar) ---
            const height = 70;
            // Posición Y: Suelo - Mitad de altura
            const yPos = this.groundY - (height / 2);
            
            obstacle = this.add.rectangle(w + 50, yPos, 50, height, 0xff0000);
        } else {
            // --- MURO AÉREO (Agacharse) ---
            const height = 400;
            // CAMBIO: Gap reducido a 100 (antes 130). 
            // Esto baja el obstáculo y obliga a agacharse más rápido.
            const gap = 100; 
            
            // Posición Y: Suelo - Hueco - Mitad de altura
            const yPos = this.groundY - gap - (height / 2);
            
            obstacle = this.add.rectangle(w + 50, yPos, 50, height, 0xff0000);
        }

        this.physics.add.existing(obstacle);
        this.obstacles.add(obstacle);

        // Propiedades físicas del obstáculo
        obstacle.body.setAllowGravity(false); // Flotan
        obstacle.body.setImmovable(true);     // Son sólidos
    }

    handleCollision(obstacle) {
        if (obstacle.hit) return; // Evitar golpes múltiples en un frame
        obstacle.hit = true;
        obstacle.fillColor = 0x555555; // Cambiar color al golpear

        this.zombieDistance -= 40; // Los zombies se acercan

        // Lógica de 2 fallos en 10 segundos
        const now = Date.now();
        this.mistakeTimestamps.push(now);
        this.mistakeTimestamps = this.mistakeTimestamps.filter(time => now - time < 10000);

        if (this.mistakeTimestamps.length >= 2) {
            this.zombieDistance = 0; // Muerte instantánea
        }
        this.cameras.main.shake(200, 0.01); // Temblor de cámara
    }

    updateZombies() {
        // Si no nos golpeamos, recuperamos distancia poco a poco
        if (this.zombieDistance < 150) {
            this.zombieDistance += 0.05;
        }

        // Actualizar barra de peligro visual
        const barWidth = Math.max(0, this.zombieDistance);
        this.dangerBar.width = barWidth;

        // Interpolación para que los zombies nos persigan suavemente
        const targetX = this.player.x - (this.zombieDistance * 3);
        this.zombieHorde.x = Phaser.Math.Linear(this.zombieHorde.x, targetX, 0.1);
        this.zombieText.x = this.zombieHorde.x;

        // --- CONDICIONES DE DERROTA ---
        if (this.zombieDistance <= 0) {
            this.triggerGameOver();
        }

        const playerBounds = this.player.getBounds();
        const zombieBounds = this.zombieHorde.getBounds();

        // Si los rectángulos se tocan físicamente -> Game Over
        if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, zombieBounds)) {
            this.triggerGameOver();
        }
    }

    createMobileControls(w, h) {
        const btnSize = 60;
        const btnY = h - 50;

        // Botón Saltar (Derecha)
        const jumpBtn = this.add.rectangle(w - 60, btnY, btnSize, btnSize, 0xffffff, 0.3).setInteractive().setScrollFactor(0);
        this.add.text(w - 60, btnY, '⬆', { fontSize: '30px' }).setOrigin(0.5);

        jumpBtn.on('pointerdown', () => this.jumpBtnDown = true);
        jumpBtn.on('pointerup', () => this.jumpBtnDown = false);
        jumpBtn.on('pointerout', () => this.jumpBtnDown = false);

        // Botón Agacharse (Izquierda)
        const duckBtn = this.add.rectangle(60, btnY, btnSize, btnSize, 0xffffff, 0.3).setInteractive().setScrollFactor(0);
        this.add.text(60, btnY, '⬇', { fontSize: '30px' }).setOrigin(0.5);

        duckBtn.on('pointerdown', () => this.duckBtnDown = true);
        duckBtn.on('pointerup', () => this.duckBtnDown = false);
        duckBtn.on('pointerout', () => this.duckBtnDown = false);
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.physics.pause(); // Congelar físicas
        this.player.setTint(0xff0000); // Jugador rojo

        // Guardar récord
        const currentBest = localStorage.getItem('parkour_highscore') || 0;
        if (this.scoreDistance > currentBest) {
            localStorage.setItem('parkour_highscore', Math.floor(this.scoreDistance));
        }

        // Esperar y reiniciar
        this.time.delayedCall(1500, () => {
            this.scene.start('GameOverScene', { score: Math.floor(this.scoreDistance) });
        });
    }
}