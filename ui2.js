// টেলিগ্রাম মেসেজের ডিজিটাল ডিজাইন (কার্ড), দেশ/পতাকা চেনা, ফরম্যাটিং — কোনো বাইরের প্যাকেজ লাগে না
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CC = {};
('1:US,7:RU,20:EG,27:ZA,30:GR,31:NL,32:BE,33:FR,34:ES,36:HU,39:IT,40:RO,41:CH,43:AT,44:GB,45:DK,46:SE,47:NO,48:PL,49:DE,' +
 '51:PE,52:MX,53:CU,54:AR,55:BR,56:CL,57:CO,58:VE,60:MY,61:AU,62:ID,63:PH,64:NZ,65:SG,66:TH,81:JP,82:KR,84:VN,86:CN,90:TR,' +
 '91:IN,92:PK,93:AF,94:LK,95:MM,98:IR,212:MA,213:DZ,216:TN,218:LY,220:GM,221:SN,233:GH,234:NG,249:SD,251:ET,254:KE,255:TZ,' +
 '256:UG,260:ZM,263:ZW,351:PT,352:LU,353:IE,354:IS,357:CY,358:FI,359:BG,370:LT,371:LV,372:EE,380:UA,381:RS,385:HR,386:SI,' +
 '420:CZ,421:SK,852:HK,853:MO,855:KH,856:LA,880:BD,886:TW,960:MV,961:LB,962:JO,963:SY,964:IQ,965:KW,966:SA,967:YE,968:OM,' +
 '970:PS,971:AE,972:IL,973:BH,974:QA,975:BT,976:MN,977:NP,992:TJ,993:TM,994:AZ,995:GE,996:KG,998:UZ')
  .split(',').forEach((p) => { const [c, i] = p.split(':'); CC[c] = i; });

function countryOf(n) {
  for (let l = 3; l >= 1; l--) {
    const code = n.slice(0, l), iso = CC[code];
    if (iso) {
      let name = iso;
      try { name = new Intl.DisplayNames(['en'], { type: 'region' }).of(iso) || iso; } catch {}
      const flag = [...iso].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
      return { iso, name, flag, code };
    }
  }
  return { iso: '', name: 'Unknown', flag: '🌐', code: '' };
}

const pretty = (n) => { const c = countryOf(n); return c.code ? `+${c.code} ${n.slice(c.code.length)}` : `+${n}`; };
const mask = (n) => (n.length > 8 ? `+${n.slice(0, 5)}•••${n.slice(-3)}` : `+${n}`);
const fmtUp = (s) => { s = Math.floor(s); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return `${d ? d + 'd ' : ''}${h}h ${m}m ${s % 60}s`; };
const dhakaTime = () => new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' });
// ♾ লোডিং-সিস্টেম: লিমিট নেই — প্রতি ১০টা নাম্বারে বার একবার ভরে আবার নতুন করে শুরু হয়
const loadBar = (n, len = 10) => { n = Math.max(0, +n || 0); const f = n === 0 ? 0 : (n % len === 0 ? len : n % len); return '▰'.repeat(f) + '▱'.repeat(len - f); };
const slotText = (n) => `<code>${loadBar(n)}</code> ${n || 0} ∙ ♾ Unlimited`;
const bar = (v, max, len = 10) => { const f = Math.max(0, Math.min(len, Math.round((v / max) * len))); return '▰'.repeat(f) + '▱'.repeat(len - f); };

// ===== ডিজিটাল ফ্রেম =====
const top = (t) => `<b>╔═══◤ ${t} ◢═══╗</b>\n<code>▌ SYS ▸ ONLINE  ▰▰▰▰▰▰▰▰▰▰</code>`;
const bottom = `<b>╚═══════════════════════╝</b>`;
const row = (k, v) => `║ ▸ ${k}  ⟫  ${v}`;

const usage = () =>
`${top('📌 𝗣𝗔𝗜𝗥 𝗨𝗦𝗔𝗚𝗘')}

কান্ট্রি কোডসহ নাম্বার দাও:

<code>/pair +8801712345678</code>
<code>/pair 8801712345678</code>

<blockquote>💡 শুরুতে <b>0</b> বসিও না — নাম্বার শুরু হবে দেশের কোড দিয়ে (বাংলাদেশ = 880)</blockquote>
${bottom}`;

const code = (n, c) =>
`${top('🔑 𝗣𝗔𝗜𝗥𝗜𝗡𝗚 𝗖𝗢𝗗𝗘')}

🔐 <code>${c}</code>

${row('📱 Number', `<code>${pretty(n)}</code>`)}

<blockquote>01 ➜ ওই নাম্বারের WhatsApp খোলো
02 ➜ Settings ➜ Linked Devices
03 ➜ Link a Device
04 ➜ <b>Link with phone number instead</b>
05 ➜ উপরের কোডটা বসাও</blockquote>
${bottom}`;

