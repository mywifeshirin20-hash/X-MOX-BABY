// .song / .play <গানের নাম বা YouTube লিংক>  → অডিও (গান)
// .video / .vsong / .ytv <নাম বা লিংক>        → ভিডিও
// index2.js এই ফাইল লোড করে ব্যবহার করে (আলাদা কিছু চালাতে হয় না)
//
// ⚡ স্পিডের জন্য যা করা হয়েছে:
//   • কার্ড পাঠানো আর ডাউনলোড একসাথে চলে (একটার জন্য আরেকটা অপেক্ষা করে না)
//   • ফাইল সরাসরি ডিস্ক থেকে স্ট্রিম হয়ে যায় (RAM-এ পুরো ফাইল লোড হয় না — ১ GB সার্ভারে নিরাপদ)
//   • একবার নামানো গান/ভিডিও ডিস্ক-ক্যাশে থাকে — একই গান আবার চাইলে সাথে সাথে যায়
//   • সার্চ রেজাল্ট ১৫ মিনিট ক্যাশ থাকে
// 🎯 ঠিক গান দেওয়ার জন্য:
//   • সার্চ রেজাল্ট থেকে নামের সাথে সবচেয়ে মেলে সেটা বাছা হয় (রিমিক্স/স্লো/কভার/লাইভ — তুমি না লিখলে বাদ)
//   • ডাউনলোড ফেল করলে একই গানের পরের সেরা মিলটা চেষ্টা হয়
//   • SoundCloud ফলব্যাকেও নাম না মিললে ভুল গান পাঠায় না

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// ───────────────────────── yt-dlp ফলব্যাক (index2.js থেকে ফাংশন না এলেও song.js নিজে চালাতে পারে) ─────────────────────────
const { execFile } = require('child_process');
const BASE_DIR = fs.existsSync(path.join(__dirname, 'bin', 'yt-dlp')) || fs.existsSync(path.join(__dirname, 'cookies.txt')) ? __dirname : process.cwd();
const YTDLP_BUNDLED = path.join(BASE_DIR, 'bin', 'yt-dlp');
const YTDLP_USE_BUNDLED = fs.existsSync(YTDLP_BUNDLED);
const YTDLP_CMD = YTDLP_USE_BUNDLED ? 'python3' : 'yt-dlp';
// স্টার্টআপে yt-dlp চলে কিনা যাচাই (গান না পেলে কনসোলে এই লাইনটাই আগে দেখো)
setTimeout(() => {
  execFile(YTDLP_CMD, YTDLP_USE_BUNDLED ? [YTDLP_BUNDLED, '--version'] : ['--version'], { timeout: 20000 }, (err, so, se) => {
    if (err) console.error(`❌ yt-dlp চালানো যাচ্ছে না (${YTDLP_USE_BUNDLED ? 'bin/yt-dlp' : 'system yt-dlp'}):`, localReason(se || err.message), '— npm run postinstall চালাও বা pip install yt-dlp দাও');
    else console.log('✅ yt-dlp ঠিক আছে, ভার্সন:', String(so).trim());
  });
}, 3000).unref();
const localReason = (s) => {
  s = String(s || '');
  if (/ENOENT/.test(s)) return 'yt-dlp / python3 পাওয়া যায়নি (ইনস্টল নেই)';
  const line = s.split('\n').map((x) => x.trim()).filter((x) => /ERROR:/i.test(x)).pop() || s.trim().split('\n').pop() || '';
  return line.replace(/^ERROR:\s*/i, '').slice(0, 220) || 'অজানা এরর';
};
function localRun(url, kind, client, opts = {}) {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `yt_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    const fmt = kind === 'audio' ? 'bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio' : '18/best[height<=480][ext=mp4]/best[height<=480]/best';
    const a = ['--no-warnings', '--no-playlist', '--no-mtime', '--no-part', '-N', '8', '--http-chunk-size', '10M',
      '--retries', '3', '--fragment-retries', '3', '--socket-timeout', '15', '-f', fmt, '-o', `${tmp}.%(ext)s`, url];
    if (client) a.unshift('--extractor-args', `youtube:player_client=${client}`);
    const ck = path.join(BASE_DIR, 'cookies.txt');
    try { if (fs.statSync(ck).isFile()) a.unshift('--cookies', ck); } catch {}
    const args = YTDLP_USE_BUNDLED ? [YTDLP_BUNDLED, ...a] : a;
    execFile(YTDLP_CMD, args, { timeout: opts.timeout || (kind === 'audio' ? 90000 : 150000), maxBuffer: 10 * 1024 * 1024 }, (err, _so, se) => {
      if (err) { err.ytReason = localReason(se || err.message); return reject(err); }
      try {
        const dir = path.dirname(tmp), base = path.basename(tmp);
        const found = fs.readdirSync(dir).find((f) => f.startsWith(base) && !/\.(part|ytdl|json)$/i.test(f));
        if (!found) return reject(new Error('yt-dlp output file not found'));
        const full = path.join(dir, found);
        resolve({ file: full, ext: path.extname(full).slice(1) || (kind === 'audio' ? 'm4a' : 'mp4'), size: fs.statSync(full).size });
      } catch (e) { reject(e); }
    });
  });
}
async function localDownload(url, kind, opts = {}) {
  let first;
  if (opts.fast) return localRun(url, kind, undefined, opts); // দ্রুত একবারের চেষ্টা — ফেল করলে কলার ফলব্যাকে যাবে
  try { return await localRun(url, kind, undefined, opts); } catch (e) { first = e; }
  if (!/youtu|ytsearch/i.test(url)) throw first;
  for (const c of ['tv', 'ios', 'mweb', 'web_embedded', 'android']) {
    try { return await localRun(url, kind, c); } catch {}
  }
  throw first;
}
function localSearchJson(query, n = 5, site = 'scsearch') {
  return new Promise((resolve, reject) => {
    const a = ['--no-warnings', '--flat-playlist', '-J', '--socket-timeout', '15', `${site}${n}:${query}`];
    const args = YTDLP_USE_BUNDLED ? [YTDLP_BUNDLED, ...a] : a;
    execFile(YTDLP_CMD, args, { timeout: 30000, maxBuffer: 8 * 1024 * 1024 }, (err, so, se) => {
      if (err) { err.ytReason = localReason(se || err.message); return reject(err); }
      try { resolve(((JSON.parse(so) || {}).entries || []).filter(Boolean)); } catch (e) { reject(e); }
    });
  });
}

const COOLDOWN_MS = 8000;      // একই ইউজার ৮ সেকেন্ডে একবার
const MAX_AUDIO_SEC = 900;     // ১৫ মিনিটের বেশি লম্বা গান নেওয়া হবে না
const MAX_VIDEO_SEC = 600;     // ১০ মিনিটের বেশি লম্বা ভিডিও নেওয়া হবে না
const MAX_VIDEO_MB = 60;       // এর বেশি বড় ভিডিও পাঠানো হবে না
const SEND_AS_FILE = true;     // true = অডিও যাওয়ার পর ফাইল (document) হিসেবেও পাঠাবে (অডিও আগে যায়, দেরি হয় না)
const MAX_PARALLEL = 2;        // একসাথে সর্বোচ্চ কয়টা ডাউনলোড (১ GB RAM সার্ভারের জন্য)
const CACHE_MAX_FILES = 12;
const CACHE_MAX_BYTES = 150 * 1024 * 1024;
const SEARCH_TTL_MS = 15 * 60 * 1000;
const CACHE_DIR = path.join(os.tmpdir(), 'xmox_media_cache');
try { fs.rmSync(CACHE_DIR, { recursive: true, force: true }); } catch {} // বট চালুর সময় পুরোনো ক্যাশ পরিষ্কার

const mimeOf = (ext) => (ext === 'mp3' ? 'audio/mpeg' : ['webm', 'opus', 'ogg'].includes(ext) ? 'audio/ogg; codecs=opus' : 'audio/mp4');
const docMimeOf = (ext) => (ext === 'mp3' ? 'audio/mpeg' : ['webm', 'opus', 'ogg'].includes(ext) ? 'audio/ogg' : 'audio/mp4');
const safeName = (s) => String(s).replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'media';
const md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex').slice(0, 12);

// ───────────────────────── নাম মেলানো (ঠিক গানটাই বাছতে) ─────────────────────────
const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
// তুমি এগুলো লিখলেও টাইটেলে নাও থাকতে পারে — তাই মেলানোর সময় ধরা হয় না
const NOISE = new Set(['song', 'songs', 'audio', 'mp3', 'video', 'mp4', 'download', 'full', 'official', 'new', 'gan', 'gaan', 'গান', 'ভিডিও']);
// তুমি না লিখলে এই ধরনের ভার্সন বাদ দেওয়া হবে (অরিজিনাল গানটাই আগে)
const UNWANTED = ['remix', 'slowed', 'reverb', 'cover', 'karaoke', 'instrumental', 'lofi', 'nightcore', '8d', 'mashup', 'ringtone', 'shorts', 'reaction', 'tutorial', 'status', 'trailer', 'teaser', 'live', 'dj', 'sped', 'bass', 'boosted'];

function scoreVideo(qTokens, qSet, v, idx) {
  const hay = norm(`${v.title || ''} ${(v.author && v.author.name) || ''}`);
  const hayTokens = new Set(hay.split(' '));
  const padded = ` ${hay} `;
  const core = qTokens.filter((t) => !NOISE.has(t));
  const toks = core.length ? core : qTokens;
  if (!toks.length) return 0;
  let hit = 0;
  for (const t of toks) {
    if (t.length <= 2 ? padded.includes(` ${t} `) : hay.includes(t)) hit++;
  }
  let s = hit / toks.length;
  const compactHay = hay.replace(/ /g, '');
  if (compactHay.includes(toks.join(''))) s += 0.3;          // স্পেস/হাইফেন আলাদা হলেও মিলে গেলে বোনাস
  if (hay.startsWith(toks.join(' '))) s += 0.15;              // টাইটেল তোমার লেখা দিয়েই শুরু
  for (const w of UNWANTED) if (hayTokens.has(w) && !qSet.has(w)) s -= 0.35;
  if (v.seconds > 0 && v.seconds < 45) s -= 0.2;              // শর্টস/টিজার
  if (/official|topic/.test(hay)) s += 0.05;
  s += Math.min(0.08, Math.log10((v.views || 0) + 1) / 100);  // সমান হলে জনপ্রিয়টা (সাধারণত আসলটা)
  s -= idx * 0.01;                                            // YouTube-এর নিজের র‍্যাঙ্কও কিছুটা ধরা হয়
  return s;
}

// সবচেয়ে মেলা ভিডিওগুলো সাজিয়ে দেয় (সেরা আগে)
function rank(query, videos, { maxSec, minScore = 0.5, fallbackTop = true, allowZero = false } = {}) {
  const qTokens = norm(query).split(' ').filter(Boolean);
  const qSet = new Set(qTokens);
  const ok = (videos || []).filter((v) => v && v.url && (allowZero && !v.seconds ? true : v.seconds > 0 && v.seconds <= maxSec)).slice(0, 8);
  const scored = ok.map((v, i) => ({ v, i, s: scoreVideo(qTokens, qSet, v, i) }));
  const passing = scored.filter((x) => x.s >= minScore).sort((a, b) => b.s - a.s || a.i - b.i);
  if (passing.length) return passing.map((x) => x.v);
  return fallbackTop && ok.length ? [ok[0]] : []; // বানান ভুল থাকলে YouTube-এর টপ রেজাল্ট
}

// ───────────────────────── সার্চ (ক্যাশসহ) ─────────────────────────
const searchCache = new Map();
const pickInfo = new Map(); // videoId -> সার্চে পাওয়া টাইটেল/চ্যানেল/থাম্বনেইল (বাটন চাপলে আবার yts কল না করতে)
const rememberVideo = (v) => {
  if (!v || !v.videoId) return;
  pickInfo.set(v.videoId, v);
  if (pickInfo.size > 300) pickInfo.delete(pickInfo.keys().next().value);
};
async function searchVideos(yts, q) {
  const key = norm(q);
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.t < SEARCH_TTL_MS) return hit.videos;
  const r = await yts(q);
  const videos = (r && r.videos) || [];
  videos.forEach(rememberVideo);
  searchCache.set(key, { t: Date.now(), videos });
  if (searchCache.size > 60) searchCache.delete(searchCache.keys().next().value);
  return videos;
}

const YT_ID = /(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i;
async function infoFromUrl(yts, text) {
  const m = String(text).match(YT_ID);
  if (!m) return null;
  const url = `https://www.youtube.com/watch?v=${m[1]}`;
  const known = pickInfo.get(m[1]);
  if (known) return { videoId: m[1], title: known.title || 'YouTube', url, seconds: known.seconds || 0, timestamp: known.timestamp, author: known.author, thumbnail: known.thumbnail };
  try {
    const v = await yts({ videoId: m[1] });
    if (v) return { videoId: m[1], title: v.title || 'YouTube', url, seconds: v.seconds || 0, timestamp: v.timestamp, author: v.author, thumbnail: v.thumbnail };
  } catch {}
  return { videoId: m[1], title: 'YouTube', url, seconds: 0, author: null };
}

