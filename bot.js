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
const BACKUP_GROUP_ID = -1003732536424;
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
    } catch (error) {
      console.log("Main channel check error:", error.message);
    }

    try {
      const chatMember = await ctx.telegram.getChatMember(CHAT_GROUP_ID, userId);
      isChatGroupMember = ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (error) {
      console.log("Chat group check error:", error.message);
    }

    try {
      const chatMember = await ctx.telegram.getChatMember(OTP_GROUP_ID, userId);
      isOTPGroupMember = ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (error) {
      console.log("OTP group check error:", error.message);
    }

    const allJoined = isMainChannelMember && isChatGroupMember && isOTPGroupMember;

    console.log(`📊 Membership [${userId}]: main=${isMainChannelMember} chat=${isChatGroupMember} otp=${isOTPGroupMember} all=${allJoined}`);

    return {
      mainChannel: isMainChannelMember,
      chatGroup: isChatGroupMember,
      otpGroup: isOTPGroupMember,
      allJoined: allJoined
    };

  } catch (error) {
    console.error("Membership check fatal error:", error);
    return {
      mainChannel: false,
      chatGroup: false,
      otpGroup: false,
      allJoined: false
    };
  }
}

/******************** SESSION MIDDLEWARE ********************/
bot.use(session({
  defaultSession: () => ({
    verified: false,
    isAdmin: false,
    adminState: null,
    adminData: null,
    currentNumbers: [],
    currentService: null,
    currentCountry: null,
    lastNumberTime: 0,
    lastMessageId: null,
    lastChatId: null,
    lastVerificationCheck: 0,
    totpState: null,
    totpData: null,
    mailState: null,
    withdrawState: null,
    withdrawData: null,
    pendingRestore: null
  })
}));

bot.use((ctx, next) => {
  if (ctx.from) {
    const userId = ctx.from.id.toString();
    if (!users[userId]) {
      users[userId] = {
        id: userId,
        username: ctx.from.username || 'no_username',
        first_name: ctx.from.first_name || 'User',
        last_name: ctx.from.last_name || '',
        joined: new Date().toISOString(),
        last_active: new Date().toISOString(),
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
      verified: false,
      isAdmin: false,
      adminState: null,
      adminData: null,
      currentNumbers: [],
      currentService: null,
      currentCountry: null,
      lastNumberTime: 0,
      lastMessageId: null,
      lastChatId: null,
      lastVerificationCheck: 0,
      totpState: null,
      totpData: null,
      mailState: null,
      withdrawState: null,
      withdrawData: null,
      pendingRestore: null
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
  if (ctx.message?.text?.startsWith('/start') || 
      ctx.message?.text?.startsWith('/adminlogin') ||
      ctx.message?.text?.startsWith('/cancel')) {
    return next();
  }
  if (ctx.callbackQuery?.data === 'verify_user') return next();
  if (!ctx.from) return next();
  if (!settings.requireVerification) return next();

  const userId = ctx.from.id.toString();
  const now = Date.now();
  const RECHECK_INTERVAL = 2 * 60 * 60 * 1000;
  const lastCheck = ctx.session?.lastVerificationCheck || 0;
  const checkAge = now - lastCheck;

  if (ctx.session?.verified && checkAge < RECHECK_INTERVAL) {
    return next();
  }

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
  
  console.log(`🚫 Blocked user ${userId}`);

  let notJoinedList = "";
  if (!membership.mainChannel) notJoinedList += "❌ 1️⃣ Main Channel\n";
  if (!membership.chatGroup) notJoinedList += "❌ 2️⃣ Number Channel\n";
  if (!membership.otpGroup) notJoinedList += "❌ 3️⃣ OTP Group\n";

  const verificationMessage = 
    "⛔ *ACCESS BLOCKED*\n\n" +
    "You have not joined all required groups:\n\n" +
    notJoinedList + "\n" +
    "🔐 *Please join ALL three groups and press VERIFY*\n\n" +
    "👇 Click the buttons below to join:";

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
  } catch (error) {
    console.log("Could not reply to user:", error.message);
  }
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
    await ctx.reply(
      "🏠 *Main Menu*\n\nChoose an option:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            ["☎️ Get Number", "📧 Get Tempmail"],
            ["🔐 2FA", "💰 Balances"],
            ["💸 Withdraw", "💬 Support"]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      }
    );
  } catch (error) {
    console.error("Error showing main menu:", error);
  }
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

    await ctx.reply(
      "🤖 *Welcome to Number Bot*\n\n" +
      "🔐 *VERIFICATION REQUIRED - 3 GROUPS*\n" +
      "To use this bot, you MUST join ALL three groups first:\n\n" +
      "👇 Click the buttons below to join:",
      {
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
      }
    );
  } catch (error) {
    console.error("Start command error:", error);
  }
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
      if (users[uid]) {
        users[uid].verified = true;
        saveUsers();
      }

      await ctx.editMessageText(
        "✅ *VERIFICATION SUCCESSFUL!*\n\n" +
        "🎉 You have joined all 3 required groups.\n\n" +
        "You can now use all bot features.\n\n" +
        "👇 Press the button below to continue:",
        { 
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 Go to Main Menu", callback_data: "goto_main_menu" }]
            ]
          }
        }
      );

    } else {
      let notJoinedMsg = "❌ *VERIFICATION FAILED*\n\n";
      notJoinedMsg += "You haven't joined the following groups:\n\n";
      
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

  } catch (error) {
    console.error("Verification error:", error);
    await ctx.answerCbQuery("❌ Verification failed", { show_alert: true });
  }
});

