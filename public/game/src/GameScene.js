// ─────────────────────────────────────────────────────
//  GAME SCENE — BENJI PAYS: INVOICE ROVER
//  Core runner loop — Phaser 3
// ─────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.playerName   = data.playerName  || 'Player';
    this.playerEmail  = data.playerEmail || '';
    this.score        = 0;
    this.combo        = 0;
    this.maxCombo     = 0;
    this.multiplier   = 1;
    this.currentLane  = 1;
    this.targetLane   = 1;
    this.isAlive      = true;
    this.clutchUsed   = false;
    this.isClutch     = false;
    this.clutchTimer  = 0;
    this.cityIndex    = 0;
    this.isNight      = false;
    this.distance     = 0;
    this.scoreTimer   = 0;
    this.spawnTimer   = 0;
    this.colSpawnTimer= 0;
    this.puSpawnTimer = 0;
    this.graceTimer   = 0;
    this.isGrace      = false;
    this.activePU     = null;
    this.puTimer      = 0;
    this.puWarning    = false;
    this.flashTimer   = 0;
    this.flashVisible = true;
    this.touchStartX  = 0;
    this.obstacles    = [];
    this.collectibles = [];
    this.powerups     = [];
    this.particles    = [];
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const C = GAME_CONFIG.COLORS;

    // ── LAYOUT ──────────────────────────────────────
    const lp  = W * GAME_CONFIG.LANE_PADDING;
    const lw  = (W - lp * 2) / 3;
    this.laneX   = [lp+lw*0+lw/2, lp+lw*1+lw/2, lp+lw*2+lw/2];
    this.groundY = H * 0.80;
    this.W = W; this.H = H;

    // ── BACKGROUND LAYERS ───────────────────────────
    this.bgSky  = this.add.rectangle(W/2, H*0.4,  W, H*0.8, 0x0c1e36);
    this.bgGrd  = this.add.rectangle(W/2, H*0.9,  W, H*0.2, 0x0c1c2e);
    this.bgLine = this.add.rectangle(W/2, this.groundY, W, 2, 0x1a3250);
    this.nightOverlay = this.add.rectangle(W/2, H/2, W, H, 0x000010, 0)
      .setDepth(8);

    // Lane dividers
    this.laneX.forEach((lx, i) => {
      if (i < 2) {
        const div = this.add.rectangle(
          this.laneX[i] + lw/2, this.groundY + H*0.1, 1, H*0.2, 0xffffff, 0.06
        );
      }
    });

    // ── BENJI ───────────────────────────────────────
    this.benjiGroup = this.add.container(this.laneX[1], this.groundY - 26).setDepth(5);
    this.benjiBody  = this.add.rectangle(0, 0, 44, 52, C.CERULEAN).setDepth(5);
    this.benjiHead  = this.add.rectangle(12, -30, 34, 28, C.CERULEAN).setDepth(5);
    this.benjiNose  = this.add.rectangle(26, -28, 12, 10, C.CERULEAN).setDepth(5);
    this.benjiEye   = this.add.circle(18, -34, 4, 0xffffff).setDepth(5);
    this.benjiPupil = this.add.circle(20, -34, 2, 0x111111).setDepth(5);
    this.benjiTail  = this.add.rectangle(-28, -10, 14, 6, C.CERULEAN).setDepth(5);
    this.benjiLeg1  = this.add.rectangle(-10, 28, 10, 18, C.CERULEAN).setDepth(5);
    this.benjiLeg2  = this.add.rectangle(10,  28, 10, 18, C.CERULEAN).setDepth(5);
    this.benjiGroup.add([
      this.benjiBody, this.benjiHead, this.benjiNose,
      this.benjiEye, this.benjiPupil, this.benjiTail,
      this.benjiLeg1, this.benjiLeg2
    ]);
    this.benjiX = this.laneX[1];
    this.benjiGroundY = this.groundY - 26;
    this.benjiY = this.benjiGroundY;
    this.benjiVY = 0;
    this.isJumping = false;

    // Shield ring (hidden until active)
    this.shieldRing = this.add.circle(0, 0, 36, 0x004777, 0)
      .setStrokeStyle(3, 0x004777, 0).setDepth(6);

    // ── HUD ─────────────────────────────────────────
    this.hudScore = this.add.text(14, 14, 'SCORE\n0', {
      fontFamily:'Arial Black', fontSize:'28px', color:'#FFFFFF',
      stroke:'#000000', strokeThickness:3
    }).setDepth(10);

    this.hudCombo = this.add.text(W-14, 14, '', {
      fontFamily:'Arial Black', fontSize:'14px', color:'#4DC97A',
      stroke:'#000000', strokeThickness:2, align:'right'
    }).setOrigin(1, 0).setDepth(10).setVisible(false);

    this.hudMulti = this.add.text(W-14, 48, '', {
      fontFamily:'Arial Black', fontSize:'12px', color:'#CC7D51',
      stroke:'#000000', strokeThickness:2, align:'right'
    }).setOrigin(1, 0).setDepth(10).setVisible(false);

    // Power-up timer bar
    this.puBarBg = this.add.rectangle(W/2, H-16, W*0.7, 8, 0x001a2e)
      .setDepth(10).setVisible(false);
    this.puBar   = this.add.rectangle(W/2, H-16, W*0.7, 8, 0xCC7D51)
      .setDepth(10).setVisible(false).setOrigin(0.5);

    // City banner
    this.cityBannerBg = this.add.rectangle(W/2, 90, W*0.7, 32, 0x001a2e, 0.85)
      .setDepth(11).setVisible(false)
      .setStrokeStyle(1, 0x3a5a7a);
    this.cityBannerText = this.add.text(W/2, 90, '', {
      fontFamily:'Arial Black', fontSize:'13px', color:'#FFFFFF', letterSpacing:2
    }).setOrigin(0.5).setDepth(11).setVisible(false);

    // Score pop container
    this.scorePops = [];

    // ── INPUT ───────────────────────────────────────
    this.input.on('pointerdown', p => { this.touchStartX = p.x; });
    this.input.on('pointerup', p => {
      const dx = p.x - this.touchStartX;
      const dy = p.y - (p.downY || p.y);
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy||0)) {
        if (dx > 0 && this.targetLane < 2) this.targetLane++;
        else if (dx < 0 && this.targetLane > 0) this.targetLane--;
      } else if (!this.isJumping) {
        this.doJump();
      }
    });
    this.input.keyboard.on('keydown-LEFT',  () => { if(this.targetLane>0) this.targetLane--; });
    this.input.keyboard.on('keydown-RIGHT', () => { if(this.targetLane<2) this.targetLane++; });
    this.input.keyboard.on('keydown-UP',    () => { if(!this.isJumping) this.doJump(); });
    this.input.keyboard.on('keydown-SPACE', () => { if(!this.isJumping) this.doJump(); });

    // ── GAMEPAD ────────────────────────────────────
    this.padPrevLeft  = false;
    this.padPrevRight = false;
    this.padPrevJump  = false;
  }

  // ── JUMP ──────────────────────────────────────────
  doJump() {
    this.isJumping = true;
    this.benjiVY   = GAME_CONFIG.JUMP_VELOCITY * 0.016;
  }

  // ── SPEED ─────────────────────────────────────────
  getSpeed() {
    const cfg = GAME_CONFIG;
    const t   = Math.min(this.score / cfg.SPEED_RAMP, 1);
    const spd = cfg.SPEED_START + t * (cfg.SPEED_MAX - cfg.SPEED_START);
    return (this.activePU === 'BOOST') ? spd * cfg.BOOST_SPEED_MULT : spd;
  }

  // ── SPAWN HELPERS ─────────────────────────────────
  spawnObstacle() {
    const n = Math.random() < 0.28 ? 2 : 1;
    const lanes = [0,1,2].sort(() => Math.random()-0.5).slice(0, n);
    const types = [
      { label:'📄', color:0xE84040, name:'CHECK'   },
      { label:'⚠️', color:0xff8800, name:'OVERDUE'  },
      { label:'😤', color:0xff5555, name:'CLIENT'   },
    ];
    const t = types[Math.floor(Math.random()*types.length)];
    lanes.forEach(lane => {
      const x = this.laneX[lane];
      const body = this.add.rectangle(x, -40, 38, 38, t.color, 0.9).setDepth(4);
      const label = this.add.text(x, -40, t.label, {fontSize:'22px'}).setOrigin(0.5).setDepth(4);
      const badge = this.add.text(x, -62, '❌ DODGE', {
        fontFamily:'Arial', fontSize:'9px', color:'#FFFFFF',
        backgroundColor:'#E84040', padding:{x:4,y:2}
      }).setOrigin(0.5).setDepth(4);
      this.obstacles.push({ body, label, badge, lane, alive:true });
    });
  }

  spawnCollectible() {
    const lane = Math.floor(Math.random()*3);
    const types = [
      { label:'💸', color:0x4DC97A, pts:20, name:'ACH'    },
      { label:'⚡', color:0x4DC97A, pts:30, name:'INSTANT' },
      { label:'💵', color:0x4DC97A, pts:15, name:'DOLLAR'  },
      { label:'🔄', color:0x4DC97A, pts:25, name:'AUTOPAY' },
    ];
    const t = types[Math.floor(Math.random()*types.length)];
    const x = this.laneX[lane];
    const glow  = this.add.circle(x, -40, 22, 0x4DC97A, 0.18).setDepth(3);
    const emoji = this.add.text(x, -40, t.label, {fontSize:'24px'}).setOrigin(0.5).setDepth(4);
    const badge = this.add.text(x, -62, '✅ COLLECT', {
      fontFamily:'Arial', fontSize:'9px', color:'#FFFFFF',
      backgroundColor:'#4DC97A', padding:{x:4,y:2}
    }).setOrigin(0.5).setDepth(4);
    this.collectibles.push({ glow, emoji, badge, lane, alive:true, wobble:Math.random()*Math.PI*2, pts:t.pts });
  }

  spawnPowerup() {
    const lane = Math.floor(Math.random()*3);
    const types = [
      { label:'🛡️', color:0x004777, name:'SHIELD', text:'AUTO-PAY SHIELD'  },
      { label:'⚡', color:0xf5c842, name:'BOOST',  text:'INSTANT PAY BOOST' },
      { label:'💰', color:0xCC7D51, name:'PAID',   text:'PAID IN FULL'      },
      { label:'💫', color:0x4DC97A, name:'STREAK', text:'PAYMENT STREAK'    },
    ];
    const t = types[Math.floor(Math.random()*types.length)];
    const x = this.laneX[lane];
    const ring  = this.add.circle(x, -50, 26, t.color, 0.15).setStrokeStyle(2, t.color, 0.6).setDepth(3);
    const emoji = this.add.text(x, -50, t.label, {fontSize:'28px'}).setOrigin(0.5).setDepth(4);
    const badge = this.add.text(x, -76, '⚡ POWER-UP', {
      fontFamily:'Arial', fontSize:'9px', color:'#FFFFFF',
      backgroundColor:'#CC7D51', padding:{x:4,y:2}
    }).setOrigin(0.5).setDepth(4);
    this.powerups.push({ ring, emoji, badge, lane, alive:true, type:t, pulse:0 });
  }

  // ── POWER-UP ACTIVATION ───────────────────────────
  activatePowerup(type) {
    const cfg = GAME_CONFIG;
    this.activePU  = type.name;
    this.puWarning = false;
    this.flashVisible = true;

    if (type.name === 'PAID') {
      // Instant clear — no duration
      this.clearObstacles();
      this.activePU = null;
      this.showPUBanner(type.text, '#CC7D51');
      return;
    }

    this.puTimer = cfg.POWERUP_DURATIONS[type.name];
    this.puBarBg.setVisible(true);
    this.puBar.setVisible(true);
    this.activateNight();
    this.showPUBanner(type.text, type.name === 'SHIELD' ? '#004777' :
      type.name === 'BOOST' ? '#f5c842' : '#4DC97A');

    if (type.name === 'SHIELD') {
      this.shieldRing.setVisible(true).setStrokeStyle(3, 0x004777, 0.6);
    }
  }

  activateNight() {
    this.isNight = !this.isNight;
    this.tweens.add({
      targets: this.nightOverlay,
      alpha: this.isNight ? 0.5 : 0,
      duration: 800, ease: 'Linear'
    });
    this.updateCityColors();
  }

  clearObstacles() {
    this.obstacles.forEach(o => {
      if (!o.alive) return;
      o.alive = false;
      this.burst(o.body.x, o.body.y, 0xE84040, 8);
      o.body.destroy(); o.label.destroy(); o.badge.destroy();
    });
    this.obstacles = this.obstacles.filter(o => o.alive);
  }

  showPUBanner(text, color) {
    const W = this.W, H = this.H;
    const banner = this.add.text(W/2, H*0.42, text, {
      fontFamily:'Arial Black', fontSize:'22px', color,
      stroke:'#000000', strokeThickness:3, letterSpacing:2
    }).setOrigin(0.5).setDepth(12).setAlpha(0);
    this.tweens.add({
      targets:banner, alpha:1, y:H*0.38, duration:300,
      onComplete:() => {
        this.time.delayedCall(1800, () => {
          this.tweens.add({ targets:banner, alpha:0, duration:400,
            onComplete:() => banner.destroy() });
        });
      }
    });
  }

  // ── CITY TRANSITION ───────────────────────────────
  checkCityChange() {
    const cfg = GAME_CONFIG;
    const newIdx = cfg.CITIES.reduce((acc,c,i) => this.score>=c.threshold ? i : acc, 0);
    if (newIdx !== this.cityIndex) {
      this.cityIndex = newIdx;
      this.isGrace   = true;
      this.graceTimer = GAME_CONFIG.GRACE_PERIOD_MS;
      this.updateCityColors();
      this.showCityBanner(cfg.CITIES[newIdx]);
    }
  }

  updateCityColors() {
    const city = GAME_CONFIG.CITIES[this.cityIndex];
    const darken = (hex, f) => {
      const r = ((hex>>16)&0xff), g = ((hex>>8)&0xff), b = (hex&0xff);
      return ((Math.round(r*(1-f))<<16)|(Math.round(g*(1-f))<<8)|Math.round(b*(1-f)));
    };
    const accent = parseInt(city.accent.replace('#',''), 16);
    this.benjiBody.setFillStyle(accent);
    this.benjiHead.setFillStyle(accent);
    this.benjiNose.setFillStyle(accent);
    this.benjiTail.setFillStyle(accent);
    this.benjiLeg1.setFillStyle(accent);
    this.benjiLeg2.setFillStyle(accent);
  }

  showCityBanner(city) {
    this.cityBannerText.setText(city.flag + '  ' + city.name.toUpperCase());
    this.cityBannerBg.setVisible(true);
    this.cityBannerText.setVisible(true);
    this.time.delayedCall(2800, () => {
      this.cityBannerBg.setVisible(false);
      this.cityBannerText.setVisible(false);
    });
  }

  // ── PARTICLE BURST ────────────────────────────────
  burst(x, y, color, count=8) {
    for (let i=0; i<count; i++) {
      const angle = (Math.PI*2*i)/count + Math.random()*0.4;
      const speed = 80 + Math.random()*120;
      const p = this.add.circle(x, y, 3+Math.random()*3, color, 1).setDepth(7);
      this.tweens.add({
        targets:p, x:x+Math.cos(angle)*speed, y:y+Math.sin(angle)*speed-60,
        alpha:0, duration:700+Math.random()*300, ease:'Cubic.easeOut',
        onComplete:()=>p.destroy()
      });
    }
  }

  // ── SCORE POP ─────────────────────────────────────
  scorePop(x, y, text) {
    const pop = this.add.text(x, y, text, {
      fontFamily:'Arial Black', fontSize:'20px', color:'#4DC97A',
      stroke:'#000000', strokeThickness:2
    }).setOrigin(0.5).setDepth(9);
    this.tweens.add({
      targets:pop, y:y-60, alpha:0, duration:900, ease:'Cubic.easeOut',
      onComplete:()=>pop.destroy()
    });
  }

  // ── HIT HANDLING ──────────────────────────────────
  handleHit() {
    if (this.activePU === 'SHIELD') {
      // Shield absorbs hit
      this.burst(this.benjiX, this.benjiY, 0x004777, 6);
      return;
    }
    if (!this.clutchUsed) {
      // Clutch save — first hit
      this.clutchUsed = true;
      this.isClutch   = true;
      this.clutchTimer = GAME_CONFIG.CLUTCH_INVINCIBILITY_MS;
      this.combo = 0; this.multiplier = 1;
      this.updateHUD();
      // Flash red briefly
      this.cameras.main.flash(300, 232, 64, 64, true);
      this.burst(this.benjiX, this.benjiY, 0xE84040, 6);
    } else {
      // Second hit — game over
      this.endGame();
    }
  }

  endGame() {
    this.isAlive = false;
    this.cameras.main.flash(500, 232, 64, 64);
    this.time.delayedCall(600, () => {
      this.scene.start('GameOverScene', {
        score:    this.score,
        maxCombo: this.maxCombo,
        city:     GAME_CONFIG.CITIES[this.cityIndex].name,
        flag:     GAME_CONFIG.CITIES[this.cityIndex].flag,
        name:     this.playerName,
        email:    this.playerEmail,
        distance: this.distance,
      });
    });
  }

  // ── HUD UPDATE ────────────────────────────────────
  updateHUD() {
    this.hudScore.setText('SCORE\n' + Math.floor(this.score).toLocaleString());
    if (this.combo > 0) {
      this.hudCombo.setText('🔥 ' + this.combo + ' COMBO').setVisible(true);
    } else {
      this.hudCombo.setVisible(false);
    }
    if (this.multiplier > 1) {
      this.hudMulti.setText(this.multiplier + '× MULTIPLIER').setVisible(true);
    } else {
      this.hudMulti.setVisible(false);
    }
  }

  // ── MAIN UPDATE LOOP ──────────────────────────────
  update(time, delta) {
    if (!this.isAlive) return;
    const cfg = GAME_CONFIG;
    const spd = this.getSpeed();
    const pxPerMs = spd / 1000;
    const move = pxPerMs * delta;

    // ── Gamepad Polling ──────────────────────────
    if (this.input.gamepad && this.input.gamepad.total > 0) {
      const pad = this.input.gamepad.getPad(0);
      if (pad) {
        const DEADZONE = 0.3;

        // Left stick X
        const stickLeft  = pad.leftStick.x < -DEADZONE;
        const stickRight = pad.leftStick.x >  DEADZONE;

        // LB (4) / RB (5) — digital buttons
        const lb = pad.buttons[4] && pad.buttons[4].pressed;
        const rb = pad.buttons[5] && pad.buttons[5].pressed;

        // LT (6) / RT (7) — may be analog or digital
        const lt = pad.buttons[6] && (pad.buttons[6].pressed || pad.buttons[6].value > 0.3);
        const rt = pad.buttons[7] && (pad.buttons[7].pressed || pad.buttons[7].value > 0.3);

        const wantLeft  = stickLeft  || lb || lt;
        const wantRight = stickRight || rb || rt;

        // Edge-triggered lane changes
        if (wantLeft && !this.padPrevLeft && this.targetLane > 0) this.targetLane--;
        if (wantRight && !this.padPrevRight && this.targetLane < 2) this.targetLane++;
        this.padPrevLeft  = wantLeft;
        this.padPrevRight = wantRight;

        // Jump: A (0) for Xbox, X (3) for Tata — both active
        const jumpPressed = (pad.buttons[0] && pad.buttons[0].pressed) ||
                            (pad.buttons[3] && pad.buttons[3].pressed);
        if (jumpPressed && !this.padPrevJump && !this.isJumping) this.doJump();
        this.padPrevJump = jumpPressed;
      }
    }

    // ── Benji X ──────────────────────────────────
    const targetX = this.laneX[this.targetLane];
    this.benjiX += (targetX - this.benjiX) * 0.15;
    this.benjiGroup.x = this.benjiX;

    // ── Benji Jump ───────────────────────────────
    if (this.isJumping) {
      this.benjiVY += (cfg.GRAVITY / 1000) * delta;
      this.benjiY  += this.benjiVY * delta;
      if (this.benjiY >= this.benjiGroundY) {
        this.benjiY   = this.benjiGroundY;
        this.benjiVY  = 0;
        this.isJumping = false;
      }
    } else {
      this.benjiY = this.benjiGroundY;
    }
    this.benjiGroup.y = this.benjiY;

    // ── Benji Animate ────────────────────────────
    const bounce = this.isJumping ? 0 : Math.sin(time * 0.008) * 2;
    this.benjiBody.y = bounce;
    this.benjiLeg1.y = 28 + (this.isJumping ? 0 : Math.sin(time*0.012)*6);
    this.benjiLeg2.y = 28 + (this.isJumping ? 0 : Math.sin(time*0.012+Math.PI)*6);
    this.benjiTail.rotation = Math.sin(time*0.01)*0.3;

    // Shield ring follows Benji
    this.shieldRing.x = this.benjiX;
    this.shieldRing.y = this.benjiY;
    if (this.activePU === 'SHIELD') {
      this.shieldRing.setStrokeStyle(3, 0x004777, 0.4+Math.sin(time*0.008)*0.3);
    }

    // ── Flash (clutch / power-up warning) ────────
    if (this.isClutch || this.puWarning) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        this.flashTimer   = cfg.POWERUP_FLASH_RATE_MS;
        this.flashVisible = !this.flashVisible;
        this.benjiGroup.setAlpha(this.flashVisible ? 1 : 0.2);
      }
    } else {
      this.benjiGroup.setAlpha(1);
    }

    // ── Clutch timer ─────────────────────────────
    if (this.isClutch) {
      this.clutchTimer -= delta;
      if (this.clutchTimer <= 0) { this.isClutch = false; this.benjiGroup.setAlpha(1); }
    }

    // ── Grace period ─────────────────────────────
    if (this.isGrace) {
      this.graceTimer -= delta;
      if (this.graceTimer <= 0) this.isGrace = false;
    }

    // ── Power-up timer ───────────────────────────
    if (this.activePU && this.activePU !== 'PAID') {
      this.puTimer -= delta;
      const total = cfg.POWERUP_DURATIONS[this.activePU];
      const pct   = Math.max(this.puTimer / total, 0);
      this.puBar.setScale(pct, 1);
      this.puBar.setFillStyle(pct < 0.3 ? 0xE84040 : 0xCC7D51);

      if (this.puTimer <= cfg.POWERUP_WARNING_MS && !this.puWarning) {
        this.puWarning  = true;
        this.flashTimer = cfg.POWERUP_FLASH_RATE_MS;
      }
      if (this.puTimer <= 0) {
        this.activePU  = null;
        this.puWarning = false;
        this.flashVisible = true;
        this.benjiGroup.setAlpha(1);
        this.puBarBg.setVisible(false);
        this.puBar.setVisible(false);
        this.shieldRing.setStrokeStyle(0);
        if (this.isNight) this.activateNight();
      }
    }

    // ── Score ────────────────────────────────────
    this.scoreTimer += delta;
    if (this.scoreTimer >= 100) {
      const pts = cfg.SCORE_PER_SECOND * 0.1 * this.multiplier *
                  (this.activePU==='STREAK' ? cfg.STREAK_POINTS_MULT : 1);
      this.score       += pts;
      this.distance    += move * 10;
      this.scoreTimer   = 0;
      this.updateHUD();
      this.checkCityChange();
    }

    // ── Spawn ────────────────────────────────────
    const spawnRate = Math.max(1400 - this.score*0.06, 600);
    this.spawnTimer += delta;
    if (this.spawnTimer >= spawnRate) { this.spawnTimer=0; if(!this.isGrace) this.spawnObstacle(); }

    const colRate = Math.max(1000 - this.score*0.04, 500);
    this.colSpawnTimer += delta;
    if (this.colSpawnTimer >= colRate) { this.colSpawnTimer=0; this.spawnCollectible(); }

    this.puSpawnTimer += delta;
    if (this.puSpawnTimer >= 9000) { this.puSpawnTimer=0; this.spawnPowerup(); }

    // ── Move objects ─────────────────────────────
    const HR = 28; // Benji hit radius

    this.obstacles = this.obstacles.filter(o => {
      if (!o.alive) return false;
      o.body.y  += move; o.label.y += move; o.badge.y += move;
      // Collision
      if (!this.isClutch && o.body.y > this.benjiY-40 && o.body.y < this.benjiY+40 &&
          Math.abs(o.body.x - this.benjiX) < HR+16) {
        o.alive = false;
        this.burst(o.body.x, o.body.y, 0xE84040, 8);
        o.body.destroy(); o.label.destroy(); o.badge.destroy();
        this.handleHit();
        return false;
      }
      if (o.body.y > this.H+60) {
        o.body.destroy(); o.label.destroy(); o.badge.destroy();
        return false;
      }
      return true;
    });

    this.collectibles = this.collectibles.filter(c => {
      if (!c.alive) return false;
      c.glow.y  += move; c.emoji.y += move; c.badge.y += move;
      c.wobble  += 0.06;
      c.emoji.x  = this.laneX[c.lane] + Math.sin(c.wobble)*3;
      c.glow.x   = c.emoji.x;
      // Collision
      if (c.emoji.y > this.benjiY-40 && c.emoji.y < this.benjiY+40 &&
          Math.abs(c.emoji.x - this.benjiX) < HR+18) {
        c.alive = false;
        const pts = c.pts * this.multiplier *
                    (this.activePU==='STREAK' ? cfg.STREAK_POINTS_MULT : 1);
        this.score  += pts;
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        if (this.combo >= cfg.COMBO_MULTIPLIER_AT)
          this.multiplier = Math.min(Math.floor(this.combo/cfg.COMBO_MULTIPLIER_AT)+1, cfg.MULTIPLIER_MAX);
        if (this.combo >= cfg.COMBO_SHIELD_AT && this.activePU !== 'SHIELD') {
          this.activatePowerup({ name:'SHIELD', text:'COMBO SHIELD!' });
        }
        if (this.activePU === 'STREAK') this.puTimer += cfg.STREAK_EXTEND_MS;
        this.burst(c.emoji.x, c.emoji.y, 0x4DC97A, 6);
        this.scorePop(c.emoji.x, c.emoji.y, '+'+Math.floor(pts));
        this.updateHUD();
        c.glow.destroy(); c.emoji.destroy(); c.badge.destroy();
        return false;
      }
      if (c.emoji.y > this.H+60) {
        // Missed collectible — reset combo
        this.combo=0; this.multiplier=1; this.updateHUD();
        c.glow.destroy(); c.emoji.destroy(); c.badge.destroy();
        return false;
      }
      return true;
    });

    this.powerups = this.powerups.filter(p => {
      if (!p.alive) return false;
      p.ring.y  += move; p.emoji.y += move; p.badge.y += move;
      p.pulse   += 0.08;
      const sc   = 1 + Math.sin(p.pulse)*0.07;
      p.emoji.setScale(sc);
      // Collision
      if (p.emoji.y > this.benjiY-50 && p.emoji.y < this.benjiY+40 &&
          Math.abs(p.ring.x - this.benjiX) < HR+22) {
        p.alive = false;
        this.activatePowerup(p.type);
        this.burst(p.ring.x, p.ring.y, 0xCC7D51, 12);
        p.ring.destroy(); p.emoji.destroy(); p.badge.destroy();
        return false;
      }
      if (p.emoji.y > this.H+60) {
        p.ring.destroy(); p.emoji.destroy(); p.badge.destroy();
        return false;
      }
      return true;
    });
  }
}
