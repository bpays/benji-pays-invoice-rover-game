// Benji Pays: Invoice Rover — Phaser 3 Entry Point

const SUPABASE_URL = '';  // Add when ready
const SUPABASE_KEY = '';  // Add when ready

const config = {
  type: Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#002843',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [ BootScene, StartScene, GameScene, GameOverScene ]
};

const game = new Phaser.Game(config);