/******************** TELEGRAM BACKUP SYSTEM - FULLY FIXED ********************/
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
    
    await bot.telegram.sendDocument(BACKUP_GROUP_ID, { source: buffer, filename: `${backupId}.json` }, { caption: message, parse_mode: 'Markdown' });
    
    const localBackupPath = path.join(DATA_DIR, `${backupId}.json`);
    fs.writeFileSync(localBackupPath, jsonString);
    
    const backupInfo = { backupId: backupId, timestamp: backupData.timestamp, stats: backupData.stats, localPath: localBackupPath };
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
    const lastBackupFile = path.join(DATA_DIR, "last_backup.json");
    if (fs.existsSync(lastBackupFile)) {
      try {
        const info = JSON.parse(fs.readFileSync(lastBackupFile, 'utf8'));
        const localFile = path.join(DATA_DIR, `${info.backupId}.json`);
        if (fs.existsSync(localFile)) {
          console.log(`📦 Found local backup: ${info.backupId}`);
          return { fileId: null, fileName: `${info.backupId}.json`, timestamp: info.timestamp, localPath: localFile, stats: info.stats };
        }
      } catch(e) {}
    }
    
    console.log('🔍 Searching Telegram for backups...');
    let latestBackup = null;
    let latestTimestamp = null;
    
    try {
      const messages = await bot.telegram.getChatHistory(BACKUP_GROUP_ID, 100);
      
      for (const msg of messages) {
        if (msg.document && msg.document.file_name && msg.document.file_name.endsWith('.json')) {
          const match = msg.document.file_name.match(/BACKUP_([\d\-T]+)\.json/);
          if (match) {
            const timestamp = match[1];
            if (!latestTimestamp || timestamp > latestTimestamp) {
              latestTimestamp = timestamp;
              latestBackup = {
                messageId: msg.message_id,
                fileId: msg.document.file_id,
                fileName: msg.document.file_name,
                timestamp: timestamp,
                fileSize: msg.document.file_size
              };
              console.log(`📦 Found backup: ${latestBackup.fileName}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error.message);
    }
    
    if (latestBackup) {
      try {
        const fileLink = await bot.telegram.getFileLink(latestBackup.fileId);
        const response = await fetch(fileLink.href);
        const jsonText = await response.text();
        const backupData = JSON.parse(jsonText);
        
        const localBackupPath = path.join(DATA_DIR, latestBackup.fileName);
        fs.writeFileSync(localBackupPath, jsonText);
        
        const backupInfo = {
          backupId: latestBackup.fileName.replace('.json', ''),
          timestamp: latestBackup.timestamp,
          stats: backupData.stats,
          localPath: localBackupPath
        };
        fs.writeFileSync(path.join(DATA_DIR, "last_backup.json"), JSON.stringify(backupInfo, null, 2));
        
        latestBackup.localPath = localBackupPath;
        latestBackup.stats = backupData.stats;
        
      } catch(e) {
        console.error('Failed to download backup:', e.message);
      }
    }
    
    return latestBackup;
  } catch (error) {
    console.error('Find latest backup error:', error);
    return null;
  }
}

async function restoreFromTelegramBackup(backupFileId, localPath = null) {
  try {
    let backupData = null;
    
    if (localPath && fs.existsSync(localPath)) {
      console.log('🔄 Restoring from local backup...');
      const jsonText = fs.readFileSync(localPath, 'utf8');
      backupData = JSON.parse(jsonText);
    } else if (backupFileId) {
      console.log('🔄 Downloading from Telegram...');
      const fileLink = await bot.telegram.getFileLink(backupFileId);
      const response = await fetch(fileLink.href);
      const jsonText = await response.text();
      backupData = JSON.parse(jsonText);
      
      const localBackupPath = path.join(DATA_DIR, `${backupData.backupId}.json`);
      fs.writeFileSync(localBackupPath, jsonText);
    } else {
      console.log('❌ No backup source provided');
      return null;
    }
    
    if (!backupData) {
      console.log('❌ Failed to parse backup data');
      return null;
    }
    
    console.log(`📦 Restoring backup: ${backupData.backupId}`);
    console.log(`👥 Users: ${backupData.stats.totalUsers}`);
    console.log(`💰 Earnings: ${backupData.stats.totalEarnings} TK`);
    
    const safetyBackup = path.join(DATA_DIR, `safety_${Date.now()}.json`);
    const currentData = {
      users, earnings, withdrawals, otpLog, admins, settings,
      services, countries, activeNumbers, totpSecrets, tempMails,
      countryPrices, numbersByCountryService
    };
    fs.writeFileSync(safetyBackup, JSON.stringify(currentData, null, 2));
    console.log(`✅ Safety backup saved: ${safetyBackup}`);
    
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
    
    const backupInfo = {
      backupId: backupData.backupId,
      timestamp: backupData.timestamp,
      stats: backupData.stats,
      localPath: path.join(DATA_DIR, `${backupData.backupId}.json`)
    };
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
      console.log('⚠️ Current data empty! Restoring from backup...');
      const restored = await restoreFromTelegramBackup(latestBackup.fileId, latestBackup.localPath);
      if (restored) {
        console.log(`✅ Auto-restore successful! Restored ${restored.stats.totalUsers} users`);
      }
    } else {
      console.log(`✅ Current data has ${Object.keys(users).length} users. No restore needed.`);
    }
  } else {
    console.log('📭 No backup found in group');
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
  if (!latestBackup) return await ctx.reply("❌ *No backup found*", { parse_mode: "Markdown" });
  const backupDate = new Date(latestBackup.timestamp.replace(/-/g, ':')).toLocaleString('en-GB');
  await ctx.reply(`📦 *Backup Found*\n\n📁 File: ${latestBackup.fileName}\n📅 Date: ${backupDate}\n\n⚠️ *WARNING:* This will overwrite current data!\nType /confirm_restore to proceed.`, { parse_mode: "Markdown" });
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
      keyboard: [
        ["☎️ Get Number", "📧 Get Tempmail"],
        ["🔐 2FA", "💰 Balances"],
        ["💸 Withdraw", "💬 Support"]
      ],
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
  if (availableServices.length === 0) return await ctx.reply("📭 *No Numbers Available*", { parse_mode: "Markdown" });
  const serviceButtons = [];
  for (let i = 0; i < availableServices.length; i += 2) {
    const row = [];
    row.push({ text: `${availableServices[i].service.icon} ${availableServices[i].service.name} (${availableServices[i].totalNums})`, callback_data: `select_service:${availableServices[i].serviceId}` });
    if (availableServices[i + 1]) row.push({ text: `${availableServices[i+1].service.icon} ${availableServices[i+1].service.name} (${availableServices[i+1].totalNums})`, callback_data: `select_service:${availableServices[i+1].serviceId}` });
    serviceButtons.push(row);
  }
  await ctx.reply("🎯 *Select a Service*\n\nWhich service do you need a number for?\n_(number in brackets = available count)_", { parse_mode: "Markdown", reply_markup: { inline_keyboard: serviceButtons } });
});

/******************** SERVICE SELECTION ********************/
bot.action(/^select_service:(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const serviceId = ctx.match[1];
    const availableCountries = getAvailableCountriesForService(serviceId);
    if (availableCountries.length === 0) return await ctx.answerCbQuery("❌ No numbers available", { show_alert: true });
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
    countryButtons.push([{ text: "🔙 Back", callback_data: "back_to_services" }]);
    await ctx.editMessageText(`${service.icon} *${service.name}* — Select Country\n\n📌 Balance will be added automatically when OTP arrives`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: countryButtons } });
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
    if ((now - ctx.session.lastNumberTime) < (settings.cooldownSeconds * 1000) && (ctx.session.currentNumbers || []).length > 0) {
      const remaining = Math.ceil(((settings.cooldownSeconds * 1000) - (now - ctx.session.lastNumberTime)) / 1000);
      return await ctx.reply(`⏳ *${remaining} সেকেন্ড অপেক্ষা করুন।*`, { parse_mode: "Markdown" });
    }
    const numbers = getMultipleNumbersByCountryAndService(countryCode, serviceId, userId, numberCount);
    if (numbers.length === 0) return await ctx.answerCbQuery(`❌ Not enough numbers.`, { show_alert: true });
    if ((ctx.session.currentNumbers || []).length > 0) {
      (ctx.session.currentNumbers || []).forEach(num => { if (activeNumbers[num]) delete activeNumbers[num]; });
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
    const message = `✅ *${numbers.length} Number(s) Assigned!*\n\n${service.icon} *Service:* ${service.name}\n${country.flag} *Country:* ${country.name}\n💵 *Earnings per OTP:* ${otpPrice.toFixed(2)} taka\n\n📞 *Numbers:*\n${numbersText}\n📌 Use this number in the OTP Group.`;
    await ctx.editMessageText(message, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '📨 Open OTP Group', url: OTP_GROUP }], [{ text: '🔄 Get New Numbers', callback_data: `get_new_numbers:${serviceId}:${countryCode}` }], [{ text: '🔙 Service List', callback_data: 'back_to_services' }]] } });
  } catch (error) { console.error("Country selection error:", error); await ctx.answerCbQuery("❌ Error", { show_alert: true }); }
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
    if ((now - ctx.session.lastNumberTime) < (settings.cooldownSeconds * 1000)) {
      const remaining = Math.ceil(((settings.cooldownSeconds * 1000) - (now - ctx.session.lastNumberTime)) / 1000);
      return await ctx.reply(`⏳ *${remaining} সেকেন্ড অপেক্ষা করুন।*`, { parse_mode: "Markdown" });
    }
    const numbers = getMultipleNumbersByCountryAndService(countryCode, serviceId, userId, numberCount);
    if (numbers.length === 0) return await ctx.answerCbQuery(`❌ Not enough numbers.`, { show_alert: true });
    if ((ctx.session.currentNumbers || []).length > 0) {
      (ctx.session.currentNumbers || []).forEach(num => { if (activeNumbers[num]) delete activeNumbers[num]; });
      saveActiveNumbers();
    }
    ctx.session.currentNumbers = numbers;
    ctx.session.lastNumberTime = now;
    const country = countries[countryCode];
    const service = services[serviceId];
    const otpPrice = getOtpPriceForCountry(countryCode);
    let numbersText = '';
    numbers.forEach((num, i) => { numbersText += `${i + 1}. \`+${num}\`\n`; });
    const message = `🔄 *${numbers.length} New Number(s)!*\n\n${service.icon} *Service:* ${service.name}\n${country.flag} *Country:* ${country.name}\n💵 *Earnings per OTP:* ${otpPrice.toFixed(2)} taka\n\n📞 *Numbers:*\n${numbersText}\n📌 Use this number in the OTP Group.`;
    await ctx.editMessageText(message, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '📨 Open OTP Group', url: OTP_GROUP }], [{ text: '🔄 Get New Numbers', callback_data: `get_new_numbers:${serviceId}:${countryCode}` }], [{ text: '🔙 Service List', callback_data: 'back_to_services' }]] } });
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
        for (const cc of availableCountries) totalNums += (numbersByCountryService[cc]?.[serviceId]?.length || 0);
        availableServices.push({ serviceId, service, totalNums });
      }
    }
    const serviceButtons = [];
    for (let i = 0; i < availableServices.length; i += 2) {
      const row = [];
      row.push({ text: `${availableServices[i].service.icon} ${availableServices[i].service.name} (${availableServices[i].totalNums})`, callback_data: `select_service:${availableServices[i].serviceId}` });
      if (availableServices[i + 1]) row.push({ text: `${availableServices[i+1].service.icon} ${availableServices[i+1].service.name} (${availableServices[i+1].totalNums})`, callback_data: `select_service:${availableServices[i+1].serviceId}` });
      serviceButtons.push(row);
    }
    await ctx.editMessageText("🎯 *Select a Service*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: serviceButtons } });
  } catch (error) { console.error("Back to services error:", error); await ctx.answerCbQuery("❌ Error", { show_alert: true }); }
});

