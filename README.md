```markdown
# WA-Bot Store

# WA-Bot Store

![Made with Node.js](https://img.shields.io/badge/Made%20with-Node.js-43853d?style=for-the-badge&logo=node.js)
![Baileys](https://img.shields.io/badge/Powered%20by-Baileys-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)
[![Telegram Channel](https://img.shields.io/badge/Follow-Telegram-blue?style=for-the-badge&logo=telegram)](https://t.me/NamaChannel)
[![WhatsApp Channel](https://img.shields.io/badge/Follow-WhatsApp-25D366?style=for-the-badge&logo=whatsapp)](https://wa.me/1234567890)

Bot WhatsApp sederhana dengan fitur lengkap untuk kebutuhan grup dan bisnis. Mendukung manajemen list, anti-link, stiker, dan administrasi grup.

## Fitur

- 📋 **List/Produk**: Tambah, hapus, update, dan tampilkan list dengan gambar
- 🛡️ **Anti-Link**: Hapus otomatis pesan berisi link
- 👮‍♂️ **Manajemen Grup**: Add, kick, hidetag, buka/tutup grup
- 🖼️ **Stiker**: Buat stiker dari gambar/video
- 🔗 **Link Grup**: Dapatkan link dengan cepat
- ⚙️ **Mendukung prefix atau tanpa prefix**

## Persyaratan

- VPS (Ubuntu/Debian)
- Node.js v16+
- RAM minimal 1GB
- Koneksi internet stabil

## Instalasi

### 1. Persiapan

```bash
# Update dan install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget ffmpeg imagemagick webp nodejs npm
```

### 2. Clone Repository

```bash
# Download script
git clone https://github.com/SCxVBS/wa-bot-store.git
cd wa-bot-store
```

### 3. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 4. Konfigurasi

Edit file `index.js`:

```javascript
const config = {
  name: 'WA-Bot',           // Nama bot
  owner: {
    name: 'Nama Owner',     // Nama kamu
    number: '62xxxxxxxxxx', // Format 62xxx
    numberWithoutPrefix: '08xxxxxxxxxx', // Format 0xxx
  },
  prefix: '.',
  logoPath: path.join(__dirname, 'assets', 'images', 'logo.jpg'), // Logo lokal
  sessionName: 'wabot-session',
};
```

### 5. Jalankan Bot

```bash
npm start
```

Scan QR Code yang muncul dengan WhatsApp.

### 6. Jalankan di Background

```bash
npm install -g pm2
pm2 start index.js --name "wa-bot"
pm2 startup
pm2 save
```

## Perintah Bot

### Umum

| Perintah | Fungsi |
|----------|--------|
| `.owner` | Info owner bot |
| `.list` | Lihat semua list |
| `.s` atau `.stiker` | Buat stiker |
| `.linkgc` | Link invite grup |
| `.menu` | Lihat semua perintah |

### Admin/Owner

| Perintah | Fungsi |
|----------|--------|
| `.addlist nama\|isi` | Tambah list baru |
| `.dellist nama` | Hapus list |
| `.updatelist nama\|isi_baru` | Update list |
| `.renamelist nama_lama\|nama_baru` | Ganti nama list |
| `.antilink on/off` | Atur anti-link |
| `.add nomor` | Tambah member |
| `.h` atau `.hidetag pesan` | Mention semua member |
| `.kick @tag` | Keluarkan member |
| `.open` | Buka grup |
| `.close` | Tutup grup |

## Troubleshooting

**Bot tidak connect:**
```bash
rm -rf session
npm start
```

**Error module tidak ditemukan:**
```bash
npm install --legacy-peer-deps
```

**QR Code tidak muncul:**
```bash
node -v  # Pastikan versi 16+
# Update jika perlu:
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Kontak

[![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/scxvbs)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com/channel/0029VbAR1YL5EjxqhRhOzT3x)

## Lisensi

MIT License

## Disclaimer

Bot ini dibuat untuk tujuan edukasi dan memudahkan pengelolaan bisnis. Penggunaan bot WhatsApp harus mengikuti ketentuan dari WhatsApp. Pengembang tidak bertanggung jawab atas penyalahgunaan bot ini.