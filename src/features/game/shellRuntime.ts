// @ts-nocheck
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

const bpProfanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});
function bpProfanityCheck(s: string): boolean {
  try { return bpProfanityMatcher.hasMatch(s); } catch { return false; }
}
let __invoiceRoverGameMounted = false;
let __unmountGameShell = function noop() {};
export function resetInvoiceRoverGameMount(): void {
  try {
    __unmountGameShell();
  } catch (e) {
    console.warn('Game shell unmount:', e);
  }
  __unmountGameShell = function noop() {};
  delete (window as unknown as { toggleSoundFromGameOver?: () => void }).toggleSoundFromGameOver;
  delete (window as unknown as { toggleSoundFromStart?: () => void }).toggleSoundFromStart;
  __invoiceRoverGameMounted = false;
}
export function mountInvoiceRoverGame(): void {
  if (__invoiceRoverGameMounted) return;
  __invoiceRoverGameMounted = true;
  const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  let activeEventTag = 'general';
  (async function loadActiveEventTag() {
    try {
      const res = await fetch(`${SUPA_URL}/rest/v1/settings?key=eq.active_event&select=value`, {
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
      });
      if (res.ok) {
        const arr = await res.json();
        if (Array.isArray(arr) && arr[0]?.value) activeEventTag = String(arr[0].value).trim() || 'general';
      }
    } catch (e) { /* fall back to 'general' */ }
  })();

async function submitScore(data) {
  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/submit-score`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    let body = {};
    try {
      body = await res.json();
    } catch (_) { /* non-JSON */ }
    if (!res.ok) {
      const msg = body && body.error ? String(body.error) : 'Could not submit.';
      return { ok: false, code: body && body.code, error: msg };
    }
    return { ok: true };
  } catch (e) {
    console.warn('Score submit failed:', e);
    return { ok: false, code: 'network', error: 'Connection problem. Try again.' };
  }
}

async function supaSelect(table, params='') {
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`
      }
    });
    return res.ok ? await res.json() : [];
  } catch(e) { console.warn('Supabase select failed:', e); return []; }
}