/******************** BALANCE ********************/
bot.hears("💰 Balances", async (ctx) => {
  clearUserState(ctx);
  const userId = ctx.from.id.toString();
  const e = getUserEarnings(userId);
  const pendingWithdrawals = withdrawals.filter(w => w.userId === userId && w.status === "pending");
  const totalWithdrawn = withdrawals.filter(w => w.userId === userId && w.status === "approved").reduce((sum, w) => sum + w.amount, 0);
  await ctx.reply(`💰 *Your Earnings*\n\n💵 *Current Balance:* ${e.balance.toFixed(2)} taka\n📈 *Total Earned:* ${e.totalEarned.toFixed(2)} taka\n📨 *Total OTPs:* ${e.otpCount || 0}\n💸 *Total Withdrawn:* ${totalWithdrawn.toFixed(2)} taka\n⏳ *Pending Withdrawals:* ${pendingWithdrawals.length}\n\n📌 *Minimum Withdraw:* ${settings.minWithdraw} taka`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "💸 Withdraw", callback_data: "start_withdraw" }], [{ text: "📋 Withdraw History", callback_data: "withdraw_history" }]] } });
});

/******************** WITHDRAW ********************/
bot.hears("💸 Withdraw", async (ctx) => {
  ctx.session.withdrawState = null;
  ctx.session.withdrawData = null;
  const userId = ctx.from.id.toString();
  const e = getUserEarnings(userId);
  if (!settings.withdrawEnabled) return await ctx.reply("⏸️ *Withdrawals are currently disabled.*", { parse_mode: "Markdown" });
  if (e.balance < settings.minWithdraw) return await ctx.reply(`❌ *Insufficient balance.*\n\n💵 Balance: ${e.balance.toFixed(2)} taka\n📌 Minimum: ${settings.minWithdraw} taka`, { parse_mode: "Markdown" });
  await ctx.reply(`💸 *Withdraw*\n\n💵 Your balance: *${e.balance.toFixed(2)} taka*\n📌 Minimum: *${settings.minWithdraw} taka*\n\nChoose your withdrawal method:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🟣 bKash", callback_data: "withdraw_method:bKash" }, { text: "🟠 Nagad", callback_data: "withdraw_method:Nagad" }], [{ text: "❌ Cancel", callback_data: "withdraw_cancel" }]] } });
});

bot.action("start_withdraw", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.withdrawState = null;
  ctx.session.withdrawData = null;
  const userId = ctx.from.id.toString();
  const e = getUserEarnings(userId);
  if (!settings.withdrawEnabled) return await ctx.editMessageText("⏸️ *Withdrawals are currently disabled.*", { parse_mode: "Markdown" });
  if (e.balance < settings.minWithdraw) return await ctx.editMessageText(`❌ *Insufficient balance.*\n\n💵 Balance: ${e.balance.toFixed(2)} taka\n📌 Minimum: ${settings.minWithdraw} taka`, { parse_mode: "Markdown" });
  await ctx.editMessageText(`💸 *Withdraw*\n\n💵 Your balance: *${e.balance.toFixed(2)} taka*\n📌 Minimum: *${settings.minWithdraw} taka*\n\nChoose your withdrawal method:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🟣 bKash", callback_data: "withdraw_method:bKash" }, { text: "🟠 Nagad", callback_data: "withdraw_method:Nagad" }], [{ text: "❌ Cancel", callback_data: "withdraw_cancel" }]] } });
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
  await ctx.editMessageText(`${icon} *${method} Withdrawal*\n\n💰 Your balance: *${e.balance.toFixed(2)} taka*\n📌 Minimum: *${settings.minWithdraw} taka*\n\nSelect an amount or type in chat:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: amountButtons } });
});

bot.action(/^withdraw_amount:([^:]+):(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const method = ctx.match[1];
  const amount = parseFloat(ctx.match[2]);
  const userId = ctx.from.id.toString();
  const e = getUserEarnings(userId);
  const icon = method === "bKash" ? "🟣" : "🟠";
  if (isNaN(amount) || amount <= 0) return await ctx.editMessageText("❌ Invalid amount.", { parse_mode: "Markdown" });
  if (amount < settings.minWithdraw) return await ctx.editMessageText(`❌ Minimum *${settings.minWithdraw} taka* required.`, { parse_mode: "Markdown" });
  if (amount > e.balance) return await ctx.editMessageText(`❌ Insufficient balance! Your balance: *${e.balance.toFixed(2)} taka*`, { parse_mode: "Markdown" });
  ctx.session.withdrawState = "waiting_account";
  ctx.session.withdrawData = { method, amount };
  await ctx.editMessageText(`${icon} *${method} - ${amount.toFixed(2)} taka*\n\n📱 Your *${method} number:*\nExample: \`01712345678\`\n\nType /cancel to cancel`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "withdraw_cancel" }]] } });
});

bot.action("withdraw_history", async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id.toString();
  const userWithdrawals = withdrawals.filter(w => w.userId === userId).slice(-10).reverse();
  let text = "📋 *Withdraw History*\n\n";
  if (userWithdrawals.length === 0) text += "No withdrawal requests yet.";
  else userWithdrawals.forEach(w => { const icon = w.status === "approved" ? "✅" : w.status === "rejected" ? "❌" : "⏳"; const date = new Date(w.requestedAt).toLocaleDateString('en-GB'); text += `${icon} *${w.amount.toFixed(2)} taka* - ${w.method}\n📱 \`${w.account}\` | ${date}\n\n`; });
  await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "goto_main_menu" }]] } });
});

bot.action("withdraw_cancel", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.withdrawState = null;
  ctx.session.withdrawData = null;
  await ctx.editMessageText("❌ *Withdrawal cancelled.*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "goto_main_menu" }]] } });
});

bot.action("withdraw_confirm", async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    if (ctx.session.withdrawState !== "confirm") return;
    const { method, account, amount } = ctx.session.withdrawData;
    const userEarnings = getUserEarnings(userId);
    if (userEarnings.balance < amount) { ctx.session.withdrawState = null; ctx.session.withdrawData = null; return await ctx.editMessageText("❌ Balance changed.", { parse_mode: "Markdown" }); }
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
  } catch (error) { console.error("Withdraw confirm error:", error); }
});

/******************** ADMIN WITHDRAW APPROVE/REJECT ********************/
bot.action(/^wadmin_approve:(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin && !isAdmin(ctx.from.id.toString())) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery("✅ Approving...");
  const withdrawId = ctx.match[1];
  const w = withdrawals.find(w => w.id === withdrawId);
  if (!w) return await ctx.editMessageText("❌ Request not found.");
  if (w.status !== "pending") return await ctx.editMessageText(`⚠️ Already ${w.status}.`);
  w.status = "approved";
  w.processedAt = new Date().toISOString();
  saveWithdrawals();
  await ctx.editMessageText(`✅ *Withdraw Approved!*\n\n👤 ${w.userName}\n💵 ${w.amount.toFixed(2)} taka → ${w.method}\n📱 ${w.account}`, { parse_mode: "Markdown" });
  try { await ctx.telegram.sendMessage(w.userId, `✅ *Your Withdrawal has been Approved!*\n\n💵 Amount: ${w.amount.toFixed(2)} taka\n💳 Method: ${w.method}\n📱 Account: ${w.account}`, { parse_mode: "Markdown" }); } catch (e) {}
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
  try { await ctx.telegram.sendMessage(w.userId, `❌ *Your Withdrawal Request was Rejected.*\n\n💵 ${w.amount.toFixed(2)} taka has been refunded.`, { parse_mode: "Markdown" }); } catch (e) {}
});

/******************** 2FA MENU ********************/
bot.hears(["🔐 2FA", "🔐 2FA Codes"], async (ctx) => {
  clearUserState(ctx);
  await ctx.reply("🔐 *2-Step Verification Code Generator*\n\nSelect a service:", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📘 Facebook 2FA", callback_data: "totp_service:facebook" }], [{ text: "📸 Instagram 2FA", callback_data: "totp_service:instagram" }], [{ text: "🔍 Google 2FA", callback_data: "totp_service:google" }], [{ text: "⚙️ Other Service 2FA", callback_data: "totp_service:other" }]] } });
});

/******************** TOTP HANDLERS ********************/
bot.action(/^totp_service:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const service = ctx.match[1];
  const icons = { facebook: "📘", instagram: "📸", google: "🔍", other: "⚙️" };
  const names = { facebook: "Facebook", instagram: "Instagram", google: "Google", other: "Other" };
  ctx.session.totpState = "waiting_secret";
  ctx.session.totpData = { service };
  await ctx.editMessageText(`${icons[service] || "🔐"} *${names[service] || service} Secret Key*\n\nSend your Authenticator Secret Key.\n\n🔑 Example: \`JBSWY3DPEHPK3PXP\`\n\nType /cancel to cancel`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "totp_back" }]] } });
});

