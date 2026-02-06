import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    preload() {
        // Cargar las imágenes
        // Asegúrate de que los nombres de archivo coinciden con lo que tienes en la carpeta
        this.load.spritesheet('anim_run', 'assets/img/P1_Run.png', { 
            frameWidth: 134, 
            frameHeight: 117 
        });

        this.load.spritesheet('anim_jump', 'assets/img/P1_Jump.png', { 
            frameWidth: 108, 
            frameHeight: 86 
        });

        this.load.spritesheet('anim_pirouette', 'assets/img/P1_Jump2.png', { 
            frameWidth: 108, 
            frameHeight: 78
        });
    }

    create() {
        // --- 1. CONFIGURACIÓN INICIAL ---
        this.isGameOver = false;
        this.gameSpeed = 5; 
        this.scoreDistance = 0; 
        this.mistakeTimestamps = []; 
        this.zombieDistance = 100; 
        
        const w = this.scale.width;
        const h = this.scale.height;
        
        // Altura del suelo
        this.groundY = h - 120; 

        // --- 2. DEFINIR ANIMACIONES ---
        this.anims.create({
            key: 'run',
            frames: this.anims.generateFrameNumbers('anim_run', { start: 0, end: -1 }),
            frameRate: 12,
            repeat: -1
        });

        this.anims.create({
            key: 'jump',
            frames: this.anims.generateFrameNumbers('anim_jump', { start: 0, end: -1 }),
            frameRate: 12,
            repeat: 0
        });

        this.anims.create({
            key: 'pirouette',
            frames: this.anims.generateFrameNumbers('anim_pirouette', { start: 0, end: -1 }),
            frameRate: 15,
            repeat: 0
        });

        // --- 3. ESCENARIO ---
        this.ground = this.add.rectangle(w/2, this.groundY + 25, w, 50, 0x333333);
        this.physics.add.existing(this.ground, true);

        // --- 4. JUGADOR ---
        // Aquí cargamos 'anim_run' directamente para que se vea desde el frame 1
        this.player = this.physics.add.sprite(150, this.groundY - 200, 'anim_run');
        this.player.play('run');
        
        // Ajuste de Hitbox (Caja de colisión) para el sprite
        this.player.body.setSize(20, 50); 
        this.player.body.setOffset(14, 14);

        this.player.setCollideWorldBounds(true);        
        this.physics.add.collider(this.player, this.ground);

        // --- 5. ZOMBIES ---
        this.zombieHorde = this.add.rectangle(50, this.groundY - 50, 60, 80, 0x00ff00);
        this.zombieText = this.add.text(50, this.groundY - 100, "¡RAAWR!", { fontSize: '12px', color: '#0f0'}).setOrigin(0.5);

        // --- 6. OBSTÁCULOS ---
        this.obstacles = this.physics.add.group({
            allowGravity: false,
            immovable: true
        });

        this.physics.add.overlap(this.player, this.obstacles, (player, obstacle) => {
            this.handleCollision(obstacle);
        });

        // --- 7. CONTROLES Y UI ---
        this.createMobileControls(w, h);
        this.cursors = this.input.keyboard.createCursorKeys();

        // Timers
        this.time.addEvent({
            delay: 2000,
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: true
        });

        // UI Textos
        this.scoreText = this.add.text(20, 20, 'Distancia: 0m', { fontSize: '20px', fill: '#fff' });
        this.add.text(w - 150, 20, 'Peligro:', { fontSize: '16px', fill: '#fff' });
        this.dangerBar = this.add.rectangle(w - 20, 30, 100, 10, 0xff0000).setOrigin(1, 0.5);
    }

    update(time, delta) {
        if (this.isGameOver) return;

        // 1. Aumentar distancia y velocidad
        this.scoreDistance += 0.05 * this.gameSpeed;
        this.scoreText.setText(`Distancia: ${Math.floor(this.scoreDistance)}m`);
        this.gameSpeed += 0.001; 

        // 2. Controles
        if ((this.cursors.up.isDown || this.jumpBtnDown) && this.player.body.touching.down) {
            this.performJump();
        }

        if (this.cursors.down.isDown || this.duckBtnDown) {
            this.performDuck(true);
        } else {
            this.performDuck(false);
        }

        // 3. Mover obstáculos
        this.obstacles.getChildren().forEach(obstacle => {
            obstacle.x -= this.gameSpeed;
            if (obstacle.x < -100) obstacle.destroy();
        });

        // 4. Actualizar Zombies
        this.updateZombies();

        // 5. Gestión de Animaciones (Volver a correr al tocar suelo)
        if (this.player.body.touching.down) {
            if (this.player.anims.currentAnim && this.player.anims.currentAnim.key !== 'run') {
                this.player.play('run', true);
            }
        }
    }

    // --- ACCIONES ---

    performJump() {
        this.player.setVelocityY(-600);
        
        // 70% salto normal, 30% pirueta
        if (Math.random() > 0.3) {
            this.player.play('jump');
        } else {
            this.player.play('pirouette');
        }
    }

    performDuck(isDucking) {
        // Al no tener animación de agacharse aún, modificamos solo la Hitbox
        if (isDucking) {
            this.player.body.setSize(30, 30); // Hitbox más pequeña
            this.player.body.setOffset(10, 34); // Bajamos el centro
        } else {
            this.player.body.setSize(30, 50); // Restaurar Hitbox normal
            this.player.body.setOffset(10, 14);
        }
    }

    spawnObstacle() {
        if (this.isGameOver) return;

        const w = this.scale.width;
        const groundY = this.groundY;
        
        const type = Math.random() > 0.5 ? 'low' : 'high';
        let obstacle;

        if (type === 'low') {
            obstacle = this.add.rectangle(w + 50, groundY - 25, 50, 50, 0xff0000);
        } else {
            const gap = 60; 
            const height = 400; 
            const yPos = groundY - gap - (height / 2);
            obstacle = this.add.rectangle(w + 50, yPos, 50, height, 0xff0000);
        }

        this.physics.add.existing(obstacle);
        this.obstacles.add(obstacle);
        obstacle.body.setAllowGravity(false);
        obstacle.body.setImmovable(true);
    }

    handleCollision(obstacle) {
        if (obstacle.hit) return;
        obstacle.hit = true;
        obstacle.fillColor = 0x555555;

        this.zombieDistance -= 40; 
        
        const now = Date.now();
        this.mistakeTimestamps.push(now);
        this.mistakeTimestamps = this.mistakeTimestamps.filter(time => now - time < 10000);

        if (this.mistakeTimestamps.length >= 2) {
            this.zombieDistance = 0;
        }
        this.cameras.main.shake(200, 0.01);
    }

    updateZombies() {
        if (this.zombieDistance < 150) {
            this.zombieDistance += 0.05;
        }

        const barWidth = Math.max(0, this.zombieDistance);
        this.dangerBar.width = barWidth;

        const targetX = this.player.x - (this.zombieDistance * 3); 
        this.zombieHorde.x = Phaser.Math.Linear(this.zombieHorde.x, targetX, 0.1);
        this.zombieText.x = this.zombieHorde.x;

        // Muerte por distancia numérica
        if (this.zombieDistance <= 0) {
            this.triggerGameOver();
        }
        // Muerte por contacto físico
        const playerBounds = this.player.getBounds();
        const zombieBounds = this.zombieHorde.getBounds();

        if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, zombieBounds)) {
            this.triggerGameOver();
        }
    }

    createMobileControls(w, h) {
        const btnSize = 60;
        const btnY = h - 50;

        // Salto
        const jumpBtn = this.add.rectangle(w - 60, btnY, btnSize, btnSize, 0xffffff, 0.3).setInteractive().setScrollFactor(0);
        this.add.text(w - 60, btnY, '⬆', { fontSize: '30px' }).setOrigin(0.5);

        jumpBtn.on('pointerdown', () => this.jumpBtnDown = true);
        jumpBtn.on('pointerup', () => this.jumpBtnDown = false);
        jumpBtn.on('pointerout', () => this.jumpBtnDown = false);

        // Agacharse
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

        this.time.delayedCall(1000, () => {
            this.scene.start('GameOverScene', { score: Math.floor(this.scoreDistance) });
        });
    }
} 