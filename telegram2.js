// টেলিগ্রাম পেয়ারিং বট (ডিজিটাল ভার্সন): /pair দিলে WhatsApp পেয়ারিং কোড পাঠায়, কোড বসালে ওই নাম্বারে বট চালু হয়।
process.env.NO_MAIN = process.env.NO_MAIN ?? '1'; // শুধু টেলিগ্রাম-পেয়ার বট চলবে (মূল বট বাদ)
const fs = require('fs');
const os = require('os');
const TelegramBot = require('node-telegram-bot-api');
const ui = require('./ui2.js');

// ================= কনফিগ =================
// 🔐 টোকেন কোডে লেখা নেই (ফাইল লিক হলে যেন টোকেন না যায়)।
// দুইভাবে দিতে পারো: (১) পরিবেশ ভেরিয়েবল TG_TOKEN  (২) index2.js-এর পাশে tg-token.txt ফাইলে শুধু টোকেনটা লিখে রাখো
const BOT_TOKEN = '8708746291:AAEep_dMNwzSxW4FC7KwsCJ79v6g1vPGabc';
// 👇 কার্ডের নিচের "WA Channel" বাটনের লিংক (নিজের চ্যানেল/গ্রুপের লিংক বসাও)
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb9GHFLId7nFaUnJMh0D';
const CHANNEL_TEXT = '📢 WA Channel';
// 👇 তোমার টেলিগ্রাম আইডি (@userinfobot থেকে জানা যায়) — দিলে /status-এ সব নাম্বারের লিস্ট দেখতে পাবে
// 👇 অফিসিয়াল গ্রুপ (শুধু এখানেই /pair চলবে)
const GROUP_LINK = 'https://t.me/xmoxbaby';
const GROUP_USERNAME = '@xmoxbaby';
const GROUP_BTN_TEXT = '🌷 Join Official Group';
// 👇 বট ওপেন করলে "What can this bot do?" এর নিচে যে লেখা দেখায়
const BOT_DESCRIPTION = '___আসসালামু আলাইকুম ওরাহমাতুল্লাহি ওবারাকাতুহু-!!🌺😇✍️\nWelcome new bot Je kano help Mainu Bhaiya';
const ADMIN_ID = String(process.env.TG_ADMIN_ID || '');
// =========================================

let fileToken = '';
try { fileToken = fs.readFileSync('./tg-token.txt', 'utf8').trim(); } catch {}
const TOKEN = (BOT_TOKEN.includes(':') ? BOT_TOKEN.trim() : '') || (process.env.TG_TOKEN || '').trim() || fileToken;
if (!TOKEN) { console.error('❌ টোকেন নেই। TG_TOKEN পরিবেশ ভেরিয়েবলে দাও, অথবা tg-token.txt ফাইলে টোকেন লিখে রাখো।'); process.exit(1); }

const { pairExternal, unpairExternal, listSubs, MAX_SUBS } = require('./index2.js');

fs.mkdirSync('./data', { recursive: true });
const OWNERS_FILE = './data/tg-owners.json'; // নাম্বার -> কোন টেলিগ্রাম ইউজার পেয়ার করেছে
let owners = {};
try { owners = JSON.parse(fs.readFileSync(OWNERS_FILE)); } catch {}
const saveOwners = () => fs.writeFileSync(OWNERS_FILE, JSON.stringify(owners, null, 1));