bot.action(/^totp_refresh:([^:]+):(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery("🔄 Refreshing...");
    const service = ctx.match[1];
    const secret = decodeURIComponent(ctx.match[2]);
    const result = generateTOTP(secret);
    if (!result) return await ctx.editMessageText("❌ *Invalid secret key.*", { parse_mode: "Markdown" });
    const icon = service === "facebook" ? "📘" : service === "instagram" ? "📸" : service === "google" ? "🔍" : "⚙️";
    const name = service === "facebook" ? "Facebook" : service === "instagram" ? "Instagram" : service === "google" ? "Google" : "2FA";
    await ctx.editMessageText(`${icon} *${name} 2FA Code*\n\n🔑 *Code:* \`${result.token}\`\n⏰ *${result.timeRemaining} seconds remaining*`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Refresh", callback_data: `totp_refresh:${service}:${encodeURIComponent(secret)}` }], [{ text: "🔙 Back", callback_data: "totp_back" }]] } });
  } catch (error) { console.error("TOTP error:", error); }
});

bot.action("totp_back", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("🔐 *2FA Code Generator*\n\nSelect a service:", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📘 Facebook 2FA", callback_data: "totp_service:facebook" }], [{ text: "📸 Instagram 2FA", callback_data: "totp_service:instagram" }], [{ text: "🔍 Google 2FA", callback_data: "totp_service:google" }], [{ text: "⚙️ Other Service 2FA", callback_data: "totp_service:other" }]] } });
});

/******************** TEMP MAIL ********************/
bot.hears(["📧 Temp Mail", "📧 Get Tempmail"], async (ctx) => {
  clearUserState(ctx);
  const userId = ctx.from.id.toString();
  const existing = tempMails[userId];
  if (existing) {
    await ctx.reply(`📧 *Temporary Email*\n\n📌 Your email:\n\`${existing.address}\`\n\n⚠️ Getting a new email will delete this one.`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📬 Check Inbox", callback_data: "tempmail_inbox" }], [{ text: "📋 Show Email", callback_data: "tempmail_showaddress" }], [{ text: "🔄 New Email", callback_data: "tempmail_create" }], [{ text: "🗑️ Delete", callback_data: "tempmail_delete" }]] } });
  } else {
    await ctx.reply("📧 *Temporary Email*\n\n✅ Create a new disposable email address.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🆕 Create New Email", callback_data: "tempmail_create" }]] } });
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
      if (!newEmail) { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `❌ *Email creation failed.*`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Retry", callback_data: "tempmail_create" }]] } }); return; }
      tempMails[userId] = newEmail;
      saveTempMails();
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `✅ *New Temporary Email Created!*\n\n📧 *Email Address:*\n\`${newEmail.address}\``, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📬 Check Inbox", callback_data: "tempmail_inbox" }], [{ text: "📋 Show Email", callback_data: "tempmail_showaddress" }], [{ text: "🔄 New Email", callback_data: "tempmail_create" }], [{ text: "🗑️ Delete", callback_data: "tempmail_delete" }]] } });
    } catch (error) { console.error("Temp mail error:", error.message); try { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `❌ *Error.*`, { parse_mode: "Markdown" }); } catch(e) {} }
  });
});

bot.action("tempmail_inbox", async (ctx) => {
  try {
    await ctx.answerCbQuery("📬 Loading...");
    const userId = ctx.from.id.toString();
    if (!tempMails[userId]) return await ctx.editMessageText("❌ *No email found.*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🆕 Create Email", callback_data: "tempmail_create" }]] } });
    const { address, provider } = tempMails[userId];
    let messages = [];
    try { messages = await getEmailInbox(tempMails[userId]); } catch(e) {}
    let text = `📬 *Inbox:* \`${address}\`\n_(via ${provider})_\n\n`;
    if (messages.length === 0) text += `📭 *No emails yet.*`;
    else messages.slice(0, 5).forEach(msg => { text += `━━━━━━━━━━━━━━━\n📩 *From:* ${msg.from}\n📌 *Subject:* ${msg.subject}\n🕐 ${msg.date}\n`; });
    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Refresh", callback_data: "tempmail_inbox" }], [{ text: "🔙 Back", callback_data: "tempmail_create" }]] } });
  } catch (error) { console.error("Inbox error:", error); }
});

bot.action("tempmail_showaddress", async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id.toString();
  if (!tempMails[userId]) return await ctx.answerCbQuery("❌ No email", { show_alert: true });
  await ctx.editMessageText(`📧 *Your Temp Email:*\n\n\`${tempMails[userId].address}\``, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📬 Check Inbox", callback_data: "tempmail_inbox" }]] } });
});

bot.action("tempmail_delete", async (ctx) => {
  const userId = ctx.from.id.toString();
  await ctx.answerCbQuery();
  if (tempMails[userId]) { delete tempMails[userId]; saveTempMails(); await ctx.editMessageText("✅ *Email deleted.*", { parse_mode: "Markdown" }); }
  else await ctx.editMessageText("❌ *No email found.*", { parse_mode: "Markdown" });
});

/******************** SUPPORT & HELP ********************/
bot.hears("💬 Support", async (ctx) => { await ctx.reply("💬 *Support*\n\nAdmin: @Rana1132", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "Contact", url: "https://t.me/Rana1132" }]] } }); });
bot.hears("ℹ️ Help", async (ctx) => { await ctx.reply("📖 *Bot Help*\n\n• ☎️ Get Number\n• 📧 Get Tempmail\n• 🔐 2FA Codes\n• 💰 Balances\n• 💸 Withdraw\n\nAdmin: /adminlogin", { parse_mode: "Markdown" }); });
bot.hears(["🏠 Home", "🏠 Main Menu"], async (ctx) => { clearUserState(ctx); await showMainMenu(ctx); });

/******************** ADMIN LOGIN ********************/
bot.command("adminlogin", async (ctx) => {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) return await ctx.reply("❌ Usage: /adminlogin [password]");
  if (parts[1] === ADMIN_PASSWORD) {
    ctx.session.isAdmin = true;
    if (!admins.includes(ctx.from.id.toString())) { admins.push(ctx.from.id.toString()); saveAdmins(); }
    await ctx.reply("✅ *Admin Login Successful!*\nUse /admin", { parse_mode: "Markdown" });
  } else await ctx.reply("❌ Wrong password.");
});

/******************** ADMIN PANEL ********************/
bot.command("admin", async (ctx) => {
  if (!ctx.session.isAdmin && !isAdmin(ctx.from.id.toString())) return await ctx.reply("❌ *Admin Access Required*", { parse_mode: "Markdown" });
  const buttons = [
    [{ text: "📊 Stock Report", callback_data: "admin_stock" }, { text: "👥 User Stats", callback_data: "admin_users" }],
    [{ text: "📢 Broadcast", callback_data: "admin_broadcast" }, { text: "📋 OTP Log", callback_data: "admin_otp_log" }],
    [{ text: "➕ Add Numbers", callback_data: "admin_add_numbers" }, { text: "📤 Upload File", callback_data: "admin_upload" }],
    [{ text: "🗑️ Delete Numbers", callback_data: "admin_delete" }, { text: "🔧 Manage Services", callback_data: "admin_manage_services" }],
    [{ text: "🌍 Manage Countries", callback_data: "admin_manage_countries" }, { text: "⚙️ Settings", callback_data: "admin_settings" }],
    [{ text: "💰 Country Prices", callback_data: "admin_country_prices" }, { text: "💸 Withdrawals", callback_data: "admin_withdrawals" }],
    [{ text: "👛 Balance Management", callback_data: "admin_balance_manage" }, { text: "📦 Backup", callback_data: "admin_backup" }],
    [{ text: "🚪 Logout", callback_data: "admin_logout" }]
  ];
  await ctx.reply("🛠 *Admin Dashboard*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } });
});

/******************** ADMIN BACKUP MENU ********************/
bot.action("admin_backup", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  let backupInfo = "";
  try { const latest = await findLatestBackup(); if (latest) backupInfo = `\n📦 *Latest:* ${latest.fileName}`; else backupInfo = `\n⚠️ *No backups*`; } catch(e) {}
  await ctx.editMessageText(`📦 *Backup Management*${backupInfo}`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🆕 Create Backup", callback_data: "admin_create_backup" }], [{ text: "🔄 Emergency Restore", callback_data: "admin_emergency_restore" }], [{ text: "📋 View Backups", callback_data: "admin_view_backups" }], [{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

bot.action("admin_create_backup", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery("⏳ Creating...");
  const result = await createTelegramBackup(false);
  if (result) await ctx.editMessageText(`✅ *Backup Created!*\n🆔 ID: \`${result.backupId}\``, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_backup" }]] } });
  else await ctx.editMessageText("❌ *Backup failed*", { parse_mode: "Markdown" });
});

bot.action("admin_emergency_restore", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  const loadingMsg = await ctx.editMessageText("🔍 *Searching...*", { parse_mode: "Markdown" });
  try {
    const latest = await findLatestBackup();
    if (!latest) { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "❌ *No backup found*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_backup" }]] } }); return; }
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `📦 *Backup Found*\n\n📁 ${latest.fileName}\n\n⚠️ Type /confirm_restore to proceed.`, { parse_mode: "Markdown" });
    ctx.session.pendingRestore = { fileId: latest.fileId, localPath: latest.localPath };
  } catch (error) { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "❌ Error", { parse_mode: "Markdown" }); }
});

