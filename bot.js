/******************** IMPORTS ********************/
const { Telegraf, session } = require("telegraf");
const fs = require("fs");
const path = require("path");
const https = require("https");
const { authenticator } = require("otplib");

/******************** YOUR CONFIGURATION ********************/
const BOT_TOKEN = "8657128372:AAFArlAPVAaCEnriPz_3Wn3xc1EQUjldLH8";
const ADMIN_PASSWORD = "mamun1132";

// ⚠️ IMPORTANT: Replace the IDs below with your actual IDs ⚠️
const MAIN_CHANNEL = "@updaterange";
const MAIN_CHANNEL_ID = -1001153782407;

const CHAT_GROUP = "https://t.me/numbergroup1122";
const CHAT_GROUP_ID = -1001153782407;

const OTP_GROUP = "https://t.me/otpreceived1";
const OTP_GROUP_ID = -1001153782407;

// ব্যাকআপ গ্রুপ আইডি
const BACKUP_GROUP_ID = -5168617650;
const AUTO_RESTORE_ON_START = true;

/******************** FILES ********************/
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH)
  : __dirname;

console.log(`📁 Data Directory: ${DATA_DIR}`);

const NUMBERS_FILE = path.join(DATA_DIR, "numbers.txt");
const COUNTRIES_FILE = path.join(DATA_DIR, "countries.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SERVICES_FILE = path.join(DATA_DIR, "services.json");
const ACTIVE_NUMBERS_FILE = path.join(DATA_DIR, "active_numbers.json");
const OTP_LOG_FILE = path.join(DATA_DIR, "otp_log.json");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const TOTP_SECRETS_FILE = path.join(DATA_DIR, "totp_secrets.json");
const TEMP_MAILS_FILE = path.join(DATA_DIR, "temp_mails.json");
const EARNINGS_FILE = path.join(DATA_DIR, "earnings.json");
const WITHDRAW_FILE = path.join(DATA_DIR, "withdrawals.json");
const COUNTRY_PRICES_FILE = path.join(DATA_DIR, "country_prices.json");

/******************** DEFAULT SETTINGS ********************/
let settings = {
  defaultNumberCount: 10,
  cooldownSeconds: 5,
  requireVerification: true,
  minWithdraw: 50,
  defaultOtpPrice: 0.25,
  withdrawMethods: ["bKash", "Nagad"],
  withdrawEnabled: true
};

/******************** LOAD SETTINGS ********************/
if (fs.existsSync(SETTINGS_FILE)) {
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading settings:", e);
  }
} else {
  saveSettings();
}

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN not set correctly");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

/******************** LOAD DATA ********************/
let countries = {};
if (fs.existsSync(COUNTRIES_FILE)) {
  try {
    countries = JSON.parse(fs.readFileSync(COUNTRIES_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading countries:", e);
    countries = {};
  }
} else {
  countries = {
    "880": { name: "Bangladesh", flag: "🇧🇩" },
    "91": { name: "India", flag: "🇮🇳" },
    "92": { name: "Pakistan", flag: "🇵🇰" },
    "1": { name: "USA", flag: "🇺🇸" },
    "44": { name: "UK", flag: "🇬🇧" },
    "977": { name: "Nepal", flag: "🇳🇵" }
  };
  saveCountries();
}

let services = {};
if (fs.existsSync(SERVICES_FILE)) {
  try {
    services = JSON.parse(fs.readFileSync(SERVICES_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading services:", e);
    services = {};
  }
} else {
  services = {
    "whatsapp": { name: "WhatsApp", icon: "📱" },
    "telegram": { name: "Telegram", icon: "✈️" },
    "facebook": { name: "Facebook", icon: "📘" },
    "instagram": { name: "Instagram", icon: "📸" },
    "google": { name: "Google", icon: "🔍" },
    "verification": { name: "Verification", icon: "✅" },
    "other": { name: "Other", icon: "🔧" }
  };
  saveServices();
}

let numbersByCountryService = {};
if (fs.existsSync(NUMBERS_FILE)) {
  try {
    const lines = fs.readFileSync(NUMBERS_FILE, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const lineTrimmed = line.trim();
      if (!lineTrimmed) continue;
      let number, countryCode, service;
      if (lineTrimmed.includes("|")) {
        const parts = lineTrimmed.split("|");
        if (parts.length >= 3) {
          number = parts[0].trim();
          countryCode = parts[1].trim();
          service = parts[2].trim();
        } else if (parts.length === 2) {
          number = parts[0].trim();
          countryCode = parts[1].trim();
          service = "other";
        } else {
          continue;
        }
      } else {
        number = lineTrimmed;
        countryCode = getCountryCodeFromNumber(number);
        service = "other";
      }
      if (!/^\d{10,15}$/.test(number)) continue;
      if (!countryCode) continue;
      numbersByCountryService[countryCode] = numbersByCountryService[countryCode] || {};
      numbersByCountryService[countryCode][service] = numbersByCountryService[countryCode][service] || [];
      if (!numbersByCountryService[countryCode][service].includes(number)) {
        numbersByCountryService[countryCode][service].push(number);
      }
    }
    console.log(`✅ Loaded numbers`);
  } catch (e) {
    console.error("❌ Error loading numbers:", e);
    numbersByCountryService = {};
  }
}

let users = {};
if (fs.existsSync(USERS_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading users:", e);
    users = {};
  }
}

let activeNumbers = {};
if (fs.existsSync(ACTIVE_NUMBERS_FILE)) {
  try {
    activeNumbers = JSON.parse(fs.readFileSync(ACTIVE_NUMBERS_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading active numbers:", e);
    activeNumbers = {};
  }
}

let otpLog = [];
if (fs.existsSync(OTP_LOG_FILE)) {
  try {
    otpLog = JSON.parse(fs.readFileSync(OTP_LOG_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading OTP log:", e);
    otpLog = [];
  }
}

let admins = [];
if (fs.existsSync(ADMINS_FILE)) {
  try {
    admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading admins:", e);
    admins = [];
  }
}

let totpSecrets = {};
if (fs.existsSync(TOTP_SECRETS_FILE)) {
  try { totpSecrets = JSON.parse(fs.readFileSync(TOTP_SECRETS_FILE, 'utf8')); }
  catch (e) { totpSecrets = {}; }
}

let tempMails = {};
if (fs.existsSync(TEMP_MAILS_FILE)) {
  try { tempMails = JSON.parse(fs.readFileSync(TEMP_MAILS_FILE, 'utf8')); }
  catch (e) { tempMails = {}; }
}

let earnings = {};
if (fs.existsSync(EARNINGS_FILE)) {
  try { earnings = JSON.parse(fs.readFileSync(EARNINGS_FILE, 'utf8')); }
  catch (e) { earnings = {}; }
}

let withdrawals = [];
if (fs.existsSync(WITHDRAW_FILE)) {
  try { withdrawals = JSON.parse(fs.readFileSync(WITHDRAW_FILE, 'utf8')); }
  catch (e) { withdrawals = []; }
}

let countryPrices = {};
if (fs.existsSync(COUNTRY_PRICES_FILE)) {
  try { countryPrices = JSON.parse(fs.readFileSync(COUNTRY_PRICES_FILE, 'utf8')); }
  catch (e) { countryPrices = {}; }
}

/******************** SAVE FUNCTIONS ********************/
function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error("❌ Error saving settings:", error);
  }
}

function saveNumbers() {
  try {
    const lines = [];
    for (const countryCode in numbersByCountryService) {
      for (const service in numbersByCountryService[countryCode]) {
        for (const number of numbersByCountryService[countryCode][service]) {
          lines.push(`${number}|${countryCode}|${service}`);
        }
      }
    }
    fs.writeFileSync(NUMBERS_FILE, lines.join("\n"));
  } catch (error) {
    console.error("❌ Error saving numbers:", error);
  }
}

function saveCountries() {
  try {
    fs.writeFileSync(COUNTRIES_FILE, JSON.stringify(countries, null, 2));
  } catch (error) {
    console.error("❌ Error saving countries:", error);
  }
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error("❌ Error saving users:", error);
  }
}

function saveServices() {
  try {
    fs.writeFileSync(SERVICES_FILE, JSON.stringify(services, null, 2));
  } catch (error) {
    console.error("❌ Error saving services:", error);
  }
}

function saveActiveNumbers() {
  try {
    fs.writeFileSync(ACTIVE_NUMBERS_FILE, JSON.stringify(activeNumbers, null, 2));
  } catch (error) {
    console.error("❌ Error saving active numbers:", error);
  }
}

function saveOTPLog() {
  try {
    fs.writeFileSync(OTP_LOG_FILE, JSON.stringify(otpLog.slice(-1000), null, 2));
  } catch (error) {
    console.error("❌ Error saving OTP log:", error);
  }
}

function saveAdmins() {
  try {
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
  } catch (error) {
    console.error("❌ Error saving admins:", error);
  }
}

function saveTotpSecrets() {
  try {
    fs.writeFileSync(TOTP_SECRETS_FILE, JSON.stringify(totpSecrets, null, 2));
  } catch (error) {
    console.error("❌ Error saving TOTP secrets:", error);
  }
}

function saveTempMails() {
  try {
    fs.writeFileSync(TEMP_MAILS_FILE, JSON.stringify(tempMails, null, 2));
  } catch (error) {
    console.error("❌ Error saving temp mails:", error);
  }
}

function saveEarnings() {
  try {
    fs.writeFileSync(EARNINGS_FILE, JSON.stringify(earnings, null, 2));
  } catch (error) {
    console.error("❌ Error saving earnings:", error);
  }
}

function saveWithdrawals() {
  try {
    fs.writeFileSync(WITHDRAW_FILE, JSON.stringify(withdrawals, null, 2));
  } catch (error) {
    console.error("❌ Error saving withdrawals:", error);
  }
}

function saveCountryPrices() {
  try {
    fs.writeFileSync(COUNTRY_PRICES_FILE, JSON.stringify(countryPrices, null, 2));
  } catch (error) {
    console.error("❌ Error saving country prices:", error);
  }
}

/******************** EARNINGS HELPERS ********************/
function getUserEarnings(userId) {
  const uid = userId.toString();
  if (!earnings[uid]) {
    earnings[uid] = { balance: 0, totalEarned: 0, otpCount: 0 };
  }
  return earnings[uid];
}

function getOtpPriceForCountry(countryCode) {
  return countryPrices[countryCode] !== undefined
    ? countryPrices[countryCode]
    : (settings.defaultOtpPrice || 0.25);
}

function addEarning(userId, countryCode) {
  const uid = userId.toString();
  const price = getOtpPriceForCountry(countryCode);
  if (!earnings[uid]) earnings[uid] = { balance: 0, totalEarned: 0, otpCount: 0 };
  earnings[uid].balance = parseFloat((earnings[uid].balance + price).toFixed(2));
  earnings[uid].totalEarned = parseFloat((earnings[uid].totalEarned + price).toFixed(2));
  earnings[uid].otpCount = (earnings[uid].otpCount || 0) + 1;
  saveEarnings();
  return price;
}

/******************** HELPER FUNCTIONS ********************/
function isAdmin(userId) {
  return admins.includes(userId.toString());
}

function getCountryCodeFromNumber(n) {
  const numStr = n.toString();
  const code3 = numStr.slice(0, 3);
  if (countries[code3]) return code3;
  const code2 = numStr.slice(0, 2);
  if (countries[code2]) return code2;
  const code1 = numStr.slice(0, 1);
  if (countries[code1]) return code1;
  return null;
}

function getCountryFromNumber(number) {
  const numStr = number.toString();
  for (const length of [3, 2, 1]) {
    const code = numStr.slice(0, length);
    if (countries[code]) {
      return countries[code];
    }
  }
  return { name: "Unknown", flag: "🏴‍☠️" };
}

function getAvailableCountriesForService(service) {
  const availableCountries = [];
  for (const countryCode in numbersByCountryService) {
    if (numbersByCountryService[countryCode][service] && 
        numbersByCountryService[countryCode][service].length > 0 &&
        countries[countryCode]) {
      availableCountries.push(countryCode);
    }
  }
  return availableCountries;
}

function getMultipleNumbersByCountryAndService(countryCode, service, userId, count) {
  if (!numbersByCountryService[countryCode] || !numbersByCountryService[countryCode][service]) {
    return [];
  }
  if (numbersByCountryService[countryCode][service].length < count) {
    return [];
  }
  const numbers = [];
  for (let i = 0; i < count; i++) {
    const number = numbersByCountryService[countryCode][service].shift();
    numbers.push(number);
    activeNumbers[number] = {
      userId: userId,
      countryCode: countryCode,
      service: service,
      assignedAt: new Date().toISOString(),
      lastOTP: null,
      otpCount: 0
    };
  }
  saveNumbers();
  saveActiveNumbers();
  return numbers;
}

function extractPhoneNumberFromMessage(text) {
  if (!text) return null;
  const fullMatch = text.match(/\+?(\d{10,15})/);
  if (fullMatch) {
    const num = fullMatch[1];
    if (num.length >= 10 && num.length <= 15) return num;
  }
  return null;
}

function findMatchingActiveNumber(messageText) {
  const allActive = Object.keys(activeNumbers);
  if (allActive.length === 0) return null;
  const extracted = extractPhoneNumberFromMessage(messageText);
  if (extracted) {
    if (activeNumbers[extracted]) return extracted;
    const noPlus = extracted.replace(/^\+/, '');
    if (activeNumbers[noPlus]) return noPlus;
  }
  for (const num of allActive) {
    if (messageText.includes(num)) return num;
  }
  for (const num of allActive) {
    const last8 = num.slice(-8);
    if (messageText.includes(last8)) return num;
  }
  for (const num of allActive) {
    const last6 = num.slice(-6);
    if (messageText.includes(last6)) return num;
  }
  for (const num of allActive) {
    const last4 = num.slice(-4);
    if (last4 && messageText.includes(last4)) return num;
  }
  return null;
}

function extractOTPCode(text) {
  if (!text) return null;
  const patterns = [
    /(?:otp|code|pin|verification|verify|token)[^\d]{0,10}(\d{4,8})/i,
    /(?:is|has|:)\s*(\d{4,8})\b/i,
    /\b(\d{6})\b/,
    /\b(\d{4})\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1] && m[1].length >= 4 && m[1].length <= 8) return m[1];
  }
  return null;
}

function getTimeAgo(date) {
  try {
    if (!date || isNaN(new Date(date))) return "unknown";
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + " years ago";
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + " months ago";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + " days ago";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + " hours ago";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  } catch(e) { return "unknown"; }
}

function generateRandomString(length) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/******************** EMAIL SYSTEM - Mail.tm ********************/
function mailTmRequest(method, path, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.mail.tm',
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 429) {
          console.error(`❌ Mail.tm rate limited`);
          resolve({ _rateLimit: true });
          return;
        }
        try { resolve(JSON.parse(d)); }
        catch(e) { resolve(null); }
      });
    });
    req.on('error', (e) => { console.error(`Mail.tm request error: ${e.message}`); resolve(null); });
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    if (data) req.write(data);
    req.end();
  });
}

function randomPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let pass = '';
  for (let i = 0; i < 16; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

function randomUsername() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let name = '';
  for (let i = 0; i < 12; i++) name += chars[Math.floor(Math.random() * chars.length)];
  return name;
}

async function createFreshEmail() {
  try {
    const domains = await mailTmRequest('GET', '/domains?page=1');
    const domainList = Array.isArray(domains) ? domains : (domains?.['hydra:member'] || []);
    if (!domainList.length) return null;
    const domain = domainList[0].domain;
    const username = randomUsername();
    const password = randomPassword();
    const address = `${username}@${domain}`;
    let account = null;
    for (let i = 1; i <= 3; i++) {
      account = await mailTmRequest('POST', '/accounts', { address, password });
      if (account && account.id) break;
      if (account?._rateLimit) await new Promise(r => setTimeout(r, 3000));
      else break;
    }
    if (!account || !account.id) return null;
    const tokenRes = await mailTmRequest('POST', '/token', { address, password });
    if (!tokenRes || !tokenRes.token) return null;
    return {
      address,
      sidToken: tokenRes.token,
      provider: 'mailtm',
      createdAt: new Date().toISOString()
    };
  } catch(e) {
    console.error('❌ Mail.tm error:', e.message);
    return null;
  }
}

async function getEmailInbox(emailObj) {
  try {
    const data = await mailTmRequest('GET', '/messages?page=1', null, emailObj.sidToken);
    const msgList = Array.isArray(data) ? data : (data?.['hydra:member'] || []);
    return msgList.map(m => ({
        id: m.id,
        from: m.from?.address || '',
        subject: m.subject || '',
        date: m.createdAt || ''
      }));
  } catch(e) { return []; }
}

async function getEmailMessage(id, emailObj) {
  try {
    const data = await mailTmRequest('GET', `/messages/${id}`, null, emailObj.sidToken);
    if (!data) return '';
    const text = data.text || '';
    const html = data.html?.[0] || '';
    return (text || html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  } catch(e) { return ''; }
}

function generateTOTP(secret) {
  try {
    const cleanSecret = secret.replace(/\s/g, "").toUpperCase();
    authenticator.options = { step: 30 };
    const token = authenticator.generate(cleanSecret);
    const timeRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
    return { token, timeRemaining };
  } catch (e) { return null; }
}

/******************** VERIFICATION FUNCTION ********************/
async function checkUserMembership(ctx) {
  try {
    const userId = ctx.from.id;
    let isMainChannelMember = false;
    let isChatGroupMember = false;
    let isOTPGroupMember = false;

    try {
      const chatMember = await ctx.telegram.getChatMember(MAIN_CHANNEL_ID, userId);
      isMainChannelMember = ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (error) { console.log("Main channel check error:", error.message); }

    try {
      const chatMember = await ctx.telegram.getChatMember(CHAT_GROUP_ID, userId);
      isChatGroupMember = ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (error) { console.log("Chat group check error:", error.message); }

    try {
      const chatMember = await ctx.telegram.getChatMember(OTP_GROUP_ID, userId);
      isOTPGroupMember = ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (error) { console.log("OTP group check error:", error.message); }

    const allJoined = isMainChannelMember && isChatGroupMember && isOTPGroupMember;
    return { mainChannel: isMainChannelMember, chatGroup: isChatGroupMember, otpGroup: isOTPGroupMember, allJoined: allJoined };
  } catch (error) {
    return { mainChannel: false, chatGroup: false, otpGroup: false, allJoined: false };
  }
}

/******************** SESSION MIDDLEWARE ********************/
bot.use(session({
  defaultSession: () => ({
    verified: false, isAdmin: false, adminState: null, adminData: null,
    currentNumbers: [], currentService: null, currentCountry: null,
    lastNumberTime: 0, lastMessageId: null, lastChatId: null,
    lastVerificationCheck: 0, totpState: null, totpData: null,
    mailState: null, withdrawState: null, withdrawData: null, pendingRestore: null
  })
}));

bot.use((ctx, next) => {
  if (ctx.from) {
    const userId = ctx.from.id.toString();
    if (!users[userId]) {
      users[userId] = {
        id: userId, username: ctx.from.username || 'no_username',
        first_name: ctx.from.first_name || 'User', last_name: ctx.from.last_name || '',
        joined: new Date().toISOString(), last_active: new Date().toISOString(),
        verified: ctx.session?.verified || false
      };
      saveUsers();
    } else {
      users[userId].last_active = new Date().toISOString();
      saveUsers();
    }
  }
  if (!ctx.session) {
    ctx.session = {
      verified: false, isAdmin: false, adminState: null, adminData: null,
      currentNumbers: [], currentService: null, currentCountry: null,
      lastNumberTime: 0, lastMessageId: null, lastChatId: null,
      lastVerificationCheck: 0, totpState: null, totpData: null,
      mailState: null, withdrawState: null, withdrawData: null, pendingRestore: null
    };
  }
  if (ctx.from && !ctx.session.isAdmin) {
    ctx.session.isAdmin = isAdmin(ctx.from.id.toString());
  }
  return next();
});

/******************** VERIFICATION MIDDLEWARE ********************/
bot.use(async (ctx, next) => {
  if (ctx.chat?.type !== 'private') return next();
  if (ctx.session?.isAdmin) return next();
  if (ctx.message?.text?.startsWith('/start') || ctx.message?.text?.startsWith('/adminlogin') || ctx.message?.text?.startsWith('/cancel')) return next();
  if (ctx.callbackQuery?.data === 'verify_user') return next();
  if (!ctx.from) return next();
  if (!settings.requireVerification) return next();

  const userId = ctx.from.id.toString();
  const now = Date.now();
  const RECHECK_INTERVAL = 2 * 60 * 60 * 1000;
  const lastCheck = ctx.session?.lastVerificationCheck || 0;
  const checkAge = now - lastCheck;

  if (ctx.session?.verified && checkAge < RECHECK_INTERVAL) return next();

  const membership = await checkUserMembership(ctx);

  if (membership.allJoined) {
    ctx.session.verified = true;
    ctx.session.lastVerificationCheck = now;
    if (users[userId]) { users[userId].verified = true; saveUsers(); }
    return next();
  }

  ctx.session.verified = false;
  ctx.session.lastVerificationCheck = 0;
  if (users[userId]) { users[userId].verified = false; saveUsers(); }
  
  let notJoinedList = "";
  if (!membership.mainChannel) notJoinedList += "❌ 1️⃣ Main Channel\n";
  if (!membership.chatGroup) notJoinedList += "❌ 2️⃣ Number Channel\n";
  if (!membership.otpGroup) notJoinedList += "❌ 3️⃣ OTP Group\n";

  const verificationMessage = "⛔ *ACCESS BLOCKED*\n\nYou have not joined all required groups:\n\n" + notJoinedList + "\n🔐 *Please join ALL three groups and press VERIFY*\n\n👇 Click the buttons below to join:";

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery("⛔ Please join all groups first!", { show_alert: true });
    try {
      await ctx.editMessageText(verificationMessage, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "1️⃣ 📢 Main Channel", url: "https://t.me/updaterange" }],
            [{ text: "2️⃣ 🌐 Number Channel", url: CHAT_GROUP }],
            [{ text: "3️⃣ 📨 OTP Group", url: OTP_GROUP }],
            [{ text: "✅ VERIFY MEMBERSHIP", callback_data: "verify_user" }]
          ]
        }
      });
    } catch(e) {}
    return;
  }

  try {
    await ctx.reply(verificationMessage, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "1️⃣ 📢 Main Channel", url: "https://t.me/updaterange" }],
          [{ text: "2️⃣ 🌐 Number Channel", url: CHAT_GROUP }],
          [{ text: "3️⃣ 📨 OTP Group", url: OTP_GROUP }],
          [{ text: "✅ VERIFY MEMBERSHIP", callback_data: "verify_user" }]
        ]
      }
    });
  } catch (error) { console.log("Could not reply to user:", error.message); }
  return;
});

/******************** HELPER: Clear all user state ********************/
function clearUserState(ctx) {
  ctx.session.withdrawState = null;
  ctx.session.withdrawData = null;
  ctx.session.totpState = null;
  ctx.session.totpData = null;
  ctx.session.adminState = null;
  ctx.session.adminData = null;
}

