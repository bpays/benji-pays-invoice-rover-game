// Benji Pays: Invoice Rover — Phaser 3 Entry Point

const SUPABASE_URL = 'https://wowzqjrvmgkcustjdxpo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvd3pxanJ2bWdrY3VzdGpkeHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODA5NTYsImV4cCI6MjA5MTE1Njk1Nn0.f5Pvand0Ov_dhqvateUr_fBw_feT8NGRcym9vdMUdyo';

const config = {
  type: Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#002843',
  input: {
    gamepad: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [ BootScene, StartScene, GameScene, GameOverScene ]
};

const game = new Phaser.Game(config);