// ───────────────────────── ডিস্ক ক্যাশ ─────────────────────────
const fileCache = new Map(); // key -> { file, ext, size }
const inUse = new Set();
const cacheKeyOf = (kind, v) => `${kind}_${md5(v.videoId || v.url)}`;
function cacheGet(key) {
  const e = fileCache.get(key);
  if (!e) return null;
  if (!fs.existsSync(e.file)) { fileCache.delete(key); return null; }
  fileCache.delete(key); fileCache.set(key, e); // সদ্য-ব্যবহৃত হিসেবে পিছনে নেওয়া
  return e;
}
function evict() {
  let total = 0;
  for (const e of fileCache.values()) total += e.size;
  for (const [k, e] of fileCache) {
    if (fileCache.size <= CACHE_MAX_FILES && total <= CACHE_MAX_BYTES) break;
    if (inUse.has(e.file)) continue;
    fileCache.delete(k); total -= e.size; fs.unlink(e.file, () => {});
  }
}
function cachePut(key, file, ext) {
  try {
    const size = fs.statSync(file).size;
    if (size > CACHE_MAX_BYTES / 2) return null;
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const dest = path.join(CACHE_DIR, `${key}.${ext}`);
    try { fs.renameSync(file, dest); } catch { fs.copyFileSync(file, dest); fs.unlinkSync(file); }
    fileCache.set(key, { file: dest, ext, size });
    evict();
    return { file: dest, ext, size };
  } catch { return null; }
}