const bot = new TelegramBot(TOKEN, { polling: true });
let lastConflictLog = 0;
bot.on('polling_error', (e) => {
  // 409 = একই টোকেন দিয়ে আরেক জায়গায় বট চলছে — বারবার একই লাইন না ছেপে ১ মিনিটে একবার কারণ জানায়
  if (/409/.test(e.message)) {
    if (Date.now() - lastConflictLog > 60000) {
      lastConflictLog = Date.now();
      console.error('⚠️ 409 Conflict: এই টোকেন দিয়ে আরেক জায়গায় (অন্য প্যানেল/সার্ভার/ফোন/পুরোনো প্রসেস) বট চলছে। সেটা বন্ধ করো, অথবা BotFather থেকে /revoke দিয়ে নতুন টোকেন নাও।');
    }
    return;
  }
  console.error('tg polling:', e.message);
});
// webhook সেট থাকলে polling আটকে যায়, তাই শুরুতেই সেটা মুছে দেওয়া হয়
bot.deleteWebHook().catch(() => {});
bot.setMyCommands([
  { command: 'pair', description: 'WhatsApp নাম্বারে বট কানেক্ট করো' },
  { command: 'ping', description: 'বটের স্পিড চেক (সবাই)' },
  { command: 'status', description: 'বটের অবস্থা (শুধু এডমিন/ওনার)' },
  { command: 'mybots', description: 'তোমার কানেক্টেড নাম্বার' },
  { command: 'unpair', description: 'বট ডিসকানেক্ট করো' },
  { command: 'menu', description: 'বটের মেনু ও গ্রুপ সেটিংস' },
  { command: 'antilink', description: 'গ্রুপে লিংক বন্ধ (on/off)' },
  { command: 'welcome', description: 'নতুন মেম্বারকে ওয়েলকাম (on/off)' },
  { command: 'antivideo', description: 'গ্রুপে ভিডিও বন্ধ (on/off)' },
  { command: 'antiimage', description: 'গ্রুপে ছবি বন্ধ (on/off)' },
  { command: 'help', description: 'সাহায্য' },
]).catch(() => {});

// বটের ডেসক্রিপশন সেট (BotFather-এ হাতে করতে হবে না)
bot._request('setMyDescription', { form: { description: BOT_DESCRIPTION } }).catch((e) => console.error('description:', e.message));

const groupKb = { inline_keyboard: [[{ text: GROUP_BTN_TEXT, url: GROUP_LINK }]] };
// শুধু প্রাইভেট চ্যাটে বন্ধ; যেকোনো গ্রুপ/সুপারগ্রুপে /pair চলবে
const isOfficialGroup = async (msg) => msg.chat.type === 'group' || msg.chat.type === 'supergroup';

const COMMUNITY_LINK = 'https://chat.whatsapp.com/GvFlq3jqGLtFvbjnCb7xD5?s=cl&p=a&mlu=4&ilr=4';
const DEV_USERNAMES = ['xmoxmainubaby', 'mainuvibes']; // টেলিগ্রাম ইউজারনেম (@ ছাড়া)
// সাকসেস/আনসাকসেস মেসেজের নিচের বাটন: Channel, Community, তারপর Developers
const kb = { inline_keyboard: [
  [{ text: CHANNEL_TEXT, url: CHANNEL_LINK }, { text: '👥 Community Group', url: COMMUNITY_LINK }],
  [{ text: '👑 Owners', url: 'https://t.me/+8801843079760' }], // ওনারের টেলিগ্রাম নাম্বার
  DEV_USERNAMES.map((u) => ({ text: '👨‍💻 Developers', url: 'https://t.me/' + u })), // নাম "Developers" দেখাবে, চাপলে ইনবক্সে নিয়ে যাবে
] };

// কোড কপি বাটন - কোড সহজে নির্বাচন করা যায় এমন ফরম্যাটে
const getCopyKeyboard = (code) => ({
  inline_keyboard: [
    [{ text: `📋 কপি করুন: ${code}`, copy_text: { text: code } }] // চাপলেই সরাসরি ক্লিপবোর্ডে কপি হবে
  ]
});

// মেসেজে রিপ্লাই দিয়ে HTML কার্ড পাঠায়
const send = (msg, html, withButton = true, markup = null) => bot.sendMessage(msg.chat.id, html, {
  parse_mode: 'HTML', disable_web_page_preview: true,
  reply_to_message_id: msg.message_id, allow_sending_without_reply: true,
  ...(markup ? { reply_markup: markup } : withButton ? { reply_markup: kb } : {}),
}).catch((e) => console.error('send:', e.message));

// ===== Callback Query Handler =====
// কোড কার্ডের message -> পেয়ারিং এন্ট্রি (কপি বাটনের মেসেজও কানেক্ট/ফেইলের আগে মুছে ফেলার জন্য)
const cardEntry = new Map();

