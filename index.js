/**
 * WhatsApp Bot Script dengan Fitur Lengkap
 * Dibuat untuk berjalan di VPS
 * Mendukung fitur bisnis dan grup management
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidDecode, downloadContentFromMessage, getContentType, Browsers, makeInMemoryStore } = require('@whiskeysockets/baileys');
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
moment.tz.setDefault('Asia/Jakarta');

// Konfigurasi Bot
const config = {
  name: 'SCxVBS',
  owner: {
    name: 'Varen Shino',
    number: '62895413202421', // Format 62xxx
    numberWithoutPrefix: '0895413202421', // Format 0xxx
  },
  prefix: '.', // Prefix untuk perintah, tapi bot juga mendukung tanpa prefix
  logoUrl: 'https://deposit.pictures/p/273e2ce806b44d66831401d19f66a016',
  sessionName: 'SCxVBS-session',
};

// Direktori untuk menyimpan data
const STORE_PATH = './store.json';
const DATA_DIR = './data';
const SESSION_DIR = './session';
const TEMP_DIR = './temp';

// Pastikan direktori ada
[DATA_DIR, SESSION_DIR, TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Database sederhana untuk list
const LIST_DB_PATH = path.join(DATA_DIR, 'list_db.json');
// Database untuk pengaturan grup
const GROUP_SETTINGS_PATH = path.join(DATA_DIR, 'group_settings.json');

// Inisialisasi database jika belum ada
if (!fs.existsSync(LIST_DB_PATH)) {
  fs.writeFileSync(LIST_DB_PATH, JSON.stringify({}, null, 2));
}

if (!fs.existsSync(GROUP_SETTINGS_PATH)) {
  fs.writeFileSync(GROUP_SETTINGS_PATH, JSON.stringify({}, null, 2));
}

// Memuat database
const loadListDb = () => {
  try {
    return JSON.parse(fs.readFileSync(LIST_DB_PATH, 'utf8'));
  } catch (error) {
    logger.error('Gagal memuat database list, membuat baru:', error);
    return {};
  }
};

const saveListDb = (data) => {
  try {
    fs.writeFileSync(LIST_DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    logger.error('Gagal menyimpan database list:', error);
    return false;
  }
};

const loadGroupSettings = () => {
  try {
    return JSON.parse(fs.readFileSync(GROUP_SETTINGS_PATH, 'utf8'));
  } catch (error) {
    logger.error('Gagal memuat pengaturan grup, membuat baru:', error);
    return {};
  }
};

const saveGroupSettings = (data) => {
  try {
    fs.writeFileSync(GROUP_SETTINGS_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    logger.error('Gagal menyimpan pengaturan grup:', error);
    return false;
  }
};

// Format logger yang elegan
const logger = {
  info: (msg) => console.log(chalk.blue(`[${moment().format('HH:mm:ss')}] [INFO] `) + msg),
  success: (msg) => console.log(chalk.green(`[${moment().format('HH:mm:ss')}] [SUKSES] `) + msg),
  error: (msg, err) => {
    console.log(chalk.red(`[${moment().format('HH:mm:ss')}] [ERROR] `) + msg);
    if (err) {
      console.log(chalk.red('Stack Trace:'));
      console.log(err.stack || err);
    }
  },
  warn: (msg) => console.log(chalk.yellow(`[${moment().format('HH:mm:ss')}] [PERINGATAN] `) + msg),
  command: (cmd, sender) => console.log(chalk.magenta(`[${moment().format('HH:mm:ss')}] [PERINTAH] `) + chalk.cyan(cmd) + ' dari ' + chalk.yellow(sender)),
  debug: (msg) => console.log(chalk.gray(`[${moment().format('HH:mm:ss')}] [DEBUG] `) + msg)
};

// Membuat in-memory store untuk caching
const store = makeInMemoryStore({ logger: pino({ level: 'silent' }).child({ level: 'silent' }) });
store.readFromFile(STORE_PATH);
setInterval(() => {
  store.writeToFile(STORE_PATH);
}, 10000);

// Utilitas
const isOwner = (jid) => {
  if (!jid) return false;
  return normalizePhoneNumber(jid) === normalizePhoneNumber(config.owner.number);
};

const normalizePhoneNumber = (number) => {
  if (!number) return '';
  number = number.replace(/\D/g, '');
  if (number.startsWith('08')) {
    number = '62' + number.slice(1);
  }
  return number;
};

const getGroupAdmins = async (groupMetadata) => {
  const admins = groupMetadata.participants.filter(v => v.admin !== null).map(v => v.id);
  return admins;
};

const isGroupAdmin = async (groupMetadata, participant) => {
  const admins = await getGroupAdmins(groupMetadata);
  return admins.includes(participant);
};

const formatPhoneNumber = (number) => {
  const pn = new PhoneNumber(normalizePhoneNumber(number));
  return pn.getNumber('international');
};

// Fungsi untuk mengecek apakah pesan berisi link
const containsLink = (message) => {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  return urlRegex.test(message);
};

// Inisialisasi koneksi WhatsApp
const startBot = async () => {
  // Banner yang keren
  console.log(chalk.cyan(figlet.textSync('SCxVBS', { font: 'Standard' })));
  console.log(chalk.yellow('='.repeat(50)));
  console.log(chalk.green(' > Author  : ') + config.owner.name);
  console.log(chalk.green(' > Bot     : ') + config.name);
  console.log(chalk.green(' > Versi   : ') + '1.0.0');
  console.log(chalk.green(' > Telegram   : ') + 't.me/scxvbs');
  console.log(chalk.yellow('='.repeat(50)));

  try {
    // Menghubungkan ke session WhatsApp
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    
    // Membuat instance WA Socket dengan konfigurasi yang kompatibel dengan Node.js v23
    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      printQRInTerminal: true,
      browser: Browsers.ubuntu('Chrome'),
      logger: pino({ level: 'silent' }),
      generateHighQualityLinkPreview: true,
      defaultQueryTimeoutMs: 60000,
      markOnlineOnConnect: true
    });

    store.bind(sock.ev);

    // Listener untuk credentials update
    sock.ev.on('creds.update', saveCreds);

    // Listener untuk koneksi
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        logger.info('QR Code tersedia. Silahkan scan dengan WhatsApp.');
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode || 0;
        const reason = lastDisconnect?.error?.message || 'Alasan tidak diketahui';
        
        logger.warn(`Koneksi terputus. Status: ${statusCode}, Alasan: ${reason}`);
        
        // Jika bukan karena LoggedOut, coba hubungkan kembali
        if (statusCode !== DisconnectReason.loggedOut) {
          logger.info('Mencoba menghubungkan kembali dalam 5 detik...');
          setTimeout(() => {
            startBot().catch(err => {
              logger.error('Gagal restart bot:', err);
            });
          }, 5000);
        } else {
          logger.error('Sesi terputus permanen, silahkan scan QR kembali!');
        }
      } else if (connection === 'connecting') {
        logger.info('Menghubungkan ke WhatsApp...');
      } else if (connection === 'open') {
        logger.success(`${config.name} berhasil terhubung ke WhatsApp!`);
      }
    });

    // Handler untuk pesan
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      
      for (const msg of messages) {
        try {
          // Hanya proses pesan dari pengguna (bukan pesan status)
          if (msg.key && !msg.key.fromMe && msg.message) {
            await messageHandler(sock, msg);
          }
        } catch (err) {
          logger.error('Terjadi error saat memproses pesan:', err);
        }
      }
    });

    // Handler untuk update grup
    sock.ev.on('group-participants.update', async (update) => {
      try {
        const groupId = update.id;
        const participants = update.participants || [];
        const action = update.action;
        
        // Mendapatkan metadata grup
        const groupMetadata = await sock.groupMetadata(groupId);
        const groupName = groupMetadata.subject;
        
        logger.info(`[GRUP] ${action} di "${groupName}": ${participants.join(', ')}`);
      } catch (err) {
        logger.error('Terjadi error saat memproses update grup:', err);
      }
    });

    return sock;
  } catch (err) {
    logger.error('Gagal memulai bot:', err);
    // Coba restart setelah 30 detik jika terjadi error
    setTimeout(() => {
      logger.info('Mencoba restart bot setelah error...');
      startBot().catch(err => {
        logger.error('Gagal restart bot:', err);
      });
    }, 30000);
  }
};

// Handler untuk memproses pesan yang masuk
const messageHandler = async (sock, msg) => {
  if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;
  
  const isGroupMsg = msg.key.remoteJid.endsWith('@g.us');
  const sender = msg.key.remoteJid;
  const senderName = msg.pushName || 'Unknown';
  const senderId = msg.key.participant || sender;
  const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  const isOwnerMsg = isOwner(senderId);
  
  // Mendapatkan metadata grup jika pesan berasal dari grup
  let groupMetadata = null;
  let groupAdmins = [];
  let isAdmin = false;
  
  if (isGroupMsg) {
    try {
      groupMetadata = await sock.groupMetadata(sender);
      groupAdmins = await getGroupAdmins(groupMetadata);
      isAdmin = groupAdmins.includes(senderId);
    } catch (error) {
      logger.error('Gagal mendapatkan metadata grup:', error);
    }
  }
  
  // Mendapatkan isi pesan
  let body = '';
  let msgType = '';
  
  try {
    msgType = getContentType(msg.message);
    
    if (msgType === 'conversation') {
      body = msg.message.conversation;
    } else if (msgType === 'extendedTextMessage') {
      body = msg.message.extendedTextMessage.text;
    } else if (msgType === 'imageMessage' && msg.message.imageMessage.caption) {
      body = msg.message.imageMessage.caption;
    } else if (msgType === 'videoMessage' && msg.message.videoMessage.caption) {
      body = msg.message.videoMessage.caption;
    }
  } catch (error) {
    logger.error('Gagal mendapatkan isi pesan:', error);
    body = '';
  }
  
  // Mengecek apakah pesan menggunakan prefix atau tidak
  const isCmd = body.startsWith(config.prefix);
  const command = isCmd ? body.slice(config.prefix.length).trim().split(/ +/).shift().toLowerCase() : body.trim().split(/ +/).shift().toLowerCase();
  const args = body.trim().split(/ +/).slice(1);
  const content = args.join(' ');
  
  // Muat pengaturan grup
  const groupSettings = loadGroupSettings();
  const currentGroupSettings = isGroupMsg ? (groupSettings[sender] || { antilink: false }) : { antilink: false };

  // Memeriksa apakah antilink aktif dan pesan berisi link
  if (isGroupMsg && currentGroupSettings.antilink && containsLink(body)) {
    if (!isAdmin && !isOwnerMsg) {
      try {
        // Hapus pesan yang mengandung link
        await sock.sendMessage(sender, { 
          text: `⚠️ *PERINGATAN*\n\nAnda mengirim link dan antilink sedang aktif di grup ini.` 
        }, { quoted: msg });
        
        await sock.sendMessage(sender, { delete: msg.key });
        logger.warn(`[ANTILINK] Pesan yang berisi link dihapus dari ${senderName} di grup ${groupMetadata.subject}`);
        return;
      } catch (error) {
        logger.error('Gagal menangani pesan antilink:', error);
      }
    }
  }
  
  // Log perintah yang diterima
  if (command) {
    logger.command(command, `${senderName} (${senderId.split('@')[0]})`);
  }
  
  // Memproses daftar list yang diinputkan user
  if (!isCmd) {
    try {
      const listDb = loadListDb();
      if (isGroupMsg && listDb[sender] && listDb[sender][command]) {
        const listItem = listDb[sender][command];
        
        // Jika list memiliki gambar
        if (listItem.image && fs.existsSync(listItem.image)) {
          await sock.sendMessage(sender, {
            image: { url: listItem.image },
            caption: listItem.content,
            mimetype: 'image/jpeg'
          }, { quoted: msg });
        } else {
          await sock.sendMessage(sender, { text: listItem.content }, { quoted: msg });
        }
        
        return;
      }
    } catch (error) {
      logger.error('Gagal memproses list:', error);
    }
  }
  
  // Handler untuk perintah
  try {
    switch (command) {
      case 'owner':
        {
          const vcard = 'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            `FN:${config.owner.name}\n` +
            `TEL;type=CELL;type=VOICE;waid=${config.owner.number}:${config.owner.numberWithoutPrefix}\n` +
            'END:VCARD';
          
          await sock.sendMessage(sender, {
            contacts: {
              displayName: config.owner.name,
              contacts: [{ vcard }]
            }
          }, { quoted: msg });
          
          await sock.sendMessage(sender, {
            text: `👨‍💻 *BIODATA OWNER*\n\n👤 *Nama:* ${config.owner.name}\n📱 *Nomor:* ${config.owner.numberWithoutPrefix}`
          }, { quoted: msg });
        }
        break;
        
      case 'addlist':
        {
          // Hanya owner dan admin yang bisa menambah list
          if (!isAdmin && !isOwnerMsg && isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya dapat digunakan oleh admin grup dan owner bot!'
            }, { quoted: msg });
            return;
          }
          
          if (!content.includes('|')) {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nGunakan format: addlist nama|isi'
            }, { quoted: msg });
            return;
          }
          
          const [listName, ...listContentArr] = content.split('|');
          const listContent = listContentArr.join('|');
          
          if (!listName || !listContent) {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nNama dan isi list tidak boleh kosong!'
            }, { quoted: msg });
            return;
          }
          
          // Mengambil database list
          const listDb = loadListDb();
          
          // Membuat objek untuk grup jika belum ada
          if (!listDb[sender]) {
            listDb[sender] = {};
          }
          
          // Memeriksa apakah ada gambar
          let imageUrl = null;
          
          if (msgType === 'imageMessage') {
            try {
              // Download gambar
              const buffer = await downloadContentFromMessage(msg.message.imageMessage, 'image');
              const fileName = `${Date.now()}.jpg`;
              const filePath = path.join(TEMP_DIR, fileName);
              
              let chunks = Buffer.from([]);
              for await (const chunk of buffer) {
                chunks = Buffer.concat([chunks, chunk]);
              }
              
              await writeFile(filePath, chunks);
              
              // Simpan URL gambar untuk diakses nanti
              imageUrl = filePath;
            } catch (error) {
              logger.error('Gagal menyimpan gambar:', error);
            }
          }
          
          // Menambahkan list ke database
          listDb[sender][listName.trim().toLowerCase()] = {
            content: listContent.trim(),
            image: imageUrl
          };
          
          saveListDb(listDb);
          
          await sock.sendMessage(sender, {
            text: `✅ *LIST BERHASIL DITAMBAHKAN*\n\n*Nama:* ${listName.trim()}\n*Isi:* ${listContent.trim()}`
          }, { quoted: msg });
        }
        break;
        
      case 'list':
        {
          const listDb = loadListDb();
          
          if (!isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya bisa digunakan di dalam grup!'
            }, { quoted: msg });
            return;
          }
          
          if (!listDb[sender] || Object.keys(listDb[sender]).length === 0) {
            await sock.sendMessage(sender, {
              text: '❌ *LIST KOSONG*\n\nBelum ada list yang ditambahkan di grup ini.'
            }, { quoted: msg });
            return;
          }
          
          let listMessage = '📋 *DAFTAR LIST*\n\n';
          Object.keys(listDb[sender]).forEach((item, index) => {
            listMessage += `${index + 1}. ${item}\n`;
          });
          
          listMessage += '\nKetik nama list untuk melihat isinya.';
          
          await sock.sendMessage(sender, { text: listMessage }, { quoted: msg });
        }
        break;
        
      case 'dellist':
        {
          // Hanya owner dan admin yang bisa menghapus list
          if (!isAdmin && !isOwnerMsg && isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya dapat digunakan oleh admin grup dan owner bot!'
            }, { quoted: msg });
            return;
          }
          
          if (!content) {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nGunakan format: dellist nama'
            }, { quoted: msg });
            return;
          }
          
          const listName = content.toLowerCase();
          const listDb = loadListDb();
          
          if (!isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya bisa digunakan di dalam grup!'
            }, { quoted: msg });
            return;
          }
          
          if (!listDb[sender] || !listDb[sender][listName]) {
            await sock.sendMessage(sender, {
              text: `❌ *LIST TIDAK DITEMUKAN*\n\nList dengan nama "${content}" tidak ditemukan.`
            }, { quoted: msg });
            return;
          }
          
          // Hapus gambar jika ada
          if (listDb[sender][listName].image && fs.existsSync(listDb[sender][listName].image)) {
            fs.unlinkSync(listDb[sender][listName].image);
          }
          
          // Hapus list dari database
          delete listDb[sender][listName];
          saveListDb(listDb);
          
          await sock.sendMessage(sender, {
            text: `✅ *LIST BERHASIL DIHAPUS*\n\nList dengan nama "${content}" telah dihapus.`
          }, { quoted: msg });
        }
        break;
        
      case 'updatelist':
        {
          // Hanya owner dan admin yang bisa mengupdate list
          if (!isAdmin && !isOwnerMsg && isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya dapat digunakan oleh admin grup dan owner bot!'
            }, { quoted: msg });
            return;
          }
          
          if (!content.includes('|')) {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nGunakan format: updatelist nama|isi_baru'
            }, { quoted: msg });
            return;
          }
          
          const [listName, ...listContentArr] = content.split('|');
          const listContent = listContentArr.join('|');
          
          if (!listName || !listContent) {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nNama dan isi list tidak boleh kosong!'
            }, { quoted: msg });
            return;
          }
          
          const listDb = loadListDb();
          
          if (!isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya bisa digunakan di dalam grup!'
            }, { quoted: msg });
            return;
          }
          
          if (!listDb[sender] || !listDb[sender][listName.trim().toLowerCase()]) {
            await sock.sendMessage(sender, {
              text: `❌ *LIST TIDAK DITEMUKAN*\n\nList dengan nama "${listName.trim()}" tidak ditemukan.`
            }, { quoted: msg });
            return;
          }
          
          // Memeriksa apakah ada gambar
          let imageUrl = listDb[sender][listName.trim().toLowerCase()].image;
          
          if (msgType === 'imageMessage') {
            try {
              // Hapus gambar lama jika ada
              if (imageUrl && fs.existsSync(imageUrl)) {
                fs.unlinkSync(imageUrl);
              }
              
              // Download gambar baru
              const buffer = await downloadContentFromMessage(msg.message.imageMessage, 'image');
              const fileName = `${Date.now()}.jpg`;
              const filePath = path.join(TEMP_DIR, fileName);
              
              let chunks = Buffer.from([]);
              for await (const chunk of buffer) {
                chunks = Buffer.concat([chunks, chunk]);
              }
              
              await writeFile(filePath, chunks);
              
              // Simpan URL gambar baru
              imageUrl = filePath;
            } catch (error) {
              logger.error('Gagal menyimpan gambar baru:', error);
            }
          }
          
          // Update list di database
          listDb[sender][listName.trim().toLowerCase()] = {
            content: listContent.trim(),
            image: imageUrl
          };
          
          saveListDb(listDb);
          
          await sock.sendMessage(sender, {
            text: `✅ *LIST BERHASIL DIUPDATE*\n\n*Nama:* ${listName.trim()}\n*Isi Baru:* ${listContent.trim()}`
          }, { quoted: msg });
        }
        break;
        
      case 'renamelist':
        {
          // Hanya owner dan admin yang bisa merename list
          if (!isAdmin && !isOwnerMsg && isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya dapat digunakan oleh admin grup dan owner bot!'
            }, { quoted: msg });
            return;
          }
          
          if (!content.includes('|')) {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nGunakan format: renamelist nama_lama|nama_baru'
            }, { quoted: msg });
            return;
          }
          
          const [oldName, newName] = content.split('|').map(item => item.trim().toLowerCase());
          
          if (!oldName || !newName) {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nNama lama dan nama baru tidak boleh kosong!'
            }, { quoted: msg });
            return;
          }
          
          const listDb = loadListDb();
          
          if (!isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya bisa digunakan di dalam grup!'
            }, { quoted: msg });
            return;
          }
          
          if (!listDb[sender] || !listDb[sender][oldName]) {
            await sock.sendMessage(sender, {
              text: `❌ *LIST TIDAK DITEMUKAN*\n\nList dengan nama "${oldName}" tidak ditemukan.`
            }, { quoted: msg });
            return;
          }
          
          if (listDb[sender][newName]) {
            await sock.sendMessage(sender, {
              text: `❌ *NAMA SUDAH ADA*\n\nList dengan nama "${newName}" sudah ada.`
            }, { quoted: msg });
            return;
          }
          
          // Rename list
          listDb[sender][newName] = listDb[sender][oldName];
          delete listDb[sender][oldName];
          
          saveListDb(listDb);
          
          await sock.sendMessage(sender, {
            text: `✅ *LIST BERHASIL DIRENAME*\n\n*Nama Lama:* ${oldName}\n*Nama Baru:* ${newName}`
          }, { quoted: msg });
        }
        break;
        
      case 'antilink':
        {
          // Hanya owner dan admin yang bisa menggunakan antilink
          if (!isAdmin && !isOwnerMsg && isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya dapat digunakan oleh admin grup dan owner bot!'
            }, { quoted: msg });
            return;
          }
          
          if (!isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya bisa digunakan di dalam grup!'
            }, { quoted: msg });
            return;
          }
          
          if (!content) {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nGunakan format: antilink on/off'
            }, { quoted: msg });
            return;
          }
          
          const option = content.toLowerCase();
          
          if (option !== 'on' && option !== 'off') {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nGunakan format: antilink on/off'
            }, { quoted: msg });
            return;
          }
          
          // Muat pengaturan grup
          const groupSettings = loadGroupSettings();
          
          // Buat objek untuk grup jika belum ada
          if (!groupSettings[sender]) {
            groupSettings[sender] = {};
          }
          
          // Update pengaturan antilink
          groupSettings[sender].antilink = (option === 'on');
          
          saveGroupSettings(groupSettings);
          
          await sock.sendMessage(sender, {
            text: `✅ *ANTILINK ${option.toUpperCase()}*\n\nAntilink telah ${option === 'on' ? 'diaktifkan' : 'dinonaktifkan'} di grup ini.`
          }, { quoted: msg });
        }
        break;
        
      case 'add':
        {
          // Hanya owner dan admin yang bisa menambah member
          if (!isAdmin && !isOwnerMsg && isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya dapat digunakan oleh admin grup dan owner bot!'
            }, { quoted: msg });
            return;
          }
          
          if (!isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya bisa digunakan di dalam grup!'
            }, { quoted: msg });
            return;
          }
          
          if (!content) {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nGunakan format: add nomor_telepon'
            }, { quoted: msg });
            return;
          }
          
          // Normalisasi nomor telepon
          let number = normalizePhoneNumber(content);
          
          // Jika terjadi reply message, cek apakah ada nomor telepon di pesan yang direply
          if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && 
              msg.message.extendedTextMessage.contextInfo.quotedMessage) {
            const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            
            if (quotedMsg.conversation) {
              // Cek apakah pesan yang direply berisi nomor telepon
              const numberMatch = quotedMsg.conversation.match(/(\d+)/g);
              
              if (numberMatch) {
                number = normalizePhoneNumber(numberMatch[0]);
              }
            }
          }
          
          if (!number.endsWith('@s.whatsapp.net')) {
            number = number + '@s.whatsapp.net';
          }
          
          try {
            await sock.groupParticipantsUpdate(sender, [number], 'add');
            await sock.sendMessage(sender, {
              text: `✅ *MEMBER BERHASIL DITAMBAHKAN*\n\nBerhasil menambahkan nomor ${formatPhoneNumber(number)} ke dalam grup.`
            }, { quoted: msg });
          } catch (error) {
            logger.error('Gagal menambahkan member:', error);
            await sock.sendMessage(sender, {
              text: `❌ *GAGAL MENAMBAHKAN MEMBER*\n\nTerjadi kesalahan saat menambahkan member. Pastikan nomor valid dan belum bergabung ke grup.`
            }, { quoted: msg });
          }
        }
        break;
        
      case 'h':
      case 'hidetag':
        {
          // Hanya owner dan admin yang bisa hidetag
          if (!isAdmin && !isOwnerMsg && isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya dapat digunakan oleh admin grup dan owner bot!'
            }, { quoted: msg });
            return;
          }
          
          if (!isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya bisa digunakan di dalam grup!'
            }, { quoted: msg });
            return;
          }
          
          if (!content) {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nGunakan format: hidetag pesan'
            }, { quoted: msg });
            return;
          }
          
          const groupMembers = groupMetadata.participants;
          const mentionList = groupMembers.map(member => member.id);
          
          await sock.sendMessage(sender, {
            text: content,
            mentions: mentionList
          }, { quoted: msg });
        }
        break;
        
      case 'kick':
        {
          // Hanya owner dan admin yang bisa kick member
          if (!isAdmin && !isOwnerMsg && isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya dapat digunakan oleh admin grup dan owner bot!'
            }, { quoted: msg });
            return;
          }
          
          if (!isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya bisa digunakan di dalam grup!'
            }, { quoted: msg });
            return;
          }
          
          let target;
          
          // Jika pesan mereply ke pesan lain
          if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && 
              msg.message.extendedTextMessage.contextInfo.participant) {
            target = msg.message.extendedTextMessage.contextInfo.participant;
          } 
          // Jika pesan tidak mereply tapi ada argumen nomor telepon
          else if (content) {
            target = normalizePhoneNumber(content);
            
            if (!target.endsWith('@s.whatsapp.net')) {
              target = target + '@s.whatsapp.net';
            }
          } else {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nGunakan format: kick @tag atau reply pesan dengan ketik kick'
            }, { quoted: msg });
            return;
          }
          
          // Pastikan tidak menendang diri sendiri atau bot
          if (target === botNumber || target === senderId) {
            await sock.sendMessage(sender, {
              text: '❌ *TIDAK DAPAT MENENDANG*\n\nTidak dapat menendang diri sendiri atau bot!'
            }, { quoted: msg });
            return;
          }
          
          try {
            await sock.groupParticipantsUpdate(sender, [target], 'remove');
            await sock.sendMessage(sender, {
              text: `✅ *MEMBER BERHASIL DIKELUARKAN*\n\nBerhasil mengeluarkan member dari grup.`
            }, { quoted: msg });
          } catch (error) {
            logger.error('Gagal mengeluarkan member:', error);
            await sock.sendMessage(sender, {
              text: `❌ *GAGAL MENGELUARKAN MEMBER*\n\nTerjadi kesalahan saat mengeluarkan member. Pastikan nomor valid dan ada di dalam grup.`
            }, { quoted: msg });
          }
        }
        break;
        
      case 's':
      case 'stiker':
        {
          if (!msgType.includes('image') && !msgType.includes('video') && 
              !(msg.message.extendedTextMessage && 
                msg.message.extendedTextMessage.contextInfo && 
                msg.message.extendedTextMessage.contextInfo.quotedMessage)) {
            await sock.sendMessage(sender, {
              text: '❌ *FORMAT SALAH*\n\nKirim gambar dengan caption s atau stiker, atau reply gambar dengan ketik s atau stiker'
            }, { quoted: msg });
            return;
          }
          
          try {
            // Menampilkan pesan sedang membuat stiker
            await sock.sendMessage(sender, {
              text: '⏳ *SEDANG MEMBUAT STIKER*\n\nMohon tunggu sebentar...'
            }, { quoted: msg });
            
            let buffer;
            
            // Jika pesan berupa gambar/video dengan caption
            if (msgType.includes('image') || msgType.includes('video')) {
              const stream = await downloadContentFromMessage(
                msgType === 'imageMessage' ? msg.message.imageMessage : msg.message.videoMessage,
                msgType === 'imageMessage' ? 'image' : 'video'
              );
              
              buffer = Buffer.from([]);
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
            } 
            // Jika pesan mereply ke media
            else if (msg.message.extendedTextMessage && 
                     msg.message.extendedTextMessage.contextInfo && 
                     msg.message.extendedTextMessage.contextInfo.quotedMessage) {
                       
              const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
              const quotedType = getContentType(quotedMsg);
              
              if (quotedType.includes('image') || quotedType.includes('video')) {
                const stream = await downloadContentFromMessage(
                  quotedType === 'imageMessage' ? quotedMsg.imageMessage : quotedMsg.videoMessage,
                  quotedType === 'imageMessage' ? 'image' : 'video'
                );
                
                buffer = Buffer.from([]);
                for await (const chunk of stream) {
                  buffer = Buffer.concat([buffer, chunk]);
                }
              } else {
                await sock.sendMessage(sender, {
                  text: '❌ *MEDIA TIDAK DIDUKUNG*\n\nHanya gambar dan video yang dapat dikonversi menjadi stiker.'
                }, { quoted: msg });
                return;
              }
            }
            
            // Jika buffer berhasil didapat, konversi ke stiker
            if (buffer && buffer.length > 0) {
              await sock.sendMessage(sender, { 
                sticker: buffer
              }, { quoted: msg });
            } else {
              throw new Error('Buffer kosong');
            }
            
          } catch (error) {
            logger.error('Gagal membuat stiker:', error);
            await sock.sendMessage(sender, {
              text: `❌ *GAGAL MEMBUAT STIKER*\n\nTerjadi kesalahan saat membuat stiker.`
            }, { quoted: msg });
          }
        }
        break;
        
      case 'linkgc':
        {
          if (!isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya bisa digunakan di dalam grup!'
            }, { quoted: msg });
            return;
          }
          
          try {
            const groupCode = await sock.groupInviteCode(sender);
            const groupName = groupMetadata.subject;
            const groupLink = `https://chat.whatsapp.com/${groupCode}`;
            
            await sock.sendMessage(sender, {
              text: `📢 *LINK GROUP*\n\n*Nama Grup:* ${groupName}\n*Link:* ${groupLink}`
            }, { quoted: msg });
          } catch (error) {
            logger.error('Gagal mendapatkan link grup:', error);
            await sock.sendMessage(sender, {
              text: `❌ *GAGAL MENDAPATKAN LINK*\n\nTerjadi kesalahan saat mendapatkan link grup.`
            }, { quoted: msg });
          }
        }
        break;
        
      case 'open':
        {
          // Hanya owner dan admin yang bisa open grup
          if (!isAdmin && !isOwnerMsg && isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya dapat digunakan oleh admin grup dan owner bot!'
            }, { quoted: msg });
            return;
          }
          
          if (!isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya bisa digunakan di dalam grup!'
            }, { quoted: msg });
            return;
          }
          
          try {
            await sock.groupSettingUpdate(sender, 'not_announcement');
            await sock.sendMessage(sender, {
              text: '🔓 *GRUP DIBUKA*\n\nSekarang semua member dapat mengirim pesan di grup ini.'
            }, { quoted: msg });
          } catch (error) {
            logger.error('Gagal membuka grup:', error);
            await sock.sendMessage(sender, {
              text: `❌ *GAGAL MEMBUKA GRUP*\n\nTerjadi kesalahan saat membuka grup.`
            }, { quoted: msg });
          }
        }
        break;
        
      case 'close':
        {
          // Hanya owner dan admin yang bisa close grup
          if (!isAdmin && !isOwnerMsg && isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya dapat digunakan oleh admin grup dan owner bot!'
            }, { quoted: msg });
            return;
          }
          
          if (!isGroupMsg) {
            await sock.sendMessage(sender, {
              text: '❌ *GAGAL*\n\nPerintah ini hanya bisa digunakan di dalam grup!'
            }, { quoted: msg });
            return;
          }
          
          try {
            await sock.groupSettingUpdate(sender, 'announcement');
            await sock.sendMessage(sender, {
              text: '🔒 *GRUP DITUTUP*\n\nSekarang hanya admin yang dapat mengirim pesan di grup ini.'
            }, { quoted: msg });
          } catch (error) {
            logger.error('Gagal menutup grup:', error);
            await sock.sendMessage(sender, {
              text: `❌ *GAGAL MENUTUP GRUP*\n\nTerjadi kesalahan saat menutup grup.`
            }, { quoted: msg });
          }
        }
        break;
        
      case 'menu':
        {
          try {
            // Kirim logo bot
            await sock.sendMessage(sender, {
              image: { url: config.logoUrl },
              caption: `
🤖 *${config.name} MENU* 🤖

👨‍💻 *Owner Bot:* ${config.owner.name}
📱 *Nomor Owner:* ${config.owner.numberWithoutPrefix}

*DAFTAR PERINTAH:*

👤 *owner*
- Menampilkan biodata owner bot

📝 *addlist* _nama|isi_
- Menambahkan list ke database (Admin/Owner)

📋 *list*
- Menampilkan semua list yang tersimpan

🗑️ *dellist* _nama_
- Menghapus list dari database (Admin/Owner)

✏️ *updatelist* _nama|isi_baru_
- Mengupdate isi list yang ada (Admin/Owner)

📝 *renamelist* _nama_lama|nama_baru_
- Mengganti nama list (Admin/Owner)

🔗 *antilink* _on/off_
- Mengaktifkan/menonaktifkan anti-link (Admin/Owner)

➕ *add* _nomor_
- Menambahkan member ke grup (Admin/Owner)

📢 *h* atau *hidetag* _pesan_
- Mengirim pesan mention ke semua member (Admin/Owner)

⛔ *kick* _@tag_
- Mengeluarkan member dari grup (Admin/Owner)

🖼️ *s* atau *stiker*
- Membuat stiker dari gambar/video

🔗 *linkgc*
- Menampilkan link invite grup

🔓 *open*
- Membuka grup agar semua member bisa chat (Admin/Owner)

🔒 *close*
- Menutup grup agar hanya admin bisa chat (Admin/Owner)

📜 *menu*
- Menampilkan daftar perintah bot

*NOTE:*
Semua perintah bisa digunakan dengan atau tanpa prefix "."
Contoh: .menu atau menu

© 2025 ${config.name} - Dibuat dengan ❤️ oleh ${config.owner.name}
              `
            }, { quoted: msg });
          } catch (error) {
            logger.error('Gagal menampilkan menu:', error);
            await sock.sendMessage(sender, {
              text: `❌ *GAGAL MENAMPILKAN MENU*\n\nTerjadi kesalahan saat menampilkan menu.`
            }, { quoted: msg });
          }
        }
        break;
        
      default:
        // Jika tidak ada perintah yang cocok dan pesan dimulai dengan prefix
        if (isCmd) {
          await sock.sendMessage(sender, {
            text: `❌ *PERINTAH TIDAK DIKENAL*\n\nKetik ${config.prefix}menu atau menu untuk melihat daftar perintah.`
          }, { quoted: msg });
        }
        break;
    }
  } catch (error) {
    logger.error('Terjadi kesalahan saat memproses perintah:', error);
  }
};

// Mulai bot
console.log('Memulai Bot WhatsApp...');
startBot().catch(err => {
  logger.error('Terjadi kesalahan fatal saat memulai bot:', err);
});