/******************** SHOW MAIN MENU ********************/
async function showMainMenu(ctx) {
  try {
    await ctx.reply("🏠 *Main Menu*\n\nChoose an option:", {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [["☎️ Get Number", "📧 Get Tempmail"], ["🔐 2FA", "💰 Balances"], ["💸 Withdraw", "💬 Support"]],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    });
  } catch (error) { console.error("Error showing main menu:", error); }
}

/******************** START COMMAND ********************/
bot.start(async (ctx) => {
  try {
    const startUserId = ctx.from.id.toString();
    ctx.session.verified = users[startUserId]?.verified || false;
    ctx.session.currentNumbers = [];
    ctx.session.currentService = null;
    ctx.session.currentCountry = null;
    ctx.session.lastNumberTime = 0;
    ctx.session.lastMessageId = null;
    ctx.session.lastChatId = null;
    ctx.session.lastVerificationCheck = 0;
    ctx.session.totpState = null;
    ctx.session.totpData = null;
    ctx.session.mailState = null;
    ctx.session.withdrawState = null;
    ctx.session.withdrawData = null;
    ctx.session.adminState = null;
    ctx.session.adminData = null;
    ctx.session.isAdmin = isAdmin(ctx.from.id.toString());

    if (!settings.requireVerification) {
      ctx.session.verified = true;
      return showMainMenu(ctx);
    }

    await ctx.reply("🤖 *Welcome to Number Bot*\n\n🔐 *VERIFICATION REQUIRED - 3 GROUPS*\nTo use this bot, you MUST join ALL three groups first:\n\n👇 Click the buttons below to join:", {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: "1️⃣ 📢 Main Channel", url: "https://t.me/updaterange" }],
          [{ text: "2️⃣ 🌐 Number Channel", url: CHAT_GROUP }],
          [{ text: "3️⃣ 📨 OTP Group", url: OTP_GROUP }],
          [{ text: "✅ VERIFY MEMBERSHIP", callback_data: "verify_user" }]
        ]
      }
    });
  } catch (error) { console.error("Start command error:", error); }
});

/******************** VERIFICATION BUTTON ********************/
bot.action("verify_user", async (ctx) => {
  try {
    await ctx.answerCbQuery("🔍 Checking all 3 groups...");
    const membership = await checkUserMembership(ctx);
    if (membership.allJoined) {
      ctx.session.verified = true;
      ctx.session.lastVerificationCheck = Date.now();
      const uid = ctx.from.id.toString();
      if (users[uid]) { users[uid].verified = true; saveUsers(); }
      await ctx.editMessageText("✅ *VERIFICATION SUCCESSFUL!*\n\n🎉 You have joined all 3 required groups.\n\nYou can now use all bot features.\n\n👇 Press the button below to continue:", { 
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🏠 Go to Main Menu", callback_data: "goto_main_menu" }]] }
      });
    } else {
      let notJoinedMsg = "❌ *VERIFICATION FAILED*\n\nYou haven't joined the following groups:\n\n";
      if (!membership.mainChannel) notJoinedMsg += "❌ 1️⃣ Main Channel\n";
      if (!membership.chatGroup) notJoinedMsg += "❌ 2️⃣ Number Channel\n";
      if (!membership.otpGroup) notJoinedMsg += "❌ 3️⃣ OTP Group\n";
      notJoinedMsg += "\nPlease join ALL three groups and click VERIFY again.";
      await ctx.editMessageText(notJoinedMsg, { 
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "1️⃣ 📢 Main Channel", url: "https://t.me/updaterange" }],
            [{ text: "2️⃣ 🌐 Number Channel", url: CHAT_GROUP }],
            [{ text: "3️⃣ 📨 OTP Group", url: OTP_GROUP }],
            [{ text: "✅ VERIFY AGAIN", callback_data: "verify_user" }]
          ]
        }
      });
    }
  } catch (error) { console.error("Verification error:", error); await ctx.answerCbQuery("❌ Verification failed", { show_alert: true }); }
});

/******************** TELEGRAM BACKUP SYSTEM - UPDATED & FIXED ********************/
let lastBackupInfo = null;

async function createTelegramBackup(isAuto = true) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `BACKUP_${timestamp}`;
    
    const backupData = {
      backupId: backupId,
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        users: users,
        earnings: earnings,
        withdrawals: withdrawals,
        otpLog: otpLog.slice(-500),
        admins: admins,
        settings: settings,
        services: services,
        countries: countries,
        activeNumbers: activeNumbers,
        totpSecrets: totpSecrets,
        tempMails: tempMails,
        countryPrices: countryPrices,
        numbersByCountryService: numbersByCountryService
      },
      stats: {
        totalUsers: Object.keys(users).length,
        totalEarnings: Object.values(earnings).reduce((sum, e) => sum + e.totalEarned, 0),
        totalBalance: Object.values(earnings).reduce((sum, e) => sum + e.balance, 0),
        totalWithdrawals: withdrawals.length,
        totalNumbers: Object.values(numbersByCountryService).flatMap(c => Object.values(c).flat().length).length
      }
    };
    
    const jsonString = JSON.stringify(backupData, null, 2);
    const buffer = Buffer.from(jsonString, 'utf-8');
    
    let message = `📦 *SYSTEM BACKUP*\n\n🆔 ID: \`${backupId}\`\n📅 Time: ${new Date().toLocaleString('en-GB')}\n\n📊 *Statistics:*\n👥 Users: ${backupData.stats.totalUsers}\n💰 Total Earned: ${backupData.stats.totalEarnings.toFixed(2)} TK\n💵 Balance: ${backupData.stats.totalBalance.toFixed(2)} TK\n📞 Numbers: ${backupData.stats.totalNumbers}\n📁 Size: ${(buffer.length / 1024).toFixed(2)} KB`;
    
    await bot.telegram.sendDocument(
      BACKUP_GROUP_ID,
      { source: buffer, filename: `${backupId}.json` },
      { caption: message, parse_mode: 'Markdown' }
    );
    
    // লোকাল ফাইলেও সেভ করুন
    const localBackupPath = path.join(DATA_DIR, `${backupId}.json`);
    fs.writeFileSync(localBackupPath, jsonString);
    
    // last backup info সেভ করুন
    const backupInfo = { backupId, timestamp: backupData.timestamp, stats: backupData.stats };
    fs.writeFileSync(path.join(DATA_DIR, "last_backup.json"), JSON.stringify(backupInfo, null, 2));
    
    console.log(`✅ Backup created: ${backupId}`);
    return backupData;
    
  } catch (error) {
    console.error('Backup error:', error);
    return null;
  }
}

async function findLatestBackup() {
  try {
    // 1. প্রথমে লোকাল ফাইল চেক করুন
    const lastBackupFile = path.join(DATA_DIR, "last_backup.json");
    if (fs.existsSync(lastBackupFile)) {
      const info = JSON.parse(fs.readFileSync(lastBackupFile, 'utf8'));
      const localFile = path.join(DATA_DIR, `${info.backupId}.json`);
      if (fs.existsSync(localFile)) {
        console.log(`📦 Found local backup: ${info.backupId}`);
        return { fileId: null, fileName: `${info.backupId}.json`, timestamp: info.timestamp, localPath: localFile };
      }
    }
    
    // 2. Telegram থেকে খুঁজুন
    console.log('🔍 Searching Telegram...');
    const messages = await bot.telegram.getChatHistory(BACKUP_GROUP_ID, 20);
    
    let latest = null;
    for (const msg of messages) {
      if (msg.document && msg.document.file_name && msg.document.file_name.endsWith('.json')) {
        const match = msg.document.file_name.match(/BACKUP_([\d\-T]+)\.json/);
        if (match) {
          const timestamp = match[1];
          if (!latest || timestamp > latest.timestamp) {
            latest = { fileId: msg.document.file_id, fileName: msg.document.file_name, timestamp: timestamp };
          }
        }
      }
    }
    
    return latest;
    
  } catch (error) {
    console.error('Find backup error:', error);
    return null;
  }
}

async function restoreFromTelegramBackup(backupFileId, localPath = null) {
  try {
    let backupData = null;
    
    if (localPath && fs.existsSync(localPath)) {
      const jsonText = fs.readFileSync(localPath, 'utf8');
      backupData = JSON.parse(jsonText);
      console.log(`📦 Restoring from local: ${backupData.backupId}`);
    } else if (backupFileId) {
      console.log('🔄 Downloading from Telegram...');
      const fileLink = await bot.telegram.getFileLink(backupFileId);
      const response = await fetch(fileLink.href);
      const jsonText = await response.text();
      backupData = JSON.parse(jsonText);
      
      const localBackupPath = path.join(DATA_DIR, backupData.backupId + '.json');
      fs.writeFileSync(localBackupPath, jsonText);
    } else {
      return null;
    }
    
    if (!backupData) return null;
    
    console.log(`📦 Restoring: ${backupData.backupId}`);
    
    if (backupData.data.users) { users = backupData.data.users; saveUsers(); }
    if (backupData.data.earnings) { earnings = backupData.data.earnings; saveEarnings(); }
    if (backupData.data.withdrawals) { withdrawals = backupData.data.withdrawals; saveWithdrawals(); }
    if (backupData.data.otpLog) { otpLog = backupData.data.otpLog; saveOTPLog(); }
    if (backupData.data.admins) { admins = backupData.data.admins; saveAdmins(); }
    if (backupData.data.settings) { settings = backupData.data.settings; saveSettings(); }
    if (backupData.data.services) { services = backupData.data.services; saveServices(); }
    if (backupData.data.countries) { countries = backupData.data.countries; saveCountries(); }
    if (backupData.data.activeNumbers) { activeNumbers = backupData.data.activeNumbers; saveActiveNumbers(); }
    if (backupData.data.totpSecrets) { totpSecrets = backupData.data.totpSecrets; saveTotpSecrets(); }
    if (backupData.data.tempMails) { tempMails = backupData.data.tempMails; saveTempMails(); }
    if (backupData.data.countryPrices) { countryPrices = backupData.data.countryPrices; saveCountryPrices(); }
    if (backupData.data.numbersByCountryService) { numbersByCountryService = backupData.data.numbersByCountryService; saveNumbers(); }
    
    const backupInfo = { backupId: backupData.backupId, timestamp: backupData.timestamp, stats: backupData.stats };
    fs.writeFileSync(path.join(DATA_DIR, "last_backup.json"), JSON.stringify(backupInfo, null, 2));
    
    console.log('✅ Restore successful!');
    return backupData;
  } catch (error) {
    console.error('Restore error:', error);
    return null;
  }
}

async function autoRestoreOnStart() {
  if (!AUTO_RESTORE_ON_START) return;
  console.log('🔍 Checking for latest backup...');
  const latestBackup = await findLatestBackup();
  if (latestBackup) {
    console.log(`📦 Found backup: ${latestBackup.fileName}`);
    if (Object.keys(users).length === 0) {
      console.log('⚠️ Current data empty! Restoring...');
      await restoreFromTelegramBackup(latestBackup.fileId, latestBackup.localPath);
    } else {
      console.log(`✅ Current data has ${Object.keys(users).length} users. No restore needed.`);
    }
  } else {
    console.log('📭 No backup found');
  }
}

/******************** BACKUP COMMANDS ********************/
bot.command("backup", async (ctx) => {
  if (!ctx.session.isAdmin && !isAdmin(ctx.from.id.toString())) return await ctx.reply("❌ Admin only");
  await ctx.reply("⏳ *Creating backup...*", { parse_mode: "Markdown" });
  const result = await createTelegramBackup(false);
  if (result) {
    await ctx.reply(`✅ *Backup created!*\n🆔 ID: \`${result.backupId}\``, { parse_mode: "Markdown" });
  } else {
    await ctx.reply("❌ *Backup failed*", { parse_mode: "Markdown" });
  }
});