// ───────────────────────── একসাথে কয়টা ডাউনলোড চলবে ─────────────────────────
let active = 0;
const waiters = [];
const acquire = () => (active < MAX_PARALLEL ? (active++, Promise.resolve()) : new Promise((r) => waiters.push(r)));
const release = () => { const n = waiters.shift(); if (n) n(); else active--; };

// SoundCloud ফলব্যাক — নাম না মিললে কিছু পাঠায় না (ভুল গান দেওয়ার চেয়ে "পাওয়া যায়নি" ভালো)
async function soundcloudFallback(q, ytDlpDownload, ytDlpSearchJson) {
  if (typeof ytDlpSearchJson !== 'function') return null;
  const entries = await ytDlpSearchJson(q, 6, 'scsearch');
  const vids = entries.map((e) => ({
    title: e.title, author: { name: e.uploader || '' }, seconds: e.duration || 0, views: 0,
    url: e.url || e.webpage_url,
  })).filter((e) => e.url);
  const best = rank(q, vids, { maxSec: MAX_AUDIO_SEC, minScore: 0.6, fallbackTop: false, allowZero: true })[0];
  if (!best) return null;
  const got = await ytDlpDownload(best.url, 'audio', { asFile: true });
  return { got, v: best };
}


// ───────────────────────── 🎧 অডিও ডাউনলোড (YouTube অডিও-অনলি ফরম্যাট ব্লক করলেও যেন গান আসে) ─────────────────────────
// ১) অডিও-অনলি m4a দ্রুত একবার চেষ্টা (৪৫ সেকেন্ড) ২) না হলে ভিডিও (যেটা ঠিক চলে) নামিয়ে তার থেকে অডিও বের করা
let ffmpegOk = null;
function hasFfmpeg() {
  if (ffmpegOk !== null) return Promise.resolve(ffmpegOk);
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-version'], { timeout: 8000 }, (err) => { ffmpegOk = !err; resolve(ffmpegOk); });
  });
}
function ffmpegRun(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { timeout: 90000, maxBuffer: 4 * 1024 * 1024 }, (err, _so, se) => (err ? reject(new Error(String(se || err.message).slice(-200))) : resolve()));
  });
}
async function getAudio(ytDlpDownload, url) {
  try {
    return await ytDlpDownload(url, 'audio', { asFile: true, timeout: 45000, fast: true });
  } catch (e) {
    console.error('অডিও-অনলি ফেল, ভিডিও থেকে অডিও বের করছি:', String(e.ytReason || e.message).slice(0, 160));
  }
  return ytDlpDownload(url, 'video', { asFile: true });
}
// WhatsApp যেটা অডিও হিসেবে চালাতে পারে (m4a/mp3) সেটাই বানায়; ffmpeg না থাকলে যা আছে তাই ফেরত
async function toPlayableAudio(got) {
  const ext = String(got.ext || '').toLowerCase();
  if (ext === 'm4a' || ext === 'mp3') return got;
  if (!(await hasFfmpeg())) return got;
  const out = got.file.replace(/\.[^.\\/]+$/, '') + '_a.m4a';
  const tryRun = async (codecArgs) => { await ffmpegRun(['-y', '-v', 'error', '-i', got.file, '-vn', ...codecArgs, '-movflags', '+faststart', out]); };
  try {
    if (['mp4', 'mov', 'm4v'].includes(ext)) {
      try { await tryRun(['-c:a', 'copy']); } catch { await tryRun(['-c:a', 'aac', '-b:a', '128k']); }
    } else {
      await tryRun(['-c:a', 'aac', '-b:a', '128k']);
    }
    const size = fs.statSync(out).size;
    if (!size) throw new Error('empty');
    fs.unlink(got.file, () => {});
    return { file: out, ext: 'm4a', size };
  } catch (e) {
    console.error('অডিও কনভার্ট ফেল:', e.message);
    try { fs.unlinkSync(out); } catch {}
    return got;
  }
}

