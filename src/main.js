import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import MainMenuScene from './scenes/MainMenuScene';
import GameScene from './scenes/GameScene';
import GameOverScene from './scenes/GameOverScene';

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800, // Resolución base (se escala luego)
    height: 450, 
    scale: {
        mode: Phaser.Scale.FIT, // Ajustar a la pantalla sin deformar
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: Phaser.Scale.Orientation.LANDSCAPE
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 1000 }, // Gravedad fuerte para saltos rápidos tipo parkour
            debug: false // Pon true para ver las cajas de colisión
        }
    },
    scene: [BootScene, MainMenuScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(config);