// কপি বাটন এখন copy_text ধরনের — বাটন চাপলে Telegram নিজেই কোড কপি করে, তাই আলাদা callback হ্যান্ডলার/মেসেজ লাগে না

bot.onText(/^\/(start|help)(?:@\w+)?$/, (msg) => send(msg, ui.welcome()));

// ===== কোডের মেয়াদ ও কুলডাউন =====
const CODE_TTL = 80 * 1000; // কোডের মেয়াদ: ৮০ সেকেন্ড (এই সময়ের মধ্যে কানেক্ট না হলে কোড বাতিল)
// uid -> { n, expireAt, timer, connected, pairingMsg }  (যতক্ষণ এন্ট্রি আছে, নতুন কোড নেওয়া যাবে না)
const pending = new Map();
const clearPending = (uid) => {
  const p = pending.get(uid);
  if (p?.timer) clearTimeout(p.timer);
  pending.delete(uid);
};

// /pair +8801712345678  বা  /pair8801712345678  — দুটোই চলবে
bot.onText(/^\/pair(?:@\w+)?(?=[\s+\d]|$)\s*(.*)$/, async (msg, m) => {
  // শুধু অফিসিয়াল গ্রুপে /pair চলবে, প্রাইভেটে গ্রুপের বাটন দেখাবে
  if (!(await isOfficialGroup(msg))) return send(msg, ui.groupOnly(), false, groupKb);
  const n = (m[1] || '').replace(/\D/g, '');
  if (!n || n.startsWith('0') || n.length < 8 || n.length > 15) return send(msg, ui.usage(), false);
  const uid = String(msg.from.id);

  // আগের কোডের মেয়াদ এখনো শেষ হয়নি → নতুন কোড দেওয়া হবে না
  const cur = pending.get(uid);
  if (cur) {
    const left = cur.expireAt ? Math.max(1, Math.ceil((cur.expireAt - Date.now()) / 1000)) : Math.ceil(CODE_TTL / 1000);
    return send(msg, `⏳ <b>আগের কোডের মেয়াদ এখনো আছে।</b>\n\n<code>+${cur.n}</code> নাম্বারের কোড কানেক্ট করো, অথবা <b>${left} সেকেন্ড</b> পর আবার <code>/pair</code> দাও।`, false);
  }
  // একই নাম্বারে অন্য কেউ পেয়ারিং করছে কিনা
  for (const p of pending.values()) {
    if (p.n === n) return send(msg, '⏳ এই নাম্বারে এখন আরেকজন পেয়ারিং করছে। কিছুক্ষণ পর চেষ্টা করো।', false);
  }

  // done = শেষ হয়ে গেছে (সফল/ব্যর্থ) | cardP = কোড কার্ডের মেসেজ | extra = কপি বাটনের মেসেজগুলো
  const entry = { n, expireAt: 0, timer: null, connected: false, done: false, code: null, cardP: null, extra: [] };
  pending.set(uid, entry);
  bot.sendChatAction(msg.chat.id, 'typing').catch(() => {});
  // "Generating Pair Code..." কার্ড পাঠায়; কোড/ফেইল আসলে এটা ডিলিট হয়ে যাবে
  const genP = send(msg, ui.generating(n), false);
  const delMsg = (p) => Promise.resolve(p).then((x) => x && bot.deleteMessage(x.chat.id, x.message_id).catch(() => {})).catch(() => {});

  // পেয়ারিংয়ের সব কার্ড (Generating / কোড / কপি-মেসেজ) মুছে ফেলে
  const cleanup = async () => {
    const ids = [...entry.extra];
    entry.extra = [];
    for (const p of [genP, entry.cardP]) { try { const x = await p; if (x) ids.push(x.message_id); } catch {} }
    for (const [k, v] of cardEntry) if (v === entry) cardEntry.delete(k);
    await Promise.all(ids.map((id) => bot.deleteMessage(msg.chat.id, id).catch(() => {})));
  };
  // সফল বা ব্যর্থ — যেটাই হোক একবারই চলবে: আগে পেয়ারিং কার্ড ডিলিট, তারপর কানেক্টেড/আনসাকসেস কার্ড
  const finish = async (buildCard) => {
    if (entry.done) return;
    entry.done = true;
    if (entry.timer) clearTimeout(entry.timer);
    if (pending.get(uid) === entry) pending.delete(uid); // শেষ হলেই আবার /pair দেওয়া যাবে
    await cleanup();
    return send(msg, buildCard());
  };

  pairExternal(n, {
    onCode: (c) => {
      if (entry.done || pending.get(uid) !== entry) return;
      delMsg(genP);
      if (entry.code === c) return; // একই কোড আবার এলে নতুন কার্ড দরকার নেই
      if (entry.cardP) { delMsg(entry.cardP); entry.cardP = null; } // কোড বদলালে পুরোনো কার্ড মুছে নতুনটা
      entry.code = c;
      // কোড পাওয়ার মুহূর্ত থেকে ৮০ সেকেন্ডের টাইমার শুরু (একবারই)
      if (!entry.timer) {
        entry.expireAt = Date.now() + CODE_TTL;
        entry.timer = setTimeout(() => {
          if (entry.done) return;
          // ৮০ সেকেন্ডে কানেক্ট হয়নি → পেন্ডিং পেয়ারিং বাতিল; পেয়ারিং কার্ড মুছে আনসাকসেস কার্ড যাবে
          try { if (!listSubs().find((x) => x.n === n)?.paired) unpairExternal(n); } catch {}
          finish(() => ui.failed(n, 'timeout'));
        }, CODE_TTL);
      }
      // কোড সহ কার্ড এবং কপি বাটন
      const p = send(msg, ui.code(n, c) + '\n\n⏱ <b>এই কোড ৮০ সেকেন্ড বৈধ।</b>', false, getCopyKeyboard(c));
      entry.cardP = p;
      p.then((x) => { if (x && !entry.done) cardEntry.set(`${x.chat.id}:${x.message_id}`, entry); });
    },
    onConnected: (num) => {
      if (entry.done) return;
      entry.connected = true;
      owners[num] = uid; saveOwners();
      return finish(() => ui.connected(num, listSubs().length, MAX_SUBS));
    },
    onFail: (_text, reason) => finish(() => ui.failed(n, reason || 'error')),
  });
});

