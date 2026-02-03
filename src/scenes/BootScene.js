import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Cargaríamos aquí las imágenes reales.
        // this.load.image('background', 'assets/img/background.png');
        // this.load.spritesheet('player', 'assets/img/player.png', { frameWidth: 64, frameHeight: 64 });
        
        // Simulación de carga
        this.add.text(400, 225, 'Cargando...', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);
    }

    create() {
        this.scene.start('MainMenuScene');
    }
}