import Phaser from 'phaser';

export default class GameOverScene extends Phaser.Scene {
    constructor() {
        super('GameOverScene');
    }

    init(data) {
        this.score = data.score || 0;
    }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;

        this.add.text(w / 2, h / 3, '¡INFECTADO!', {
            fontSize: '50px', color: '#ff0000', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(w / 2, h / 2, `Recorriste: ${this.score}m`, {
            fontSize: '30px', color: '#fff'
        }).setOrigin(0.5);

        const restartBtn = this.add.rectangle(w / 2, h * 0.7, 200, 60, 0xffffff).setInteractive();
        this.add.text(w / 2, h * 0.7, 'REINTENTAR', { fontSize: '24px', color: '#000' }).setOrigin(0.5);

        restartBtn.on('pointerdown', () => {
            this.scene.start('GameScene');
        });
        
        const menuBtn = this.add.rectangle(w / 2, h * 0.85, 200, 40, 0x666666).setInteractive();
        this.add.text(w / 2, h * 0.85, 'MENÚ', { fontSize: '20px', color: '#fff' }).setOrigin(0.5);

        menuBtn.on('pointerdown', () => {
            this.scene.start('MainMenuScene');
        });
    }
}