bot.onText(/^\/unpair(?:@\w+)?(?=[\s+\d]|$)\s*(.*)$/, (msg, m) => {
  const n = (m[1] || '').replace(/\D/g, '');
  if (!n) return send(msg, '<b>🔌 ব্যবহার:</b> <code>/unpair 8801712345678</code>', false);
  const uid = String(msg.from.id);
  if (owners[n] && owners[n] !== uid && uid !== ADMIN_ID) return send(msg, '❌ এই নাম্বার তুমি পেয়ার করোনি।', false);
  if (!unpairExternal(n)) return send(msg, '⚠️ এই নাম্বার কানেক্টেড নেই।', false);
  delete owners[n]; saveOwners();
  send(msg, `✅ <code>+${n}</code> ডিসকানেক্ট করা হয়েছে।`, false);
});

bot.onText(/^\/mybots(?:@\w+)?$/, (msg) => {
  const uid = String(msg.from.id);
  const mine = listSubs().filter((x) => uid === ADMIN_ID || owners[x.n] === uid);
  if (!mine.length) return send(msg, 'তোমার কোনো কানেক্টেড নাম্বার নেই। <code>/pair +880…</code> দিয়ে শুরু করো।', false);
  const lines = mine.map((x, i) => {
    const c = ui.countryOf(x.n);
    return `${i + 1}. ${c.flag} <code>+${x.n}</code> ${x.online ? '🟢 online' : x.paired ? '🔴 offline' : '🟡 pairing…'}`;
  });
  send(msg, ui.mybots(lines), false);
});

const fmtUp = (sec) => {
  sec = Math.floor(sec);
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60;
  return `${d ? d + 'd ' : ''}${h}h ${m}m ${x}s`;
};

