// BootScene — preloads all assets before game starts
// Placeholder until real Phaser Launcher project replaces this

class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // Assets will be loaded here once Midjourney sprites are ready
    // this.load.spritesheet('benji', 'assets/sprites/benji_run.png', { frameWidth: 256, frameHeight: 256 });
    // this.load.image('bg-vancouver-sky', 'assets/backgrounds/vancouver/sky.png');
    this.createLoadingScreen();
  }

  createLoadingScreen() {
    const { width, height } = this.scale;
    this.add.rectangle(width/2, height/2, width, height, 0x002843);
    const title = this.add.text(width/2, height/2 - 40, 'BENJI PAYS', {
      fontFamily: 'Arial Black', fontSize: '32px', color: '#CC7D51'
    }).setOrigin(0.5);
    this.add.text(width/2, height/2, 'INVOICE ROVER', {
      fontFamily: 'Arial Black', fontSize: '20px', color: '#F8F8F8'
    }).setOrigin(0.5);
    this.add.text(width/2, height/2 + 60, 'Loading...', {
      fontFamily: 'Arial', fontSize: '13px', color: '#7ba3be'
    }).setOrigin(0.5);
  }

  create() {
    this.scene.start('StartScene');
  }
}