bot.command("emergency_restore", async (ctx) => {
  if (!ctx.session.isAdmin && !isAdmin(ctx.from.id.toString())) return await ctx.reply("❌ Admin only");
  await ctx.reply("🔍 *Searching for latest backup...*", { parse_mode: "Markdown" });
  const latestBackup = await findLatestBackup();
  if (!latestBackup) {
    return await ctx.reply("❌ *No backup found*", { parse_mode: "Markdown" });
  }
  const backupDate = new Date(latestBackup.timestamp.replace(/-/g, ':')).toLocaleString('en-GB');
  await ctx.reply(
    `📦 *Backup Found*\n\n📁 File: ${latestBackup.fileName}\n📅 Date: ${backupDate}\n\n⚠️ *WARNING:* This will overwrite current data!\nType /confirm_restore to proceed.`,
    { parse_mode: "Markdown" }
  );
  ctx.session.pendingRestore = { fileId: latestBackup.fileId, localPath: latestBackup.localPath };
});

bot.command("confirm_restore", async (ctx) => {
  if (!ctx.session.isAdmin && !isAdmin(ctx.from.id.toString())) return await ctx.reply("❌ Admin only");
  if (!ctx.session.pendingRestore) return await ctx.reply("❌ No pending restore. Use /emergency_restore first.");
  await ctx.reply("⏳ *Restoring from backup...*", { parse_mode: "Markdown" });
  const restored = await restoreFromTelegramBackup(ctx.session.pendingRestore.fileId, ctx.session.pendingRestore.localPath);
  if (restored) {
    await ctx.reply(`✅ *RESTORE SUCCESSFUL!*\n\n📦 Backup: ${restored.backupId}\n👥 Users: ${restored.stats.totalUsers}\n💰 Total Earned: ${restored.stats.totalEarnings.toFixed(2)} TK`, { parse_mode: "Markdown" });
  } else {
    await ctx.reply("❌ *Restore failed*", { parse_mode: "Markdown" });
  }
  ctx.session.pendingRestore = null;
});

bot.command("backup_list_telegram", async (ctx) => {
  if (!ctx.session.isAdmin && !isAdmin(ctx.from.id.toString())) return await ctx.reply("❌ Admin only");
  await ctx.reply("🔍 *Fetching backup list...*", { parse_mode: "Markdown" });
  try {
    const messages = await bot.telegram.getChatHistory(BACKUP_GROUP_ID, 50);
    const backups = [];
    for (const msg of messages) {
      if (msg.document && msg.document.file_name && msg.document.file_name.endsWith('.json')) {
        const match = msg.document.file_name.match(/BACKUP_([\d\-T]+)\.json/);
        if (match) {
          backups.push({ name: msg.document.file_name, date: match[1], size: (msg.document.file_size / 1024).toFixed(2) });
        }
      }
    }
    if (backups.length === 0) return await ctx.reply("📭 *No backups found*", { parse_mode: "Markdown" });
    let message = "📦 *Telegram Backups*\n\n";
    backups.slice(0, 10).forEach((b, i) => {
      const date = new Date(b.date.replace(/-/g, ':')).toLocaleString('en-GB');
      message += `${i+1}. ${b.name}\n   📅 ${date} | 💾 ${b.size} KB\n\n`;
    });
    message += `\n💡 Use /emergency_restore to restore latest backup`;
    await ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    await ctx.reply("❌ Error fetching backup list. Make sure bot is admin in backup group.");
  }
});

bot.command("cancel", async (ctx) => {
  ctx.session.withdrawState = null;
  ctx.session.withdrawData = null;
  ctx.session.totpState = null;
  ctx.session.totpData = null;
  ctx.session.adminState = null;
  ctx.session.adminData = null;
  ctx.session.pendingRestore = null;
  await ctx.reply("✅ Cancelled.", {
    reply_markup: {
      keyboard: [["☎️ Get Number", "📧 Get Tempmail"], ["🔐 2FA", "💰 Balances"], ["💸 Withdraw", "💬 Support"]],
      resize_keyboard: true
    }
  });
});

bot.action("goto_main_menu", async (ctx) => {
  await ctx.answerCbQuery();
  clearUserState(ctx);
  await showMainMenu(ctx);
});

/******************** GET NUMBERS ********************/
bot.hears(["📞 Get Numbers", "☎️ Get Number"], async (ctx) => {
  clearUserState(ctx);
  const availableServices = [];
  for (const serviceId in services) {
    const service = services[serviceId];
    const availableCountries = getAvailableCountriesForService(serviceId);
    if (availableCountries.length > 0) {
      let totalNums = 0;
      for (const cc of availableCountries) {
        totalNums += (numbersByCountryService[cc]?.[serviceId]?.length || 0);
      }
      availableServices.push({ serviceId, service, totalNums });
    }
  }
  if (availableServices.length === 0) {
    return await ctx.reply("📭 *No Numbers Available*\n\nSorry, all numbers are currently in use.\nPlease try again later or contact support.", { parse_mode: "Markdown" });
  }
  const serviceButtons = [];
  for (let i = 0; i < availableServices.length; i += 2) {
    const row = [];
    row.push({ text: `${availableServices[i].service.icon} ${availableServices[i].service.name} (${availableServices[i].totalNums})`, callback_data: `select_service:${availableServices[i].serviceId}` });
    if (availableServices[i + 1]) {
      row.push({ text: `${availableServices[i+1].service.icon} ${availableServices[i+1].service.name} (${availableServices[i+1].totalNums})`, callback_data: `select_service:${availableServices[i+1].serviceId}` });
    }
    serviceButtons.push(row);
  }
  await ctx.reply("🎯 *Select a Service*\n\nWhich service do you need a number for?\n_(number in brackets = available count)_", {
    parse_mode: "Markdown", reply_markup: { inline_keyboard: serviceButtons }
  });
});

/******************** SERVICE SELECTION ********************/
bot.action(/^select_service:(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const serviceId = ctx.match[1];
    const availableCountries = getAvailableCountriesForService(serviceId);
    if (availableCountries.length === 0) {
      return await ctx.answerCbQuery("❌ No numbers available for this service", { show_alert: true });
    }
    const service = services[serviceId];
    const sortedCountries = [...availableCountries].sort((a, b) => getOtpPriceForCountry(a) - getOtpPriceForCountry(b));
    const countryButtons = [];
    for (let i = 0; i < sortedCountries.length; i += 2) {
      const row = [];
      const cc1 = sortedCountries[i];
      const c1 = countries[cc1];
      const price1 = getOtpPriceForCountry(cc1);
      row.push({ text: `${c1.flag} ${c1.name} (${price1.toFixed(2)}TK)`, callback_data: `select_country:${serviceId}:${cc1}` });
      if (sortedCountries[i + 1]) {
        const cc2 = sortedCountries[i + 1];
        const c2 = countries[cc2];
        const price2 = getOtpPriceForCountry(cc2);
        row.push({ text: `${c2.flag} ${c2.name} (${price2.toFixed(2)}TK)`, callback_data: `select_country:${serviceId}:${cc2}` });
      }
      countryButtons.push(row);
    }
    countryButtons.push([{ text: "🔙 Back to Service List", callback_data: "back_to_services" }]);
    await ctx.editMessageText(`${service.icon} *${service.name}* — Select Country\n\n📌 Balance will be added automatically when OTP arrives\n_(taka = earnings per OTP)_`, {
      parse_mode: "Markdown", reply_markup: { inline_keyboard: countryButtons }
    });
  } catch (error) { console.error("Service selection error:", error); await ctx.answerCbQuery("❌ Error", { show_alert: true }); }
});

/******************** COUNTRY SELECTION ********************/
bot.action(/^select_country:(.+):(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const serviceId = ctx.match[1];
    const countryCode = ctx.match[2];
    const userId = ctx.from.id.toString();
    const numberCount = settings.defaultNumberCount;
    const now = Date.now();
    const timeSinceLast = now - ctx.session.lastNumberTime;
    const cooldown = settings.cooldownSeconds * 1000;
    if (timeSinceLast < cooldown && (ctx.session.currentNumbers || []).length > 0) {
      const remaining = Math.ceil((cooldown - timeSinceLast) / 1000);
      await ctx.answerCbQuery();
      return await ctx.reply(`⏳ *${remaining} সেকেন্ড অপেক্ষা করুন।*`, { parse_mode: "Markdown" });
    }
    const numbers = getMultipleNumbersByCountryAndService(countryCode, serviceId, userId, numberCount);
    if (numbers.length === 0) {
      return await ctx.answerCbQuery(`❌ Not enough numbers available.`, { show_alert: true });
    }
    if ((ctx.session.currentNumbers || []).length > 0) {
      (ctx.session.currentNumbers || []).forEach(num => { if (activeNumbers[num]) { delete activeNumbers[num]; } });
      saveActiveNumbers();
    }
    ctx.session.currentNumbers = numbers;
    ctx.session.currentService = serviceId;
    ctx.session.currentCountry = countryCode;
    ctx.session.lastNumberTime = now;
    const country = countries[countryCode];
    const service = services[serviceId];
    const otpPrice = getOtpPriceForCountry(countryCode);
    let numbersText = '';
    numbers.forEach((num, i) => { numbersText += `${i + 1}. \`+${num}\`\n`; });
    const message = `✅ *${numbers.length} Number(s) Assigned!*\n\n${service.icon} *Service:* ${service.name}\n${country.flag} *Country:* ${country.name}\n💵 *Earnings per OTP:* ${otpPrice.toFixed(2)} taka\n\n📞 *Numbers:*\n${numbersText}\n📌 Use this number in the OTP Group.\nOTP will appear here and balance will be updated automatically.`;
    const sentMessage = await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '📨 Open OTP Group', url: OTP_GROUP }], [{ text: '🔄 Get New Numbers', callback_data: `get_new_numbers:${serviceId}:${countryCode}` }], [{ text: '🔙 Service List', callback_data: 'back_to_services' }]] }
    });
    if (sentMessage && sentMessage.message_id) {
      ctx.session.lastMessageId = sentMessage.message_id;
      ctx.session.lastChatId = ctx.chat.id;
    }
  } catch (error) { console.error("Country selection error:", error); await ctx.answerCbQuery("❌ Error getting numbers", { show_alert: true }); }
});

/******************** GET NEW NUMBERS ********************/
bot.action(/^get_new_numbers:(.+):(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const serviceId = ctx.match[1];
    const countryCode = ctx.match[2];
    const userId = ctx.from.id.toString();
    const numberCount = settings.defaultNumberCount;
    const now = Date.now();
    const timeSinceLast = now - ctx.session.lastNumberTime;
    const cooldown = settings.cooldownSeconds * 1000;
    if (timeSinceLast < cooldown) {
      const remaining = Math.ceil((cooldown - timeSinceLast) / 1000);
      await ctx.answerCbQuery();
      return await ctx.reply(`⏳ *${remaining} সেকেন্ড অপেক্ষা করুন।*`, { parse_mode: "Markdown" });
    }
    const numbers = getMultipleNumbersByCountryAndService(countryCode, serviceId, userId, numberCount);
    if (numbers.length === 0) {
      return await ctx.answerCbQuery(`❌ Not enough numbers available.`, { show_alert: true });
    }
    if ((ctx.session.currentNumbers || []).length > 0) {
      (ctx.session.currentNumbers || []).forEach(num => { if (activeNumbers[num]) { delete activeNumbers[num]; } });
      saveActiveNumbers();
    }
    ctx.session.currentNumbers = numbers;
    ctx.session.lastNumberTime = now;
    const country = countries[countryCode];
    const service = services[serviceId];
    const otpPrice = getOtpPriceForCountry(countryCode);
    let numbersText = '';
    numbers.forEach((num, i) => { numbersText += `${i + 1}. \`+${num}\`\n`; });
    const message = `🔄 *${numbers.length} New Number(s)!*\n\n${service.icon} *Service:* ${service.name}\n${country.flag} *Country:* ${country.name}\n💵 *Earnings per OTP:* ${otpPrice.toFixed(2)} taka\n\n📞 *Numbers:*\n${numbersText}\n📌 Use this number in the OTP Group.\nOTP will appear here and balance will be updated automatically.`;
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '📨 Open OTP Group', url: OTP_GROUP }], [{ text: '🔄 Get New Numbers', callback_data: `get_new_numbers:${serviceId}:${countryCode}` }], [{ text: '🔙 Service List', callback_data: 'back_to_services' }]] }
    });
  } catch (error) { console.error("Get new numbers error:", error); await ctx.answerCbQuery("❌ Error", { show_alert: true }); }
});