const connected = (n, slot, max) => {
  const co = countryOf(n);
  return `${top('💎 𝗡𝗢𝗗𝗘 𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗘𝗗 💎')}

✅ <b>Successfully linked!</b>

${row('📱 Number', `<code>+${n}</code>`)}
${row('🌍 Country', `${co.flag} ${esc(co.name)} (+${co.code || '?'})`)}
${row('🕒 Time', `${dhakaTime()} (Dhaka)`)}
${row('📊 Slot', slotText(slot))}

<blockquote>🚀 এখন WhatsApp-এ গিয়ে <code>.menu</code> লেখো।
🛡 গ্রুপে প্রোটেকশন চালাতে বটকে এডমিন বানাও।</blockquote>
${bottom}`;
};

const failed = (n, kind) => {
  const why = kind === 'timeout' ? '⏰ ৮০ সেকেন্ডের মধ্যে কানেক্ট হয়নি'
    : kind === 'busy' ? '⚠️ এই নাম্বার আগে থেকেই কানেক্টেড বা প্রসেসিং-এ আছে'
    : kind === 'limit' ? '🚫 সার্ভারের কানেকশন লিমিট পূর্ণ'
    : kind === 'invalid' ? '❌ নাম্বারটি সঠিক নয়'
    : kind === 'failed' ? '❌ পেয়ারিং সম্পন্ন হয়নি — কোড ঠিকমতো বসানো হয়নি বা লিংক বাতিল হয়েছে'
    : '❌ পেয়ারিং কোড তৈরি করা যায়নি';
  const retry = kind === 'busy' || kind === 'limit' ? '' : `\n${row('🔁 Retry', `<code>/pair +${n}</code>`)}`;
  return `${top('😔 𝗣𝗔𝗜𝗥 𝗙𝗔𝗜𝗟𝗘𝗗')}

${why}

${row('📱 Number', `<code>+${n}</code>`)}${retry}
${bottom}`;
};

const status = (s) =>
`${top('📡 𝗦𝗬𝗦𝗧𝗘𝗠 𝗦𝗧𝗔𝗧𝗨𝗦 📡')}

${row('🟢 Online', `<b>${s.online}</b>`)}
${row('🔴 Offline', `<b>${s.offline}</b>`)}
${row('⏳ Pairing', `<b>${s.pending}</b>`)}
${row('🔌 Total linked', `<b>${s.total}</b>`)}
${row('👥 Users', `<b>${s.users}</b>`)}

📊 ${slotText(s.total)}
${row('⏱ Uptime', `<code>${fmtUp(s.uptime)}</code>`)}
${row('💾 Memory', `<code>${s.mem} MB</code>`)}
${row('🖥 Platform', `<code>${s.platform}</code>`)}
${row('🟩 Node.js', `<code>${s.node}</code>`)}${s.list ? `\n\n<blockquote expandable>${s.list}</blockquote>` : ''}
${bottom}`;

const welcome = () =>
`${top('🤖 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗣𝗔𝗜𝗥')}

তোমার নাম্বারে WhatsApp বট চালু করো — মাত্র ১ মিনিটে!

<blockquote>📲 <b>/pair</b> <code>+8801712345678</code> — বট কানেক্ট
📡 <b>/status</b> — সিস্টেমের অবস্থা
📋 <b>/mybots</b> — তোমার কানেক্টেড নাম্বার
🔌 <b>/unpair</b> <code>8801712345678</code> — ডিসকানেক্ট</blockquote>

⚠️ <i>পেয়ার করলে তোমার WhatsApp এই সার্ভারে Linked Device হিসেবে যুক্ত হয়। যেকোনো সময় /unpair বা WhatsApp-এর Linked Devices থেকে মুছতে পারো।</i>
${bottom}`;

// প্রাইভেটে /pair দিলে এটা দেখাবে
const groupOnly = () =>
`${top('🔒 𝗚𝗥𝗢𝗨𝗣 𝗢𝗡𝗟𝗬')}

👉 এই কমান্ড শুধু অফিসিয়াল গ্রুপে চলে।
নিচের বাটনে চেপে জয়েন করো, তারপর সেখানে <code>/pair</code> দাও।
${bottom}`;

// গ্রুপে /pair দিলে প্রথমে এটা আসবে
const generating = (n) => {
  const co = countryOf(n);
  return `${top('⏳ 𝗚𝗘𝗡𝗘𝗥𝗔𝗧𝗜𝗡𝗚 𝗖𝗢𝗗𝗘')}

${row('📱 Number', `<code>+${n}</code>`)}
${row('🌍 Country', `${co.flag} ${esc(co.name)} (+${co.code || '?'})`)}

<blockquote>🔄 <i>Please wait a moment...</i></blockquote>
${bottom}`;
};

const mybots = (lines) => `${top('📋 𝗠𝗬 𝗡𝗢𝗗𝗘𝗦')}\n\n${lines.join('\n')}\n${bottom}`;
const pong = (ms, up) => `${top('🏓 𝗣𝗢𝗡𝗚')}\n\n${row('⚡ Speed', `<code>${ms} ms</code>`)}\n${row('⏱ Uptime', `<code>${fmtUp(up)}</code>`)}\n${bottom}`;

// টাইমআউটেও একই "PAIR FAILED" কার্ড যায়
const timeout = (n) => failed(n, 'timeout');

module.exports = { esc, countryOf, pretty, mask, usage, code, connected, failed, status, welcome, bar, fmtUp, groupOnly, generating, timeout, mybots, pong, top, bottom, row };
