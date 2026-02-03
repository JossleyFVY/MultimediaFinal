import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        // --- 1. CONFIGURACIÓN INICIAL ---
        this.isGameOver = false;
        this.gameSpeed = 5; // Velocidad inicial
        this.scoreDistance = 0; // Metros recorridos
        this.mistakeTimestamps = []; // Para controlar fallos seguidos
        this.zombieDistance = 100; // Distancia de la horda (0 = Muerte)
        
        const w = this.scale.width;
        const h = this.scale.height;
        
        // DEFINIMOS LA ALTURA DEL SUELO (Más alto para dejar sitio a botones)
        this.groundY = h - 120; 

        // --- 2. ESCENARIO (SUELO Y FONDO) ---
        // Suelo estático
        this.ground = this.add.rectangle(w/2, this.groundY + 25, w, 50, 0x333333);
        this.physics.add.existing(this.ground, true); // true = estático

        // --- 3. JUGADOR ---
        // Lo colocamos sobre el suelo nuevo
        this.player = this.physics.add.sprite(150, this.groundY - 100, null);
        this.player.setSize(40, 80); // Hitbox de pie
        this.player.setCollideWorldBounds(true);
        
        // Simulación visual del jugador (Rectángulo Azul)
        this.playerGraphics = this.add.rectangle(0, 0, 40, 80, 0x0000ff);
        
        this.physics.add.collider(this.player, this.ground);

        // --- 4. ZOMBIES (PERSEGUIDORES) ---
        // Horda Zombie (Rectángulo Verde)
        this.zombieHorde = this.add.rectangle(50, this.groundY - 50, 60, 80, 0x00ff00);
        this.zombieText = this.add.text(50, this.groundY - 100, "¡RAAWR!", { fontSize: '12px', color: '#0f0'}).setOrigin(0.5);

        // --- 5. GRUPOS DE OBSTÁCULOS ---
        // IMPORTANTE: allowGravity false para que no se caigan
        this.obstacles = this.physics.add.group({
            allowGravity: false,
            immovable: true
        });

        // Colisión Jugador vs Obstáculo
        this.physics.add.overlap(this.player, this.obstacles, (player, obstacle) => {
            this.handleCollision(obstacle);
        });

        // --- 6. CONTROLES (UI MÓVIL) ---
        this.createMobileControls(w, h);
        
        // Teclado (para depurar en PC)
        this.cursors = this.input.keyboard.createCursorKeys();

        // --- 7. TIMERS (GENERACIÓN DE MUNDO) ---
        this.time.addEvent({
            delay: 2000,
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: true
        });

        // UI de Puntuación
        this.scoreText = this.add.text(20, 20, 'Distancia: 0m', { fontSize: '20px', fill: '#fff' });
        
        // Barra de peligro Zombie
        this.add.text(w - 150, 20, 'Peligro:', { fontSize: '16px', fill: '#fff' });
        this.dangerBar = this.add.rectangle(w - 20, 30, 100, 10, 0xff0000).setOrigin(1, 0.5);
    }

    update(time, delta) {
        if (this.isGameOver) return;

        // --- ACTUALIZAR LÓGICA DE JUEGO ---

        // 1. Sincronizar gráfico con física
        this.playerGraphics.x = this.player.x;
        this.playerGraphics.y = this.player.y;

        // 2. Aumentar distancia y velocidad
        this.scoreDistance += 0.05 * this.gameSpeed;
        this.scoreText.setText(`Distancia: ${Math.floor(this.scoreDistance)}m`);
        this.gameSpeed += 0.001; 

        // 3. Controles
        // Saltar
        if ((this.cursors.up.isDown || this.jumpBtnDown) && this.player.body.touching.down) {
            this.performJump();
        }

        // Agacharse
        if (this.cursors.down.isDown || this.duckBtnDown) {
            this.performDuck(true);
        } else {
            this.performDuck(false);
        }

        // 4. Mover obstáculos hacia la izquierda
        this.obstacles.getChildren().forEach(obstacle => {
            obstacle.x -= this.gameSpeed;
            if (obstacle.x < -100) obstacle.destroy();
        });

        // 5. Actualizar Zombies
        this.updateZombies();
    }

    // --- ACCIONES DEL JUGADOR ---

    performJump() {
        this.player.setVelocityY(-600); 
        this.playerGraphics.fillColor = 0x00ffff; // Cian al saltar
    }

    performDuck(isDucking) {
        if (isDucking) {
            this.player.body.setSize(40, 40);
            this.player.body.setOffset(0, 40);
            this.playerGraphics.height = 40;
            this.playerGraphics.y += 20; 
            this.playerGraphics.fillColor = 0xffff00; // Amarillo al agacharse
        } else {
            this.player.body.setSize(40, 80);
            this.player.body.setOffset(0, 0);
            this.playerGraphics.height = 80;
            this.playerGraphics.fillColor = 0x0000ff; // Azul normal
        }
    }

    // --- GENERACIÓN DE OBSTÁCULOS ---
    
    spawnObstacle() {
        if (this.isGameOver) return;

        const w = this.scale.width;
        const groundY = this.groundY; // Usamos la nueva altura del suelo
        
        const type = Math.random() > 0.5 ? 'low' : 'high';

        let obstacle;
        if (type === 'low') {
            // CAJA BAJA (Saltar)
            obstacle = this.add.rectangle(w + 50, groundY - 25, 50, 50, 0xff0000);
        } else {
            // OBSTÁCULO ALTO (Agacharse)
            // Configurado como un Muro Flotante Gigante
            const gap = 60; // Hueco para pasar agachado
            const height = 400; // Muy alto para no saltarlo
            const yPos = groundY - gap - (height / 2);

            obstacle = this.add.rectangle(w + 50, yPos, 50, height, 0xff0000);
        }

        // Añadimos físicas y forzamos que floten
        this.physics.add.existing(obstacle);
        this.obstacles.add(obstacle);
        obstacle.body.setAllowGravity(false);
        obstacle.body.setImmovable(true);
    }

    // --- SISTEMA DE DAÑO Y ZOMBIES ---

    handleCollision(obstacle) {
        if (obstacle.hit) return;
        obstacle.hit = true;
        obstacle.fillColor = 0x555555;

        // Penalización
        this.zombieDistance -= 40; 
        
        // Regla de fallos seguidos
        const now = Date.now();
        this.mistakeTimestamps.push(now);
        this.mistakeTimestamps = this.mistakeTimestamps.filter(time => now - time < 10000);

        if (this.mistakeTimestamps.length >= 2) {
            this.zombieDistance = 0;
        }

        this.cameras.main.shake(200, 0.01);
    }

    updateZombies() {
        if (this.zombieDistance < 150) {//Distancia zombies con el jugador al correr
            this.zombieDistance += 0.05;
        }

        const barWidth = Math.max(0, this.zombieDistance);
        this.dangerBar.width = barWidth;

        const targetX = this.player.x - (this.zombieDistance * 3); 
        this.zombieHorde.x = Phaser.Math.Linear(this.zombieHorde.x, targetX, 0.1);
        this.zombieText.x = this.zombieHorde.x;

        if (this.zombieDistance <= 0) {
            this.triggerGameOver();
        }
        // Muerte B (NUEVO): Si los cuadrados se tocan físicamente
        // Esto arregla el "efecto fantasma" donde el zombie te tocaba y no pasaba nada
        const playerBounds = this.player.getBounds();
        const zombieBounds = this.zombieHorde.getBounds();

        if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, zombieBounds)) {
            this.triggerGameOver();
        }
    }

    // --- UI MÓVIL (BOTONES PEQUEÑOS Y ABAJO) ---
    createMobileControls(w, h) {
        const btnSize = 60; // Más pequeños
        const btnY = h - 50; // Pegados al fondo

        // Botón Saltar (Derecha)
        const jumpBtn = this.add.rectangle(w - 60, btnY, btnSize, btnSize, 0xffffff, 0.3)
            .setInteractive()
            .setScrollFactor(0);
        
        this.add.text(w - 60, btnY, '⬆', { fontSize: '30px' }).setOrigin(0.5);

        jumpBtn.on('pointerdown', () => this.jumpBtnDown = true);
        jumpBtn.on('pointerup', () => this.jumpBtnDown = false);
        jumpBtn.on('pointerout', () => this.jumpBtnDown = false);

        // Botón Agacharse (Izquierda)
        const duckBtn = this.add.rectangle(60, btnY, btnSize, btnSize, 0xffffff, 0.3)
            .setInteractive()
            .setScrollFactor(0);

        this.add.text(60, btnY, '⬇', { fontSize: '30px' }).setOrigin(0.5);

        duckBtn.on('pointerdown', () => this.duckBtnDown = true);
        duckBtn.on('pointerup', () => this.duckBtnDown = false);
        duckBtn.on('pointerout', () => this.duckBtnDown = false);
    }

    // --- GAME OVER ---
    triggerGameOver() {
        this.isGameOver = true;
        this.physics.pause();
        this.player.setTint(0xff0000);
        
        const currentBest = localStorage.getItem('parkour_highscore') || 0;
        if (this.scoreDistance > currentBest) {
            localStorage.setItem('parkour_highscore', Math.floor(this.scoreDistance));
        }

        this.time.delayedCall(1000, () => {
            this.scene.start('GameOverScene', { score: Math.floor(this.scoreDistance) });
        });
    }
}