bot.action("admin_confirm_restore", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  if (!ctx.session.pendingRestore) return await ctx.editMessageText("❌ No restore pending.", { parse_mode: "Markdown" });
  await ctx.answerCbQuery("⏳ Restoring...");
  const loadingMsg = await ctx.editMessageText("⏳ *Restoring...*", { parse_mode: "Markdown" });
  try {
    const restored = await restoreFromTelegramBackup(ctx.session.pendingRestore.fileId, ctx.session.pendingRestore.localPath);
    if (restored) await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `✅ *RESTORE SUCCESSFUL!*\n\n📦 ${restored.backupId}\n👥 Users: ${restored.stats.totalUsers}`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🛠 Admin", callback_data: "admin_back" }]] } });
    else await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "❌ *Restore failed*", { parse_mode: "Markdown" });
    ctx.session.pendingRestore = null;
  } catch (error) { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "❌ Error", { parse_mode: "Markdown" }); ctx.session.pendingRestore = null; }
});

bot.action("admin_view_backups", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  try {
    const messages = await bot.telegram.getChatHistory(BACKUP_GROUP_ID, 50);
    const backups = [];
    for (const msg of messages) {
      if (msg.document && msg.document.file_name && msg.document.file_name.endsWith('.json')) {
        const match = msg.document.file_name.match(/BACKUP_([\d\-T]+)\.json/);
        if (match) backups.push({ name: msg.document.file_name, date: match[1], size: (msg.document.file_size / 1024).toFixed(2) });
      }
    }
    if (backups.length === 0) return await ctx.editMessageText("📭 *No backups*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_backup" }]] } });
    let text = "📦 *Backups*\n\n";
    backups.slice(0, 10).forEach((b, i) => { const date = new Date(b.date.replace(/-/g, ':')).toLocaleString('en-GB'); text += `${i+1}. ${b.name}\n   📅 ${date} | 💾 ${b.size} KB\n\n`; });
    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_backup" }]] } });
  } catch (error) { await ctx.editMessageText("❌ Error", { parse_mode: "Markdown" }); }
});

bot.action("admin_back", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.adminState = null;
  ctx.session.adminData = null;
  const buttons = [
    [{ text: "📊 Stock Report", callback_data: "admin_stock" }, { text: "👥 User Stats", callback_data: "admin_users" }],
    [{ text: "📢 Broadcast", callback_data: "admin_broadcast" }, { text: "📋 OTP Log", callback_data: "admin_otp_log" }],
    [{ text: "➕ Add Numbers", callback_data: "admin_add_numbers" }, { text: "📤 Upload File", callback_data: "admin_upload" }],
    [{ text: "🗑️ Delete Numbers", callback_data: "admin_delete" }, { text: "🔧 Manage Services", callback_data: "admin_manage_services" }],
    [{ text: "🌍 Manage Countries", callback_data: "admin_manage_countries" }, { text: "⚙️ Settings", callback_data: "admin_settings" }],
    [{ text: "💰 Country Prices", callback_data: "admin_country_prices" }, { text: "💸 Withdrawals", callback_data: "admin_withdrawals" }],
    [{ text: "👛 Balance Management", callback_data: "admin_balance_manage" }, { text: "📦 Backup", callback_data: "admin_backup" }],
    [{ text: "🚪 Logout", callback_data: "admin_logout" }]
  ];
  await ctx.editMessageText("🛠 *Admin Dashboard*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } });
});

bot.action("admin_cancel", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.adminState = null;
  ctx.session.adminData = null;
  await ctx.editMessageText("❌ *Cancelled*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

bot.action("admin_logout", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.isAdmin = false;
  await ctx.editMessageText("🚪 *Logged Out*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Main Menu", callback_data: "back_to_services" }]] } });
});