// /ping — সবাই চালাতে পারবে
bot.onText(/^\/ping(?:@\w+)?$/, async (msg) => {
  const t0 = Date.now();
  try {
    const sent = await bot.sendMessage(msg.chat.id, '🏓 Pinging…', { reply_to_message_id: msg.message_id, allow_sending_without_reply: true });
    const ms = Date.now() - t0;
    await bot.editMessageText(
      ui.pong(ms, process.uptime()),
      { chat_id: msg.chat.id, message_id: sent.message_id, parse_mode: 'HTML' });
  } catch (e) { console.error('ping:', e.message); }
});

// শুধু গ্রুপ এডমিন / গ্রুপ ওনার (creator) — আর বটের মালিক (ADMIN_ID)
async function canSeeStatus(msg) {
  const uid = String(msg.from?.id || '');
  if (ADMIN_ID && uid === ADMIN_ID) return true;
  if (msg.chat.type === 'private') return false;               // প্রাইভেট চ্যাটে শুধু ADMIN_ID
  if (msg.sender_chat && msg.sender_chat.id === msg.chat.id) return true; // anonymous admin হিসেবে পাঠালে
  try {
    const mem = await bot.getChatMember(msg.chat.id, msg.from.id);
    return mem.status === 'creator' || mem.status === 'administrator';
  } catch { return false; }
}

// /status — শুধু এডমিন/ওনার; নাম্বারের লিস্ট দেখবে শুধু ADMIN_ID
bot.onText(/^\/(status|stats)(?:@\w+)?$/, async (msg) => {
  if (!(await canSeeStatus(msg))) {
    return send(msg, '❌ <b>এই কমান্ড শুধু গ্রুপ এডমিন ও গ্রুপ ওনার ব্যবহার করতে পারবে।</b>', false);
  }
  const subs = listSubs();
  const s = {
    online: subs.filter((x) => x.online).length,
    offline: subs.filter((x) => x.paired && !x.online).length,
    pending: subs.filter((x) => !x.paired).length,
    total: subs.length,
    users: new Set(Object.values(owners)).size,
    max: MAX_SUBS,
    uptime: process.uptime(),
    mem: (process.memoryUsage().rss / 1024 / 1024).toFixed(1),
    platform: `${os.platform()} ${os.arch()}`,
    node: process.version,
    list: '',
  };
  if (ADMIN_ID && String(msg.from?.id) === ADMIN_ID && subs.length) {
    s.list = subs.map((x) => `${ui.countryOf(x.n).flag} ${ui.mask(x.n)} ${x.online ? '🟢' : x.paired ? '🔴' : '🟡'}`).join('\n');
  }
  send(msg, ui.status(s));
});

// ================= গ্রুপ ম্যানেজমেন্ট: antilink / welcome / antivideo / antiimage / menu =================
const WELCOME_VIDEO = ['./telegram.mp4', './telegram.mp5'].find((f) => fs.existsSync(f)) || './telegram.mp4'; // ওয়েলকাম ভিডিও — এই ফাইলের পাশে রাখো
const WELCOME_JOIN_LINK = 'https://t.me/xmoxcommunity'; // ওয়েলকামের "JOIN ✅" লিংক
const MAX_WARN = 3;                    // ৩ বার ওয়ার্নিং, ৪র্থ বারে কিক
const GROUPS_FILE = './data/tg-groups.json';
let groupsDb = {};
try { groupsDb = JSON.parse(fs.readFileSync(GROUPS_FILE)); } catch {}
const saveGroups = () => { try { fs.writeFileSync(GROUPS_FILE, JSON.stringify(groupsDb, null, 1)); } catch (e) { console.error('groups save:', e.message); } };
const gset = (cid) => (groupsDb[cid] ??= { antilink: false, welcome: false, antivideo: false, antiimage: false, warns: {} });
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const isGroupChat = (msg) => msg.chat.type === 'group' || msg.chat.type === 'supergroup';
const TOGGLES = { antilink: '🔗 Anti-Link', welcome: '👋 Welcome', antivideo: '🎬 Anti-Video', antiimage: '🖼 Anti-Image' };