/******************** BACK TO SERVICES ********************/
bot.action("back_to_services", async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const availableServices = [];
    for (const serviceId in services) {
      const service = services[serviceId];
      const availableCountries = getAvailableCountriesForService(serviceId);
      if (availableCountries.length > 0) {
        let totalNums = 0;
        for (const cc of availableCountries) {
          totalNums += (numbersByCountryService[cc]?.[serviceId]?.length || 0);
        }
        availableServices.push({ serviceId, service, totalNums });
      }
    }
    const serviceButtons = [];
    for (let i = 0; i < availableServices.length; i += 2) {
      const row = [];
      row.push({ text: `${availableServices[i].service.icon} ${availableServices[i].service.name} (${availableServices[i].totalNums})`, callback_data: `select_service:${availableServices[i].serviceId}` });
      if (availableServices[i + 1]) {
        row.push({ text: `${availableServices[i+1].service.icon} ${availableServices[i+1].service.name} (${availableServices[i+1].totalNums})`, callback_data: `select_service:${availableServices[i+1].serviceId}` });
      }
      serviceButtons.push(row);
    }
    await ctx.editMessageText("🎯 *Select a Service*\n\nWhich service do you need a number for?\n_(number in brackets = available count)_", {
      parse_mode: "Markdown", reply_markup: { inline_keyboard: serviceButtons }
    });
  } catch (error) { console.error("Back to services error:", error); await ctx.answerCbQuery("❌ Error", { show_alert: true }); }
});

/******************** BALANCE ********************/
bot.hears("💰 Balances", async (ctx) => {
  clearUserState(ctx);
  const userId = ctx.from.id.toString();
  const e = getUserEarnings(userId);
  const pendingWithdrawals = withdrawals.filter(w => w.userId === userId && w.status === "pending");
  const totalWithdrawn = withdrawals.filter(w => w.userId === userId && w.status === "approved").reduce((sum, w) => sum + w.amount, 0);
  await ctx.reply(`💰 *Your Earnings*\n\n💵 *Current Balance:* ${e.balance.toFixed(2)} taka\n📈 *Total Earned:* ${e.totalEarned.toFixed(2)} taka\n📨 *Total OTPs:* ${e.otpCount || 0}\n💸 *Total Withdrawn:* ${totalWithdrawn.toFixed(2)} taka\n⏳ *Pending Withdrawals:* ${pendingWithdrawals.length}\n\n📌 *Minimum Withdraw:* ${settings.minWithdraw} taka\n\n💡 Balance is added automatically when OTP is received.`, {
    parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "💸 Withdraw", callback_data: "start_withdraw" }], [{ text: "📋 Withdraw History", callback_data: "withdraw_history" }]] }
  });
});

/******************** WITHDRAW ********************/
bot.hears("💸 Withdraw", async (ctx) => {
  ctx.session.withdrawState = null;
  ctx.session.withdrawData = null;
  const userId = ctx.from.id.toString();
  const e = getUserEarnings(userId);
  if (!settings.withdrawEnabled) return await ctx.reply("⏸️ *Withdrawals are currently disabled.*\nPlease try again later.", { parse_mode: "Markdown" });
  if (e.balance < settings.minWithdraw) return await ctx.reply(`❌ *Insufficient balance for withdrawal.*\n\n💵 Your balance: *${e.balance.toFixed(2)} taka*\n📌 Minimum: *${settings.minWithdraw} taka*\n\nYou need ${(settings.minWithdraw - e.balance).toFixed(2)} more taka.`, { parse_mode: "Markdown" });
  await ctx.reply(`💸 *Withdraw*\n\n💵 Your balance: *${e.balance.toFixed(2)} taka*\n📌 Minimum: *${settings.minWithdraw} taka*\n\nChoose your withdrawal method:`, {
    parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🟣 bKash", callback_data: "withdraw_method:bKash" }, { text: "🟠 Nagad", callback_data: "withdraw_method:Nagad" }], [{ text: "❌ Cancel", callback_data: "withdraw_cancel" }]] }
  });
});

bot.action("start_withdraw", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.withdrawState = null;
  ctx.session.withdrawData = null;
  const userId = ctx.from.id.toString();
  const e = getUserEarnings(userId);
  if (!settings.withdrawEnabled) return await ctx.editMessageText("⏸️ *Withdrawals are currently disabled.*", { parse_mode: "Markdown" });
  if (e.balance < settings.minWithdraw) return await ctx.editMessageText(`❌ *Insufficient balance.*\n\n💵 Balance: ${e.balance.toFixed(2)} taka\n📌 Minimum: ${settings.minWithdraw} taka`, { parse_mode: "Markdown" });
  await ctx.editMessageText(`💸 *Withdraw*\n\n💵 Your balance: *${e.balance.toFixed(2)} taka*\n📌 Minimum: *${settings.minWithdraw} taka*\n\nChoose your withdrawal method:`, {
    parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🟣 bKash", callback_data: "withdraw_method:bKash" }, { text: "🟠 Nagad", callback_data: "withdraw_method:Nagad" }], [{ text: "❌ Cancel", callback_data: "withdraw_cancel" }]] }
  });
});

bot.action(/^withdraw_method:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const method = ctx.match[1];
  const icon = method === "bKash" ? "🟣" : "🟠";
  const userId = ctx.from.id.toString();
  const e = getUserEarnings(userId);
  const bal = e.balance;
  const min = settings.minWithdraw;
  const fullBal = Math.floor(bal * 100) / 100;
  ctx.session.withdrawState = "waiting_amount";
  ctx.session.withdrawData = { method };
  const amountButtons = [];
  const amounts = [];
  if (bal >= min) amounts.push(min);
  if (bal >= 100 && !amounts.includes(100)) amounts.push(100);
  if (bal >= 200 && !amounts.includes(200)) amounts.push(200);
  if (bal >= 500 && !amounts.includes(500)) amounts.push(500);
  const row = [];
  for (const amt of amounts) { row.push({ text: `${amt} taka`, callback_data: `withdraw_amount:${method}:${amt}` }); if (row.length === 2) { amountButtons.push([...row]); row.length = 0; } }
  if (row.length > 0) amountButtons.push([...row]);
  amountButtons.push([{ text: `💰 All taka (${fullBal} taka)`, callback_data: `withdraw_amount:${method}:${fullBal}` }]);
  amountButtons.push([{ text: "❌ Cancel", callback_data: "withdraw_cancel" }]);
  await ctx.editMessageText(`${icon} *${method} Withdrawal*\n\n💰 Your balance: *${e.balance.toFixed(2)} taka*\n📌 Minimum: *${settings.minWithdraw} taka*\n\nSelect from the buttons below\nor type an amount in chat (e.g.: \`75\`):`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: amountButtons } });
});

bot.action(/^withdraw_amount:([^:]+):(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const method = ctx.match[1];
  const amount = parseFloat(ctx.match[2]);
  const userId = ctx.from.id.toString();
  const e = getUserEarnings(userId);
  const icon = method === "bKash" ? "🟣" : "🟠";
  if (isNaN(amount) || amount <= 0) return await ctx.editMessageText("❌ An error occurred. Please try again.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "start_withdraw" }]] } });
  if (amount < settings.minWithdraw) return await ctx.editMessageText(`❌ Minimum *${settings.minWithdraw} taka* is required.`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "start_withdraw" }]] } });
  if (amount > e.balance) return await ctx.editMessageText(`❌ Insufficient balance! Your balance: *${e.balance.toFixed(2)} taka*`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "start_withdraw" }]] } });
  ctx.session.withdrawState = "waiting_account";
  ctx.session.withdrawData = { method, amount };
  await ctx.editMessageText(`${icon} *${method} - ${amount.toFixed(2)} taka*\n\n📱 Your *${method} number:*\nExample: \`01712345678\`\n\nType /cancel to cancel`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "withdraw_cancel" }]] } });
});

bot.action("withdraw_history", async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id.toString();
  const userWithdrawals = withdrawals.filter(w => w.userId === userId).slice(-10).reverse();
  try {
    let text = "📋 *Withdraw History*\n\n";
    if (userWithdrawals.length === 0) { text += "No withdrawal requests yet."; } else {
      userWithdrawals.forEach((w) => { const icon = w.status === "approved" ? "✅" : w.status === "rejected" ? "❌" : "⏳"; const date = new Date(w.requestedAt).toLocaleDateString('en-GB'); text += `${icon} *${w.amount.toFixed(2)} taka* - ${w.method}\n📱 \`${w.account}\` | ${date}\n\n`; });
    }
    if (text.length > 4000) text = text.substring(0, 3950) + '\n\n_...truncated_';
    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "goto_main_menu" }]] } });
  } catch(error) { if (error.message?.includes("message is not modified")) return; try { await ctx.editMessageText("❌ Error loading history.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "goto_main_menu" }]] } }); } catch(e) {} }
});

bot.action("withdraw_cancel", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.withdrawState = null;
  ctx.session.withdrawData = null;
  await ctx.editMessageText("❌ *Withdrawal cancelled.*\n\nPress 💸 Withdraw to try again.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "goto_main_menu" }]] } });
});

bot.action("withdraw_confirm", async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    if (ctx.session.withdrawState !== "confirm") return;
    const { method, account, amount } = ctx.session.withdrawData;
    const userEarnings = getUserEarnings(userId);
    if (userEarnings.balance < amount) { ctx.session.withdrawState = null; ctx.session.withdrawData = null; return await ctx.editMessageText("❌ Balance has changed. Please try again.", { parse_mode: "Markdown" }); }
    userEarnings.balance = parseFloat((userEarnings.balance - amount).toFixed(2));
    saveEarnings();
    const withdrawId = Date.now().toString();
    withdrawals.push({ id: withdrawId, userId, userName: ctx.from.first_name || "User", userUsername: ctx.from.username || "", amount, method, account, status: "pending", requestedAt: new Date().toISOString(), processedAt: null });
    saveWithdrawals();
    ctx.session.withdrawState = null;
    ctx.session.withdrawData = null;
    await ctx.editMessageText(`✅ *Withdrawal Request Submitted!*\n\n💳 Method: ${method}\n📱 Account: ${account}\n💵 Amount: ${amount.toFixed(2)} taka\n\n⏳ Payment will be sent after admin approval.`, { parse_mode: "Markdown" });
    for (const adminId of admins) {
      try { await ctx.telegram.sendMessage(adminId, `🔔 *New Withdrawal Request!*\n\n👤 User: ${ctx.from.first_name} (@${ctx.from.username || "N/A"})\n🆔 ID: ${userId}\n💳 Method: ${method}\n📱 Account: ${account}\n💵 Amount: ${amount.toFixed(2)} taka`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "✅ Approve", callback_data: `wadmin_approve:${withdrawId}` }, { text: "❌ Reject", callback_data: `wadmin_reject:${withdrawId}` }]] } }); } catch (e) {} }
  } catch (error) { console.error("Withdraw confirm error:", error); try { await ctx.reply("❌ An error occurred. Please try again."); } catch(e) {} }
});

