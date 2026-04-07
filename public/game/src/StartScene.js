// StartScene — name + email capture, then launches GameScene
class StartScene extends Phaser.Scene {
  constructor() { super('StartScene'); }

  create() {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width/2, height/2, width, height, 0x002843);

    // Title
    this.add.text(width/2, height * 0.22, 'BENJI PAYS', {
      fontFamily: 'Arial Black', fontSize: '36px', color: '#F8F8F8'
    }).setOrigin(0.5);
    this.add.text(width/2, height * 0.30, 'INVOICE ROVER', {
      fontFamily: 'Arial Black', fontSize: '22px', color: '#CC7D51'
    }).setOrigin(0.5);

    // Hint
    this.add.text(width/2, height * 0.78, 'Swipe left / right  ·  Tap to jump', {
      fontFamily: 'Arial', fontSize: '12px', color: '#7ba3be',
      letterSpacing: 2
    }).setOrigin(0.5);

    // Play button (DOM element for form — will be replaced with proper HTML overlay)
    const playBtn = this.add.rectangle(width/2, height * 0.68, 280, 52, 0xCC7D51, 1)
      .setInteractive({ useHandCursor: true });
    this.add.text(width/2, height * 0.68, 'RUN WITH BENJI →', {
      fontFamily: 'Arial Black', fontSize: '18px', color: '#F8F8F8'
    }).setOrigin(0.5);

    playBtn.on('pointerdown', () => {
      this.scene.start('GameScene', { playerName: 'Player', playerEmail: '' });
    });
  }
}
