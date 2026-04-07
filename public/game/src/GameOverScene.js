// GameOverScene — shows final score, stats, share prompt
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  init(data) {
    this.finalScore  = data.score     || 0;
    this.maxCombo    = data.maxCombo  || 0;
    this.cityReached = data.city      || 'Vancouver';
    this.cityFlag    = data.flag      || '🇨🇦';
    this.playerName  = data.name      || 'Player';
    this.distance    = data.distance  || 0;
  }

  create() {
    const { width, height } = this.scale;
    const C = GAME_CONFIG.COLORS;

    // Background
    this.add.rectangle(width/2, height/2, width, height, 0x001224, 0.96);

    // Title
    this.add.text(width/2, height * 0.12, 'WIPED OUT', {
      fontFamily: 'Arial Black', fontSize: '52px', color: '#CC7D51'
    }).setOrigin(0.5);

    this.add.text(width/2, height * 0.20,
      `IN ${this.cityReached.toUpperCase()} ${this.cityFlag}`, {
      fontFamily: 'Arial', fontSize: '12px', color: '#7ba3be',
      letterSpacing: 3
    }).setOrigin(0.5);

    // Stats grid
    const stats = [
      { label: 'SCORE',      value: Math.floor(this.finalScore).toLocaleString() },
      { label: 'BEST COMBO', value: this.maxCombo + 'x'                          },
      { label: 'MADE IT TO', value: this.cityFlag + ' ' + this.cityReached       },
      { label: 'DISTANCE',   value: Math.floor(this.distance / 60) + 'm'         },
    ];

    stats.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = width * (col === 0 ? 0.28 : 0.72);
      const y = height * (0.33 + row * 0.13);

      this.add.rectangle(x, y, width * 0.42, 70, 0x002843)
        .setStrokeStyle(1, 0x1a3a5a);
      this.add.text(x, y - 10, s.value, {
        fontFamily: 'Arial Black', fontSize: '26px', color: '#004777'
      }).setOrigin(0.5);
      this.add.text(x, y + 18, s.label, {
        fontFamily: 'Arial', fontSize: '9px', color: '#7ba3be', letterSpacing: 2
      }).setOrigin(0.5);
    });

    // Share copy
    const shareText = `${this.playerName} scored ${Math.floor(this.finalScore).toLocaleString()} pts in Benji Pays: Invoice Rover! Reached ${this.cityReached}. Can you beat me? 🐕💸 benjipays.com/run`;
    const shareBox = this.add.rectangle(width/2, height * 0.64, width * 0.88, 65, 0x001a2e)
      .setStrokeStyle(1, 0xCC7D51, 0.4);
    this.add.text(width/2, height * 0.64, shareText, {
      fontFamily: 'Arial', fontSize: '11px', color: '#D9B59D',
      wordWrap: { width: width * 0.82 }, align: 'center', lineSpacing: 4
    }).setOrigin(0.5);

    // Run Again button
    const retryBtn = this.add.rectangle(width * 0.30, height * 0.78, width * 0.52, 50, 0xCC7D51)
      .setInteractive({ useHandCursor: true });
    this.add.text(width * 0.30, height * 0.78, 'RUN AGAIN', {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#F8F8F8', letterSpacing: 1
    }).setOrigin(0.5);
    retryBtn.on('pointerdown', () => {
      this.scene.start('StartScene');
    });

    // Share button
    const shareBtn = this.add.rectangle(width * 0.72, height * 0.78, width * 0.38, 50, 0x002843)
      .setStrokeStyle(1, 0x3a5a7a)
      .setInteractive({ useHandCursor: true });
    this.add.text(width * 0.72, height * 0.78, 'SHARE 🔗', {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#F8F8F8', letterSpacing: 1
    }).setOrigin(0.5);
    shareBtn.on('pointerdown', () => {
      if (navigator.share) {
        navigator.share({ text: shareText }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(shareText)
          .then(() => alert('Copied to clipboard!'))
          .catch(() => alert(shareText));
      }
    });
  }
}