// ───────────────────────── মূল কমান্ড ─────────────────────────
async function mediaCommand(kind, ctx) {
  const { sock, m, from, text, reply, sender, yts, num, prefix = '.' } = ctx;
  // index2.js থেকে ফাংশন না এলেও যেন "is not a function" না হয়
  const ytDlpDownload = typeof ctx.ytDlpDownload === 'function' ? ctx.ytDlpDownload : localDownload;
  const ytDlpSearchJson = typeof ctx.ytDlpSearchJson === 'function' ? ctx.ytDlpSearchJson : localSearchJson;
  const songCooldown = ctx.songCooldown && typeof ctx.songCooldown === 'object' ? ctx.songCooldown : (globalThis.__songCd = globalThis.__songCd || {});
  const isVideo = kind === 'video';
  if (!text || !String(text).trim()) {
    return reply(isVideo
      ? `🎬 ভিডিওর নাম বা YouTube লিংক লেখো।\nযেমন: ${prefix}video tum hi ho\nবা: ${prefix}video https://youtu.be/...`
      : `🎵 গানের নাম বা YouTube লিংক লেখো।\nযেমন: ${prefix}song tum hi ho\nবা: ${prefix}play kothin prem`);
  }
  const q = String(text).trim();
  const k = num(sender), now = Date.now();
  if (songCooldown[k] && now - songCooldown[k] < COOLDOWN_MS) {
    return reply(`⏳ ${Math.ceil((COOLDOWN_MS - (now - songCooldown[k])) / 1000)} সেকেন্ড পর আবার চেষ্টা করো।`);
  }
  songCooldown[k] = now;
  const t0 = Date.now();
  const maxSec = isVideo ? MAX_VIDEO_SEC : MAX_AUDIO_SEC;

  // ১) কোন ভিডিওটা — লিংক হলে সরাসরি, নাম হলে সবচেয়ে মেলাটা
  let cands = [], searchFailed = false, direct = null;
  try {
    direct = await infoFromUrl(yts, q);
    if (direct) {
      if (direct.seconds > maxSec) { songCooldown[k] = 0; return reply(`❌ এটা অনেক লম্বা (সর্বোচ্চ ${Math.round(maxSec / 60)} মিনিট)।`); }
      cands = [direct];
    } else {
      cands = rank(q, await searchVideos(yts, q), { maxSec }).slice(0, 2);
    }
  } catch (e) { console.error('media search:', e.message); searchFailed = true; }
  if (!cands.length && !searchFailed) { songCooldown[k] = 0; return reply(`❌ ${isVideo ? 'ভিডিও' : 'গান'} পাওয়া যায়নি (বা ${Math.round(maxSec / 60)} মিনিটের বেশি লম্বা)।`); }

  const primary = cands[0] || { title: q, url: `ytsearch1:${q}`, videoId: md5(q), author: null };
  const cached = cands.length ? cacheGet(cacheKeyOf(kind, primary)) : null;

  // ২) কার্ড পাঠানো — ডাউনলোডের সাথে একসাথে চলে
  const caption = `${isVideo ? '🎬' : '🎵'} *${primary.title}*\n\n👤 ${primary.author?.name || '-'}\n⏱ ${primary.timestamp || '-'}\n${primary.videoId && cands.length ? `🔗 https://youtu.be/${primary.videoId}\n` : ''}\n${cached ? '⚡ পাঠাচ্ছি...' : '⏳ ডাউনলোড হচ্ছে...'}`;
  const cardP = (async () => {
    try {
      if (primary.thumbnail) await sock.sendMessage(from, { image: { url: primary.thumbnail }, caption }, { quoted: m });
      else await reply(caption);
    } catch { try { await reply(caption); } catch {} }
  })();

  // ৩) ডাউনলোড (ক্যাশে থাকলে ডাউনলোডই লাগে না)
  let got = null, used = primary, why = '';
  if (cached) {
    got = { file: cached.file, ext: cached.ext, cached: true };
  } else {
    await acquire();
    try {
      const targets = cands.length ? cands : [primary];
      for (const c of targets) {
        try { got = isVideo ? await ytDlpDownload(c.url, kind, { asFile: true }) : await getAudio(ytDlpDownload, c.url); used = c; break; }
        catch (e) { console.error(`media yt (${c.title}):`, e.message); why = e.ytReason || e.message; }
      }
      if (!got && !isVideo && !direct) {
        try {
          const sc = await soundcloudFallback(q, ytDlpDownload, ytDlpSearchJson);
          if (sc) { got = sc.got; used = sc.v; }
          else why += ' | SoundCloud-এ হুবহু মেলা গান নেই';
        } catch (e2) { console.error('media sc:', e2.message); why += ` | SoundCloud: ${e2.ytReason || e2.message}`; }
      }
    } finally { release(); }
  }

  await cardP;
  if (!got) {
    songCooldown[k] = 0;
    const bot = /not a bot|sign in/i.test(why);
    return reply(bot
      ? '❌ YouTube এই সার্ভারকে ব্লক করেছে।\n🛠 cookies.txt (YouTube কুকি) index2.js-এর পাশে রেখে বট রিস্টার্ট দাও।'
      : `❌ ${isVideo ? 'ভিডিও' : 'গান'} ডাউনলোড করা যায়নি।\n🔎 ${String(why).slice(0, 180)}`);
  }

  // ৪) পাঠানো
  if (!isVideo && !got.cached) { try { got = await toPlayableAudio(got); } catch (e) { console.error('toPlayableAudio:', e.message); } }
  let { file, ext } = got;
  let temp = !got.cached;
  try {
    const size = fs.statSync(file).size;
    if (isVideo && size > MAX_VIDEO_MB * 1024 * 1024) {
      songCooldown[k] = 0;
      if (temp) fs.unlink(file, () => {});
      return reply(`❌ ভিডিওটা অনেক বড় (${Math.round(size / 1048576)} MB) — ছোট/কম লম্বা ভিডিও চেষ্টা করো।`);
    }
  } catch {}
  if (temp) {
    const c = cachePut(cacheKeyOf(kind, used), file, ext);
    if (c) { file = c.file; temp = false; }
  }
  inUse.add(file);
  try {
    if (isVideo) {
      if (ext === 'mp4' || ext === 'mov') {
        await sock.sendMessage(from, { video: { url: file }, mimetype: 'video/mp4', caption: `🎬 ${used.title}` }, { quoted: m });
      } else { // WhatsApp mp4 ছাড়া চালাতে পারে না — ফাইল হিসেবে পাঠাই যাতে অন্তত ডাউনলোড করা যায়
        await sock.sendMessage(from, { document: { url: file }, mimetype: 'video/' + ext, fileName: `${safeName(used.title)}.${ext}`, caption: `🎬 ${used.title}` }, { quoted: m });
      }
    } else {
      try {
        await sock.sendMessage(from, { audio: { url: file }, mimetype: mimeOf(ext) }, { quoted: m });
      } catch (ea) {
        // অডিও বার্তা না গেলে (WhatsApp/লাইব্রেরি সমস্যা) ফাইল হিসেবে পাঠাই — গান যেন তবুও পৌঁছায়
        console.error('media audio fallback:', ea.message);
        await sock.sendMessage(from, { document: { url: file }, mimetype: docMimeOf(ext), fileName: `${safeName(used.title)}.${ext}`, caption: `🎧 ${used.title}` }, { quoted: m });
        if (SEND_AS_FILE) { /* ফাইল ইতিমধ্যে গেছে */ }
        return;
      }
      if (SEND_AS_FILE) {
        await sock.sendMessage(from, { document: { url: file }, mimetype: docMimeOf(ext), fileName: `${safeName(used.title)}.${ext}`, caption: `🎧 ${used.title}` }, { quoted: m });
      }
    }
    console.log(`[${kind}] "${used.title}" — ${((Date.now() - t0) / 1000).toFixed(1)}s ${got.cached ? '(ক্যাশ)' : ''}`);
  } catch (e) {
    console.error('media send:', e.message);
    songCooldown[k] = 0;
    try { await reply('❌ পাঠানো যায়নি, আবার চেষ্টা করো।'); } catch {}
  } finally {
    inUse.delete(file);
    if (temp) fs.unlink(file, () => {});
  }
}


