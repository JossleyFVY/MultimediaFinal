import Phaser from 'phaser';

export default class MainMenuScene extends Phaser.Scene {
    constructor() {
        super('MainMenuScene');
    }

    create() {

        

        const width = this.scale.width;
        const height = this.scale.height;

        // Título
        this.add.text(width / 2, height / 3, 'PARKOUR ZOMBIE', {
            fontSize: '48px',
            fontFamily: 'Arial',
            color: '#00ff00',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Mostrar Récord
        const bestScore = localStorage.getItem('parkour_highscore') || 0;
        this.add.text(width / 2, height / 2, `Mejor Distancia: ${bestScore}m`, {
            fontSize: '24px', color: '#ffffff'
        }).setOrigin(0.5);

        // Botón Jugar
        const playBtn = this.add.rectangle(width / 2, height * 0.7, 200, 60, 0xffffff)
            .setInteractive();
        
        this.add.text(width / 2, height * 0.7, 'CORRER', {
            fontSize: '28px', color: '#000000'
        }).setOrigin(0.5);

        playBtn.on('pointerdown', () => {
            this.scene.start('GameScene');
        });
    }
}