/******************** ADMIN STOCK REPORT ********************/
bot.action("admin_stock", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  let report = "📊 *Stock Report*\n\n";
  let total = 0;
  for (const cc in numbersByCountryService) {
    const country = countries[cc];
    report += `\n${country?.flag || '🌍'} ${country?.name || cc} (+${cc}):\n`;
    let ct = 0;
    for (const sid in numbersByCountryService[cc]) {
      const count = numbersByCountryService[cc][sid].length;
      if (count > 0) { report += `  ${services[sid]?.icon || '📞'} ${services[sid]?.name || sid}: *${count}*\n`; ct += count; }
    }
    report += `  *Total:* ${ct}\n`;
    total += ct;
  }
  report += `\n📈 *Grand Total:* ${total}\n👥 *Active:* ${Object.keys(activeNumbers).length}\n📨 *OTPs:* ${otpLog.length}`;
  await ctx.editMessageText(report, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Refresh", callback_data: "admin_stock" }], [{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

/******************** ADMIN USER STATS ********************/
bot.action("admin_users", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  let text = `👥 *User Stats*\n\n📊 Total: ${Object.keys(users).length}\n📱 Active: ${Object.keys(activeNumbers).length}\n📨 OTPs: ${otpLog.length}\n\n📋 *Recent Users:*\n`;
  const recent = Object.values(users).sort((a,b) => new Date(b.last_active) - new Date(a.last_active)).slice(0, 10);
  recent.forEach(u => { text += `\n👤 ${u.first_name}\n🆔 \`${u.id}\`\n🕐 ${getTimeAgo(new Date(u.last_active))}\n`; });
  await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Refresh", callback_data: "admin_users" }], [{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

/******************** ADMIN OTP LOG ********************/
bot.action("admin_otp_log", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  let text = "📋 *Recent OTPs*\n\n";
  otpLog.slice(-10).reverse().forEach(log => { text += `📞 \`${log.phoneNumber}\` → \`${log.userId}\`\n🕐 ${getTimeAgo(new Date(log.timestamp))}\n\n`; });
  await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Refresh", callback_data: "admin_otp_log" }], [{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

/******************** ADMIN BROADCAST ********************/
bot.action("admin_broadcast", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  ctx.session.adminState = "waiting_broadcast";
  await ctx.editMessageText("📢 *Broadcast*\n\nSend your message:", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

/******************** ADMIN ADD NUMBERS ********************/
bot.action("admin_add_numbers", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  ctx.session.adminState = "waiting_add_numbers";
  await ctx.editMessageText("➕ *Add Numbers*\n\nFormat: `number|country|service`\nExample: `8801712345678|880|whatsapp`", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

/******************** ADMIN UPLOAD FILE ********************/
bot.action("admin_upload", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  ctx.session.adminState = "waiting_upload";
  const btns = [];
  for (const sid in services) btns.push([{ text: `${services[sid].icon} ${services[sid].name}`, callback_data: `admin_select_service:${sid}` }]);
  btns.push([{ text: "❌ Cancel", callback_data: "admin_cancel" }]);
  await ctx.editMessageText("📤 *Upload Numbers*\n\nSelect service:", { parse_mode: "Markdown", reply_markup: { inline_keyboard: btns } });
});

bot.action(/^admin_select_service:(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  ctx.session.adminState = "waiting_upload_file";
  ctx.session.adminData = { serviceId: ctx.match[1] };
  await ctx.editMessageText(`📤 *Upload for ${services[ctx.match[1]]?.name}*\n\nSend .txt file with numbers (one per line):`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

/******************** ADMIN MANAGE SERVICES ********************/
bot.action("admin_manage_services", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  await ctx.editMessageText("🔧 *Manage Services*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📋 List", callback_data: "admin_list_services" }, { text: "➕ Add", callback_data: "admin_add_service" }], [{ text: "🗑️ Delete", callback_data: "admin_delete_service" }], [{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

bot.action("admin_list_services", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  let text = "📋 *Services*\n\n";
  for (const sid in services) text += `${services[sid].icon} *${services[sid].name}* \`${sid}\`\n`;
  await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_manage_services" }]] } });
});

bot.action("admin_add_service", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  ctx.session.adminState = "waiting_add_service";
  await ctx.editMessageText("➕ *Add Service*\n\nFormat: `id name icon`\nExample: `gmail Gmail 📧`", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

bot.action("admin_delete_service", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  const btns = [];
  for (const sid in services) btns.push([{ text: `${services[sid].icon} ${services[sid].name}`, callback_data: `admin_delete_service_confirm:${sid}` }]);
  btns.push([{ text: "❌ Cancel", callback_data: "admin_back" }]);
  await ctx.editMessageText("🗑️ *Delete Service*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: btns } });
});

bot.action(/^admin_delete_service_confirm:(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  const sid = ctx.match[1];
  await ctx.editMessageText(`⚠️ *Delete ${services[sid]?.name}?*\n\nThis will delete all numbers for this service!`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "✅ Yes", callback_data: `admin_delete_service_execute:${sid}` }, { text: "❌ No", callback_data: "admin_manage_services" }]] } });
});

bot.action(/^admin_delete_service_execute:(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  const sid = ctx.match[1];
  for (const cc in numbersByCountryService) if (numbersByCountryService[cc][sid]) delete numbersByCountryService[cc][sid];
  delete services[sid];
  saveNumbers(); saveServices();
  await ctx.editMessageText(`✅ *Service Deleted*`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_manage_services" }]] } });
});

/******************** ADMIN MANAGE COUNTRIES ********************/
bot.action("admin_manage_countries", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  await ctx.editMessageText("🌍 *Manage Countries*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "➕ Add", callback_data: "admin_add_country" }, { text: "📋 List", callback_data: "admin_list_countries" }], [{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

bot.action("admin_list_countries", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  let text = "🌍 *Countries*\n\n";
  for (const cc in countries) text += `${countries[cc].flag} *${countries[cc].name}* (+${cc})\n`;
  await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_manage_countries" }]] } });
});

bot.action("admin_add_country", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  ctx.session.adminState = "waiting_add_country";
  await ctx.editMessageText("➕ *Add Country*\n\nFormat: `code name flag`\nExample: `880 Bangladesh 🇧🇩`", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

/******************** ADMIN SETTINGS ********************/
bot.action("admin_settings", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  await ctx.editMessageText(`⚙️ *Settings*\n\n📞 Numbers: ${settings.defaultNumberCount}\n⏱ Cooldown: ${settings.cooldownSeconds}s\n🔐 Verification: ${settings.requireVerification ? "ON" : "OFF"}\n💵 Price: ${(settings.defaultOtpPrice || 0.25).toFixed(2)} TK\n💸 Min Withdraw: ${settings.minWithdraw} TK\n🏧 Withdraw: ${settings.withdrawEnabled ? "ON" : "OFF"}`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📞 Count", callback_data: "admin_set_count" }, { text: "⏱ Cooldown", callback_data: "admin_set_cooldown" }], [{ text: `🔐 ${settings.requireVerification ? "Disable" : "Enable"}`, callback_data: "admin_toggle_verification" }], [{ text: "💵 Price", callback_data: "admin_set_default_price" }, { text: "💸 Min Withdraw", callback_data: "admin_set_min_withdraw" }], [{ text: `🏧 ${settings.withdrawEnabled ? "Disable" : "Enable"}`, callback_data: "admin_toggle_withdraw" }], [{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

bot.action("admin_set_count", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_set_count";
  await ctx.editMessageText(`📞 *Set Number Count*\n\nCurrent: ${settings.defaultNumberCount}\nSend new count (1-100):`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

bot.action("admin_set_cooldown", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_set_cooldown";
  await ctx.editMessageText(`⏱ *Set Cooldown*\n\nCurrent: ${settings.cooldownSeconds}s\nSend new cooldown (1-3600):`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

bot.action("admin_toggle_verification", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  settings.requireVerification = !settings.requireVerification;
  saveSettings();
  await ctx.answerCbQuery(`✅ Verification ${settings.requireVerification ? "Enabled" : "Disabled"}`);
  await ctx.editMessageText(`⚙️ *Settings*\n\n🔐 Verification: ${settings.requireVerification ? "ON" : "OFF"}`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_settings" }]] } });
});

bot.action("admin_set_default_price", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_set_default_price";
  await ctx.editMessageText(`💵 *Set Default Price*\n\nCurrent: ${(settings.defaultOtpPrice || 0.25).toFixed(2)} TK\nSend new price:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

bot.action("admin_set_min_withdraw", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_set_min_withdraw";
  await ctx.editMessageText(`💸 *Set Min Withdraw*\n\nCurrent: ${settings.minWithdraw} TK\nSend new amount:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

bot.action("admin_toggle_withdraw", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  settings.withdrawEnabled = !settings.withdrawEnabled;
  saveSettings();
  await ctx.answerCbQuery(`✅ Withdraw ${settings.withdrawEnabled ? "Enabled" : "Disabled"}`);
  await ctx.editMessageText(`⚙️ *Settings*\n\n🏧 Withdraw: ${settings.withdrawEnabled ? "ON" : "OFF"}`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_settings" }]] } });
});

/******************** ADMIN COUNTRY PRICES ********************/
bot.action("admin_country_prices", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  let text = "💰 *Country Prices*\n\n📌 Default: ${(settings.defaultOtpPrice || 0.25).toFixed(2)} TK\n\n";
  for (const cc in countries) { const price = countryPrices[cc] !== undefined ? countryPrices[cc] : (settings.defaultOtpPrice || 0.25); text += `${countries[cc].flag} ${countries[cc].name}: *${price.toFixed(2)} TK*\n`; }
  await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "✏️ Set", callback_data: "admin_set_country_price" }, { text: "🔄 Reset", callback_data: "admin_reset_prices" }], [{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

bot.action("admin_set_country_price", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_set_country_price";
  await ctx.editMessageText("✏️ *Set Country Price*\n\nFormat: `code price`\nExample: `880 0.50`", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

bot.action("admin_reset_prices", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  countryPrices = {};
  saveCountryPrices();
  await ctx.answerCbQuery("✅ Reset");
  await ctx.editMessageText("✅ *All prices reset*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_country_prices" }]] } });
});

/******************** ADMIN BALANCE MANAGEMENT ********************/
bot.action("admin_balance_manage", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  const totalBalance = Object.values(earnings).reduce((s, e) => s + e.balance, 0);
  const totalEarned = Object.values(earnings).reduce((s, e) => s + e.totalEarned, 0);
  let text = `💰 *Balance Management*\n\n💵 Total Balance: ${totalBalance.toFixed(2)} TK\n📈 Total Earned: ${totalEarned.toFixed(2)} TK\n👥 Users: ${Object.keys(earnings).length}\n\n`;
  const top = Object.entries(earnings).sort(([,a],[,b]) => b.totalEarned - a.totalEarned).slice(0, 5);
  top.forEach(([uid, e], i) => { const u = users[uid]; text += `${i+1}. ${u?.first_name || uid}: ${e.totalEarned.toFixed(2)} TK\n`; });
  await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "➕ Add", callback_data: "admin_add_balance" }, { text: "➖ Deduct", callback_data: "admin_deduct_balance" }], [{ text: "🔄 Reset", callback_data: "admin_reset_balance" }], [{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

bot.action("admin_add_balance", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_add_balance";
  await ctx.editMessageText("➕ *Add Balance*\n\nFormat: `user_id amount`\nExample: `123456789 50`", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

bot.action("admin_deduct_balance", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_deduct_balance";
  await ctx.editMessageText("➖ *Deduct Balance*\n\nFormat: `user_id amount`", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

bot.action("admin_reset_balance", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_reset_balance";
  await ctx.editMessageText("🔄 *Reset Balance*\n\nSend user_id:", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] } });
});

/******************** ADMIN WITHDRAWALS ********************/
bot.action("admin_withdrawals", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  const pending = withdrawals.filter(w => w.status === "pending");
  const approved = withdrawals.filter(w => w.status === "approved");
  const totalApproved = approved.reduce((s, w) => s + w.amount, 0);
  await ctx.editMessageText(`💸 *Withdrawals*\n\n⏳ Pending: ${pending.length}\n✅ Approved: ${approved.length} (${totalApproved.toFixed(2)} TK)`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "⏳ Pending", callback_data: "admin_pending_withdrawals" }], [{ text: "📋 History", callback_data: "admin_all_withdrawals" }], [{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

bot.action("admin_pending_withdrawals", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  const pending = withdrawals.filter(w => w.status === "pending");
  if (pending.length === 0) return await ctx.editMessageText("✅ *No pending*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_withdrawals" }]] } });
  let text = "⏳ *Pending Requests*\n\n";
  const btns = [];
  pending.forEach(w => { text += `👤 ${w.userName} | 💵 ${w.amount.toFixed(2)} TK | ${w.method}\n📱 ${w.account}\n\n`; btns.push([{ text: `✅ ${w.amount.toFixed(2)} TK`, callback_data: `wadmin_approve:${w.id}` }, { text: "❌ Reject", callback_data: `wadmin_reject:${w.id}` }]); });
  btns.push([{ text: "🔙 Back", callback_data: "admin_withdrawals" }]);
  await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: btns } });
});

bot.action("admin_all_withdrawals", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  const recent = withdrawals.slice(-15).reverse();
  if (recent.length === 0) return await ctx.editMessageText("📋 *No withdrawals*", { parse_mode: "Markdown" });
  let text = "📋 *Recent Withdrawals*\n\n";
  recent.forEach(w => { const icon = w.status === "approved" ? "✅" : w.status === "rejected" ? "❌" : "⏳"; text += `${icon} ${w.userName} | ${w.amount.toFixed(2)} TK | ${w.method}\n📅 ${new Date(w.requestedAt).toLocaleDateString()}\n\n`; });
  await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_withdrawals" }]] } });
});

/******************** ADMIN DELETE NUMBERS ********************/
bot.action("admin_delete", async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  const btns = [];
  for (const cc in numbersByCountryService) {
    for (const sid in numbersByCountryService[cc]) {
      const count = numbersByCountryService[cc][sid].length;
      if (count > 0) btns.push([{ text: `🗑️ ${cc}/${sid} (${count})`, callback_data: `admin_delete_confirm:${cc}:${sid}` }]);
    }
  }
  btns.push([{ text: "❌ Cancel", callback_data: "admin_cancel" }]);
  await ctx.editMessageText("🗑️ *Delete Numbers*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: btns } });
});

bot.action(/^admin_delete_confirm:(.+):(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  const cc = ctx.match[1], sid = ctx.match[2];
  const count = numbersByCountryService[cc]?.[sid]?.length || 0;
  await ctx.editMessageText(`⚠️ *Delete ${count} numbers?*\nCountry: ${cc}\nService: ${services[sid]?.name || sid}`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "✅ Yes", callback_data: `admin_delete_execute:${cc}:${sid}` }, { text: "❌ No", callback_data: "admin_back" }]] } });
});

bot.action(/^admin_delete_execute:(.+):(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin) return await ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery();
  const cc = ctx.match[1], sid = ctx.match[2];
  delete numbersByCountryService[cc][sid];
  if (Object.keys(numbersByCountryService[cc]).length === 0) delete numbersByCountryService[cc];
  saveNumbers();
  await ctx.editMessageText(`✅ *Deleted*`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

/******************** TEXT INPUT HANDLER ********************/
bot.on("text", async (ctx, next) => {
  if (!ctx.message || !ctx.message.text) return next();
  const text = ctx.message.text.trim();
  const userId = ctx.from.id.toString();
  const KEYBOARD_BUTTONS = ["☎️ Get Number", "📞 Get Numbers", "📧 Get Tempmail", "📧 Temp Mail", "🔐 2FA", "🔐 2FA Codes", "💰 Balances", "💸 Withdraw", "💬 Support", "🏠 Home", "🏠 Main Menu", "ℹ️ Help"];
  if (KEYBOARD_BUTTONS.includes(text)) { ctx.session.withdrawState = null; ctx.session.withdrawData = null; ctx.session.totpState = null; ctx.session.totpData = null; ctx.session.adminState = null; ctx.session.adminData = null; return next(); }
  if (text.startsWith('/')) return next();
  
  if (ctx.session.totpState === "waiting_secret") {
    const secret = text.replace(/\s/g, "").toUpperCase();
    const result = generateTOTP(secret);
    if (!result) return await ctx.reply("❌ *Invalid secret key*", { parse_mode: "Markdown" });
    const { service } = ctx.session.totpData || {};
    const icon = service === "facebook" ? "📘" : service === "instagram" ? "📸" : service === "google" ? "🔍" : "⚙️";
    const name = service === "facebook" ? "Facebook" : service === "instagram" ? "Instagram" : service === "google" ? "Google" : "2FA";
    ctx.session.totpState = null;
    return await ctx.reply(`${icon} *${name} 2FA Code*\n\n🔑 \`${result.token}\`\n⏰ ${result.timeRemaining}s`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔄 Refresh", callback_data: `totp_refresh:${service}:${encodeURIComponent(secret)}` }]] } });
  }
  
  if (ctx.session.withdrawState === "waiting_amount") {
    const amount = parseFloat(text);
    const e = getUserEarnings(userId);
    const { method } = ctx.session.withdrawData || {};
    if (!method) { ctx.session.withdrawState = null; return await ctx.reply("❌ Start over", { parse_mode: "Markdown" }); }
    if (isNaN(amount) || amount <= 0) return await ctx.reply("❌ Valid amount", { parse_mode: "Markdown" });
    if (amount < settings.minWithdraw) return await ctx.reply(`❌ Min ${settings.minWithdraw} TK`, { parse_mode: "Markdown" });
    if (amount > e.balance) return await ctx.reply(`❌ Balance: ${e.balance.toFixed(2)} TK`, { parse_mode: "Markdown" });
    ctx.session.withdrawData = { method, amount };
    ctx.session.withdrawState = "waiting_account";
    return await ctx.reply(`📱 Your *${method} number:*\nExample: \`01712345678\``, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "withdraw_cancel" }]] } });
  }
  
  if (ctx.session.withdrawState === "waiting_account") {
    const account = text;
    if (!/^01[3-9]\d{8}$/.test(account)) return await ctx.reply("❌ Invalid number", { parse_mode: "Markdown" });
    const e = getUserEarnings(userId);
    const { method, amount } = ctx.session.withdrawData;
    if (e.balance < amount) { ctx.session.withdrawState = null; return await ctx.reply("❌ Balance changed", { parse_mode: "Markdown" }); }
    ctx.session.withdrawData = { method, account, amount };
    ctx.session.withdrawState = "confirm";
    const icon = method === "bKash" ? "🟣" : "🟠";
    return await ctx.reply(`${icon} *${method} - ${amount.toFixed(2)} TK*\n📱 ${account}\n\nConfirm?`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "✅ Confirm", callback_data: "withdraw_confirm" }, { text: "❌ Cancel", callback_data: "withdraw_cancel" }]] } });
  }
  
  if (!ctx.session.isAdmin || !ctx.session.adminState) return next();
  const state = ctx.session.adminState;
  
  if (state === "waiting_set_count") { const n = parseInt(text); if (n >= 1 && n <= 100) { settings.defaultNumberCount = n; saveSettings(); ctx.session.adminState = null; await ctx.reply(`✅ Set to ${n}`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Settings", callback_data: "admin_settings" }]] } }); } else await ctx.reply("❌ 1-100"); }
  else if (state === "waiting_set_cooldown") { const n = parseInt(text); if (n >= 1 && n <= 3600) { settings.cooldownSeconds = n; saveSettings(); ctx.session.adminState = null; await ctx.reply(`✅ Set to ${n}s`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Settings", callback_data: "admin_settings" }]] } }); } else await ctx.reply("❌ 1-3600"); }
  else if (state === "waiting_set_default_price") { const p = parseFloat(text); if (!isNaN(p) && p >= 0) { settings.defaultOtpPrice = p; saveSettings(); ctx.session.adminState = null; await ctx.reply(`✅ Price: ${p.toFixed(2)} TK`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Settings", callback_data: "admin_settings" }]] } }); } else await ctx.reply("❌ Valid price"); }
  else if (state === "waiting_set_min_withdraw") { const a = parseFloat(text); if (!isNaN(a) && a >= 1) { settings.minWithdraw = a; saveSettings(); ctx.session.adminState = null; await ctx.reply(`✅ Min: ${a} TK`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Settings", callback_data: "admin_settings" }]] } }); } else await ctx.reply("❌ Valid amount"); }
  else if (state === "waiting_broadcast") { let s=0,f=0; for(const uid of Object.keys(users)) { try{ await bot.telegram.sendMessage(uid, text); s++; await new Promise(r=>setTimeout(r,50)); }catch(e){ f++; } } ctx.session.adminState=null; await ctx.reply(`📢 Broadcast\n✅ Sent: ${s}\n❌ Failed: ${f}`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Admin", callback_data: "admin_back" }]] } }); }
  else if (state === "waiting_add_numbers") { const lines = text.split("\n").map(l=>l.trim()).filter(Boolean); let a=0,f=0; for(const line of lines){ const parts=line.split("|"); const num=parts[0].replace(/\D/g,""); const cc=parts[1]; const sid=parts[2]; if(!num||!cc||!sid){ f++; continue; } if(!numbersByCountryService[cc]) numbersByCountryService[cc]={}; if(!numbersByCountryService[cc][sid]) numbersByCountryService[cc][sid]=[]; if(!numbersByCountryService[cc][sid].includes(num)){ numbersByCountryService[cc][sid].push(num); a++; }else f++; } saveNumbers(); ctx.session.adminState=null; await ctx.reply(`✅ Added: ${a}\n❌ Failed: ${f}`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Admin", callback_data: "admin_back" }]] } }); }
  else if (state === "waiting_add_country") { const parts=text.split(/\s+/); if(parts.length>=3){ const cc=parts[0].replace(/\D/g,""); const flag=parts[parts.length-1]; const name=parts.slice(1,-1).join(" "); countries[cc]={name,flag}; saveCountries(); ctx.session.adminState=null; await ctx.reply(`✅ Added ${name} (+${cc})`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Countries", callback_data: "admin_manage_countries" }]] } }); } else await ctx.reply("❌ Format: code name flag"); }
  else if (state === "waiting_add_service") { const parts=text.split(/\s+/); if(parts.length>=3){ const sid=parts[0].toLowerCase(); const icon=parts[parts.length-1]; const name=parts.slice(1,-1).join(" "); services[sid]={name,icon}; saveServices(); ctx.session.adminState=null; await ctx.reply(`✅ Added ${name} (${sid})`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Services", callback_data: "admin_manage_services" }]] } }); } else await ctx.reply("❌ Format: id name icon"); }
  else if (state === "waiting_add_balance") { const p=text.split(/\s+/); if(p.length>=2){ const uid=p[0]; const amt=parseFloat(p[1]); if(!isNaN(amt)&&amt>0){ const e=getUserEarnings(uid); e.balance+=amt; saveEarnings(); ctx.session.adminState=null; await ctx.reply(`✅ Added ${amt} TK to ${uid}\nNew balance: ${e.balance.toFixed(2)} TK`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Balance", callback_data: "admin_balance_manage" }]] } }); } else await ctx.reply("❌ Valid amount"); } else await ctx.reply("❌ Format: user_id amount"); }
  else if (state === "waiting_deduct_balance") { const p=text.split(/\s+/); if(p.length>=2){ const uid=p[0]; const amt=parseFloat(p[1]); if(!isNaN(amt)&&amt>0){ const e=getUserEarnings(uid); e.balance=Math.max(0,e.balance-amt); saveEarnings(); ctx.session.adminState=null; await ctx.reply(`✅ Deducted ${amt} TK from ${uid}\nNew balance: ${e.balance.toFixed(2)} TK`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Balance", callback_data: "admin_balance_manage" }]] } }); } else await ctx.reply("❌ Valid amount"); } else await ctx.reply("❌ Format: user_id amount"); }
  else if (state === "waiting_reset_balance") { const uid=text.trim(); const e=getUserEarnings(uid); e.balance=0; saveEarnings(); ctx.session.adminState=null; await ctx.reply(`✅ Reset ${uid} balance to 0`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Balance", callback_data: "admin_balance_manage" }]] } }); }
  else if (state === "waiting_set_country_price") { const lines=text.split("\n").map(l=>l.trim()).filter(Boolean); let u=0; for(const line of lines){ const parts=line.split(/[:\s]+/); if(parts.length>=2){ const cc=parts[0].replace(/\D/g,""); const price=parseFloat(parts[1]); if(cc&&!isNaN(price)&&price>=0){ countryPrices[cc]=price; u++; } } } saveCountryPrices(); ctx.session.adminState=null; await ctx.reply(`✅ Updated ${u} countries`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Prices", callback_data: "admin_country_prices" }]] } }); }
});

/******************** ADMIN FILE UPLOAD HANDLER ********************/
bot.on("document", async (ctx) => {
  if (!ctx.session.isAdmin) return;
  if (ctx.session.adminState !== "waiting_upload_file") return;
  const doc = ctx.message.document;
  if (!doc || !doc.file_name || !doc.file_name.endsWith(".txt")) return await ctx.reply("❌ Send .txt file");
  const { serviceId } = ctx.session.adminData || {};
  if (!serviceId) return await ctx.reply("❌ Session expired");
  await ctx.reply("⏳ Processing...");
  const fileLink = await ctx.telegram.getFileLink(doc.file_id);
  const fileContent = await new Promise((resolve, reject) => { https.get(fileLink.href, (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(d)); res.on("error", reject); }).on("error", reject); });
  const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let added = 0, failed = 0;
  for (const line of lines) {
    let number, countryCode, service;
    if (line.includes("|")) { const parts = line.split("|"); number = parts[0].replace(/\D/g, ""); countryCode = parts[1] ? parts[1].trim() : null; service = parts[2] ? parts[2].trim() : serviceId; }
    else { number = line.replace(/\D/g, ""); countryCode = getCountryCodeFromNumber(number); service = serviceId; }
    if (!number || !/^\d{10,15}$/.test(number)) { failed++; continue; }
    if (!countryCode) { failed++; continue; }
    if (!service) service = serviceId;
    if (!numbersByCountryService[countryCode]) numbersByCountryService[countryCode] = {};
    if (!numbersByCountryService[countryCode][service]) numbersByCountryService[countryCode][service] = [];
    if (!numbersByCountryService[countryCode][service].includes(number)) { numbersByCountryService[countryCode][service].push(number); added++; }
    else failed++;
  }
  saveNumbers();
  ctx.session.adminState = null;
  ctx.session.adminData = null;
  await ctx.reply(`✅ *Upload Complete*\n📄 ${doc.file_name}\n✅ Added: ${added}\n❌ Failed: ${failed}`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Admin", callback_data: "admin_back" }]] } });
});

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
    const isRequired = chatId === MAIN_CHANNEL_ID?.toString() || chatId === CHAT_GROUP_ID?.toString() || chatId === OTP_GROUP_ID?.toString();
    if (!isRequired) return;
    const wasActive = ["member", "administrator", "creator"].includes(oldStatus);
    const nowGone = ["left", "kicked", "restricted"].includes(newStatus);
    if (wasActive && nowGone && users[userId]) { users[userId].verified = false; saveUsers(); console.log(`🚫 User ${userId} left`); }
  } catch(e) {}
});

bot.on("message", async (ctx, next) => {
  try {
    const chatId = ctx.chat.id;
    const isOtpGroup = chatId === OTP_GROUP_ID || chatId === Number(OTP_GROUP_ID) || chatId.toString() === OTP_GROUP_ID.toString();
    if (!isOtpGroup) return next();
    const text = ctx.message.text || ctx.message.caption || '';
    const msgId = ctx.message.message_id;
    if (!text) return;
    const matched = findMatchingActiveNumber(text);
    if (!matched) return;
    const data = activeNumbers[matched];
    const userId = data.userId;
    const countryCode = data.countryCode || '';
    if (data.lastOTP === msgId) return;
    data.lastOTP = msgId;
    data.otpCount = (data.otpCount || 0) + 1;
    saveActiveNumbers();
    const otp = extractOTPCode(text);
    const earned = addEarning(userId, countryCode);
    const balance = getUserEarnings(userId).balance;
    const service = services[data.service] || { icon: '📱', name: data.service };
    const country = countries[countryCode] || { flag: '🌍', name: countryCode };
    let notify = `📨 *OTP Received!*\n\n${service.icon} *${service.name}*\n${country.flag} ${country.name}\n📞 \`+${matched}\``;
    if (otp) notify += `\n\n🔑 *OTP:* \`${otp}\``;
    notify += `\n\n💵 +${earned.toFixed(2)} TK\n💰 Balance: ${balance.toFixed(2)} TK`;
    await ctx.telegram.sendMessage(userId, notify, { parse_mode: 'Markdown' });
    await ctx.telegram.forwardMessage(userId, OTP_GROUP_ID, msgId);
    otpLog.push({ phoneNumber: matched, userId, countryCode, service: data.service, otpCode: otp || null, earned, messageId: msgId, delivered: true, timestamp: new Date().toISOString() });
    saveOTPLog();
  } catch (error) { console.error('OTP error:', error); }
});

/******************** START BOT ********************/
async function startBot() {
  try {
    console.log("=====================================");
    console.log("🚀 Starting Number Bot...");
    console.log("✅ Backup system: FULLY FIXED");
    console.log("✅ Auto-restore: ENABLED");
    console.log("✅ Backup Group ID: " + BACKUP_GROUP_ID);
    console.log("=====================================");
    await bot.launch({ allowedUpdates: ["message", "callback_query", "chat_member", "my_chat_member", "document"] });
    console.log("✅ Bot started!");
    await autoRestoreOnStart();
    setInterval(async () => { await createTelegramBackup(true); }, 24 * 60 * 60 * 1000);
    setInterval(async () => {
      if (!settings.requireVerification) return;
      for (const uid of Object.keys(users)) {
        try {
          const m1 = await bot.telegram.getChatMember(MAIN_CHANNEL_ID, uid);
          const m2 = await bot.telegram.getChatMember(CHAT_GROUP_ID, uid);
          const m3 = await bot.telegram.getChatMember(OTP_GROUP_ID, uid);
          users[uid].verified = ['member','administrator','creator'].includes(m1.status) && ['member','administrator','creator'].includes(m2.status) && ['member','administrator','creator'].includes(m3.status);
        } catch(e) {}
      }
      saveUsers();
    }, 2 * 60 * 60 * 1000);
  } catch (error) { console.error("Failed:", error); setTimeout(startBot, 10000); }
}
startBot();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));