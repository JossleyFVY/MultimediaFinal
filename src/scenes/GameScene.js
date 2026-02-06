import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        // Llama al constructor de la clase padre (Phaser.Scene) con la clave 'GameScene'
        super('GameScene');
    }

    // --- PRELOAD: Carga de recursos antes de iniciar ---
    preload() {
        // Cargamos las hojas de sprites (imágenes con varios dibujitos dentro).
        // Los frameWidth/Height deben coincidir EXACTAMENTE con el tamaño de cada muñeco en tu imagen PNG.
        
        // Animación de correr
        this.load.spritesheet('anim_run', 'assets/img/P1_Run.png', { 
            frameWidth: 67, 
            frameHeight: 58 
        });

        // Animación de salto
        this.load.spritesheet('anim_jump', 'assets/img/P1_Jump.png', { 
            frameWidth: 54, 
            frameHeight: 43 
        });

        // Animación de pirueta (salto especial)
        this.load.spritesheet('anim_pirouette', 'assets/img/P1_Jump2.png', { 
            frameWidth: 54, 
            frameHeight: 39
        });
    }

    // --- CREATE: Se ejecuta una vez al empezar el juego ---
    create() {
        // --- 1. CONFIGURACIÓN INICIAL (VARIABLES) ---
        this.isGameOver = false;       // Interruptor para saber si el juego sigue activo
        this.gameSpeed = 5;            // Velocidad inicial de los obstáculos
        this.scoreDistance = 0;        // Metros recorridos
        this.mistakeTimestamps = [];   // Lista para guardar cuándo chocamos (para la regla de los 10s)
        this.zombieDistance = 100;     // Distancia de los zombies (100 = lejos, 0 = te comen)
        
        // Guardamos ancho (w) y alto (h) de la pantalla para usarlo en fórmulas
        const w = this.scale.width;
        const h = this.scale.height;
        
        // Definimos dónde estará el suelo (dejamos 120px abajo para botones)
        this.groundY = h - 100; 

        // --- 2. DEFINIR ANIMACIONES ---
        // Animación Correr: repeat -1 significa "infinito"
        this.anims.create({
            key: 'run',
            frames: this.anims.generateFrameNumbers('anim_run', { start: 0, end: -1 }),
            frameRate: 12,
            repeat: -1
        });

        // Animación Saltar: repeat 0 significa "hazlo una vez y para"
        this.anims.create({
            key: 'jump',
            frames: this.anims.generateFrameNumbers('anim_jump', { start: 0, end: -1 }),
            frameRate: 12,
            repeat: 0
        });

        // Animación Pirueta: un poco más rápida (15 fps)
        this.anims.create({
            key: 'pirouette',
            frames: this.anims.generateFrameNumbers('anim_pirouette', { start: 0, end: -1 }),
            frameRate: 15,
            repeat: 0
        });

        // --- 3. ESCENARIO (SUELO) ---
        // Creamos el rectángulo visual del suelo
        this.ground = this.add.rectangle(w/2, this.groundY + 20, w, 10, 0x333333);
        // Le damos físicas estáticas (true) para que no se caiga ni se mueva
        this.physics.add.existing(this.ground, true);

        // --- 4. JUGADOR ---
        // Creamos al jugador un poco más arriba para que caiga al suelo
        this.player = this.physics.add.sprite(180, this.groundY - 200, 'anim_run');
        this.player.play('run'); // Empieza a correr inmediatamente
        
        // AJUSTE DE HITBOX (Caja de colisión invisible)
        // setSize: Hacemos la caja más estrecha (20px) para ser generosos con el jugador
        this.player.body.setSize(10, 20); 
        // setOffset: Movemos la caja dentro del dibujo para alinearla con los pies
        this.player.body.setOffset(21, 18);

        this.player.setCollideWorldBounds(true); // Que no se salga de la pantalla
        // COLLIDER: Física sólida. El jugador choca y camina sobre el suelo.
        this.physics.add.collider(this.player, this.ground);

        // --- 5. ZOMBIES (VISUAL) ---
        // Creamos el cuadrado verde y el texto que nos persigue
        this.zombieHorde = this.add.rectangle(50, this.groundY - 50, 60, 80, 0x00ff00);
        this.zombieText = this.add.text(50, this.groundY - 100, "¡RAAWR!", { fontSize: '12px', color: '#0f0'}).setOrigin(0.5);

        // --- 6. GRUPO DE OBSTÁCULOS ---
        this.obstacles = this.physics.add.group({
            allowGravity: false, // Importante: Los obstáculos flotan (para los aéreos)
            immovable: false      // Si chocas, el obstáculo no sale volando, es un muro
        });

        // OVERLAP: Detecta contacto pero NO frena al jugador físicamente (lo atraviesas y recibes daño)
        this.physics.add.overlap(this.player, this.obstacles, (player, obstacle) => {
            this.handleCollision(obstacle);
        });

        // --- 7. CONTROLES E INTERFAZ ---
        this.createMobileControls(w, h); // Botones táctiles
        this.cursors = this.input.keyboard.createCursorKeys(); // Teclas flechas (PC)

        // TIMER: Genera un obstáculo cada 2000 milisegundos (2 segundos)
        this.time.addEvent({
            delay: 2000,
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: true
        });

        // UI: Textos de puntuación y barra de vida
        this.scoreText = this.add.text(20, 20, 'Distancia: 0m', { fontSize: '20px', fill: '#fff' });
        this.add.text(w - 150, 20, 'Peligro:', { fontSize: '16px', fill: '#fff' });
        this.dangerBar = this.add.rectangle(w - 20, 30, 100, 10, 0xff0000).setOrigin(1, 0.5);
    }

    // --- UPDATE: Bucle del juego (se ejecuta 60 veces por segundo) ---
    update(time, delta) {
        if (this.isGameOver) return; // Si perdiste, dejamos de actualizar todo

        // 1. Lógica de Puntuación
        this.scoreDistance += 0.05 * this.gameSpeed; // Sumamos distancia
        this.scoreText.setText(`Distancia: ${Math.floor(this.scoreDistance)}m`);
        this.gameSpeed += 0.001; // Aumentamos la dificultad muy lentamente

        // 2. Chequeo de Controles (Salto)
        // Solo puedes saltar si estás tocando el suelo
        if ((this.cursors.up.isDown || this.jumpBtnDown) && this.player.body.touching.down) {
            this.performJump();
        }

        // 3. Chequeo de Controles (Agacharse)
        if (this.cursors.down.isDown || this.duckBtnDown) {
            this.performDuck(true); // Modificamos hitbox para agacharnos
        } else {
            this.performDuck(false); // RESTAURAMOS hitbox normal si no tocamos nada
        }

        // 4. Movimiento de Obstáculos
        // Movemos todo hacia la izquierda para simular que avanzamos
        this.obstacles.getChildren().forEach(obstacle => {
            obstacle.x -= this.gameSpeed;
            // Si sale de la pantalla por la izquierda (-100), lo borramos para ahorrar memoria
            if (obstacle.x < -100) obstacle.destroy();
        });

        // 5. Actualizar la posición de los Zombies
        this.updateZombies();

        // 6. Gestión de Animaciones
        // Si aterrizamos en el suelo después de un salto, volvemos a la animación de correr
        if (this.player.body.touching.down && this.player.body.velocity.y >= 0) {
            if (this.player.anims.currentAnim && this.player.anims.currentAnim.key !== 'run') {
            this.player.play('run', true);
        }
    }
    }

    // --- MÉTODOS DE ACCIÓN ---

    performJump() {
        this.player.setVelocityY(-600); // Impulso hacia arriba (negativo es arriba en Phaser)
        
        // Ajustamos la caja para el sprite de salto (54x43)
        // La hacemos más pequeña: 20x30
        this.player.body.setSize(20, 30);
        this.player.body.setOffset(17, 13); // Centrado aprox
        
        // Lógica aleatoria para dar variedad visual
        if (Math.random() > 0.3) {
            this.player.play('jump');     // 70% Salto normal
        } else {
            this.player.play('pirouette'); // 30% Pirueta chula
        }
    }

    performDuck(isDucking) {
        // ESTA FUNCIÓN ES CRÍTICA: Cambia el tamaño del cuerpo físico
        if (isDucking) {
            // Si estamos agachados: Caja pequeña y baja
            this.player.body.setSize(30, 30); 
            this.player.body.setOffset(10, 34); 
        } else {
            // Si estamos de pie: RESTAURAMOS los valores originales definidos en create()
            this.player.body.setSize(30, 50); 
            this.player.body.setOffset(10, 14);
        }
    }

    spawnObstacle() {
        if (this.isGameOver) return;

        const w = this.scale.width;
        const groundY = this.groundY;
        
        // 50% probabilidad de obstáculo bajo o alto
        const type = Math.random() > 0.5 ? 'low' : 'high';
        let obstacle;

        if (type === 'low') {
            // Caja en el suelo (hay que saltar)
            obstacle = this.add.rectangle(w + 50, groundY - 25, 50, 50, 0xff0000);
        } else {
            // Muro aéreo (hay que agacharse)
            const gap = 60; // Hueco libre abajo
            const height = 400; // Altura enorme para que no se pueda saltar
            const yPos = groundY - gap - (height / 2); // Matemáticas para colocarlo
            obstacle = this.add.rectangle(w + 50, yPos, 50, height, 0xff0000);
        }

        this.physics.add.existing(obstacle);
        this.obstacles.add(obstacle); // Añadir al grupo
        
        // Configuramos física del obstáculo
        obstacle.body.setAllowGravity(false); // Que flote
        obstacle.body.setImmovable(true);     // Que sea duro como una pared
    }

    handleCollision(obstacle) {
        if (obstacle.hit) return; // Evita que un mismo obstáculo te quite vida 60 veces por segundo
        obstacle.hit = true;
        obstacle.fillColor = 0x555555; // Cambia de color para indicar golpe

        this.zombieDistance -= 40; // Penalización: Los zombies se acercan
        
        // Lógica de "2 fallos en 10 segundos = Muerte"
        const now = Date.now();
        this.mistakeTimestamps.push(now);
        // Filtramos fallos antiguos (más de 10s)
        this.mistakeTimestamps = this.mistakeTimestamps.filter(time => now - time < 10000);

        if (this.mistakeTimestamps.length >= 2) {
            this.zombieDistance = 0; // Muerte instantánea
        }
        // Efecto visual de temblor
        this.cameras.main.shake(200, 0.01);
    }

    updateZombies() {
        // Recuperación: Si corres bien, te alejas un poco de los zombies (hasta un tope de 150)
        if (this.zombieDistance < 150) {
            this.zombieDistance += 0.05;
        }

        // Actualizamos la barra roja visual
        const barWidth = Math.max(0, this.zombieDistance);
        this.dangerBar.width = barWidth;

        // Movemos el cuadrado visual de los zombies detrás del jugador
        const targetX = this.player.x - (this.zombieDistance * 3); 
        this.zombieHorde.x = Phaser.Math.Linear(this.zombieHorde.x, targetX, 0.1);
        this.zombieText.x = this.zombieHorde.x;

        // --- CONDICIONES DE DERROTA ---
        // 1. Si la distancia numérica llega a cero
        if (this.zombieDistance <= 0) {
            this.triggerGameOver();
        }
        // 2. Si los cuadrados físicos se tocan realmente (Intersección)
        const playerBounds = this.player.getBounds();
        const zombieBounds = this.zombieHorde.getBounds();

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

        // Eventos táctiles para saltar
        jumpBtn.on('pointerdown', () => this.jumpBtnDown = true);
        jumpBtn.on('pointerup', () => this.jumpBtnDown = false);
        jumpBtn.on('pointerout', () => this.jumpBtnDown = false);

        // Botón Agacharse (Izquierda)
        const duckBtn = this.add.rectangle(60, btnY, btnSize, btnSize, 0xffffff, 0.3).setInteractive().setScrollFactor(0);
        this.add.text(60, btnY, '⬇', { fontSize: '30px' }).setOrigin(0.5);

        // Eventos táctiles para agacharse
        duckBtn.on('pointerdown', () => this.duckBtnDown = true);
        duckBtn.on('pointerup', () => this.duckBtnDown = false);
        duckBtn.on('pointerout', () => this.duckBtnDown = false);
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.physics.pause(); // Congela todas las físicas
        this.player.setTint(0xff0000); // Pone al jugador rojo
        
        // Guardamos el récord en el navegador
        const currentBest = localStorage.getItem('parkour_highscore') || 0;
        if (this.scoreDistance > currentBest) {
            localStorage.setItem('parkour_highscore', Math.floor(this.scoreDistance));
        }

        // Esperamos 1 segundo y vamos a la pantalla de Game Over
        this.time.delayedCall(1000, () => {
            this.scene.start('GameOverScene', { score: Math.floor(this.scoreDistance) });
        });
    }
}