/******************** ADMIN WITHDRAW APPROVE/REJECT ********************/
bot.action(/^wadmin_approve:(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin && !isAdmin(ctx.from.id.toString())) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery("✅ Approving...");
  const withdrawId = ctx.match[1];
  const w = withdrawals.find(w => w.id === withdrawId);
  if (!w) return await ctx.editMessageText("❌ Request not found.");
  if (w.status !== "pending") return await ctx.editMessageText(`⚠️ This request is already ${w.status}.`);
  w.status = "approved";
  w.processedAt = new Date().toISOString();
  saveWithdrawals();
  await ctx.editMessageText(`✅ *Withdraw Approved!*\n\n👤 ${w.userName}\n💵 ${w.amount.toFixed(2)} taka → ${w.method}\n📱 ${w.account}`, { parse_mode: "Markdown" });
  try { await ctx.telegram.sendMessage(w.userId, `✅ *Your Withdrawal has been Approved!*\n\n💵 Amount: ${w.amount.toFixed(2)} taka\n💳 Method: ${w.method}\n📱 Account: ${w.account}\n\nPayment will be sent shortly.`, { parse_mode: "Markdown" }); } catch (e) {}
});

bot.action(/^wadmin_reject:(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin && !isAdmin(ctx.from.id.toString())) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery("❌ Rejecting...");
  const withdrawId = ctx.match[1];
  const w = withdrawals.find(w => w.id === withdrawId);
  if (!w) return await ctx.editMessageText("❌ Request not found.");
  if (w.status !== "pending") return await ctx.editMessageText(`⚠️ Already ${w.status}.`);
  w.status = "rejected";
  w.processedAt = new Date().toISOString();
  saveWithdrawals();
  const userEarnings = getUserEarnings(w.userId);
  userEarnings.balance = parseFloat((userEarnings.balance + w.amount).toFixed(2));
  saveEarnings();
  await ctx.editMessageText(`❌ *Withdraw Rejected & Refunded!*\n\n👤 ${w.userName}\n💵 ${w.amount.toFixed(2)} taka refunded.`, { parse_mode: "Markdown" });
  try { await ctx.telegram.sendMessage(w.userId, `❌ *Your Withdrawal Request was Rejected.*\n\n💵 ${w.amount.toFixed(2)} taka has been refunded to your balance.`, { parse_mode: "Markdown" }); } catch (e) {}
});

/******************** 2FA MENU ********************/
bot.hears(["🔐 2FA", "🔐 2FA Codes"], async (ctx) => {
  clearUserState(ctx);
  await ctx.reply("🔐 *2-Step Verification Code Generator*\n\nSelect a service:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "📘 Facebook 2FA", callback_data: "totp_service:facebook" }], [{ text: "📸 Instagram 2FA", callback_data: "totp_service:instagram" }], [{ text: "🔍 Google 2FA", callback_data: "totp_service:google" }], [{ text: "⚙️ Other Service 2FA", callback_data: "totp_service:other" }]] }
  });
});

/******************** TOTP HANDLERS ********************/
bot.action(/^totp_service:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const service = ctx.match[1];
  const icons = { facebook: "📘", instagram: "📸", google: "🔍", other: "⚙️" };
  const names = { facebook: "Facebook", instagram: "Instagram", google: "Google", other: "Other" };
  ctx.session.totpState = "waiting_secret";
  ctx.session.totpData = { service };
  const icon = icons[service] || "🔐";
  const name = names[service] || service;
  await ctx.editMessageText(`${icon} *${name} Secret Key*\n\nSend your Authenticator Secret Key.\n\n📌 *Where to find your key:*\n• Facebook: Settings → Security → Two-Factor Authentication → Authenticator App → Setup Key\n• Instagram: Settings → Security → Two-Factor → Authentication App → Manual key\n\n🔑 It looks like: \`JBSWY3DPEHPK3PXP\`\n\nType /cancel to cancel`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "totp_back" }]] } });
});

bot.action(/^totp_refresh:([^:]+):(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery("🔄 Refreshing code...");
    const service = ctx.match[1];
    const secret = decodeURIComponent(ctx.match[2]);
    const result = generateTOTP(secret);
    if (!result) return await ctx.editMessageText("❌ *Could not generate code.* Invalid secret key.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "totp_back" }]] } });
    const icon = service === "facebook" ? "📘" : service === "instagram" ? "📸" : service === "google" ? "🔍" : "⚙️";
    const name = service === "facebook" ? "Facebook" : service === "instagram" ? "Instagram" : service === "google" ? "Google" : "2FA";
    try { await ctx.editMessageText(`${icon} *${name} 2FA Code*\n\n🔑 *Code:* \`${result.token}\`\n\n⏰ *${result.timeRemaining} seconds remaining*\n\n📋 Copy the code and enter it on the site.`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Refresh Code", callback_data: `totp_refresh:${service}:${encodeURIComponent(secret)}` }], [{ text: "🔙 Back", callback_data: "totp_back" }]] } }); } catch (editErr) { if (!editErr.message || !editErr.message.includes("message is not modified")) throw editErr; }
  } catch (error) { console.error("TOTP refresh error:", error); try { await ctx.answerCbQuery("❌ Error refreshing code", { show_alert: true }); } catch(e) {} }
});

bot.action("totp_back", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("🔐 *2FA Code Generator*\n\nSelect a service:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "📘 Facebook 2FA", callback_data: "totp_service:facebook" }], [{ text: "📸 Instagram 2FA", callback_data: "totp_service:instagram" }], [{ text: "🔍 Google 2FA", callback_data: "totp_service:google" }], [{ text: "⚙️ Other Service 2FA", callback_data: "totp_service:other" }]] }
  });
});

/******************** TEMP MAIL ********************/
bot.hears(["📧 Temp Mail", "📧 Get Tempmail"], async (ctx) => {
  clearUserState(ctx);
  const userId = ctx.from.id.toString();
  const existing = tempMails[userId];
  if (existing) {
    await ctx.reply(`📧 *Temporary Email*\n\n📌 Your email:\n\`${existing.address}\`\n\n⚠️ Getting a new email will delete this one.`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📬 Check Inbox", callback_data: "tempmail_inbox" }], [{ text: "📋 Show Email Address", callback_data: "tempmail_showaddress" }], [{ text: "🔄 Get New Email", callback_data: "tempmail_create" }], [{ text: "🗑️ Delete Email", callback_data: "tempmail_delete" }]] } });
  } else {
    await ctx.reply("📧 *Temporary Email*\n\n✅ Create a new disposable email address.\n⚡ Instant • Unlimited • No signup", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🆕 Create New Email", callback_data: "tempmail_create" }]] } });
  }
});

bot.action("tempmail_create", async (ctx) => {
  const userId = ctx.from.id.toString();
  await ctx.answerCbQuery("⏳ Creating email...");
  const loadingMsg = await ctx.reply("⏳ *Creating your email...*", { parse_mode: "Markdown" });
  setImmediate(async () => {
    try {
      if (tempMails[userId]) delete tempMails[userId];
      const newEmail = await createFreshEmail();
      if (!newEmail) { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `❌ *Email creation failed.*\n\nMail.tm is busy. Please try again in 1 minute.`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Retry", callback_data: "tempmail_create" }]] } }); return; }
      tempMails[userId] = newEmail;
      saveTempMails();
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `✅ *New Temporary Email Created!*\n\n📧 *Email Address:*\n\`${newEmail.address}\`\n\n📌 Use this address on any website.\n✉️ Tap *Check Inbox* after receiving an email.`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📬 Check Inbox", callback_data: "tempmail_inbox" }], [{ text: "📋 Show Email Address", callback_data: "tempmail_showaddress" }], [{ text: "🔄 Get New Email", callback_data: "tempmail_create" }], [{ text: "🗑️ Delete Email", callback_data: "tempmail_delete" }]] } });
    } catch (error) { console.error("Temp mail create error:", error.message); try { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `❌ *An error occurred.* Please try again.`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Retry", callback_data: "tempmail_create" }]] } }); } catch(e) {} }
  });
});

bot.action("tempmail_inbox", async (ctx) => {
  try {
    await ctx.answerCbQuery("📬 Loading inbox...");
    const userId = ctx.from.id.toString();
    if (!tempMails[userId]) return await ctx.editMessageText("❌ *No email found.*\n\nPress the button below to create a new email.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🆕 Create New Email", callback_data: "tempmail_create" }]] } });
    const { address, provider } = tempMails[userId];
    let messages = [];
    try { messages = await getEmailInbox(tempMails[userId]); } catch(e) { console.error('Inbox fetch error:', e.message); }
    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    let text = `📬 *Inbox:* \`${address}\`\n🕐 _Checked: ${now}_\n_(via ${provider})_\n\n`;
    if (messages.length === 0) { text += `📭 *No emails yet.*\n\nSend an email to this address, then tap Refresh.`; } else {
      text += `📨 *${messages.length} email(s):*\n\n`;
      for (const msg of messages.slice(0, 5)) {
        text += `━━━━━━━━━━━━━━━\n📩 *From:* ${String(msg.from || '').replace(/[_*`\[]/g, '\\$&')}\n📌 *Subject:* ${String(msg.subject || '(No Subject)').replace(/[_*`\[]/g, '\\$&')}\n🕐 ${msg.date}\n`;
        try { const body = await getEmailMessage(msg.id, tempMails[userId]); if (body) { const otpMatches = body.match(/\b\d{4,8}\b/g); if (otpMatches && otpMatches.length > 0) { text += `\n🔑 *OTP Code:* \`${otpMatches[0]}\`\n`; } const preview = body.substring(0, 300).replace(/[_*`\[]/g, '\\$&'); text += `\n📝 *Message:*\n_${preview}${body.length > 300 ? '...' : ''}_\n`; } } catch(e) { console.error("Read message error:", e.message); }
        text += `\n`;
      }
    }
    try { await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Refresh", callback_data: "tempmail_inbox" }], [{ text: "📧 Show Email Address", callback_data: "tempmail_showaddress" }], [{ text: "🔄 Get New Email", callback_data: "tempmail_create" }], [{ text: "🗑️ Delete Email", callback_data: "tempmail_delete" }]] } }); } catch (e) { if (!e.message?.includes("message is not modified")) throw e; }
  } catch (error) { console.error("Temp mail inbox error:", error); try { await ctx.editMessageText("❌ *An error occurred.* Please try again.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Retry", callback_data: "tempmail_inbox" }]] } }); } catch (e) {} }
});

bot.action("tempmail_showaddress", async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id.toString();
  if (!tempMails[userId]) return await ctx.answerCbQuery("❌ No email found", { show_alert: true });
  const { address } = tempMails[userId];
  await ctx.editMessageText(`📧 *Your Temp Email:*\n\n\`${address}\`\n\nCopy this address and use it on any website.`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📬 Check Inbox", callback_data: "tempmail_inbox" }], [{ text: "🔄 Get New Email", callback_data: "tempmail_create" }]] } });
});

bot.action("tempmail_delete", async (ctx) => {
  const userId = ctx.from.id.toString();
  await ctx.answerCbQuery();
  if (tempMails[userId]) { delete tempMails[userId]; saveTempMails(); await ctx.editMessageText("✅ *Email deleted successfully.*", { parse_mode: "Markdown" }); } else { await ctx.editMessageText("❌ *No email found.*", { parse_mode: "Markdown" }); }
});

/******************** SUPPORT ********************/
bot.hears("💬 Support", async (ctx) => {
  await ctx.reply("💬 *Support*\n\nFor any issues or questions, contact our admin directly:\n\n📌 Admin: @Rana1132", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "💬 Contact Support", url: "https://t.me/Rana1132" }]] } });
});

/******************** HELP ********************/
bot.hears("ℹ️ Help", async (ctx) => {
  await ctx.reply("📖 *Bot Help*\n\n• ☎️ *Get Number* - Get a number\n• 📧 *Get Tempmail* - Get a free temp email\n• 🔐 *2FA* - Facebook/Instagram 2-step code\n• 💰 *Balances* - View your earnings\n• 💸 *Withdraw* - Withdraw earnings\n\n📌 Minimum withdraw: ${settings.minWithdraw} taka\n\nAdmin: /adminlogin", { parse_mode: "Markdown" });
});

/******************** HOME HANDLER ********************/
bot.hears(["🏠 Home", "🏠 Main Menu"], async (ctx) => {
  clearUserState(ctx);
  await showMainMenu(ctx);
});

/******************** ADMIN LOGIN ********************/
bot.command("adminlogin", async (ctx) => {
  try {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 2) return await ctx.reply("❌ Usage: /adminlogin [password]");
    const password = parts[1];
    if (password === ADMIN_PASSWORD) {
      ctx.session.isAdmin = true;
      if (!admins.includes(ctx.from.id.toString())) { admins.push(ctx.from.id.toString()); saveAdmins(); }
      await ctx.reply("✅ *Admin Login Successful!*\n\nYou now have administrator privileges.\nUse /admin to access admin panel.", { parse_mode: "Markdown" });
    } else { await ctx.reply("❌ Wrong password. Access denied."); }
  } catch (error) { console.error("Admin login error:", error); await ctx.reply("❌ Error during admin login."); }
});

/******************** ADMIN PANEL ********************/
bot.command("admin", async (ctx) => {
  try {
    if (!ctx.session.isAdmin && !isAdmin(ctx.from.id.toString())) return await ctx.reply("❌ *Admin Access Required*\n\nUse /adminlogin [password] to login as admin.", { parse_mode: "Markdown" });
    const buttons = [[{ text: "📊 Stock Report", callback_data: "admin_stock" }, { text: "👥 User Stats", callback_data: "admin_users" }], [{ text: "📢 Broadcast", callback_data: "admin_broadcast" }, { text: "📋 OTP Log", callback_data: "admin_otp_log" }], [{ text: "➕ Add Numbers", callback_data: "admin_add_numbers" }, { text: "📤 Upload File", callback_data: "admin_upload" }], [{ text: "🗑️ Delete Numbers", callback_data: "admin_delete" }, { text: "🔧 Manage Services", callback_data: "admin_manage_services" }], [{ text: "🌍 Manage Countries", callback_data: "admin_manage_countries" }, { text: "⚙️ Settings", callback_data: "admin_settings" }], [{ text: "💰 Country Prices", callback_data: "admin_country_prices" }, { text: "💸 Withdrawals", callback_data: "admin_withdrawals" }], [{ text: "👛 Balance Management", callback_data: "admin_balance_manage" }, { text: "📦 Backup", callback_data: "admin_backup" }], [{ text: "🚪 Logout", callback_data: "admin_logout" }]];
    await ctx.reply("🛠 *Admin Dashboard*\n\nSelect an option:", { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } });
  } catch (error) { console.error("Admin command error:", error); await ctx.reply("❌ Error accessing admin panel."); }
});

/******************** ADMIN BACKUP MENU ********************/
bot.action("admin_backup", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  let backupInfo = "";
  try {
    const latestBackup = await findLatestBackup();
    if (latestBackup) { const backupDate = new Date(latestBackup.timestamp.replace(/-/g, ':')).toLocaleString('en-GB'); backupInfo = `\n📦 *Latest Backup:* ${latestBackup.fileName}\n📅 *Date:* ${backupDate}\n`; } else { backupInfo = `\n⚠️ *No backups found* - Create one first!\n`; }
  } catch(e) {}
  await ctx.editMessageText(`📦 *Backup Management*${backupInfo}\n\nSelect an option:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🆕 Create Backup", callback_data: "admin_create_backup" }], [{ text: "🔄 Emergency Restore", callback_data: "admin_emergency_restore" }], [{ text: "📋 View Backups", callback_data: "admin_view_backups" }], [{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

bot.action("admin_create_backup", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery("⏳ Creating backup...");
  const result = await createTelegramBackup(false);
  if (result) { await ctx.editMessageText(`✅ *Backup Created!*\n\n🆔 ID: \`${result.backupId}\`\n📦 Saved in backup group.`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_backup" }]] } }); } else { await ctx.editMessageText("❌ *Backup failed*", { parse_mode: "Markdown" }); }
});

bot.action("admin_emergency_restore", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  const loadingMsg = await ctx.editMessageText("🔍 *Searching for latest backup...*\n\nPlease wait...", { parse_mode: "Markdown" });
  try {
    const latestBackup = await findLatestBackup();
    if (!latestBackup) { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "❌ *No backup found in the backup group.*\n\nPlease create a backup first using 'Create Backup' button.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back to Backup Menu", callback_data: "admin_backup" }]] } }); return; }
    const backupDate = new Date(latestBackup.timestamp.replace(/-/g, ':')).toLocaleString('en-GB');
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `📦 *Backup Found*\n\n📁 *File:* ${latestBackup.fileName}\n📅 *Date:* ${backupDate}\n\n⚠️ *WARNING:* This will overwrite ALL current data!\n\nType /confirm_restore to proceed.\nType /cancel to abort.`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "✅ Confirm Restore", callback_data: "admin_confirm_restore" }, { text: "❌ Cancel", callback_data: "admin_backup" }]] } });
    ctx.session.pendingRestore = { fileId: latestBackup.fileId, localPath: latestBackup.localPath };
  } catch (error) { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `❌ *Error searching for backup*\n\n${error.message}`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back to Backup Menu", callback_data: "admin_backup" }]] } }); }
});

