/**
 * WhatsApp Bot Script dengan Fitur Lengkap
 * Dibuat untuk berjalan di VPS
 * Mendukung fitur bisnis dan grup management
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidDecode, downloadContentFromMessage, getContentType, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const figlet = require('figlet');
const axios = require('axios');
const sharp = require('sharp');
const { exec } = require('child_process');
const { writeFile, readFile, unlink } = require('fs/promises');
const FileType = require('file-type');
const PhoneNumber = require('awesome-phonenumber');
const moment = require('moment-timezone');
const qrcodeTerminal = require('qrcode-terminal');

moment.tz.setDefault('Asia/Jakarta');

// Konfigurasi Bot
const config = {
  name: 'SCxVBS',
  owner: {
    name: 'Varen Shino',
    number: '62895413202421',
    numberWithoutPrefix: '0895413202421',
  },
  prefix: '.',
  logoPath: path.join(__dirname, 'assets', 'images', 'logo.jpg'),
  sessionName: 'SCxVBS-session',
};

// Direktori untuk menyimpan data
const DATA_DIR = './data';
const SESSION_DIR = './session';
const TEMP_DIR = './temp';

// Pastikan direktori ada
[DATA_DIR, SESSION_DIR, TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Pastikan folder assets/images ada
const ASSETS_DIR = path.join(__dirname, 'assets', 'images');
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

// Database sederhana untuk list dan popularitas
const LIST_DB_PATH = path.join(DATA_DIR, 'list_db.json');
const GROUP_SETTINGS_PATH = path.join(DATA_DIR, 'group_settings.json');
const POPULARITY_DB_PATH = path.join(DATA_DIR, 'popularity_db.json');

// Inisialisasi database jika belum ada
if (!fs.existsSync(LIST_DB_PATH)) fs.writeFileSync(LIST_DB_PATH, JSON.stringify({}, null, 2));
if (!fs.existsSync(GROUP_SETTINGS_PATH)) fs.writeFileSync(GROUP_SETTINGS_PATH, JSON.stringify({}, null, 2));
if (!fs.existsSync(POPULARITY_DB_PATH)) fs.writeFileSync(POPULARITY_DB_PATH, JSON.stringify({}, null, 2));

// Memuat database dengan penanganan error
const loadListDb = () => {
  try {
    const data = fs.readFileSync(LIST_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('💾 Database list rusak, dibuat ulang. Periksa list_db.json!');
    fs.writeFileSync(LIST_DB_PATH, JSON.stringify({}, null, 2));
    return {};
  }
};

const saveListDb = (data) => {
  try {
    fs.writeFileSync(LIST_DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    logger.error('💾 Gagal menyimpan database list:', error);
    return false;
  }
};

const loadGroupSettings = () => {
  try {
    return JSON.parse(fs.readFileSync(GROUP_SETTINGS_PATH, 'utf8'));
  } catch (error) {
    logger.error('💾 Gagal memuat pengaturan grup, membuat baru:', error);
    return {};
  }
};

const saveGroupSettings = (data) => {
  try {
    fs.writeFileSync(GROUP_SETTINGS_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    logger.error('💾 Gagal menyimpan pengaturan grup:', error);
    return false;
  }
};

const loadPopularityDb = () => {
  try {
    const data = fs.readFileSync(POPULARITY_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('💾 Database popularitas rusak, dibuat ulang. Periksa popularity_db.json!');
    fs.writeFileSync(POPULARITY_DB_PATH, JSON.stringify({}, null, 2));
    return {};
  }
};

const savePopularityDb = (data) => {
  try {
    fs.writeFileSync(POPULARITY_DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    logger.error('💾 Gagal menyimpan database popularitas:', error);
    return false;
  }
};

// Logger yang ringkas dan keren
const logger = {
  info: (msg) => console.log(chalk.cyan(`[${moment().format('HH:mm:ss')}] 📡 ${msg}`)),
  success: (msg) => console.log(chalk.green(`[${moment().format('HH:mm:ss')}] ✅ ${msg}`)),
  error: (msg, err) => {
    console.log(chalk.red(`[${moment().format('HH:mm:ss')}] ❌ ${msg}`));
    if (err) console.log(chalk.gray(`🔍 ${err.message || err}`));
  },
  warn: (msg) => console.log(chalk.yellow(`[${moment().format('HH:mm:ss')}] ⚠️ ${msg}`)),
  command: (cmd, sender) => console.log(chalk.magenta(`[${moment().format('HH:mm:ss')}] 🚀 ${cmd} oleh ${sender}`)),
  debug: (msg) => console.log(chalk.gray(`[${moment().format('HH:mm:ss')}] 🛠️ ${msg}`))
};

// Utilitas
const isOwner = (jid) => normalizePhoneNumber(jid) === normalizePhoneNumber(config.owner.number);
const normalizePhoneNumber = (number) => (number ? number.replace(/\D/g, '').replace(/^08/, '62') : '');
const getGroupAdmins = async (groupMetadata) => groupMetadata.participants.filter(v => v.admin).map(v => v.id);
const isGroupAdmin = async (groupMetadata, participant) => (await getGroupAdmins(groupMetadata)).includes(participant);
const formatPhoneNumber = (number) => new PhoneNumber(normalizePhoneNumber(number)).getNumber('international');
const containsLink = (message) => /(https?:\/\/[^\s]+|www\.[^\s]+)/gi.test(message);

// Inisialisasi koneksi WhatsApp
const startBot = async () => {
  console.log(chalk.cyan(figlet.textSync('SCxVBS', { font: 'Standard' })));
  console.log(chalk.yellow('='.repeat(50)));
  console.log(chalk.green(' > Author  : ') + chalk.white(config.owner.name));
  console.log(chalk.green(' > Bot     : ') + chalk.white(config.name));
  console.log(chalk.green(' > Versi   : ') + chalk.white('1.0.1')); // Versi diperbarui
  console.log(chalk.green(' > Telegram   : ') + chalk.white('t.me/scxvbs'));
  console.log(chalk.yellow('='.repeat(50)));

  try {
    logger.info('Memulai autentikasi...');
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    
    logger.info('Membuat WA Socket...');
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'error' })) },
      browser: Browsers.ubuntu('Chrome'),
      version,
      logger: pino({ level: 'error' }),
      generateHighQualityLinkPreview: true,
      defaultQueryTimeoutMs: 60000,
      markOnlineOnConnect: true,
    });

    logger.info('Mengikat event listener...');
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        logger.info('QR Code tersedia, pindai di bawah ini:');
        qrcodeTerminal.generate(qr, { small: true });
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode || 0;
        const reason = lastDisconnect?.error?.message || 'Alasan tidak diketahui';
        logger.warn(`Koneksi terputus. Status: ${statusCode}, Alasan: ${reason}`);
        if (statusCode !== DisconnectReason.loggedOut) {
          logger.info('Mencoba reconnect dalam 5 detik...');
          setTimeout(startBot, 5000);
        } else {
          logger.error('Sesi terputus permanen, hapus folder session!');
          fs.rmdirSync(SESSION_DIR, { recursive: true });
          fs.mkdirSync(SESSION_DIR);
        }
      } else if (connection === 'connecting') {
        logger.info('Menghubungkan ke WhatsApp...');
      } else if (connection === 'open') {
        logger.success(`${config.name} terhubung!`);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      if (!messages[0]?.key?.fromMe && messages[0]?.message) await messageHandler(sock, messages[0]);
    });

    sock.ev.on('group-participants.update', async (update) => {
      try {
        const { id, participants, action } = update;
        const groupMetadata = await sock.groupMetadata(id);
        logger.info(`[GRUP] ${action} di "${groupMetadata.subject}": ${participants.join(', ')}`);
      } catch (err) {
        logger.error('Error update grup:', err);
      }
    });

    return sock;
  } catch (err) {
    logger.error('Gagal memulai bot:', err);
    setTimeout(startBot, 30000);
  }
};

// Handler untuk memproses pesan
const messageHandler = async (sock, msg) => {
  if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

  const isGroupMsg = msg.key.remoteJid.endsWith('@g.us');
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderName = msg.pushName || 'Unknown';
  const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  const isOwnerMsg = isOwner(sender);

  let groupMetadata, groupAdmins, isAdmin;
  if (isGroupMsg) {
    groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
    groupAdmins = await getGroupAdmins(groupMetadata);
    isAdmin = groupAdmins.includes(sender);
  }

  let body = (msg.message.conversation || 
             (msg.message.extendedTextMessage?.text || 
              msg.message.imageMessage?.caption || 
              msg.message.videoMessage?.caption) || '').trim().toLowerCase();
  const isCmdWithPrefix = body.startsWith(config.prefix);
  const command = isCmdWithPrefix ? body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase() : body.trim().split(' ')[0].toLowerCase();
  const content = body.trim().split(' ').slice(1).join(' ');

  const groupSettings = loadGroupSettings();
  const currentGroupSettings = isGroupMsg ? (groupSettings[msg.key.remoteJid] || { antilink: false }) : { antilink: false };

  // Auto-respon untuk "done" atau "D" oleh admin
  if (isGroupMsg && isAdmin && (body === 'done' || body === 'd') && msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
    const thankYouMessage = `Terima kasih atas pesanan Anda! 😊 Pesanan telah selesai diproses. Kami sangat menghargai kepercayaan Anda dan menantikan pesanan berikutnya. Jika ada pertanyaan atau kebutuhan lain, jangan ragu untuk menghubungi kami. Semoga hari Anda menyenangkan! 🌟`;
    await sock.sendMessage(msg.key.remoteJid, { text: thankYouMessage }, { quoted: msg });
    return;
  }

  if (isGroupMsg && currentGroupSettings.antilink && containsLink(body) && !isAdmin && !isOwnerMsg) {
    await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Antilink aktif, link dilarang!' }, { quoted: msg });
    await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
    logger.warn(`[ANTILINK] Link dihapus dari ${senderName}`);
    return;
  }

  const listDb = loadListDb();
  if (isGroupMsg && listDb[msg.key.remoteJid]?.[body]) {
    const listItem = listDb[msg.key.remoteJid][body];
    const popularityDb = loadPopularityDb();
    popularityDb[msg.key.remoteJid] = popularityDb[msg.key.remoteJid] || {};
    popularityDb[msg.key.remoteJid][body] = (popularityDb[msg.key.remoteJid][body] || 0) + 1;
    savePopularityDb(popularityDb);
    
    let messageContent = {};
    if (listItem.image && fs.existsSync(listItem.image)) {
      messageContent = { image: { url: listItem.image }, caption: listItem.content };
    } else {
      messageContent = { text: listItem.content };
    }
    await sock.sendMessage(msg.key.remoteJid, messageContent, { quoted: msg });
    return;
  }

  if (isCmdWithPrefix || ['owner', 'addlist', 'list', 'dellist', 'updatelist', 'renamelist', 'antilink', 'add', 'h', 'hidetag', 'kick', 's', 'stiker', 'linkgc', 'open', 'close', 'menu'].includes(command)) {
    if (isCmdWithPrefix) logger.command(command, `${senderName} (${sender.split('@')[0]})`);

    switch (command) {
      case 'owner': {
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${config.owner.name}\nTEL;type=CELL;waid=${config.owner.number}:${config.owner.numberWithoutPrefix}\nEND:VCARD`;
        await sock.sendMessage(msg.key.remoteJid, { contacts: { displayName: config.owner.name, contacts: [{ vcard }] } });
        await sock.sendMessage(msg.key.remoteJid, { text: `👨‍💻 *Owner:* ${config.owner.name}\n📱 *Nomor:* ${config.owner.numberWithoutPrefix}` }, { quoted: msg });
        break;
      }
      case 'addlist': {
        if ((!isAdmin && !isOwnerMsg) || !isGroupMsg || !content.includes('|')) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Format: .addlist nama|isi (Admin/Owner)' }, { quoted: msg });
          return;
        }
        const [listName, ...listContentArr] = content.split('|');
        const listContent = listContentArr.join('|');
        if (!listName || !listContent) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Nama dan isi wajib diisi!' }, { quoted: msg });
          return;
        }
        const listDb = loadListDb();
        listDb[msg.key.remoteJid] = listDb[msg.key.remoteJid] || {};
        let imageUrl = null;
        if (msg.message.imageMessage) {
          try {
            const buffer = await downloadContentFromMessage(msg.message.imageMessage, 'image');
            const fileName = `${Date.now()}.jpg`;
            const filePath = path.join(TEMP_DIR, fileName);
            let chunks = Buffer.from([]);
            for await (const chunk of buffer) chunks = Buffer.concat([chunks, chunk]);
            await writeFile(filePath, chunks);
            imageUrl = filePath;
          } catch (error) {
            logger.error('Gagal menyimpan gambar:', error);
          }
        }
        listDb[msg.key.remoteJid][listName.trim().toLowerCase()] = { content: listContent.trim(), image: imageUrl };
        saveListDb(listDb);
        await sock.sendMessage(msg.key.remoteJid, { text: `✅ List "${listName}" ditambahkan!` }, { quoted: msg });
        break;
      }
      case 'list': {
        if (!isGroupMsg) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Hanya bisa di grup!' }, { quoted: msg });
          return;
        }
        const listDb = loadListDb();
        if (!listDb[msg.key.remoteJid] || Object.keys(listDb[msg.key.remoteJid]).length === 0) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Tidak ada list!' }, { quoted: msg });
          return;
        }
        const popularityDb = loadPopularityDb();
        const groupPopularity = popularityDb[msg.key.remoteJid] || {};
        const sortedList = Object.keys(listDb[msg.key.remoteJid]).sort((a, b) => {
          const countA = groupPopularity[a] || 0;
          const countB = groupPopularity[b] || 0;
          if (countA === countB) return a.localeCompare(b); // Urutkan alfabetis jika jumlah sama
          return countB - countA; // Urutkan berdasarkan popularitas
        });
        let listMessage = '📋 *Daftar List:*\n';
        const topItems = sortedList.slice(0, Math.min(3, sortedList.length));
        topItems.forEach((item, index) => {
          if (groupPopularity[item] && groupPopularity[item] > 0) {
            listMessage += `${index + 1}. ${item} - Produk Terpopuler 🔥\n`;
          }
        });
        sortedList.forEach((item, index) => {
          if (!topItems.includes(item)) {
            listMessage += `${topItems.length + index + 1 - topItems.length}. ${item}\n`;
          }
        });
        await sock.sendMessage(msg.key.remoteJid, { text: listMessage }, { quoted: msg });
        break;
      }
      case 'dellist': {
        if ((!isAdmin && !isOwnerMsg) || !isGroupMsg || !content) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Format: .dellist nama (Admin/Owner)' }, { quoted: msg });
          return;
        }
        const listName = content.toLowerCase();
        const listDb = loadListDb();
        if (!listDb[msg.key.remoteJid] || !listDb[msg.key.remoteJid][listName]) {
          await sock.sendMessage(msg.key.remoteJid, { text: `❌ List "${listName}" tidak ditemukan!` }, { quoted: msg });
          return;
        }
        if (listDb[msg.key.remoteJid][listName].image && fs.existsSync(listDb[msg.key.remoteJid][listName].image)) {
          fs.unlinkSync(listDb[msg.key.remoteJid][listName].image);
        }
        delete listDb[msg.key.remoteJid][listName];
        saveListDb(listDb);
        await sock.sendMessage(msg.key.remoteJid, { text: `✅ List "${listName}" dihapus!` }, { quoted: msg });
        break;
      }
      case 'updatelist': {
        if ((!isAdmin && !isOwnerMsg) || !isGroupMsg || !content.includes('|')) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Format: .updatelist nama|isi_baru (Admin/Owner)' }, { quoted: msg });
          return;
        }
        const [listName, ...listContentArr] = content.split('|');
        const listContent = listContentArr.join('|');
        if (!listName || !listContent) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Nama dan isi wajib diisi!' }, { quoted: msg });
          return;
        }
        const listDb = loadListDb();
        if (!listDb[msg.key.remoteJid] || !listDb[msg.key.remoteJid][listName.trim().toLowerCase()]) {
          await sock.sendMessage(msg.key.remoteJid, { text: `❌ List "${listName}" tidak ditemukan!` }, { quoted: msg });
          return;
        }
        let imageUrl = listDb[msg.key.remoteJid][listName.trim().toLowerCase()].image;
        if (msg.message.imageMessage) {
          try {
            if (imageUrl && fs.existsSync(imageUrl)) fs.unlinkSync(imageUrl);
            const buffer = await downloadContentFromMessage(msg.message.imageMessage, 'image');
            const fileName = `${Date.now()}.jpg`;
            const filePath = path.join(TEMP_DIR, fileName);
            let chunks = Buffer.from([]);
            for await (const chunk of buffer) chunks = Buffer.concat([chunks, chunk]);
            await writeFile(filePath, chunks);
            imageUrl = filePath;
          } catch (error) {
            logger.error('Gagal menyimpan gambar baru:', error);
          }
        }
        listDb[msg.key.remoteJid][listName.trim().toLowerCase()] = { content: listContent.trim(), image: imageUrl };
        saveListDb(listDb);
        await sock.sendMessage(msg.key.remoteJid, { text: `✅ List "${listName}" diperbarui!` }, { quoted: msg });
        break;
      }
      case 'renamelist': {
        if ((!isAdmin && !isOwnerMsg) || !isGroupMsg || !content.includes('|')) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Format: .renamelist nama_lama|nama_baru (Admin/Owner)' }, { quoted: msg });
          return;
        }
        const [oldName, newName] = content.split('|').map(item => item.trim().toLowerCase());
        if (!oldName || !newName) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Nama lama dan baru wajib diisi!' }, { quoted: msg });
          return;
        }
        const listDb = loadListDb();
        if (!listDb[msg.key.remoteJid] || !listDb[msg.key.remoteJid][oldName]) {
          await sock.sendMessage(msg.key.remoteJid, { text: `❌ List "${oldName}" tidak ditemukan!` }, { quoted: msg });
          return;
        }
        if (listDb[msg.key.remoteJid][newName]) {
          await sock.sendMessage(msg.key.remoteJid, { text: `❌ List "${newName}" sudah ada!` }, { quoted: msg });
          return;
        }
        listDb[msg.key.remoteJid][newName] = listDb[msg.key.remoteJid][oldName];
        delete listDb[msg.key.remoteJid][oldName];
        saveListDb(listDb);
        await sock.sendMessage(msg.key.remoteJid, { text: `✅ List "${oldName}" diganti jadi "${newName}"!` }, { quoted: msg });
        break;
      }
      case 'antilink': {
        if ((!isAdmin && !isOwnerMsg) || !isGroupMsg || !content) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Format: .antilink on/off (Admin/Owner)' }, { quoted: msg });
          return;
        }
        const option = content.toLowerCase();
        if (option !== 'on' && option !== 'off') {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gunakan: .antilink on/off' }, { quoted: msg });
          return;
        }
        groupSettings[msg.key.remoteJid] = groupSettings[msg.key.remoteJid] || {};
        groupSettings[msg.key.remoteJid].antilink = (option === 'on');
        saveGroupSettings(groupSettings);
        await sock.sendMessage(msg.key.remoteJid, { text: `✅ Antilink ${option.toUpperCase()}!` }, { quoted: msg });
        break;
      }
      case 'add': {
        if ((!isAdmin && !isOwnerMsg) || !isGroupMsg || !content) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Format: .add nomor (Admin/Owner)' }, { quoted: msg });
          return;
        }
        let number = normalizePhoneNumber(content);
        if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation) {
          const numberMatch = msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation.match(/(\d+)/g);
          if (numberMatch) number = normalizePhoneNumber(numberMatch[0]);
        }
        if (!number.endsWith('@s.whatsapp.net')) number += '@s.whatsapp.net';
        try {
          await sock.groupParticipantsUpdate(msg.key.remoteJid, [number], 'add');
          await sock.sendMessage(msg.key.remoteJid, { text: `✅ Menambahkan ${formatPhoneNumber(number)}!` }, { quoted: msg });
        } catch (error) {
          logger.error('Gagal menambahkan member:', error);
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal menambahkan, cek nomor!' }, { quoted: msg });
        }
        break;
      }
      case 'h':
      case 'hidetag': {
        if ((!isAdmin && !isOwnerMsg) || !isGroupMsg || !content) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Format: .hidetag pesan (Admin/Owner)' }, { quoted: msg });
          return;
        }
        const groupMembers = groupMetadata.participants.map(member => member.id);
        await sock.sendMessage(msg.key.remoteJid, { text: content, mentions: groupMembers }, { quoted: msg });
        break;
      }
      case 'kick': {
        if ((!isAdmin && !isOwnerMsg) || !isGroupMsg) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Hanya Admin/Owner di grup!' }, { quoted: msg });
          return;
        }
        let target = msg.message.extendedTextMessage?.contextInfo?.participant;
        if (content) {
          target = normalizePhoneNumber(content) + '@s.whatsapp.net';
        }
        if (!target || target === botNumber || target === sender) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Target invalid atau diri sendiri!' }, { quoted: msg });
          return;
        }
        try {
          await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'remove');
          await sock.sendMessage(msg.key.remoteJid, { text: '✅ Member dikeluarkan!' }, { quoted: msg });
        } catch (error) {
          logger.error('Gagal kick:', error);
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal kick, cek izin!' }, { quoted: msg });
        }
        break;
      }
      case 's':
      case 'stiker': {
        if (!msg.message.imageMessage && !msg.message.videoMessage &&
            !(msg.message.extendedTextMessage?.contextInfo?.quotedMessage)) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Kirim/gambar dengan caption .s/.stiker atau reply!' }, { quoted: msg });
          return;
        }
        try {
          await sock.sendMessage(msg.key.remoteJid, { text: '⏳ Membuat stiker...' }, { quoted: msg });
          let buffer;
          if (msg.message.imageMessage || msg.message.videoMessage) {
            const stream = await downloadContentFromMessage(
              msg.message.imageMessage || msg.message.videoMessage,
              'image' || 'video'
            );
            buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          } else {
            const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            const quotedType = getContentType(quotedMsg);
            if (quotedType.includes('image') || quotedType.includes('video')) {
              const stream = await downloadContentFromMessage(
                quotedMsg.imageMessage || quotedMsg.videoMessage,
                'image' || 'video'
              );
              buffer = Buffer.from([]);
              for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            }
          }
          if (buffer && buffer.length > 0) {
            await sock.sendMessage(msg.key.remoteJid, { sticker: buffer }, { quoted: msg });
          } else {
            throw new Error('Buffer kosong');
          }
        } catch (error) {
          logger.error('Gagal buat stiker:', error);
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal buat stiker!' }, { quoted: msg });
        }
        break;
      }
      case 'linkgc': {
        if (!isGroupMsg) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Hanya di grup!' }, { quoted: msg });
          return;
        }
        try {
          const groupCode = await sock.groupInviteCode(msg.key.remoteJid);
          const groupName = groupMetadata.subject;
          const groupLink = `https://chat.whatsapp.com/${groupCode}`;
          await sock.sendMessage(msg.key.remoteJid, { text: `📢 *Link Grup*\n*Nama:* ${groupName}\n*Link:* ${groupLink}` }, { quoted: msg });
        } catch (error) {
          logger.error('Gagal dapat link grup:', error);
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal dapat link!' }, { quoted: msg });
        }
        break;
      }
      case 'open': {
        if ((!isAdmin && !isOwnerMsg) || !isGroupMsg) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Hanya Admin/Owner di grup!' }, { quoted: msg });
          return;
        }
        try {
          await sock.groupSettingUpdate(msg.key.remoteJid, 'not_announcement');
          await sock.sendMessage(msg.key.remoteJid, { text: '🔓 Grup dibuka, semua bisa chat!' }, { quoted: msg });
        } catch (error) {
          logger.error('Gagal buka grup:', error);
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal buka grup!' }, { quoted: msg });
        }
        break;
      }
      case 'close': {
        if ((!isAdmin && !isOwnerMsg) || !isGroupMsg) {
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Hanya Admin/Owner di grup!' }, { quoted: msg });
          return;
        }
        try {
          await sock.groupSettingUpdate(msg.key.remoteJid, 'announcement');
          await sock.sendMessage(msg.key.remoteJid, { text: '🔒 Grup ditutup, hanya admin!' }, { quoted: msg });
        } catch (error) {
          logger.error('Gagal tutup grup:', error);
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal tutup grup!' }, { quoted: msg });
        }
        break;
      }
      case 'menu': {
        try {
          const logoPath = config.logoPath;
          const menuText = `
🤖 *${config.name} MENU* 🤖
👨‍💻 *Owner:* ${config.owner.name}
📱 *Nomor Owner:* ${config.owner.numberWithoutPrefix}

*Perintah:*
👤 .owner - Biodata owner
📝 .addlist nama|isi - Tambah list (Admin/Owner)
📋 .list - Lihat semua list
🗑️ .dellist nama - Hapus list (Admin/Owner)
✏️ .updatelist nama|isi - Update list (Admin/Owner)
📝 .renamelist nama_lama|nama_baru - Ganti nama list (Admin/Owner)
🔗 .antilink on/off - Aktifkan/mati antilink (Admin/Owner)
➕ .add nomor - Tambah member (Admin/Owner)
📢 .h/.hidetag pesan - Tag semua (Admin/Owner)
⛔ .kick @tag - Keluarin member (Admin/Owner)
🖼️ .s/.stiker - Buat stiker dari gambar/video
🔗 .linkgc - Dapatkan link grup
🔓 .open - Buka grup (Admin/Owner)
🔒 .close - Tutup grup (Admin/Owner)
📜 .menu - Tampilkan menu

*Catatan:* Perintah bisa dengan . atau tanpa prefix
© ${config.name} - ${moment().format('YYYY')}
          `;
          if (fs.existsSync(logoPath)) {
            await sock.sendMessage(msg.key.remoteJid, { image: fs.readFileSync(logoPath), caption: menuText }, { quoted: msg });
          } else {
            await sock.sendMessage(msg.key.remoteJid, { text: menuText }, { quoted: msg });
          }
        } catch (error) {
          logger.error('Gagal kirim menu:', error);
          await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal load menu!' }, { quoted: msg });
        }
        break;
      }
      default:
        if (isCmdWithPrefix) await sock.sendMessage(msg.key.remoteJid, { text: `❌ "${command}" tidak dikenal, cek .menu` }, { quoted: msg });
        break;
    }
  }
};

// Mulai bot
startBot().catch(err => logger.error('Gagal start bot:', err));