/** Keep hostnames in sync with supabase/functions/submit-score/index.ts */
const BP_BLOCKED_EMAIL_DOMAINS = new Set([
  'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','yahoo.ca','yahoo.fr','yahoo.de',
  'hotmail.com','hotmail.co.uk','outlook.com','live.com','msn.com','icloud.com','me.com','mac.com',
  'aol.com','protonmail.com','proton.me','pm.me','gmx.com','gmx.de','gmx.net','mail.com',
  'yandex.com','yandex.ru','qq.com','163.com','126.com','sina.com','inbox.com','hey.com',
  'fastmail.com','tutanota.com','tutanota.de','mailfence.com'
]);
const BP_RESERVED_NAME_TOKENS = new Set([
  'anonymous','admin','administrator','moderator','mod','root','null','undefined','benjipays','support','official'
]);
const BP_NAME_ALLOWED = /^[\p{L}\p{M}0-9\s.'-]+$/u;
const BP_MIN_NAME = 2;
const BP_MAX_NAME = 30;

// Profanity matcher is now bundled (see top of file). No async loader needed.

async function validatePlayerForm() {
  const nameRaw = document.getElementById('playerName').value;
  const emailRaw = document.getElementById('playerEmail').value;
  let name = nameRaw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (name.length < BP_MIN_NAME) {
    return { ok: false, error: 'Please enter your name (at least 2 characters).' };
  }
  if (name.length > BP_MAX_NAME) {
    return { ok: false, error: 'Name is too long.' };
  }
  if (!BP_NAME_ALLOWED.test(name)) {
    return { ok: false, error: "Name can only use letters, numbers, spaces, and . ' -" };
  }
  const nl = name.toLowerCase();
  if (nl.includes('http') || nl.includes('www.') || nl.includes('://') || nl.includes('<') || nl.includes('>') || nl.includes('@') || /[\r\n]/.test(name)) {
    return { ok: false, error: 'That name isn’t allowed.' };
  }
  if (/(.)\1{7,}/u.test(name)) {
    return { ok: false, error: 'That name isn’t allowed.' };
  }
  const lettersDigits = name.replace(/[^\p{L}\p{M}0-9]/gu, '');
  if (lettersDigits.length > 0 && /^\d+$/u.test(lettersDigits)) {
    return { ok: false, error: 'Please use your real name.' };
  }
  const tokens = name.toLowerCase().split(/[^\p{L}\p{M}0-9]+/u).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    if (BP_RESERVED_NAME_TOKENS.has(tokens[i])) {
      return { ok: false, error: 'That name isn’t allowed.' };
    }
  }
  if (bpProfanityCheck(name)) {
    return { ok: false, error: 'That name isn’t allowed.' };
  }
  const email = emailRaw.trim();
  if (!email) {
    return { ok: false, error: 'Please enter your work email.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'That email doesn’t look valid.' };
  }
  const at = email.lastIndexOf('@');
  const domain = at > 0 ? email.slice(at + 1).toLowerCase().trim() : '';
  if (BP_BLOCKED_EMAIL_DOMAINS.has(domain)) {
    return { ok: false, error: 'Please use your work email, not Gmail, Yahoo, etc.' };
  }
  return { ok: true, name: name, email: email };
}

function showStartFormError(msg) {
  const el = document.getElementById('startFormError');
  el.textContent = msg;
  el.style.display = 'block';
}
function clearStartFormError() {
  const el = document.getElementById('startFormError');
  el.textContent = '';
  el.style.display = 'none';
}

// Track if player lead already captured this session
let leadCaptured = false;
let playerId = null; // store player's score row id for later
let currentRunId = null; // server-issued run id linking start → game over

const canvas=document.getElementById('gameCanvas'),ctx=canvas.getContext('2d'),wrap=document.getElementById('gameWrap');
// Mobile/coarse-pointer detection — used to throttle GPU/fillrate cost (DPR cap, no canvas shadows).
const __BP_IS_MOBILE = (typeof window!=='undefined' && typeof window.matchMedia==='function')
  ? window.matchMedia('(pointer: coarse)').matches : false;
function resizeCanvas(){
  const rawDpr = window.devicePixelRatio || 1;
  // Cap backing-store DPR: 1.5 on coarse-pointer (phones/tablets), 2 on desktop.
  // Major win on Retina phones where 3x DPR means ~9x the pixels to fill each frame.
  const dprCap = __BP_IS_MOBILE ? 1.5 : 2;
  const dpr = Math.min(rawDpr, dprCap);
  const w=wrap.clientWidth;const h=wrap.clientHeight;
  canvas.width=w*dpr;canvas.height=h*dpr;
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
let __lastScoreText = -1;
let __scorePopCount = 0;
function onWindowResize() {
  resizeCanvas();
  updateGameBleedShades();
  syncGameBleedImage();
}
window.addEventListener('resize', onWindowResize);
const onWinKeydownGame=e=>{if(state!=='playing')return;if(e.key==='ArrowLeft'||e.key==='a'){if(targetLane>0)targetLane--;}if(e.key==='ArrowRight'||e.key==='d'){if(targetLane<2)targetLane++;}if((e.key==='ArrowUp'||e.key==='w'||e.key===' ')&&!isJumping)doJump();};
window.addEventListener('keydown',onWinKeydownGame);

const B={cerulean:'#004777',charcoal:'#002843',cooper:'#CC7D51',cameo:'#D9B59D',white:'#F8F8F8',good:'#4DC97A',bad:'#E84040',goodGlow:'rgba(77,201,122,.55)',badGlow:'rgba(232,64,64,.55)',puGlow:'rgba(204,125,81,.65)'};

/* Score thresholds: equal steps, Cyber City at 60,000. */
const CITIES=[
  {name:'Vancouver',  flag:'🇨🇦',t:0,     sky:['#0c1e36','#183450'],ground:'#0c1c2e',accent:B.cerulean, gl:'#1a3250'},
  {name:'Toronto',    flag:'🇨🇦',t:6667,  sky:['#0e1a2e','#1a2c44'],ground:'#0a1420',accent:'#3a7bd5',  gl:'#1a3050'},
  {name:'Montreal',   flag:'🇨🇦',t:13333, sky:['#1a1028','#2a1840'],ground:'#100a1c',accent:'#9b59b6',  gl:'#2a1840'},
  {name:'Dallas',     flag:'🤠', t:20000, sky:['#28180a','#3a2410'],ground:'#18100a',accent:'#c45c10',  gl:'#442e12'},
  {name:'New York',   flag:'🗽', t:26667, sky:['#0a0e1a','#141e30'],ground:'#080c14',accent:'#f0c040',  gl:'#1a2030'},
  {name:'Los Angeles',flag:'🌴', t:33333, sky:['#180848','#280e5e'],ground:'#100630',accent:'#b040ff',  gl:'#280e5c'},
  {name:'Miami',      flag:'🌊', t:40000, sky:['#0a1828','#102038'],ground:'#081018',accent:'#00c8aa',  gl:'#0a2030'},
  {name:'London',     flag:'🇬🇧',t:46667, sky:['#0c1016','#141c24'],ground:'#080c12',accent:'#4488ff',  gl:'#1c2836'},
  {name:'Australia',  flag:'🇦🇺',t:53333, sky:['#062c4c','#0a3c5c'],ground:'#041c30',accent:'#00aadd',  gl:'#0a3050'},
  {name:'Cyber City', flag:'🤖', t:60000, sky:['#000a08','#001814'],ground:'#000806',accent:'#00ffcc',  gl:'#003828'},
];
const getCity=s=>{for(let i=CITIES.length-1;i>=0;i--)if(s>=CITIES[i].t)return CITIES[i];return CITIES[0];};

const isNarrowForBleed = function () { return window.matchMedia('(max-width: 600px)').matches; };
function playfieldWidthPx() {
  const vh = window.innerHeight;
  return Math.min(window.innerWidth, (vh * 420) / 780);
}
function updateGameBleedShades() {
  const l = document.getElementById('gameSideShadeL');
  const r = document.getElementById('gameSideShadeR');
  if (!l || !r) return;
  if (isNarrowForBleed()) {
    l.style.width = '0';
    r.style.width = '0';
    return;
  }
  const side = Math.max(0, (window.innerWidth - playfieldWidthPx()) / 2);
  l.style.width = side + 'px';
  r.style.width = side + 'px';
}
function syncGameBleedImage() {
  const el = document.getElementById('gameViewportBg');
  if (!el) return;
  if (isNarrowForBleed()) {
    el.style.backgroundImage = '';
    return;
  }
  el.style.backgroundImage = '';
}

// City skyline data for parallax
const SKY={
  'Vancouver':[{x:.05,w:.04,h:.35,t:'pointed'},{x:.12,w:.06,h:.28},{x:.2,w:.035,h:.42,t:'antenna'},{x:.28,w:.07,h:.22},{x:.42,w:.05,h:.3},{x:.55,w:.3,h:.45,t:'mountain'},{x:.75,w:.25,h:.35,t:'mountain'},{x:.88,w:.06,h:.18},{x:.95,w:.04,h:.25}],
  'Dallas':[{x:.08,w:.06,h:.25},{x:.18,w:.05,h:.35},{x:.26,w:.08,h:.48,t:'reunion'},{x:.38,w:.06,h:.32},{x:.48,w:.04,h:.28},{x:.56,w:.07,h:.38},{x:.66,w:.05,h:.22},{x:.76,w:.06,h:.3},{x:.86,w:.04,h:.2},{x:.92,w:.07,h:.26}],
  'Los Angeles':[{x:.1,w:.05,h:.2},{x:.2,w:.04,h:.15},{x:.3,w:.06,h:.28},{x:.42,w:.02,h:.22,t:'palm'},{x:.5,w:.02,h:.18,t:'palm'},{x:.6,w:.05,h:.22},{x:.72,w:.02,h:.2,t:'palm'},{x:.8,w:.04,h:.16},{x:.9,w:.02,h:.24,t:'palm'}],
  'Australia':[{x:.12,w:.15,h:.18,t:'opera'},{x:.35,w:.04,h:.38,t:'antenna'},{x:.5,w:.06,h:.22},{x:.65,w:.05,h:.18},{x:.78,w:.06,h:.25},{x:.9,w:.04,h:.2}],
  'Tokyo':[{x:.05,w:.04,h:.2},{x:.12,w:.06,h:.32},{x:.22,w:.035,h:.52,t:'tokyo'},{x:.32,w:.08,h:.28},{x:.42,w:.05,h:.22},{x:.5,w:.06,h:.36},{x:.6,w:.04,h:.18},{x:.68,w:.07,h:.3},{x:.78,w:.05,h:.25},{x:.88,w:.06,h:.2},{x:.95,w:.04,h:.32}],
  'Lagos':[{x:.08,w:.06,h:.22},{x:.18,w:.05,h:.3},{x:.28,w:.07,h:.38},{x:.4,w:.05,h:.25},{x:.52,w:.08,h:.32},{x:.64,w:.04,h:.2},{x:.74,w:.06,h:.28},{x:.85,w:.05,h:.18},{x:.93,w:.04,h:.24}],
  'London':[{x:.05,w:.04,h:.22},{x:.14,w:.06,h:.18},{x:.22,w:.04,h:.48,t:'bigben'},{x:.32,w:.08,h:.25},{x:.44,w:.05,h:.34,t:'gherkin'},{x:.54,w:.06,h:.2},{x:.64,w:.04,h:.28},{x:.78,w:.12,h:.24,t:'eye'},{x:.92,w:.05,h:.22}],
  'Cyber City':[{x:.03,w:.05,h:.35},{x:.12,w:.04,h:.52},{x:.2,w:.07,h:.28},{x:.3,w:.03,h:.6,t:'antenna'},{x:.38,w:.06,h:.4},{x:.48,w:.05,h:.32},{x:.56,w:.08,h:.48},{x:.66,w:.04,h:.35},{x:.74,w:.06,h:.55},{x:.84,w:.05,h:.3},{x:.92,w:.04,h:.42}],
};

const PU_TYPES=[
  {id:'halopsa',name:'Shield',effect:'INVINCIBILITY · 7.5s',color:B.cerulean,emoji:'🛡️',dur:7.5*60,img:'/game/assets/powerups/shield.png'},
  {id:'scalepad',name:'Boost',effect:'2× SCORE · 12s',color:'#f5c842',emoji:'⚡',dur:12*60,img:'/game/assets/powerups/instant-pay.png'},
  {id:'moneris',name:'Paid In Full',effect:'ALL OBSTACLES CLEARED',color:B.cooper,emoji:'💰',dur:0,img:'/game/assets/powerups/shield.png'},
  {id:'elavon',name:'Payment Streak',effect:'DOUBLE POINTS · 15s',color:B.good,emoji:'💫',dur:15*60,img:'/game/assets/powerups/instant-pay.png'}
];
const puImageCache={};
PU_TYPES.forEach(t=>{if(!t.img)return;const im=new Image();im.src=t.img;puImageCache[t.id]=im;});
const OBS_BADGE='/game/assets/obstacles/dodge.png';
const OBS=[
  {id:'overdue',label:'⚠️',name:'OVERDUE INVOICE',color:B.bad,size:33,img:'/game/assets/obstacles/overdue-invoice.png'},
  {id:'angry',label:'😤',name:'ANGRY CLIENT',color:B.bad,size:33,img:'/game/assets/obstacles/angry-client.png'}
];
const obImageCache={};
OBS.forEach(t=>{if(!t.img)return;const im=new Image();im.src=t.img;obImageCache[t.id]=im;});
const dodgeBadgeImg=new Image();dodgeBadgeImg.src=OBS_BADGE;
const COLLECT_BADGE='/game/assets/collect/collect-label.png';
const colBadgeImg=new Image();colBadgeImg.src=COLLECT_BADGE;
/** Offscreen: collect label with black background keyed out so it can sit on a white plate */
let colBadgeNoBgCanvas=null;
function getCollectBadgeKeyOut(){
  if (colBadgeNoBgCanvas) return colBadgeNoBgCanvas;
  const im = colBadgeImg;
  if (!im.naturalWidth || !im.complete) return null;
  const w=im.naturalWidth,h=im.naturalHeight;
  try {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cctx = c.getContext('2d');
    if (!cctx) return null;
    cctx.drawImage(im, 0, 0);
    const data = cctx.getImageData(0, 0, w, h);
    const p = data.data;
    for (let i=0; i < p.length; i += 4) {
      const r=p[i],g=p[i+1],b=p[i+2];
      if (r<36 && g<36 && b<36) p[i+3] = 0;
    }
    cctx.putImageData(data, 0, 0);
    colBadgeNoBgCanvas = c;
  } catch (e) {
    return null;
  }
  return colBadgeNoBgCanvas;
}
colBadgeImg.onload = function () { getCollectBadgeKeyOut(); };
const PARTNER_BOOST_BADGE='/game/assets/powerups/power-up-label.png';
const puBoostBadgeImg=new Image();puBoostBadgeImg.src=PARTNER_BOOST_BADGE;
let puBoostNoBgCanvas=null;
function getPartnerBoostBadgeKeyOut(){
  if (puBoostNoBgCanvas) return puBoostNoBgCanvas;
  const im=puBoostBadgeImg;
  if (!im.naturalWidth||!im.complete) return null;
  const w=im.naturalWidth,h=im.naturalHeight;
  try {
    const c=document.createElement('canvas');
    c.width=w;
    c.height=h;
    const cctx=c.getContext('2d');
    if (!cctx) return null;
    cctx.drawImage(im,0,0);
    const data=cctx.getImageData(0,0,w,h);
    const p=data.data;
    for (let i=0; i < p.length; i += 4) {
      const r=p[i],g=p[i+1],b=p[i+2];
      if (r<36 && g<36 && b<36) p[i+3]=0;
    }
    cctx.putImageData(data,0,0);
    puBoostNoBgCanvas=c;
  } catch (e) { return null; }
  return puBoostNoBgCanvas;
}
puBoostBadgeImg.onload=function(){getPartnerBoostBadgeKeyOut();};
const COLLECT_ART={coins:'/game/assets/collect/coins.png',pif:'/game/assets/collect/paid-in-full.png'};
const colImageCache={};
Object.keys(COLLECT_ART).forEach(function (k) {
  const im = new Image();
  (function (key) {
    im.onload = function () { colImageCache[key] = im; };
    im.onerror = function () { delete colImageCache[key]; };
  })(k);
  im.src = COLLECT_ART[k];
});
const COL=[
  {label:'💸',name:'ACH',art:'coins',color:B.good,size:33,pts:20},
  {label:'⚡',name:'INSTANT',art:'pif',color:B.good,size:33,pts:30},
  {label:'💵',name:'DOLLAR',art:'coins',color:B.good,size:33,pts:15},
  {label:'🔄',name:'AUTO-PAY',art:'pif',color:B.good,size:33,pts:25},
];

let state='start',score=0,combo=0,maxCombo=0,multiplier=1,isNight=false,nightTimer=0;
let shieldActive=false,shieldTimer=0,speedBoost=false,speedBoostTimer=0,doublePoints=false,doublePointsTimer=0;
let clutchUsed=false,isClutch=false,clutchTimer=0,clutchStrobeT=0;
let isFinalDeath=false;
let puWarning=false,puFlashTimer=0,puFlashVisible=true,activePUTimer=0,activePUName=null;
let frameCount=0,benjiAnimT=0,distance=0,gameElapsed=0,currentCity=CITIES[0],lastCity=null,soundOn=true,playerName='',playCount=0;
onWindowResize();
let targetLane=1,benjiX=0,benjiY=0,benjiBaseY=0,isJumping=false,jumpVy=0,benjiGlow=0;
const GRAVITY=0.62,JUMP=-15;
let obstacles=[],collectibles=[],powerups=[],particles=[],groundLines=[];
let spawnT=0,colT=0,puT=0,legendT=0,legendFaded=false,skylineOff=0;
let highScore=parseInt(localStorage.getItem('benjiHS')||'0');

// ── AUDIO SYSTEM ─────────────────────────────────────────
let audioCtx=null;
const MUSIC_BASE = '/game/assets/audio/music/';
const CITY_TRACKS = {
  'Vancouver':   {day:'music_vancouver_day_loop.mp3',   night:'music_vancouver_night_loop.mp3'},
  'Toronto':     {day:'music_toronto_day_loop.mp3',     night:'music_toronto_night_loop.mp3'},
  'Montreal':    {day:'music_montreal_day_loop.mp3',    night:'music_montreal_night_loop.mp3'},
  'Dallas':      {day:'music_dallas_day_loop.mp3',      night:'music_dallas_night_loop.mp3'},
  'New York':    {day:'music_newyork_day_loop.mp3',     night:'music_newyork_night_loop.mp3'},
  'Los Angeles': {day:'music_losangeles_day_loop.mp3',  night:'music_losangeles_night_loop.mp3'},
  'Miami':       {day:'music_miami_day_loop.mp3',       night:'music_miami_night_loop.mp3'},
  'London':      {day:'music_london_day_loop.mp3',      night:'music_london_night_loop.mp3'},
  'Australia':   {day:'music_australia_day_loop.mp3',   night:'music_australia_night_loop.mp3'},
  'Cyber City':  {day:'music_cybercity_day_loop.mp3',   night:'music_cybercity_night_loop.mp3'},
};

// Audio nodes — AudioContext based (works on iOS Safari after gesture unlock)
let currentTrackFile = null;
let musicSource = null;      // AudioBufferSourceNode
let musicGain = null;        // GainNode for volume control
/** single interval for music fade-in, fade-out, or gain ramps */
let musicTimer = null;
let musicPlayId = 0;
const audioCache = {};       // decoded AudioBuffer cache

function getAC(){
  if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}

function getMusicFile(cityName, night){
  const tracks = CITY_TRACKS[cityName] || CITY_TRACKS['Vancouver'];
  return MUSIC_BASE + (night ? tracks.night : tracks.day);
}

async function loadTrack(file){
  if(audioCache[file]) return audioCache[file];
  try{
    const resp = await fetch(file);
    const buf = await resp.arrayBuffer();
    const decoded = await getAC().decodeAudioData(buf);
    audioCache[file] = decoded;
    return decoded;
  }catch(e){ console.warn('Track load failed:', file, e); return null; }
}

function setMusicVol(val){
  if(musicGain) musicGain.gain.value = Math.max(0, Math.min(1, val));
}

function hardStopMusicPlayback(){
  if(musicTimer){
    clearInterval(musicTimer);
    musicTimer = null;
  }
  if(musicSource){
    try{ musicSource.stop(0); }catch(e){}
  }
  if(musicGain){
    try{ musicGain.disconnect(); }catch(e){}
  }
  musicSource = null;
  musicGain = null;
  currentTrackFile = null;
}

function playMusic(file, vol=0.55, loop=true, fadeInMs=600){
  if(!soundOn) return;
  if(currentTrackFile===file && musicSource) return;
  const ac = getAC();
  const id = ++musicPlayId;
  hardStopMusicPlayback();
  currentTrackFile = file;
  loadTrack(file)
    .then(decoded=>{
      if(id!==musicPlayId) return;
      if(!soundOn) return;
      if(!decoded){
        if(id===musicPlayId) currentTrackFile = null;
        return;
      }
      if(id!==musicPlayId) return;
      const src = ac.createBufferSource();
      src.buffer = decoded;
      src.loop = loop;
      const gain = ac.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(ac.destination);
      src.start(0);
      musicSource = src;
      musicGain = gain;
      const steps = Math.max(1, fadeInMs/30);
      let n = 0;
      if(musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      musicTimer = setInterval(()=>{
        n++;
        gain.gain.value = Math.min(vol, (vol/steps)*n);
        if(n>=steps){
          clearInterval(musicTimer);
          musicTimer = null;
          gain.gain.value = vol;
        }
      }, 30);
    })
    .catch(e=>{ console.warn('Music failed:', file, e); });
}
function stopMusic(fadeMs=600){
  musicPlayId++;
  if(fadeMs <= 0){
    hardStopMusicPlayback();
    return;
  }
  if(!musicSource && !musicTimer) return;
  if(musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if(!musicSource) return;
  const src = musicSource, gain = musicGain;
  if(!gain){
    try{ src.stop(0); }catch(e){}
    musicSource = null; musicGain = null; currentTrackFile = null; return;
  }
  const startVol = gain.gain.value;
  const steps = Math.max(1, fadeMs/30);
  let n = 0;
  musicTimer = setInterval(()=>{
    n++;
    gain.gain.value = Math.max(0, startVol - (startVol/steps)*n);
    if(n>=steps){
      clearInterval(musicTimer);
      musicTimer = null;
      try{ src.stop(0); }catch(e){}
      try{ gain.disconnect(); }catch(e){}
      musicSource = null;
      musicGain = null;
      currentTrackFile = null;
    }
  }, 30);
}

// Legacy stubs so nothing breaks
function fadeOut(){}
function fadeIn(){}

function swapToDayMusic(cityName){
  playMusic(getMusicFile(cityName, false), 0.55, true, 800);
}

function playTitleMusic(){
  playMusic(MUSIC_BASE + 'Title Screen.mp3', 0.4, true, 800);
}

// ── SFX (Web Audio API — instant, no loading) ─────────
function beep(fr,dur,type='square',vol=0.12){if(!soundOn)return;try{const ac=getAC(),o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);o.type=type;o.frequency.value=fr;g.gain.setValueAtTime(vol,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+dur);o.start();o.stop(ac.currentTime+dur);}catch(e){}}
const sCollect=()=>{beep(660,.09,'sine',.14);setTimeout(()=>beep(880,.07,'sine',.1),75);};
const sJump=()=>{beep(280,.13,'triangle',.09);beep(380,.09,'triangle',.07);};
const sHit=()=>{beep(110,.35,'sawtooth',.18);beep(75,.45,'sawtooth',.13);};
const sPU=()=>{[440,550,660,880].forEach((f,i)=>setTimeout(()=>beep(f,.14,'sine',.16),i*65));};
const sCity=()=>{[330,440,550].forEach((f,i)=>setTimeout(()=>beep(f,.18,'sine',.09),i*90));};

function toggleMusicFromStart(){
  soundOn=!soundOn;
  const btn=document.getElementById('startSoundBtn');
  if(btn) btn.textContent=soundOn?'\uD83D\uDD0A Music On':'\uD83D\uDD07 Music Off';
  document.getElementById('soundBtn').textContent=soundOn?'\uD83D\uDD0A':'\uD83D\uDD07';
  if(soundOn){ if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume(); playTitleMusic(); }
  else stopMusic();
}

const cssW=()=>wrap.clientWidth;
const cssH=()=>wrap.clientHeight;
const REF_H=780;
/** Caps vertical scale so tall / large viewports do not over-accelerate run + jump (was cssH/780 unbounded). */
const vScale=()=>Math.max(0.85,Math.min(1.08,cssH()/REF_H));
const entityScale=()=>Math.min(cssW()/375,cssH()/REF_H*(420/375));
const laneX=l=>{const w=cssW(),lp=w*.08,lw=(w-lp*2)/3;return lp+lw*l+lw/2;};
const groundY=()=>cssH()*.78;
const benjiSz=()=>Math.min(cssW()*.13,48*vScale());

function initGame(){score=0;combo=0;maxCombo=0;multiplier=1;isNight=false;nightTimer=0;shieldActive=false;shieldTimer=0;speedBoost=false;speedBoostTimer=0;doublePoints=false;doublePointsTimer=0;clutchUsed=false;isClutch=false;clutchTimer=0;clutchStrobeT=0;isFinalDeath=false;puWarning=false;puFlashTimer=0;puFlashVisible=true;activePUTimer=0;activePUName=null;frameCount=0;benjiAnimT=0;distance=0;gameElapsed=0;currentCity=CITIES[0];lastCity=null;targetLane=1;benjiX=laneX(1);benjiGlow=0;isJumping=false;jumpVy=0;benjiBaseY=groundY()-benjiSz()*.52;benjiY=benjiBaseY;obstacles=[];collectibles=[];powerups=[];particles=[];groundLines=[];spawnT=0;colT=0;puT=0;legendT=0;legendFaded=false;skylineOff=0;document.getElementById('ingameLegend').classList.remove('fade');document.getElementById('scoreDisplay').textContent='0';document.getElementById('nightOverlay').style.opacity='0';updateComboUI();updateLivesUI();const gy=groundY();for(let i=0;i<8;i++)groundLines.push({y:gy+Math.random()*cssH()*.2,speed:.35+Math.random()*.35});setTimeout(()=>showCityBanner(CITIES[0]),600);syncGameBleedImage();}

const SPAWN_CLEAR_PAD=8;
function entityClearanceRadius(e,isObs){return e.size*(isObs?0.38:0.43);}
function isLaneClearAtY(lane,y,incomingRadius){
  for(let i=0;i<obstacles.length;i++){const e=obstacles[i];if(!e.alive||e.lane!==lane)continue;if(Math.abs(e.y-y)<incomingRadius+entityClearanceRadius(e,true)+SPAWN_CLEAR_PAD)return false;}
  for(let i=0;i<collectibles.length;i++){const e=collectibles[i];if(!e.alive||e.lane!==lane)continue;if(Math.abs(e.y-y)<incomingRadius+entityClearanceRadius(e,false)+SPAWN_CLEAR_PAD)return false;}
  for(let i=0;i<powerups.length;i++){const e=powerups[i];if(!e.alive||e.lane!==lane)continue;if(Math.abs(e.y-y)<incomingRadius+entityClearanceRadius(e,false)+SPAWN_CLEAR_PAD)return false;}
  return true;
}
function pickLane(y,incomingRadius){const lanes=[0,1,2].sort(()=>Math.random()-.5);for(let i=0;i<lanes.length;i++){if(isLaneClearAtY(lanes[i],y,incomingRadius))return lanes[i];}return null;}
function spawnObs(){
  const y=-55,n=Math.random()<.28?2:1,used=[];
  for(let k=0;k<n;k++){
    const t=OBS[Math.floor(Math.random()*OBS.length)],sz=t.size*entityScale(),r=sz*.38;
    const cands=[0,1,2].filter(l=>used.indexOf(l)<0).sort(()=>Math.random()-.5);
    let lane=null;for(let i=0;i<cands.length;i++){if(isLaneClearAtY(cands[i],y,r)){lane=cands[i];break;}}
    if(lane===null)break;
    used.push(lane);obstacles.push({lane,x:laneX(lane),y,type:t,size:sz,alive:true});
  }
  return used.length>0;
}
function spawnCol(){
  const y=-45,t=COL[Math.floor(Math.random()*COL.length)],sz=t.size*entityScale(),r=sz*.43,l=pickLane(y,r);
  if(l===null)return false;
  collectibles.push({lane:l,x:laneX(l),y,type:t,size:sz,alive:true,w:Math.random()*Math.PI*2});
  return true;
}
function spawnPU(){
  const y=-45,t=PU_TYPES[Math.floor(Math.random()*PU_TYPES.length)],sz=28*entityScale(),r=sz*.43,l=pickLane(y,r);
  if(l===null)return false;
  powerups.push({lane:l,x:laneX(l),y,type:t,size:sz,alive:true,pulse:0});
  return true;
}
function burst(x,y,col,n=8){for(let i=0;i<n;i++){const a=(Math.PI*2*i)/n+Math.random()*.4,sp=2+Math.random()*4;particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,color:col,alpha:1,size:2.5+Math.random()*3.5,life:1});}}
function scorePop(x,y,text,col){const el=document.createElement('div');el.className='score-pop';el.textContent=text;el.style.left=x+'px';el.style.top=y+'px';el.style.color=col||B.good;wrap.appendChild(el);__scorePopCount++;setTimeout(()=>{el.remove();__scorePopCount=Math.max(0,__scorePopCount-1);},860);}
function activatePU(t){sPU();document.getElementById('puName').textContent=t.name;document.getElementById('puEffect').textContent=t.effect;const b=document.getElementById('powerupBanner');b.classList.add('show');setTimeout(()=>b.classList.remove('show'),2200);
  if(t.id==='moneris'){obstacles.forEach(o=>o.alive=false);burst(cssW()/2,cssH()/2,B.cooper,20);return;}
  benjiGlow=1;activePUName=t.name;activePUTimer=t.dur;puWarning=false;puFlashVisible=true;
  if(t.id==='halopsa'){shieldActive=true;shieldTimer=t.dur;}
  if(t.id==='scalepad'){doublePoints=true;doublePointsTimer=t.dur;}
  if(t.id==='elavon'){doublePoints=true;doublePointsTimer=t.dur;}
}
function updateComboUI(){const b=document.getElementById('comboBadge'),m=document.getElementById('multiBadge');if(combo>0){b.textContent='🔥 '+combo+' COMBO';b.classList.add('active');b.classList.toggle('fire',combo>=3);}else b.classList.remove('active','fire');m.classList.toggle('active',multiplier>1);if(multiplier>1)m.textContent=multiplier+'× MULTIPLIER';}
function updateLivesUI(){const v=document.getElementById('hudLivesValue');if(!v)return;if(!clutchUsed){v.textContent='♥♥';v.setAttribute('aria-label','2 lives');}else{v.textContent='♥♡';v.setAttribute('aria-label','1 life');}}
function showCityBanner(city){const b=document.getElementById('cityBanner');const txt=document.getElementById('cityPillText');if(txt)txt.textContent=city.flag+' '+city.name.toUpperCase();b.style.transition='opacity 0.15s ease';b.style.opacity='1';setTimeout(()=>{b.style.transition='opacity 0.6s ease';b.style.opacity='0';},1800);sCity();}
function emoji(e,x,y,sz){ctx.font=`${sz}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(e,x,y);}
function drawObstacleSprite(t,x,y,size){
  const im=t.img?obImageCache[t.id]:null;
  if(im&&im.complete&&im.naturalWidth){
    const maxD=size,sc=Math.min(maxD/im.width,maxD/im.height),sw=im.width*sc,sh=im.height*sc;
    ctx.drawImage(im,x-sw/2,y-sh/2,sw,sh);
  }else emoji(t.label,x,y,size);
}
function drawDodgeBadge(x,y,size){
  const im=dodgeBadgeImg,by=y-size*.78;
  if(im&&im.complete&&im.naturalWidth){
    const maxW=size*2.35,maxH=size*.42,sc=Math.min(maxW/im.width,maxH/im.height),sw=im.width*sc,sh=im.height*sc;
    ctx.drawImage(im,x-sw/2,by-sh/2,sw,sh);
  }else label(x,by,'❌ DODGE','rgba(232,64,64,.82)');
}
/* Horizontal/vertical margin around the badge plate (same feel as the dodge strip). */
function collectBadgeImagePadding(size){
  return {h:size*0.12,v:size*0.06};
}
function drawCollectBadge(x,y,size){
  const by=y-size*0.78;
  if(!colBadgeImg||!colBadgeImg.complete||!colBadgeImg.naturalWidth){
    label(x,by,'✅ COLLECT','#ffffff',B.good,2);
    return;
  }
  const keyed = getCollectBadgeKeyOut();
  const aw = keyed ? keyed.width : colBadgeImg.naturalWidth;
  const ah = keyed ? keyed.height : colBadgeImg.naturalHeight;
  const maxW=size*2.35,maxH=size*0.42,sc=Math.min(maxW/aw,maxH/ah),sw=aw*sc,sh=ah*sc;
  const pad=collectBadgeImagePadding(size);
  const rw=sw+2*pad.h,rh=sh+2*pad.v;
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(x-rw/2,by-rh/2,rw,rh,5);
  else ctx.rect(x-rw/2,by-rh/2,rw,rh);
  ctx.fillStyle='#ffffff';
  ctx.fill();
  const src = keyed || colBadgeImg;
  ctx.drawImage(src,x-sw/2,by-sh/2,sw,sh);
}
function drawPartnerBoostBadge(x,y,size){
  const by=y-size*0.78;
  if(!puBoostBadgeImg||!puBoostBadgeImg.complete||!puBoostBadgeImg.naturalWidth){
    return;
  }
  const keyed=getPartnerBoostBadgeKeyOut();
  const aw=keyed?keyed.width:puBoostBadgeImg.naturalWidth;
  const ah=keyed?keyed.height:puBoostBadgeImg.naturalHeight;
  const maxW=size*2.35,maxH=size*0.42,sc=Math.min(maxW/aw,maxH/ah),sw=aw*sc,sh=ah*sc;
  ctx.drawImage(keyed||puBoostBadgeImg,x-sw/2,by-sh/2,sw,sh);
}
function drawCollectibleSprite(t,x,y,size){
  const im=colImageCache[t.art];
  if(im&&im.complete&&im.naturalWidth){
    const maxD=size,sc=Math.min(maxD/im.width,maxD/im.height),sw=im.width*sc,sh=im.height*sc;
    ctx.drawImage(im,x-sw/2,y-sh/2,sw,sh);
  }else emoji(t.label,x,y,size);
}
function drawPUSprite(t,x,y,size){
  const im=puImageCache[t.id];
  const r=size*.72;
  if(im&&im.complete&&im.naturalWidth){
    const maxD=r*2,sc=Math.min(maxD/im.width,maxD/im.height),sw=im.width*sc,sh=im.height*sc;
    ctx.drawImage(im,x-sw/2,y-sh/2,sw,sh);
  }else{
    emoji(t.emoji||'✨',x,y,size*.85);
  }
}
function label(x,y,text,bg,textColor,extraPadW){
  ctx.font='bold 9px Barlow,sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  const tw=ctx.measureText(text).width;
  const ex=extraPadW||0;
  const pw=tw+10+ex;
  const ph=14;
  ctx.fillStyle=bg;
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(x-pw/2,y-ph/2,pw,ph,4);
  else ctx.rect(x-pw/2,y-ph/2,pw,ph);
  ctx.fill();
  ctx.fillStyle=textColor==null?'#fff':textColor;
  ctx.fillText(text,x,y);
}
function darken(hex,f){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgb(${Math.round(r*(1-f))},${Math.round(g*(1-f))},${Math.round(b*(1-f))})`;}

function drawSkyline(city,w,gy){
  const bldgs=SKY[city.name];if(!bldgs)return;
  const col=city.accent;
  // Far layer
  ctx.save();
  const fo=(skylineOff*.25)%w;
  bldgs.forEach(b=>{
    const bx=((b.x*w-fo)%w+w)%w,bh=b.h*gy*.55,bw=b.w*w;
    ctx.fillStyle=col;ctx.globalAlpha=isNight?.06:.1;
    if(b.t==='mountain'){ctx.beginPath();ctx.moveTo(bx-bw/2,gy);ctx.lineTo(bx,gy-bh);ctx.lineTo(bx+bw/2,gy);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.globalAlpha=.03;ctx.beginPath();ctx.moveTo(bx-bw*.06,gy-bh+bh*.12);ctx.lineTo(bx,gy-bh);ctx.lineTo(bx+bw*.06,gy-bh+bh*.12);ctx.closePath();ctx.fill();}
    else if(b.t==='palm'){ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(bx,gy);ctx.quadraticCurveTo(bx+2,gy-bh*.6,bx,gy-bh);ctx.stroke();for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(bx,gy-bh);ctx.quadraticCurveTo(bx+i*10,gy-bh-6,bx+i*16,gy-bh+8);ctx.stroke();}}
    else if(b.t==='opera'){for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(bx+i*bw*.18,gy);ctx.quadraticCurveTo(bx+i*bw*.18+bw*.04,gy-bh*(1-i*.12),bx+i*bw*.18+bw*.12,gy);ctx.fill();}}
    else if(b.t==='eye'){const r=bw*.45;ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(bx,gy-r,r,0,Math.PI*2);ctx.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3+frameCount*.004;ctx.beginPath();ctx.moveTo(bx,gy-r);ctx.lineTo(bx+Math.cos(a)*r,gy-r+Math.sin(a)*r);ctx.stroke();}ctx.beginPath();ctx.moveTo(bx-r*.3,gy);ctx.lineTo(bx,gy-r);ctx.lineTo(bx+r*.3,gy);ctx.stroke();}
    else{
      ctx.fillRect(bx-bw/2,gy-bh,bw,bh);
      if(b.t==='pointed'){ctx.beginPath();ctx.moveTo(bx-bw/2,gy-bh);ctx.lineTo(bx,gy-bh-bh*.2);ctx.lineTo(bx+bw/2,gy-bh);ctx.closePath();ctx.fill();}
      if(b.t==='antenna')ctx.fillRect(bx-1,gy-bh-bh*.25,2,bh*.25);
      if(b.t==='reunion'){ctx.beginPath();ctx.arc(bx,gy-bh-bw*.5,bw*.5,0,Math.PI*2);ctx.fill();}
      if(b.t==='bigben'){ctx.beginPath();ctx.moveTo(bx-bw*.5,gy-bh);ctx.lineTo(bx,gy-bh-bh*.18);ctx.lineTo(bx+bw*.5,gy-bh);ctx.closePath();ctx.fill();}
      if(b.t==='gherkin'){ctx.beginPath();ctx.moveTo(bx-bw/2,gy-bh);ctx.quadraticCurveTo(bx-bw*.6,gy-bh-bh*.25,bx,gy-bh-bh*.3);ctx.quadraticCurveTo(bx+bw*.6,gy-bh-bh*.25,bx+bw/2,gy-bh);ctx.closePath();ctx.fill();}
      if(b.t==='tokyo'){ctx.fillStyle='#ff3333';ctx.globalAlpha=(isNight?.08:.12);ctx.beginPath();ctx.moveTo(bx-bw*.8,gy-bh*.35);ctx.lineTo(bx,gy-bh);ctx.lineTo(bx+bw*.8,gy-bh*.35);ctx.closePath();ctx.fill();ctx.fillRect(bx-1,gy-bh-bh*.12,2,bh*.12);}
      // Windows
      ctx.fillStyle='#fff';ctx.globalAlpha=isNight?.1:.03;
      const wr=Math.floor(bh/7);for(let r=0;r<wr;r++)for(let c=0;c<Math.floor(bw/4);c++)if(Math.random()<.55)ctx.fillRect(bx-bw/2+c*4+1.5,gy-bh+r*7+2,1.5,2.5);
    }
  });
  // Near layer
  const no=(skylineOff*.6)%w;
  bldgs.forEach(b=>{
    if(b.t==='mountain'||b.t==='palm'||b.t==='opera'||b.t==='eye')return;
    const bx=((b.x*w+w*.45-no)%w+w)%w,bh=b.h*gy*.3,bw=b.w*w*.7;
    ctx.fillStyle=col;ctx.globalAlpha=isNight?.04:.07;
    ctx.fillRect(bx-bw/2,gy-bh,bw,bh);
  });
  ctx.restore();
  // Fog for London
  if(city.name==='London'){ctx.save();const fg=ctx.createLinearGradient(0,gy*.4,0,gy);fg.addColorStop(0,'rgba(180,190,210,0)');fg.addColorStop(.7,'rgba(180,190,210,.03)');fg.addColorStop(1,'rgba(180,190,210,.06)');ctx.fillStyle=fg;ctx.fillRect(0,0,w,gy);ctx.restore();}
  // Neon for Tokyo/Cyber
  if((city.name==='Tokyo'||city.name==='Cyber City')&&!isNight){ctx.save();ctx.globalAlpha=.05;const nc=['#ff0055','#00ffcc','#ff9900','#ff55ff','#00aaff'];for(let i=0;i<5;i++){ctx.fillStyle=nc[i];ctx.fillRect(((i*137+frameCount*.1)%w),gy*.3+i*28,12,3);}ctx.restore();}
}

