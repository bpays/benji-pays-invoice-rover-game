// ─────────────────────────────────────────────────────
//  GAME CONFIG — BENJI PAYS: INVOICE ROVER
//  All tunable values live here. Never hardcode in scenes.
// ─────────────────────────────────────────────────────

const GAME_CONFIG = {

  // ── LANES ──────────────────────────────────────────
  LANE_COUNT:   3,
  LANE_PADDING: 0.1,   // % of screen width each side

  // ── SPEED ──────────────────────────────────────────
  SPEED_START:  220,   // px/sec at score 0
  SPEED_MAX:    500,   // px/sec at Cyber City
  SPEED_RAMP:   13500, // score at which max speed is reached
  SPEED_ENDLESS_GAIN: 3,  // extra px/sec per 1000 score beyond SPEED_RAMP
  SPEED_ENDLESS_CAP:  620, // absolute max speed (endless)

  // ── PHYSICS ────────────────────────────────────────
  GRAVITY:      800,
  JUMP_VELOCITY: -650,

  // ── SCORING ────────────────────────────────────────
  SCORE_PER_SECOND:  8,
  COLLECT_POINTS: {
    ACH:      20,
    INSTANT:  30,
    DOLLAR:   15,
    AUTOPAY:  25,
  },

  // ── COMBO ──────────────────────────────────────────
  COMBO_MULTIPLIER_AT:  3,   // combos before multiplier kicks in
  COMBO_SHIELD_AT:     10,   // consecutive collects = free shield
  MULTIPLIER_MAX:       4,

  // ── CLUTCH SAVE ────────────────────────────────────
  CLUTCH_INVINCIBILITY_MS: 1200,  // ms of invincibility after first hit

  // ── CITY GRACE PERIOD ──────────────────────────────
  GRACE_PERIOD_MS: 3000,  // ms of no obstacles on city change

  // ── POWER-UPS ──────────────────────────────────────
  POWERUP_DURATIONS: {
    SHIELD:  15000,  // ms
    BOOST:   12000,  // ms
    STREAK:  15000,  // ms
    PAID:    0,      // instant — no duration
  },
  POWERUP_WARNING_MS:    4000,   // ms before end to start flashing
  POWERUP_FLASH_RATE_MS:  330,   // ms per flash (3x per second)
  BOOST_SPEED_MULT:       1.6,
  STREAK_POINTS_MULT:     2,
  STREAK_EXTEND_MS:       500,   // ms added per collect during streak

  // ── CITIES ─────────────────────────────────────────
  CITIES: [
    { name: 'Vancouver',   flag: '🇨🇦', threshold: 0,     accent: '#004777' },
    { name: 'Toronto',     flag: '🇨🇦', threshold: 1500,  accent: '#3a7bd5' },
    { name: 'Montreal',    flag: '🇨🇦', threshold: 3000,  accent: '#9b59b6' },
    { name: 'Dallas',      flag: '🤠',  threshold: 4500,  accent: '#c45c10' },
    { name: 'New York',    flag: '🗽',  threshold: 6000,  accent: '#f0c040' },
    { name: 'Los Angeles', flag: '🌴',  threshold: 7500,  accent: '#b040ff' },
    { name: 'Miami',       flag: '🌊',  threshold: 9000,  accent: '#00c8aa' },
    { name: 'London',      flag: '🇬🇧', threshold: 10500, accent: '#4488ff' },
    { name: 'Australia',   flag: '🇦🇺', threshold: 12000, accent: '#00aadd' },
    { name: 'Cyber City',  flag: '🤖',  threshold: 13500, accent: '#00ffcc' },
  ],

  // ── BRAND ──────────────────────────────────────────
  COLORS: {
    CERULEAN:  0x004777,
    CHARCOAL:  0x002843,
    COOPER:    0xCC7D51,
    CAMEO:     0xD9B59D,
    WHITE:     0xF8F8F8,
    GOOD:      0x4DC97A,
    BAD:       0xE84040,
  },

};