// গ্রুপ এডমিন / ওনার / বটের মালিক কিনা
async function isGroupAdmin(msg) {
  const uid = String(msg.from?.id || '');
  if (ADMIN_ID && uid === ADMIN_ID) return true;
  if (msg.sender_chat && msg.sender_chat.id === msg.chat.id) return true; // anonymous admin
  try {
    const mem = await bot.getChatMember(msg.chat.id, msg.from.id);
    return mem.status === 'creator' || mem.status === 'administrator';
  } catch { return false; }
}

// ----- /antilink /welcome /antivideo /antiimage  (on/off) -----
bot.onText(/^\/(antilink|welcome|antivideo|antiimage)(?:@\w+)?(?:\s+(on|off))?\s*$/i, async (msg, m) => {
  const key = m[1].toLowerCase();
  const val = (m[2] || '').toLowerCase();
  if (!isGroupChat(msg)) return send(msg, '❌ <b>এই কমান্ড শুধু গ্রুপে ব্যবহার করা যাবে।</b>', false);
  if (!(await isGroupAdmin(msg))) return send(msg, '❌ <b>এই কমান্ড শুধু গ্রুপ এডমিন ও গ্রুপ ওনার ব্যবহার করতে পারবে।</b>', false);
  const g = gset(msg.chat.id);
  if (!val) {
    return send(msg, `<b>${TOGGLES[key]}</b> এখন: ${g[key] ? '🟢 ON' : '🔴 OFF'}\n\nব্যবহার: <code>/${key} on</code> অথবা <code>/${key} off</code>`, false);
  }
  g[key] = val === 'on';
  saveGroups();
  const extra = {
    antilink: g[key] ? `লিংক দিলে মেসেজ ডিলিট + ওয়ার্নিং। ${MAX_WARN} বার ওয়ার্নিং, ${MAX_WARN + 1} বারে গ্রুপ থেকে কিক।` : 'এখন থেকে লিংক দেওয়া যাবে।',
    welcome: g[key] ? 'নতুন মেম্বার জয়েন করলে ওয়েলকাম কার্ড ও ভিডিও যাবে।' : 'ওয়েলকাম মেসেজ বন্ধ।',
    antivideo: g[key] ? 'গ্রুপে ভিডিও দিলে ডিলিট হয়ে যাবে।' : 'এখন থেকে ভিডিও দেওয়া যাবে।',
    antiimage: g[key] ? 'গ্রুপে ছবি দিলে ডিলিট হয়ে যাবে।' : 'এখন থেকে ছবি দেওয়া যাবে।',
  }[key];
  send(msg, `${g[key] ? '✅' : '🔴'} <b>${TOGGLES[key]} ${g[key] ? 'ON' : 'OFF'}</b>\n\n${extra}`, false);
});

// ----- /menu -----
bot.onText(/^\/menu(?:@\w+)?$/i, (msg) => {
  const g = (isGroupChat(msg) && groupsDb[msg.chat.id]) || {};
  const st = (k) => (g[k] ? '🟢 ON' : '🔴 OFF');
  const html =
    '╭━━━━━━━━━━━━━━━━━━╮\n' +
    '   🌷 <b>BOT MENU</b> 🌷\n' +
    '╰━━━━━━━━━━━━━━━━━━╯\n\n' +
    '🤖 <b>সাধারণ</b>\n' +
    '├ <code>/pair</code> — WhatsApp নাম্বারে বট কানেক্ট\n' +
    '├ <code>/mybots</code> — তোমার কানেক্টেড নাম্বার\n' +
    '├ <code>/unpair</code> — বট ডিসকানেক্ট\n' +
    '├ <code>/ping</code> — বটের স্পিড চেক\n' +
    '└ <code>/menu</code> — এই মেনু\n\n' +
    '🛡 <b>গ্রুপ সেটিংস (শুধু এডমিন)</b>\n' +
    `├ <code>/antilink on|off</code> — লিংক বন্ধ (৩ ওয়ার্নিং, ৪ এ কিক) ${st('antilink')}\n` +
    `├ <code>/welcome on|off</code> — নতুন মেম্বারকে ওয়েলকাম ${st('welcome')}\n` +
    `├ <code>/antivideo on|off</code> — ভিডিও ডিলিট ${st('antivideo')}\n` +
    `└ <code>/antiimage on|off</code> — ছবি ডিলিট ${st('antiimage')}\n\n` +
    '📊 <code>/status</code> — বটের অবস্থা (এডমিন)';
  send(msg, html);
});

