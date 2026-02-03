import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        // --- 1. CONFIGURACIÓN INICIAL ---
        this.isGameOver = false;
        this.gameSpeed = 5; // Velocidad inicial del mundo
        this.scoreDistance = 0; // Metros recorridos
        this.mistakeTimestamps = []; // Para controlar los fallos seguidos (regla de los 10s)
        this.zombieDistance = 100; // 0 = Te atrapan, 100 = Lejos
        
        const w = this.scale.width;
        const h = this.scale.height;
        const groundY = h - 50;

        // --- 2. ESCENARIO (SUELO Y FONDO) ---
        // Creamos un suelo estático
        this.ground = this.add.rectangle(w/2, h - 25, w, 50, 0x333333);
        this.physics.add.existing(this.ground, true); // true = estático (no se mueve por gravedad)

        // --- 3. JUGADOR ---
        // Creamos al jugador (cuadrado azul por ahora)
        this.player = this.physics.add.sprite(150, groundY - 100, null);
        this.player.setSize(40, 80); // Hitbox de pie
        this.player.setCollideWorldBounds(true);
        
        // Simulación visual del jugador (esto se cambiaría por animaciones reales)
        this.playerGraphics = this.add.rectangle(0, 0, 40, 80, 0x0000ff);
        
        this.physics.add.collider(this.player, this.ground);

        // --- 4. ZOMBIES (PERSEGUIDORES) ---
        // Representación visual de la horda (cuadrado verde detrás)
        this.zombieHorde = this.add.rectangle(50, groundY - 50, 60, 80, 0x00ff00);
        this.zombieText = this.add.text(50, groundY - 100, "¡RAAWR!", { fontSize: '12px', color: '#0f0'}).setOrigin(0.5);

        // --- 5. GRUPOS DE OBSTÁCULOS ---
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
        // Evento para generar obstáculos cada cierto tiempo
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

        // 1. Sincronizar gráfico con física (ya que usamos un rectángulo simple)
        this.playerGraphics.x = this.player.x;
        this.playerGraphics.y = this.player.y;

        // 2. Aumentar distancia y velocidad progresiva
        this.scoreDistance += 0.05 * this.gameSpeed;
        this.scoreText.setText(`Distancia: ${Math.floor(this.scoreDistance)}m`);
        
        // Aumentar dificultad muy lentamente
        this.gameSpeed += 0.001; 

        // 3. Controles
        // Saltar (Solo si toca suelo)
        if ((this.cursors.up.isDown || this.jumpBtnDown) && this.player.body.touching.down) {
            this.performJump();
        }

        // Agacharse (Cambia hitbox)
        if (this.cursors.down.isDown || this.duckBtnDown) {
            this.performDuck(true);
        } else {
            this.performDuck(false); // Levantar si suelta botón
        }

        // 4. Mover obstáculos hacia la izquierda (Simular que corremos)
        this.obstacles.getChildren().forEach(obstacle => {
            obstacle.x -= this.gameSpeed;
            // Eliminar si sale de pantalla
            if (obstacle.x < -100) obstacle.destroy();
        });

        // 5. Gestión de Zombies y Game Over
        this.updateZombies();
    }

    // --- ACCIONES DEL JUGADOR ---

    performJump() {
        // Aquí iría: this.player.play('jump_animation_' + Phaser.Math.Between(1, 3));
        this.player.setVelocityY(-600); 
        this.playerGraphics.fillColor = 0x00ffff; // Feedback visual (Cian)
    }

    performDuck(isDucking) {
        if (isDucking) {
            // Reducir altura a la mitad
            this.player.body.setSize(40, 40);
            this.player.body.setOffset(0, 40); // Bajar el offset para que quede a ras de suelo
            this.playerGraphics.height = 40;
            this.playerGraphics.y += 20; // Ajuste visual
            this.playerGraphics.fillColor = 0xffff00; // Feedback visual (Amarillo)
        } else {
            // Restaurar tamaño original
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
        const groundY = this.scale.height - 50;
        
        // 50% probabilidad: Obstáculo bajo o Alto
        const type = Math.random() > 0.5 ? 'low' : 'high';

        let obstacle;
        if (type === 'low') {
            // Caja en el suelo
            obstacle = this.add.rectangle(w + 50, groundY - 25, 50, 50, 0xff0000);
        } else {
            // Viga en el aire
            obstacle = this.add.rectangle(w + 50, groundY - 70, 50, 40, 0xff0000);
        }

        // 1. Añadimos físicas individuales
        this.physics.add.existing(obstacle);
        
        // 2. Metemos el obstáculo en el grupo "sin gravedad"
        this.obstacles.add(obstacle);

        // 3. (SEGURIDAD) Forzamos manualmente que no tenga gravedad
        obstacle.body.setAllowGravity(false);
        obstacle.body.setImmovable(true);
    }

    // --- SISTEMA DE DAÑO Y ZOMBIES ---

    handleCollision(obstacle) {
        // Solo cuenta si el obstáculo no ha sido ya "golpeado"
        if (obstacle.hit) return;
        obstacle.hit = true;
        obstacle.fillColor = 0x555555; // Se oscurece para indicar choque

        // 1. Penalización: Los zombies se acercan mucho
        this.zombieDistance -= 40; 
        
        // 2. Registrar timestamp del fallo
        const now = Date.now();
        this.mistakeTimestamps.push(now);

        // 3. Verificar regla: "2 fallos en menos de 10 segundos"
        // Filtramos fallos antiguos (> 10s)
        this.mistakeTimestamps = this.mistakeTimestamps.filter(time => now - time < 10000);

        if (this.mistakeTimestamps.length >= 2) {
            console.log("¡Demasiados fallos seguidos!");
            this.zombieDistance = 0; // Muerte instantánea
        }

        // Efecto visual de choque (Cámara tiembla)
        this.cameras.main.shake(200, 0.01);
    }

    updateZombies() {
        // Recuperación lenta: Si corres bien, te alejas un poco de los zombies
        if (this.zombieDistance < 100) {
            this.zombieDistance += 0.05;
        }

        // Actualizar barra visual
        const barWidth = Math.max(0, this.zombieDistance);
        this.dangerBar.width = barWidth;

        // Mover sprite de la horda visualmente
        // Si distance es 100 -> x = -50 (fuera pantalla)
        // Si distance es 0 -> x = player.x (te cogen)
        const targetX = this.player.x - (this.zombieDistance * 2) + 50; 
        this.zombieHorde.x = Phaser.Math.Linear(this.zombieHorde.x, targetX, 0.1);
        this.zombieText.x = this.zombieHorde.x;

        // Condición de derrota
        if (this.zombieDistance <= 0) {
            this.triggerGameOver();
        }
    }

    // --- UI MÓVIL ---
    createMobileControls(w, h) {
        // Botón Saltar (Lado Derecho)
        const jumpBtn = this.add.rectangle(w - 80, h - 80, 100, 100, 0xffffff, 0.3)
            .setInteractive()
            .setScrollFactor(0); // Que no se mueva con la cámara
        
        this.add.text(w - 80, h - 80, '⬆', { fontSize: '40px' }).setOrigin(0.5);

        jumpBtn.on('pointerdown', () => this.jumpBtnDown = true);
        jumpBtn.on('pointerup', () => this.jumpBtnDown = false);
        jumpBtn.on('pointerout', () => this.jumpBtnDown = false);

        // Botón Agacharse (Lado Izquierdo)
        const duckBtn = this.add.rectangle(80, h - 80, 100, 100, 0xffffff, 0.3)
            .setInteractive()
            .setScrollFactor(0);

        this.add.text(80, h - 80, '⬇', { fontSize: '40px' }).setOrigin(0.5);

        duckBtn.on('pointerdown', () => this.duckBtnDown = true);
        duckBtn.on('pointerup', () => this.duckBtnDown = false);
        duckBtn.on('pointerout', () => this.duckBtnDown = false);
    }

    // --- GAME OVER ---
    triggerGameOver() {
        this.isGameOver = true;
        this.physics.pause();
        this.player.setTint(0xff0000); // Jugador rojo (infectado)
        
        // Guardar récord
        const currentBest = localStorage.getItem('parkour_highscore') || 0;
        if (this.scoreDistance > currentBest) {
            localStorage.setItem('parkour_highscore', Math.floor(this.scoreDistance));
        }

        // Esperar un segundo y cambiar escena
        this.time.delayedCall(1000, () => {
            this.scene.start('GameOverScene', { score: Math.floor(this.scoreDistance) });
        });
    }
}