// ───────────────────────── 🎵 অডিও / 🎬 ভিডিও বাটন (ক্লিক করলে সেটাই আসবে) ─────────────────────────
// .song / .play <নাম বা লিংক> → কার্ডের নিচে ২টা বাটন। অডিও চাপলে গান, ভিডিও চাপলে ভিডিও।
// বাটনের id = ".ytpick a <videoId>" / ".ytpick v <videoId>" — index2.js এ 'ytpick' কেস সেটা ধরে।
async function sendPickCard(sock, from, m, v, prefix) {
  const baileys = require('@whiskeysockets/baileys');
  const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = baileys;
  const caption = `🎵 *${v.title}*\n\n👤 ${v.author?.name || '-'}\n⏱ ${v.timestamp || '-'}\n\n👇 কোনটা চাও? বাটনে চাপো`;
  const buttons = [
    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎵 অডিও', id: `${prefix}ytpick a ${v.videoId}` }) },
    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎬 ভিডিও', id: `${prefix}ytpick v ${v.videoId}` }) },
  ];
  let header = proto.Message.InteractiveMessage.Header.create({ title: '', subtitle: '', hasMediaAttachment: false });
  if (v.thumbnail) {
    try {
      const media = await prepareWAMessageMedia({ image: { url: v.thumbnail } }, { upload: sock.waUploadToServer });
      header = proto.Message.InteractiveMessage.Header.create({ title: '', subtitle: '', hasMediaAttachment: true, imageMessage: media.imageMessage });
    } catch (e) { console.error('pick thumb:', e.message); }
  }
  const myJid = (sock.user && sock.user.id ? sock.user.id.split(':')[0] : '') + '@s.whatsapp.net';
  const wm = generateWAMessageFromContent(from, {
    viewOnceMessage: { message: {
      messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
      interactiveMessage: proto.Message.InteractiveMessage.create({
        body: proto.Message.InteractiveMessage.Body.create({ text: caption }),
        footer: proto.Message.InteractiveMessage.Footer.create({ text: 'Mox Baby' }),
        header,
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons }),
      }),
    } },
  }, { userJid: myJid, quoted: m });
  await sock.relayMessage(from, wm.message, {
    messageId: wm.key.id,
    additionalNodes: [{ tag: 'biz', attrs: {}, content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }] }],
  });
}