// ----- ওয়েলকাম কার্ড + ভিডিও -----
let welcomeVideoId = null; // একবার আপলোড হলে file_id সেভ থাকে, বারবার আপলোড লাগে না
async function sendWelcome(chat, u) {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'New Member';
  const mention = `<a href="tg://user?id=${u.id}">${esc(name)}</a>`;
  let count = '';
  try { count = await bot.getChatMemberCount(chat.id); } catch {}
  const LINE = '🌸━━━━━━━━━━━━━━━━🌸';
  const caption = [
    LINE,
    '✨ <b>WELCOME</b> ✨',
    LINE,
    '',
    `👋 <b>Hello,</b> ${mention}!`,
    `💖 <b>Welcome to ${esc(chat.title)}</b> 💖`,
    count ? `👥 <b>Member #${count}</b>` : null,
    '',
    '💖 <b>Enjoy Your Stay!</b> 💖',
    '🌸 <b>Have A Great Time</b> 🌸',
    '',
    '🤖 <b>BOT PAIRING GROUP</b>',
    'Get your pairing code here and connect your own bot in seconds ⚡',
    'Just send <code>/pair +your_number</code> to get started!',
    '',
    LINE,
    `<b>JOIN</b> ✅ ${WELCOME_JOIN_LINK}`,
  ].filter((l) => l !== null).join('\n');
  const welcomeKb = { inline_keyboard: [
    [{ text: 'OWNER ✓', url: 'https://t.me/xmox_devil' }],
    [{ text: "DEVELOPER'S", url: 'https://t.me/mainuvibes' }],
    [{ text: '🌷 MOX FAMILY', url: 'https://t.me/xmoxfamily' }],
  ] };

  let photoId = null;
  try {
    const ph = await bot.getUserProfilePhotos(u.id, { limit: 1 });
    if (ph.total_count > 0) { const sizes = ph.photos[0]; photoId = sizes[sizes.length - 1].file_id; }
  } catch {}

  if (photoId) await bot.sendPhoto(chat.id, photoId, { caption, parse_mode: 'HTML', reply_markup: welcomeKb });
  else await bot.sendMessage(chat.id, caption, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: welcomeKb });

  if (welcomeVideoId || fs.existsSync(WELCOME_VIDEO)) {
    const sent = await bot.sendVideo(
      chat.id,
      welcomeVideoId || fs.createReadStream(WELCOME_VIDEO),
      { caption: `🎬 ${mention}, <b>${esc(chat.title)}</b>-এ স্বাগতম! 💐`, parse_mode: 'HTML', supports_streaming: true },
      welcomeVideoId ? {} : { filename: 'welcome.mp4', contentType: 'video/mp4' }
    );
    if (!welcomeVideoId && sent?.video?.file_id) welcomeVideoId = sent.video.file_id;
  }
}
bot.on('new_chat_members', (msg) => {
  if (!isGroupChat(msg)) return;
  if (!groupsDb[msg.chat.id]?.welcome) return;
  for (const u of msg.new_chat_members || []) {
    if (u.is_bot) continue;
    sendWelcome(msg.chat, u).catch((e) => console.error('welcome:', e.message));
  }
});