bot.action("admin_confirm_restore", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  if (!ctx.session.pendingRestore) { await ctx.answerCbQuery("❌ No pending restore found"); return await ctx.editMessageText("❌ *No restore pending.*\n\nPlease use 'Emergency Restore' first.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back to Backup Menu", callback_data: "admin_backup" }]] } }); }
  await ctx.answerCbQuery("⏳ Restoring backup...");
  const loadingMsg = await ctx.editMessageText("⏳ *Restoring from backup...*\n\nThis may take a moment.\nPlease do not close this message.", { parse_mode: "Markdown" });
  try {
    const restored = await restoreFromTelegramBackup(ctx.session.pendingRestore.fileId, ctx.session.pendingRestore.localPath);
    if (restored) { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `✅ *RESTORE SUCCESSFUL!*\n\n📦 Backup: ${restored.backupId}\n👥 Users: ${restored.stats.totalUsers}\n💰 Total Earned: ${restored.stats.totalEarnings.toFixed(2)} TK\n💵 Pending Balance: ${restored.stats.totalBalance.toFixed(2)} TK\n\n⚠️ The bot has been restored to the backup state.`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🛠 Back to Admin Panel", callback_data: "admin_back" }]] } }); for (const adminId of admins) { try { await bot.telegram.sendMessage(adminId, `✅ *System Restored*\n\nBackup: ${restored.backupId}\nUsers: ${restored.stats.totalUsers}\nEarnings: ${restored.stats.totalEarnings.toFixed(2)} TK\n\nRestored by: ${ctx.from.first_name}`, { parse_mode: "Markdown" }); } catch(e) {} } } else { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "❌ *RESTORE FAILED*\n\nCould not restore from backup. The backup file may be corrupted.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back to Backup Menu", callback_data: "admin_backup" }]] } }); }
    ctx.session.pendingRestore = null;
  } catch (error) { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `❌ *RESTORE ERROR*\n\n${error.message}`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back to Backup Menu", callback_data: "admin_backup" }]] } }); ctx.session.pendingRestore = null; }
});

bot.action("admin_view_backups", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  try {
    const messages = await bot.telegram.getChatHistory(BACKUP_GROUP_ID, 50);
    const backups = [];
    for (const msg of messages) { if (msg.document && msg.document.file_name && msg.document.file_name.endsWith('.json')) { const match = msg.document.file_name.match(/BACKUP_([\d\-T]+)\.json/); if (match) { backups.push({ name: msg.document.file_name, date: match[1], size: (msg.document.file_size / 1024).toFixed(2) }); } } }
    if (backups.length === 0) return await ctx.editMessageText("📭 *No backups found*\n\nPlease create a backup first using 'Create Backup'.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back to Backup Menu", callback_data: "admin_backup" }]] } });
    let message = "📦 *Available Backups*\n\n";
    backups.slice(0, 10).forEach((b, i) => { const date = new Date(b.date.replace(/-/g, ':')).toLocaleString('en-GB'); message += `${i+1}. \`${b.name}\`\n   📅 ${date} | 💾 ${b.size} KB\n\n`; });
    message += `💡 Use "Emergency Restore" to restore the latest backup.`;
    await ctx.editMessageText(message, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Emergency Restore", callback_data: "admin_emergency_restore" }], [{ text: "🔙 Back", callback_data: "admin_backup" }]] } });
  } catch (error) { await ctx.editMessageText("❌ *Error loading backups*\n\nMake sure the backup group exists and bot is admin there.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_backup" }]] } }); }
});

bot.action("admin_back", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.adminState = null;
  ctx.session.adminData = null;
  const buttons = [[{ text: "📊 Stock Report", callback_data: "admin_stock" }, { text: "👥 User Stats", callback_data: "admin_users" }], [{ text: "📢 Broadcast", callback_data: "admin_broadcast" }, { text: "📋 OTP Log", callback_data: "admin_otp_log" }], [{ text: "➕ Add Numbers", callback_data: "admin_add_numbers" }, { text: "📤 Upload File", callback_data: "admin_upload" }], [{ text: "🗑️ Delete Numbers", callback_data: "admin_delete" }, { text: "🔧 Manage Services", callback_data: "admin_manage_services" }], [{ text: "🌍 Manage Countries", callback_data: "admin_manage_countries" }, { text: "⚙️ Settings", callback_data: "admin_settings" }], [{ text: "💰 Country Prices", callback_data: "admin_country_prices" }, { text: "💸 Withdrawals", callback_data: "admin_withdrawals" }], [{ text: "👛 Balance Management", callback_data: "admin_balance_manage" }, { text: "📦 Backup", callback_data: "admin_backup" }], [{ text: "🚪 Logout", callback_data: "admin_logout" }]];
  await ctx.editMessageText("🛠 *Admin Dashboard*\n\nSelect an option:", { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } });
});

bot.action("admin_cancel", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.adminState = null;
  ctx.session.adminData = null;
  await ctx.editMessageText("❌ *Action Cancelled*\n\nReturning to admin panel...", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🛠 Back to Admin", callback_data: "admin_back" }]] } });
});

bot.action("admin_logout", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.isAdmin = false;
  ctx.session.adminState = null;
  ctx.session.adminData = null;
  await ctx.editMessageText("🚪 *Admin Logged Out*\n\nYou have been logged out from admin panel.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back to Main Menu", callback_data: "back_to_services" }]] } });
});

// Note: Due to length, the remaining admin functions (stock, users, otp log, broadcast, add numbers, upload file, manage services, manage countries, settings, country prices, balance management, withdrawals, delete numbers) should remain as they are in your original bot.js file.

