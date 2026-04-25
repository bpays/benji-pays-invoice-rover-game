// Benji Pays: Invoice Rover — Phaser 3 Entry Point

const SUPABASE_URL = 'https://wowzqjrvmgkcustjdxpo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvd3pxanJ2bWdrY3VzdGpkeHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODA5NTYsImV4cCI6MjA5MTE1Njk1Nn0.f5Pvand0Ov_dhqvateUr_fBw_feT8NGRcym9vdMUdyo';

// ── PERFORMANCE: cap render resolution ─────────────────
// Phones often report devicePixelRatio of 3, which forces the WebGL canvas to
// render ~9x the pixels of a logical 1x render. That destroys mobile FPS for a
// fast-paced runner. Cap at 1.5x on mobile and 2x on desktop — the game is
// solid colors + emoji, so the visual difference is negligible.
const isCoarsePointer =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(pointer: coarse)').matches;
const dpr = Math.min(
  (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1,
  isCoarsePointer ? 1.5 : 2,
);

// Make this flag globally readable so scenes can scale work to device class.
window.__BP_IS_MOBILE__ = isCoarsePointer;

const config = {
  type: Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#002843',
  // Phaser 3 honors `resolution` only at construction time; we also disable
  // antialias because everything is solid-color shapes + emoji text.
  resolution: dpr,
  antialias: false,
  roundPixels: true,
  // Disable runtime physics (we do our own AABB) — saves a chunk of per-frame
  // work that Phaser otherwise sets up for the default arcade physics system.
  fps: { target: 60, forceSetTimeOut: false },
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