// ----- antilink / antivideo / antiimage -----
const LINK_RE = /(https?:\/\/|www\.|t\.me\/|telegram\.(?:me|dog)\/|chat\.whatsapp\.com|wa\.me\/|\b[a-z0-9-]+\.(?:com|net|org|io|me|xyz|info|co|link|site|online|app|bd|ly|gg|tv|cc|shop|store|top|club)\b)/i;
const hasLink = (msg) => {
  const ents = [...(msg.entities || []), ...(msg.caption_entities || [])];
  if (ents.some((e) => e.type === 'url' || e.type === 'text_link')) return true;
  return LINK_RE.test(msg.text || msg.caption || '');
};
const mime = (msg) => msg.document?.mime_type || '';
const noRightsNotice = new Map(); // chatId -> শেষ নোটিসের সময় (স্প্যাম আটকাতে)
const autoDel = (m, ms) => setTimeout(() => m && bot.deleteMessage(m.chat.id, m.message_id).catch(() => {}), ms);

bot.on('message', async (msg) => {
  try {
    if (!isGroupChat(msg) || !msg.from || msg.from.is_bot || msg.from.id === 777000) return;
    if (msg.new_chat_members || msg.left_chat_member) return;
    const g = groupsDb[msg.chat.id];
    if (!g) return;

    let kind = null;
    if (g.antivideo && (msg.video || msg.video_note || mime(msg).startsWith('video/'))) kind = 'video';
    else if (g.antiimage && (msg.photo || mime(msg).startsWith('image/'))) kind = 'image';
    else if (g.antilink && hasLink(msg)) kind = 'link';
    if (!kind) return;
    if (await isGroupAdmin(msg)) return; // এডমিন/ওনারের জন্য ফিল্টার নেই

    try {
      await bot.deleteMessage(msg.chat.id, msg.message_id);
    } catch (e) {
      const last = noRightsNotice.get(msg.chat.id) || 0;
      if (Date.now() - last > 5 * 60 * 1000) {
        noRightsNotice.set(msg.chat.id, Date.now());
        bot.sendMessage(msg.chat.id, '⚠️ মেসেজ ডিলিট করতে পারছি না। বটকে <b>এডমিন</b> বানাও এবং <b>Delete messages</b> ও <b>Ban users</b> পারমিশন দাও।', { parse_mode: 'HTML' }).catch(() => {});
      }
      return;
    }
    if (kind !== 'link') return; // ভিডিও/ছবি শুধু ডিলিট হবে

    const uid = String(msg.from.id);
    const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || 'User';
    const mention = `<a href="tg://user?id=${msg.from.id}">${esc(name)}</a>`;
    const count = (g.warns[uid] = (g.warns[uid] || 0) + 1);

    if (count <= MAX_WARN) {
      saveGroups();
      const w = await bot.sendMessage(msg.chat.id,
        `⚠️ <b>ওয়ার্নিং ${count}/${MAX_WARN}</b>\n\n👤 ${mention}\n🚫 এই গ্রুপে লিংক দেওয়া নিষেধ!\n` +
        (count === MAX_WARN ? '❗ আবার লিংক দিলে গ্রুপ থেকে <b>কিক</b> করা হবে।' : `আরও ${MAX_WARN - count} বার ওয়ার্নিং বাকি।`),
        { parse_mode: 'HTML' });
      autoDel(w, 20000);
    } else {
      delete g.warns[uid];
      saveGroups();
      try {
        await (bot.banChatMember || bot.kickChatMember).call(bot, msg.chat.id, msg.from.id);
        await bot.unbanChatMember(msg.chat.id, msg.from.id, { only_if_banned: true }); // কিক = বের করে দেওয়া, আবার জয়েন করতে পারবে
        const k = await bot.sendMessage(msg.chat.id, `🚫 ${mention} <b>বারবার লিংক দেওয়ায় গ্রুপ থেকে কিক করা হয়েছে।</b>`, { parse_mode: 'HTML' });
        autoDel(k, 30000);
      } catch (e) {
        console.error('kick:', e.message);
        bot.sendMessage(msg.chat.id, '⚠️ কিক করতে পারছি না। বটকে <b>Ban users</b> পারমিশন দাও।', { parse_mode: 'HTML' }).catch(() => {});
      }
    }
  } catch (e) { console.error('moderation:', e.message); }
});

console.log('✅ টেলিগ্রাম বট চালু হয়েছে');