/******************** OTP GROUP MONITORING ********************/
bot.on("chat_member", async (ctx) => {
  try {
    const member = ctx.chatMember;
    if (!member) return;
    const chatId = ctx.chat.id.toString();
    const userId = member.new_chat_member?.user?.id?.toString();
    if (!userId) return;
    const oldStatus = member.old_chat_member?.status;
    const newStatus = member.new_chat_member?.status;
    const isRequiredGroup = (chatId === MAIN_CHANNEL_ID?.toString() || chatId === CHAT_GROUP_ID?.toString() || chatId === OTP_GROUP_ID?.toString());
    if (!isRequiredGroup) return;
    const wasActive = ["member", "administrator", "creator"].includes(oldStatus);
    const nowGone = ["left", "kicked", "restricted"].includes(newStatus);
    if (wasActive && nowGone) { if (users[userId]) { users[userId].verified = false; saveUsers(); } console.log(`🚫 User ${userId} left/kicked — access revoked`); }
  } catch(e) { console.error("chat_member event error:", e.message); }
});

bot.on("message", async (ctx, next) => {
  try {
    const chatId = ctx.chat.id;
    const isOtpGroup = chatId === OTP_GROUP_ID || chatId === Number(OTP_GROUP_ID) || chatId.toString() === OTP_GROUP_ID.toString();
    if (!isOtpGroup) return next();
    const messageText = ctx.message.text || ctx.message.caption || '';
    const messageId = ctx.message.message_id;
    if (!messageText) return;
    const matchedNumber = findMatchingActiveNumber(messageText);
    if (!matchedNumber) return;
    const userData = activeNumbers[matchedNumber];
    const userId = userData.userId;
    const countryCode = userData.countryCode || '';
    if (userData.lastOTP === messageId) return;
    userData.lastOTP = messageId;
    userData.otpCount = (userData.otpCount || 0) + 1;
    saveActiveNumbers();
    const otpCode = extractOTPCode(messageText);
    const earned = addEarning(userId, countryCode);
    const userBalance = getUserEarnings(userId).balance;
    const service = services[userData.service] || { icon: '📱', name: userData.service };
    const country = countries[countryCode] || { flag: '🌍', name: countryCode };
    let notifyText = `📨 *OTP Received!*\n\n${service.icon} *Service:* ${service.name}\n${country.flag} *Country:* ${country.name}\n📞 *Number:* \`+${matchedNumber}\`\n`;
    if (otpCode) notifyText += `\n🔑 *OTP Code:* \`${otpCode}\`\n`;
    notifyText += `\n💵 *+${earned.toFixed(2)} taka earned!*\n💰 *Current Balance: ${userBalance.toFixed(2)} taka*`;
    await ctx.telegram.sendMessage(userId, notifyText, { parse_mode: 'Markdown' });
    await ctx.telegram.forwardMessage(userId, OTP_GROUP_ID, messageId);
    otpLog.push({ phoneNumber: matchedNumber, userId, countryCode, service: userData.service, otpCode: otpCode || null, earned, messageId, delivered: true, timestamp: new Date().toISOString() });
    saveOTPLog();
  } catch (error) { console.error('OTP monitoring error:', error); }
});

/******************** TEXT INPUT HANDLER ********************/
bot.on("text", async (ctx, next) => {
  try {
    if (!ctx.message || !ctx.message.text) return;
    const text = ctx.message.text.trim();
    const userId = ctx.from.id.toString();
    const KEYBOARD_BUTTONS = ["☎️ Get Number", "📞 Get Numbers", "📧 Get Tempmail", "📧 Temp Mail", "🔐 2FA", "🔐 2FA Codes", "💰 Balances", "💸 Withdraw", "💬 Support", "🏠 Home", "🏠 Main Menu", "ℹ️ Help"];
    if (KEYBOARD_BUTTONS.includes(text)) { ctx.session.withdrawState = null; ctx.session.withdrawData = null; ctx.session.totpState = null; ctx.session.totpData = null; ctx.session.adminState = null; ctx.session.adminData = null; return next(); }
    if (text.startsWith('/')) return;
    if (ctx.session.totpState === "waiting_secret") {
      const secret = text.replace(/\s/g, "").toUpperCase();
      const result = generateTOTP(secret);
      if (!result) return await ctx.reply("❌ *Invalid Secret Key!*\n\nUse Base32 format.\nExample: `JBSWY3DPEHPK3PXP`\n\nType /cancel to cancel", { parse_mode: "Markdown" });
      const { service } = ctx.session.totpData || {};
      const icon = service === "facebook" ? "📘" : service === "instagram" ? "📸" : service === "google" ? "🔍" : "⚙️";
      const name = service === "facebook" ? "Facebook" : service === "instagram" ? "Instagram" : service === "google" ? "Google" : "2FA";
      ctx.session.totpState = null;
      ctx.session.totpData = { service, secret };
      return await ctx.reply(`${icon} *${name} 2FA Code*\n\n🔑 *Code:* \`${result.token}\`\n\n⏰ *${result.timeRemaining} seconds remaining*\n\n📋 Copy the code and enter it on the site.`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Refresh Code", callback_data: `totp_refresh:${service}:${encodeURIComponent(secret)}` }], [{ text: "🔙 Back", callback_data: "totp_back" }]] } });
    }
    if (ctx.session.withdrawState === "waiting_amount") {
      const amount = parseFloat(text);
      const userEarnings = getUserEarnings(userId);
      const { method } = ctx.session.withdrawData || {};
      if (!method) { ctx.session.withdrawState = null; return await ctx.reply("❌ Please start over.", { parse_mode: "Markdown" }); }
      if (isNaN(amount) || amount <= 0) return await ctx.reply("❌ Enter a valid amount.\nExample: `75`", { parse_mode: "Markdown" });
      if (amount < settings.minWithdraw) return await ctx.reply(`❌ Minimum *${settings.minWithdraw} taka* is required.`, { parse_mode: "Markdown" });
      if (amount > userEarnings.balance) return await ctx.reply(`❌ Insufficient balance! Your balance: *${userEarnings.balance.toFixed(2)} taka*`, { parse_mode: "Markdown" });
      const icon = method === "bKash" ? "🟣" : "🟠";
      ctx.session.withdrawData = { method, amount };
      ctx.session.withdrawState = "waiting_account";
      return await ctx.reply(`${icon} *${method} - ${amount.toFixed(2)} taka*\n\n📱 Your *${method} number:*\nExample: \`01712345678\`\n\nType /cancel to cancel`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "withdraw_cancel" }]] } });
    }
    if (ctx.session.withdrawState === "waiting_account") {
      const account = text;
      if (!/^01[3-9]\d{8}$/.test(account)) return await ctx.reply("❌ *Invalid number!*\n\nEnter a valid Bangladeshi number: `01XXXXXXXXX`\n\nType /cancel to cancel", { parse_mode: "Markdown" });
      const userEarnings = getUserEarnings(userId);
      const { method, amount } = ctx.session.withdrawData;
      if (userEarnings.balance < amount) { ctx.session.withdrawState = null; ctx.session.withdrawData = null; return await ctx.reply("❌ *Balance has changed.* Please try again.", { parse_mode: "Markdown" }); }
      ctx.session.withdrawData = { method, account, amount };
      ctx.session.withdrawState = "confirm";
      const icon = method === "bKash" ? "🟣" : "🟠";
      return await ctx.reply(`✅ *Confirm Withdrawal*\n\n${icon} *Method:* ${method}\n📱 *Account:* ${account}\n💵 *Amount:* ${amount.toFixed(2)} taka\n\nIs all information correct?`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "✅ Yes, Withdraw", callback_data: "withdraw_confirm" }, { text: "❌ Cancel", callback_data: "withdraw_cancel" }]] } });
    }
    if (!ctx.session.isAdmin || !ctx.session.adminState) return;
    const adminState = ctx.session.adminState;
    // ... (rest of admin text handlers remain same)
  } catch (err) { console.error("Text handler error:", err); }
});

/******************** ADMIN FILE UPLOAD HANDLER ********************/
bot.on("document", async (ctx) => {
  try {
    if (!ctx.session.isAdmin) return;
    if (ctx.session.adminState !== "waiting_upload_file") return;
    const doc = ctx.message.document;
    if (!doc || !doc.file_name || !doc.file_name.endsWith(".txt")) return await ctx.reply("❌ *Only .txt files are supported.*\n\nPlease send a plain text file.", { parse_mode: "Markdown" });
    const { serviceId } = ctx.session.adminData || {};
    if (!serviceId) return await ctx.reply("❌ Session expired. Please start again via /admin → Upload File.", { parse_mode: "Markdown" });
    await ctx.reply("⏳ *Processing file...*", { parse_mode: "Markdown" });
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const fileUrl = fileLink.href || fileLink.toString();
    const fileContent = await new Promise((resolve, reject) => { https.get(fileUrl, (res) => { let data = ""; res.on("data", chunk => data += chunk); res.on("end", () => resolve(data)); res.on("error", reject); }).on("error", reject); });
    const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let added = 0, failed = 0;
    for (const line of lines) {
      let number, countryCode, service;
      if (line.includes("|")) { const parts = line.split("|"); number = parts[0].replace(/\D/g, ""); countryCode = parts[1] ? parts[1].trim() : null; service = parts[2] ? parts[2].trim() : serviceId; } else { number = line.replace(/\D/g, ""); countryCode = getCountryCodeFromNumber(number); service = serviceId; }
      if (!number || !/^\d{10,15}$/.test(number)) { failed++; continue; }
      if (!countryCode) { failed++; continue; }
      if (!service) service = serviceId;
      if (!numbersByCountryService[countryCode]) numbersByCountryService[countryCode] = {};
      if (!numbersByCountryService[countryCode][service]) numbersByCountryService[countryCode][service] = [];
      if (!numbersByCountryService[countryCode][service].includes(number)) { numbersByCountryService[countryCode][service].push(number); added++; } else { failed++; }
    }
    saveNumbers();
    ctx.session.adminState = null;
    ctx.session.adminData = null;
    await ctx.reply(`✅ *File Upload Complete!*\n\n📄 File: ${doc.file_name}\n✅ Added: ${added}\n❌ Skipped/Duplicate: ${failed}\n📊 Total lines: ${lines.length}`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Admin Panel", callback_data: "admin_back" }]] } });
  } catch (error) { console.error("Document upload error:", error); await ctx.reply("❌ Upload failed. Please try again.\n\nError: " + error.message); ctx.session.adminState = null; }
});

/******************** START BOT ********************/
async function startBot() {
  try {
    console.log("=====================================");
    console.log("🚀 Starting Number Bot...");
    console.log("✅ Verification system: FIXED");
    console.log("✅ Backup system: UPDATED");
    console.log("✅ Auto-restore: ENABLED");
    console.log("=====================================");
    await bot.launch({ allowedUpdates: ["message", "callback_query", "chat_member", "my_chat_member", "document"] });
    console.log("✅ Bot started successfully!");
    await autoRestoreOnStart();
    setInterval(async () => { console.log("📦 Creating auto backup..."); await createTelegramBackup(true); }, 24 * 60 * 60 * 1000);
    setInterval(async () => {
      if (!settings.requireVerification) return;
      const allUserIds = Object.keys(users);
      for (const userId of allUserIds) {
        try {
          const m1 = await bot.telegram.getChatMember(MAIN_CHANNEL_ID, userId);
          const m2 = await bot.telegram.getChatMember(CHAT_GROUP_ID, userId);
          const m3 = await bot.telegram.getChatMember(OTP_GROUP_ID, userId);
          const allJoined = ['member', 'administrator', 'creator'].includes(m1.status) && ['member', 'administrator', 'creator'].includes(m2.status) && ['member', 'administrator', 'creator'].includes(m3.status);
          users[userId].verified = allJoined;
          if (!allJoined) console.log(`🚫 User ${userId} blocked`);
          await new Promise(r => setTimeout(r, 100));
        } catch(e) {}
      }
      saveUsers();
    }, 2 * 60 * 60 * 1000);
  } catch (error) { console.error("❌ Failed to start bot:", error); setTimeout(startBot, 10000); }
}

startBot();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));