function drawBG(){
  const w=cssW(),h=cssH(),city=currentCity,gy=groundY();
  const grd=ctx.createLinearGradient(0,0,w*.3,gy*.95);
  grd.addColorStop(0,isNight?darken(city.sky[0],.55):city.sky[0]);
  grd.addColorStop(1,isNight?darken(city.sky[1],.55):city.sky[1]);
  ctx.fillStyle=grd;ctx.fillRect(0,0,w,h);
  const bg=ctx.createLinearGradient(0,0,w,gy);bg.addColorStop(0,'rgba(0,71,119,.06)');bg.addColorStop(1,'rgba(204,125,81,.04)');ctx.fillStyle=bg;ctx.fillRect(0,0,w,gy);
  if(isNight||city.name==='Tokyo'||city.name==='Cyber City'){ctx.fillStyle='rgba(255,255,255,.72)';for(let i=0;i<35;i++){const sx=(i*137+frameCount*.05)%w,sy=(i*97)%(h*.56);ctx.beginPath();ctx.arc(sx,sy,.5+(i%3)*.5,0,Math.PI*2);ctx.fill();}}
  if(city.name==='Cyber City'){ctx.strokeStyle='rgba(0,255,180,.03)';ctx.lineWidth=1;for(let y=0;y<h;y+=4){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.font='8px monospace';ctx.fillStyle='rgba(0,255,180,.2)';ctx.textAlign='left';for(let i=0;i<4;i++)ctx.fillText('ACH+$'+(1200+i*817+frameCount).toFixed(2),(frameCount*(1+i*.3))%(w+180)-80,28+i*26);}
  if(city.name==='Los Angeles'&&!isNight){ctx.font='bold '+Math.round(w*.047)+'px Barlow,sans-serif';ctx.fillStyle='rgba(255,255,255,.09)';ctx.textAlign='center';ctx.fillText('BENJI PAYS',w/2,h*.25);}
  drawSkyline(city,w,gy);
  const gg=ctx.createLinearGradient(0,gy,0,h);gg.addColorStop(0,city.ground);gg.addColorStop(1,darken(city.ground,.5));ctx.fillStyle=gg;ctx.fillRect(0,gy,w,h-gy);
  const glg=ctx.createLinearGradient(0,0,w,0);glg.addColorStop(0,B.cerulean);glg.addColorStop(.5,city.gl);glg.addColorStop(1,B.cooper);ctx.strokeStyle=glg;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(w,gy);ctx.stroke();
  const lp=w*.08,lw=(w-lp*2)/3;ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=1;ctx.setLineDash([7,13]);for(let i=1;i<3;i++){const lx=lp+lw*i;ctx.beginPath();ctx.moveTo(lx,gy);ctx.lineTo(lx,h);ctx.stroke();}ctx.setLineDash([]);
  groundLines.forEach(gl=>{ctx.strokeStyle='rgba(255,255,255,.03)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,gl.y);ctx.lineTo(w,gl.y);ctx.stroke();});
}

function drawBenji(x,y,sz){
  /* benjiAnimT += delta each frame → same motion at 60 Hz vs 120 Hz; not tied to raw frame index */
  const t=benjiAnimT,bounce=isJumping?0:Math.sin(t*.25)*1.8;const bodyCol=currentCity.accent||B.cerulean;
  ctx.save();ctx.translate(x,y+bounce);
  if(benjiGlow>0){ctx.shadowBlur=22;ctx.shadowColor='rgba(0,71,119,'+benjiGlow*.9+')';}
  if(shieldActive){ctx.beginPath();ctx.arc(0,0,sz*.84,0,Math.PI*2);ctx.strokeStyle='rgba(0,71,119,'+(0.45+Math.sin(t*.15)*.25)+')';ctx.lineWidth=3;ctx.stroke();}
  const sc=sz/48;ctx.scale(sc,sc);
  ctx.fillStyle=bodyCol;
  ctx.beginPath();ctx.ellipse(0,0,24,13,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(26,-14,14,11,-.2,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(37,-12,9,7,-.1,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(22,-22,5,9,-.4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(30,-17,3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(31,-17,1.6,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(44,-11,2.2,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.moveTo(-24,0);ctx.quadraticCurveTo(-36,-18+Math.sin(t*.2)*5,-28,-6);ctx.strokeStyle=bodyCol;ctx.lineWidth=7;ctx.lineCap='round';ctx.stroke();
  const la=isJumping?.2:Math.sin(t*.28)*.22;ctx.fillStyle=bodyCol;
  [[-16,14],[0,14],[14,14],[26,14]].forEach(([lx,ly],i)=>{const lo=(i%2===0?1:-1)*la*14;ctx.beginPath();ctx.ellipse(lx,ly+lo,5,11,la*(i%2===0?1:-1),0,Math.PI*2);ctx.fill();});
  if(currentCity.name==='Cyber City'){ctx.globalAlpha=.22;for(let i=1;i<=3;i++){ctx.fillStyle=bodyCol;ctx.fillRect(-24-i*9,-12,48,24);}ctx.globalAlpha=1;}
  ctx.shadowBlur=0;ctx.restore();if(benjiGlow>0)benjiGlow-=.018;
}

let lastTime=0;
function pollGamepad(){
  var pads=navigator.getGamepads?navigator.getGamepads():[];
  for(var i=0;i<pads.length;i++){
    var p=pads[i];if(!p||!p.connected)continue;
    // Left stick horizontal
    var lx=p.axes[0]||0;
    if(lx<-0.3&&!gpPrevLeft){if(targetLane>0)targetLane--;gpPrevLeft=true;}
    else if(lx>=-0.3)gpPrevLeft=false;
    if(lx>0.3&&!gpPrevRight){if(targetLane<2)targetLane++;gpPrevRight=true;}
    else if(lx<=0.3)gpPrevRight=false;
    // LB(4) / LT(6) = left
    var lb=p.buttons[4]&&p.buttons[4].pressed,lt=p.buttons[6]&&p.buttons[6].pressed;
    if((lb||lt)&&!gpPrevLB){if(targetLane>0)targetLane--;gpPrevLB=true;}
    else if(!lb&&!lt)gpPrevLB=false;
    // RB(5) / RT(7) = right
    var rb=p.buttons[5]&&p.buttons[5].pressed,rt=p.buttons[7]&&p.buttons[7].pressed;
    if((rb||rt)&&!gpPrevRB){if(targetLane<2)targetLane++;gpPrevRB=true;}
    else if(!rb&&!rt)gpPrevRB=false;
    // A(0) / X(3) = jump
    var aj=p.buttons[0]&&p.buttons[0].pressed,xj=p.buttons[3]&&p.buttons[3].pressed;
    if((aj||xj)&&!gpPrevJump&&!isJumping){doJump();gpPrevJump=true;}
    else if(!aj&&!xj)gpPrevJump=false;
    // D-pad: left(14), right(15)
    var dl=p.buttons[14]&&p.buttons[14].pressed,dr=p.buttons[15]&&p.buttons[15].pressed;
    if(dl&&!gpPrevDL){if(targetLane>0)targetLane--;gpPrevDL=true;}else if(!dl)gpPrevDL=false;
    if(dr&&!gpPrevDR){if(targetLane<2)targetLane++;gpPrevDR=true;}else if(!dr)gpPrevDR=false;
    break; // use first connected pad
  }
}
var gpPrevLeft=false,gpPrevRight=false,gpPrevLB=false,gpPrevRB=false,gpPrevJump=false,gpPrevDL=false,gpPrevDR=false;

function gameLoop(timestamp){
  if(state!=='playing')return;requestAnimationFrame(gameLoop);
  try{
  pollGamepad();
  const rawDelta=lastTime?Math.min(timestamp-lastTime,50):16.67;
  lastTime=timestamp;
  const delta=rawDelta/16.67; // normalised: 1.0 = perfect 60fps
  frameCount++;
  benjiAnimT+=delta;
  const gy=groundY(),bs=benjiSz(),vs=vScale();
  gameElapsed+=rawDelta/1000;
  const tRun=gameElapsed;
  const timeBonus=Math.min(tRun/100,1.1)+Math.min(Math.max(0,tRun-100)/200,1.2)+Math.min(Math.max(0,tRun-240)/350,0.9)+Math.min(Math.max(0,tRun-400)/500,0.5);
  const baseSpd=2.2+Math.min(score/2000,3.2)+timeBonus,spd=baseSpd*(speedBoost?1.5:1)*vs;
  skylineOff+=spd*.8*delta;
  benjiX+=(laneX(targetLane)-benjiX)*.17*delta;benjiBaseY=gy-bs*.52;
  if(isJumping){jumpVy+=GRAVITY*vs*delta;benjiY+=jumpVy*delta;if(benjiY>=benjiBaseY){benjiY=benjiBaseY;isJumping=false;jumpVy=0;}}else benjiY=benjiBaseY;
  
  if(shieldTimer>0){shieldTimer-=delta;if(shieldTimer<=0)shieldActive=false;}
  if(speedBoostTimer>0){speedBoostTimer-=delta;if(speedBoostTimer<=0)speedBoost=false;}
  if(doublePointsTimer>0){doublePointsTimer-=delta;if(doublePointsTimer<=0)doublePoints=false;}
  if(isClutch){
    clutchTimer-=delta;
    if(!puWarning){
      clutchStrobeT+=delta;
      if(clutchStrobeT%10<delta*5)puFlashVisible=!puFlashVisible;
    }else if(isFinalDeath){
      clutchStrobeT+=delta;
      if(clutchStrobeT%10<delta*5)puFlashVisible=!puFlashVisible;
    }
    if(clutchTimer<=0){
      if(isFinalDeath)endGame();
      isClutch=false;
      isFinalDeath=false;
      puFlashVisible=true;
      clutchStrobeT=0;
    }
  }
  if(activePUTimer>0){activePUTimer-=delta;
    if(activePUTimer<=240&&!puWarning)puWarning=true;
    if(puWarning){puFlashTimer+=delta;if(puFlashTimer%10<delta*5)puFlashVisible=!puFlashVisible;}
    if(activePUTimer<=0){activePUName=null;puWarning=false;puFlashVisible=true;}
  }
  if(!legendFaded){legendT++;if(legendT>300){document.getElementById('ingameLegend').classList.add('fade');legendFaded=true;}}
  score+=(0.044*(spd/baseSpd))*multiplier*(doublePoints?2:1)*delta;distance+=spd*delta;
  const __scoreInt=Math.floor(score);
  if(__scoreInt!==__lastScoreText){document.getElementById('scoreDisplay').textContent=__scoreInt;__lastScoreText=__scoreInt;}
  const nc=getCity(Math.floor(score));if(nc!==currentCity){currentCity=nc;if(lastCity!==nc){showCityBanner(nc);lastCity=nc;if(soundOn) swapToDayMusic(nc.name);}syncGameBleedImage();}
  const spawnTight=Math.min(Math.floor(Math.min(tRun,480)/20),12);
  spawnT+=delta;const sr=Math.max(70-Math.floor(score/200)-spawnTight,32);if(spawnT>=sr){if(!spawnObs())spawnT=sr*.5;else spawnT=0;}
  const cr=Math.max(50-Math.floor(score/300)-Math.floor(spawnTight*0.6),24);colT+=delta;if(colT>=cr){if(!spawnCol())colT=cr*.5;else colT=0;}
  puT+=delta;if(puT>=490){if(!spawnPU())puT=245;else puT=0;}
  // Cap active objects to prevent memory issues at very high scores
  const MAX_OBS=30,MAX_COL=20,MAX_PU=8,MAX_PART=80;
  if(obstacles.length>MAX_OBS){obstacles.slice(0,obstacles.length-MAX_OBS).forEach(o=>{o.alive=false;});obstacles=obstacles.filter(o=>o.alive);}
  if(collectibles.length>MAX_COL){collectibles.slice(0,collectibles.length-MAX_COL).forEach(c=>{c.alive=false;});collectibles=collectibles.filter(c=>c.alive);}
  if(powerups.length>MAX_PU){powerups.slice(0,powerups.length-MAX_PU).forEach(p=>{p.alive=false;});powerups=powerups.filter(p=>p.alive);}
  if(particles.length>MAX_PART)particles=particles.slice(particles.length-MAX_PART);
  // Cap score-pop DOM elements (only query DOM when in-memory counter signals overflow)
  if(__scorePopCount>12){const pops=wrap.querySelectorAll('.score-pop');for(let i=0;i<pops.length-12;i++)pops[i].remove();}
  obstacles=obstacles.filter(o=>{if(!o.alive)return false;o.y+=spd*delta;o.x=laneX(o.lane);return o.y<cssH()+70;});
  collectibles=collectibles.filter(c=>{if(!c.alive)return false;c.y+=spd*delta;c.w+=.07*delta;c.x=laneX(c.lane);return c.y<cssH()+70;});
  powerups=powerups.filter(p=>{if(!p.alive)return false;p.y+=spd*delta;p.pulse+=.09*delta;p.x=laneX(p.lane);return p.y<cssH()+70;});
  groundLines.forEach(gl=>{gl.y+=gl.speed*(spd/baseSpd)*delta;if(gl.y>cssH()+20)gl.y=gy+5;});
  particles=particles.filter(p=>{p.x+=p.vx*delta;p.y+=p.vy*delta;p.vy+=.14*delta;p.life-=.024*delta;p.alpha=p.life;return p.life>0;});
  const bx=benjiX,by=benjiY,hr=bs*.36;
  obstacles.forEach(o=>{if(!o.alive)return;const dx=o.x-bx,dy=o.y-by;if(Math.sqrt(dx*dx+dy*dy)<hr+o.size*.38){if(shieldActive){o.alive=false;burst(o.x,o.y,B.cerulean,6);}else if(isClutch){/* still invincible from clutch */}else if(!clutchUsed){o.alive=false;clutchUsed=true;isClutch=true;clutchTimer=90;clutchStrobeT=0;puFlashVisible=true;combo=0;multiplier=1;updateComboUI();updateLivesUI();sHit();burst(o.x,o.y,B.bad,8);}else{o.alive=false;isClutch=true;clutchTimer=60;isFinalDeath=true;clutchStrobeT=0;puFlashVisible=true;sHit();burst(o.x,o.y,B.bad,12);}}});
  collectibles.forEach(c=>{if(!c.alive)return;const dx=c.x-bx,dy=c.y-by;if(Math.sqrt(dx*dx+dy*dy)<hr+c.size*.43){c.alive=false;const pts=c.type.pts*multiplier*(doublePoints?2:1);score+=pts;combo++;if(combo>maxCombo)maxCombo=combo;if(combo>=3)multiplier=Math.min(Math.floor(combo/3)+1,4);updateComboUI();sCollect();burst(c.x,c.y,B.good,8);scorePop(c.x,c.y,'+'+pts,B.good);benjiGlow=1;}});
  powerups.forEach(p=>{if(!p.alive)return;const dx=p.x-bx,dy=p.y-by;if(Math.sqrt(dx*dx+dy*dy)<hr+p.size*.43){p.alive=false;activatePU(p.type);burst(p.x,p.y,B.cooper,14);benjiGlow=1;}});
  ctx.clearRect(0,0,cssW(),cssH());drawBG();
  collectibles.forEach(c=>{const cy=c.y+Math.sin(c.w)*4;drawCollectBadge(c.x,cy,c.size);ctx.save();ctx.shadowBlur=14;ctx.shadowColor=B.goodGlow;drawCollectibleSprite(c.type,c.x,cy,c.size);ctx.restore();});
  powerups.forEach(p=>{ctx.save();ctx.shadowBlur=16+Math.sin(p.pulse)*6;ctx.shadowColor=B.puGlow;const sc=1+Math.sin(p.pulse)*.07;ctx.translate(p.x,p.y);ctx.scale(sc,sc);ctx.translate(-p.x,-p.y);drawPUSprite(p.type,p.x,p.y,p.size);ctx.restore();drawPartnerBoostBadge(p.x,p.y,p.size);});
  obstacles.forEach(o=>{drawDodgeBadge(o.x,o.y,o.size);ctx.save();ctx.shadowBlur=13;ctx.shadowColor=B.badGlow;drawObstacleSprite(o.type,o.x,o.y,o.size);ctx.restore();});
  particles.forEach(p=>{ctx.save();ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);ctx.fill();ctx.restore();});
  if((isClutch||puWarning)&&!puFlashVisible){/* skip drawing Benji for flash effect */}else{drawBenji(benjiX,benjiY,bs);}
  }catch(err){
    console.error('Game loop crash:',err);
    if(state==='playing')endGame();
  }
}

function endGame(){
  isFinalDeath=false;isClutch=false;clutchStrobeT=0;puFlashVisible=true;
  state='over';const fs=Math.floor(score);
  const isNew=fs>highScore;if(isNew){highScore=fs;localStorage.setItem('benjiHS',String(highScore));}
  document.getElementById('hsBadge').style.display=isNew?'block':'none';
  const n=playerName;
  document.getElementById('finalScore').textContent='$'+fs.toLocaleString();
  document.getElementById('finalScoreTitle').textContent=fs.toLocaleString();
  document.getElementById('finalCombo').textContent=maxCombo;
  document.getElementById('finalCity').textContent=currentCity.flag+' '+currentCity.name;
  document.getElementById('finalDistance').textContent=Math.floor(distance/60)+'m';
  document.getElementById('overCity').textContent='IN '+currentCity.name.toUpperCase();
  document.getElementById('shareCopy').textContent=n+' collected $'+fs.toLocaleString()+' in Benji Pays: Invoice Rover! Reached '+currentCity.name+'. Can you beat me? 💸 benjigame.com';
  document.getElementById('gameOverScreen').classList.remove('hidden');var osb=document.getElementById('overSoundBtn');if(osb)osb.textContent=soundOn?'🔊 Music On':'🔇 Music Off';playCount++;if(soundOn){try{const ac=getAC();[220,196,174,155].forEach((f,i)=>{setTimeout(()=>{const o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(0.12,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+0.4);o.start();o.stop(ac.currentTime+0.4);},i*120);});}catch(e){}}stopMusic(800);
  const emailField = document.getElementById('playerEmail');
  const emailTrim = emailField && emailField.value ? emailField.value.trim() : '';
  submitScore({
    player_name: n,
    email: emailTrim,
    score: fs,
    city_reached: currentCity.name,
    city_flag: currentCity.flag,
    best_combo: maxCombo,
    event_tag: activeEventTag,
    run_id: currentRunId
  }).then(function (r) { if (r && !r.ok) console.warn('Final score submit:', r.code, r.error); });
}

let txS=0,tyS=0,ttS=0;
wrap.addEventListener('touchstart',e=>{if(state!=='playing')return;txS=e.touches[0].clientX;tyS=e.touches[0].clientY;ttS=Date.now();},{passive:true});
wrap.addEventListener('touchend',e=>{if(state!=='playing')return;const dx=e.changedTouches[0].clientX-txS,dy=e.changedTouches[0].clientY-tyS,dt=Date.now()-ttS;if(Math.abs(dx)>28&&Math.abs(dx)>Math.abs(dy)){if(dx>0){if(targetLane<2)targetLane++;}else{if(targetLane>0)targetLane--;}}else if(Math.abs(dy)<28&&dt<300&&!isJumping)doJump();},{passive:true});
let mdX=0;
wrap.addEventListener('mousedown',e=>{if(state==='playing')mdX=e.clientX;});
wrap.addEventListener('mouseup',e=>{if(state!=='playing')return;const dx=e.clientX-mdX;if(Math.abs(dx)>28){if(dx>0){if(targetLane<2)targetLane++;}else{if(targetLane>0)targetLane--;}}else if(!isJumping)doJump();});
function toggleSoundFromStart(){
  soundOn=!soundOn;
  var btn=document.getElementById('startSoundBtn');
  if(btn)btn.textContent=soundOn?'🔊 Music On':'🔇 Music Off';
  document.getElementById('soundBtn').textContent=soundOn?'🔊':'🔇';
  if(soundOn){getAC();playTitleMusic();}
  else stopMusic();
}
function toggleSoundFromGameOver(){
  soundOn=!soundOn;
  var btn=document.getElementById('overSoundBtn');
  if(btn)btn.textContent=soundOn?'🔊 Music On':'🔇 Music Off';
  document.getElementById('soundBtn').textContent=soundOn?'🔊':'🔇';
  if(soundOn){getAC();playTitleMusic();}
  else stopMusic();
}
{
  const osb=document.getElementById('overSoundBtn');
  if (osb) osb.addEventListener('click',()=>{toggleSoundFromGameOver();});
}
function doJump(){isJumping=true;jumpVy=JUMP*vScale();sJump();}
// Calls start-run to create a fresh game_runs row and update currentRunId.
// Returns { ok: true } on success, or { ok: false, error } on failure.
// On failure, currentRunId is set to null so submit-score won't compute a misleading duration.
async function beginRun(name, email){
  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/start-run`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        player_name: name,
        email: email,
        event_tag: activeEventTag
      })
    });
    let body = {};
    try { body = await res.json(); } catch (_) { /* non-JSON */ }
    if (!res.ok) {
      currentRunId = null;
      return { ok: false, error: (body && body.error) || 'Could not save your info. Try again.' };
    }
    currentRunId = (body && body.run_id) || null;
    return { ok: true };
  } catch (e) {
    console.warn('start-run failed:', e);
    currentRunId = null;
    return { ok: false, error: 'Connection problem. Try again.' };
  }
}

// Returns cached name/email from localStorage for retry/CTA paths (no form re-validation).
function cachedPlayer(){
  try {
    return {
      name: localStorage.getItem('bp_playerName') || playerName || '',
      email: localStorage.getItem('bp_playerEmail') || ''
    };
  } catch(e){ return { name: playerName || '', email: '' }; }
}

async function startGame(){
  const v = await validatePlayerForm();
  if (!v.ok) {
    showStartFormError(v.error);
    return;
  }
  clearStartFormError();
  playerName = v.name;
  const email = v.email;
  try {
    localStorage.setItem('bp_playerName', v.name);
    localStorage.setItem('bp_playerEmail', email);
  } catch (e) { /* ignore */ }
  if (!leadCaptured) {
    leadCaptured = true;
    const r = await beginRun(v.name, email);
    if (!r.ok) {
      leadCaptured = false;
      showStartFormError(r.error);
      return;
    }
  } else {
    // First-play form re-submitted (e.g., page kept session). Still start a fresh run.
    await beginRun(v.name, email);
  }
  document.getElementById('startScreen').classList.add('hidden');
  state='playing';lastTime=0;initGame();requestAnimationFrame(gameLoop);
  if(soundOn) setTimeout(()=>swapToDayMusic('Vancouver'), 200);
}
// Restore saved name/email on page load
try{const sn=localStorage.getItem('bp_playerName');const se=localStorage.getItem('bp_playerEmail');if(sn)document.getElementById('playerName').value=sn;if(se)document.getElementById('playerEmail').value=se;}catch(e){}
// Title music starts on first interaction with Play button or sound toggle
// Music during gameplay starts in startGame() directly
document.getElementById('playBtn').addEventListener('click',function(){ getAC(); void startGame(); });
{const ssb=document.getElementById('startSoundBtn');if(ssb)ssb.addEventListener('click',function(){toggleMusicFromStart();});}
document.getElementById('retryBtn').addEventListener('click',()=>{
  document.getElementById('gameOverScreen').classList.add('hidden');
  if(playCount>=2){playCount=0;document.getElementById('ctaScreen').classList.remove('hidden');return;}
  // Fire-and-forget: start a fresh run for accurate duration_s. Don't block gameplay if it fails.
  const cp=cachedPlayer();
  if(cp.name && cp.email){ void beginRun(cp.name, cp.email); } else { currentRunId=null; }
  state='playing';lastTime=0;initGame();requestAnimationFrame(gameLoop);if(soundOn)swapToDayMusic('Vancouver');
});
document.getElementById('shareBtn').addEventListener('click',()=>{const txt=document.getElementById('shareCopy').textContent;if(navigator.share)navigator.share({text:txt}).catch(()=>{});else navigator.clipboard?.writeText(txt).then(()=>alert('Copied!')).catch(()=>alert(txt));});
document.getElementById('soundBtn').addEventListener('click',()=>{
  soundOn=!soundOn;
  document.getElementById('soundBtn').textContent=soundOn?'\uD83D\uDD0A':'\uD83D\uDD07';
  const sb=document.getElementById('startSoundBtn');
  if(sb) sb.textContent=soundOn?'\uD83D\uDD0A Music On':'\uD83D\uDD07 Music Off';
  if(soundOn){
    if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();
    if(state==='playing') swapToDayMusic(currentCity?currentCity.name:'Vancouver');
    else playTitleMusic();
  } else {
    stopMusic();
  }
});
document.getElementById('playerEmail').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); getAC(); void startGame(); } });
document.getElementById('playerName').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); document.getElementById('playerEmail').focus(); } });
document.getElementById('playerName').addEventListener('input',clearStartFormError);
document.getElementById('playerEmail').addEventListener('input',clearStartFormError);
document.getElementById('ctaLearnBtn').addEventListener('click',()=>{window.open('https://benjipays.com','_blank');});
document.getElementById('ctaSkipBtn').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();document.getElementById('ctaScreen').classList.add('hidden');var cp2=cachedPlayer();if(cp2.name&&cp2.email){void beginRun(cp2.name,cp2.email);}else{currentRunId=null;}state='playing';lastTime=0;initGame();requestAnimationFrame(gameLoop);if(soundOn)swapToDayMusic('Vancouver');});

const __gp = { raf: 0, stopped: false };
// Gamepad indicator + start-screen polling
(function(){
  var gpInd=document.getElementById('gamepadIndicator');
  var gpStartFired=false;
  function checkGP(){
    if(__gp.stopped)return;
    var pads=navigator.getGamepads?navigator.getGamepads():[];
    var found=false;
    for(var i=0;i<pads.length;i++){if(pads[i]&&pads[i].connected){found=true;break;}}
    if(found){gpInd.style.display='flex';}else{gpInd.style.display='none';}
    // Allow gamepad to start the game from start screen
    if(found&&state!=='playing'&&!gpStartFired){
      for(var i=0;i<pads.length;i++){
        var p=pads[i];if(!p)continue;
        // A(0) or X(3) or Start(9) button
        if((p.buttons[0]&&p.buttons[0].pressed)||(p.buttons[3]&&p.buttons[3].pressed)||(p.buttons[9]&&p.buttons[9].pressed)){
          var ss=document.getElementById('startScreen');
          var cs=document.getElementById('ctaScreen');
          if(ss&&!ss.classList.contains('hidden')){gpStartFired=true;getAC();void startGame();break;}
          if(cs&&!cs.classList.contains('hidden')){gpStartFired=true;document.getElementById('ctaSkipBtn').click();break;}
        }
      }
    }
    // Also allow restart from game-over screen
    if(found&&state==='over'){
      for(var j=0;j<pads.length;j++){
        var pg=pads[j];if(!pg)continue;
        if((pg.buttons[0]&&pg.buttons[0].pressed)||(pg.buttons[3]&&pg.buttons[3].pressed)||(pg.buttons[9]&&pg.buttons[9].pressed)){
          if(!gpStartFired){
            gpStartFired=true;
            var go=document.getElementById('gameOverScreen');
            if(go&&!go.classList.contains('hidden')){document.getElementById('retryBtn').click();break;}
          }
        }
      }
    }
    if(state!=='playing'&&state!=='over')gpStartFired=false;
    else if(state==='playing'){
      // Reset gpStartFired when no confirm buttons are held
      var anyHeld=false;
      for(var k=0;k<pads.length;k++){var pk=pads[k];if(!pk)continue;if((pk.buttons[0]&&pk.buttons[0].pressed)||(pk.buttons[3]&&pk.buttons[3].pressed)||(pk.buttons[9]&&pk.buttons[9].pressed))anyHeld=true;}
      if(!anyHeld)gpStartFired=false;
    }
    if(!__gp.stopped)__gp.raf=requestAnimationFrame(checkGP);
  }
  checkGP();
})();

  const w = window;
  w.toggleSoundFromGameOver = toggleSoundFromGameOver;
  w.toggleSoundFromStart = toggleSoundFromStart;
  __unmountGameShell = function () {
    __gp.stopped = true;
    if (__gp.raf) cancelAnimationFrame(__gp.raf);
    __gp.raf = 0;
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('keydown', onWinKeydownGame);
  };
}