async function songPickCommand(ctx) {
  const { sock, m, from, text, reply, yts, prefix = '.' } = ctx;
  if (!text || !String(text).trim()) {
    return reply(`🎵 গান/ভিডিওর নাম বা YouTube লিংক লেখো।\nযেমন: ${prefix}song tum hi ho\nবা: ${prefix}play kothin prem`);
  }
  const q = String(text).trim();
  let v = null;
  try {
    v = await infoFromUrl(yts, q);
    if (!v) v = rank(q, await searchVideos(yts, q), { maxSec: MAX_VIDEO_SEC > MAX_AUDIO_SEC ? MAX_VIDEO_SEC : MAX_AUDIO_SEC })[0];
  } catch (e) { console.error('pick search:', e.message); }
  if (!v || !v.videoId) return reply('❌ গান/ভিডিও পাওয়া যায়নি। অন্যভাবে নামটা লিখে দেখো।');
  rememberVideo(v);
  try {
    await sendPickCard(sock, from, m, v, prefix);
  } catch (e) {
    console.error('pick buttons:', e.message);
    // বাটন না গেলে লেখা দিয়েই বেছে নেওয়া যাবে
    await reply(`🎵 *${v.title}*\n👤 ${v.author?.name || '-'}  ⏱ ${v.timestamp || '-'}\n\n🎵 অডিও চাইলে লেখো: ${prefix}playnow https://youtu.be/${v.videoId}\n🎬 ভিডিও চাইলে লেখো: ${prefix}video https://youtu.be/${v.videoId}`);
  }
}

const songCommand = (ctx) => mediaCommand('audio', ctx);
const videoCommand = (ctx) => mediaCommand('video', ctx);

// বাটন সিস্টেম বন্ধ — index2.js এর import ঠিক রাখতে ফাঁকা ফাংশন
const ytGetCommand = async () => {};

module.exports = { songPickCommand, songCommand, videoCommand, ytGetCommand, _rank: rank };
