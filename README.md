# WA-Bot Store

Bot WhatsApp dengan fitur lengkap untuk kebutuhan grup dan bisnis. Bot ini mendukung berbagai fitur seperti manajemen produk/list, anti-link, stiker, dan administrasi grup.

## Fitur

- 📋 **Manajemen List/Produk**: Tambah, hapus, update, dan tampilkan list produk dengan dukungan gambar
- 🛡️ **Anti-Link**: Otomatis menghapus pesan berisi link (kecuali admin/owner)
- 👮‍♂️ **Manajemen Grup**: Add, kick, hidetag, buka/tutup grup
- 🖼️ **Stiker**: Buat stiker dari gambar/video
- 🔗 **Link Grup**: Dapatkan link grup dengan mudah
- ⚙️ **Mendukung prefix atau tanpa prefix**

## Persyaratan

- VPS dengan OS Linux (Ubuntu/Debian direkomendasikan)
- Node.js v16 atau lebih baru
- Minimal RAM 1GB
- Koneksi internet stabil
- Whatsapp yang terhubung ke nomor aktif

## Instalasi

### 1. Persiapan Awal

```bash
# Update dan upgrade sistem
sudo apt update && sudo apt upgrade -y

# Install dependensi yang diperlukan
sudo apt install -y git curl wget ffmpeg imagemagick webp nodejs npm
```

### 2. Clone Repository

```bash
# Clone repository
git clone https://github.com/username/wa-bot-store.git
cd wa-bot-store

# Atau jika mengunduh langsung
mkdir -p wa-bot-store && cd wa-bot-store
# Lalu upload file script ke folder ini
```

### 3. Install Dependensi

```bash
# Install dependensi
npm install --legacy-peer-deps
```

### 4. Konfigurasi Bot

Buka file `index.js` dan sesuaikan konfigurasi bot:

```javascript
// Konfigurasi Bot
const config = {
  name: 'WA-Bot',          // Nama bot
  owner: {
    name: 'Nama Owner',    // Ganti dengan nama Anda
    number: '62xxxxxxxxxx', // Format 62xxx (ganti dengan nomor Anda)
    numberWithoutPrefix: '08xxxxxxxxxx', // Format 0xxx
  },
  prefix: '.',              // Prefix untuk perintah, tapi bot juga mendukung tanpa prefix
  logoUrl: 'url_logo_anda', // URL gambar logo bot
  sessionName: 'wabot-session',
};
```

### 5. Menjalankan Bot

```bash
# Jalankan bot
npm start
```

Scan QR Code yang muncul di terminal dengan WhatsApp yang akan dijadikan bot.

### 6. Menjalankan Bot di Background (agar tetap berjalan meski terminal ditutup)

```bash
# Install PM2
npm install -g pm2

# Jalankan bot dengan PM2
pm2 start index.js --name "wa-bot"

# Memastikan bot berjalan saat sistem restart
pm2 startup
pm2 save
```

## Perintah Bot

### Perintah Umum

| Perintah | Fungsi |
|----------|--------|
| `.owner` | Menampilkan biodata owner bot |
| `.list` | Menampilkan semua list yang tersimpan |
| `.s` atau `.stiker` | Membuat stiker dari gambar/video |
| `.linkgc` | Menampilkan link invite grup |
| `.menu` | Menampilkan daftar perintah bot |

### Perintah Admin/Owner

| Perintah | Fungsi |
|----------|--------|
| `.addlist nama\|isi` | Menambahkan list ke database |
| `.dellist nama` | Menghapus list dari database |
| `.updatelist nama\|isi_baru` | Mengupdate isi list yang ada |
| `.renamelist nama_lama\|nama_baru` | Mengganti nama list |
| `.antilink on/off` | Mengaktifkan/menonaktifkan anti-link |
| `.add nomor` | Menambahkan member ke grup |
| `.h` atau `.hidetag pesan` | Mengirim pesan mention ke semua member |
| `.kick @tag` | Mengeluarkan member dari grup |
| `.open` | Membuka grup agar semua member bisa chat |
| `.close` | Menutup grup agar hanya admin bisa chat |

## Troubleshooting

### Bot tidak bisa connect ke WhatsApp

1. Hapus folder session:
```bash
rm -rf session
```

2. Restart bot:
```bash
npm start
```

### Error module tidak ditemukan

```bash
npm install --legacy-peer-deps
```

### QR Code tidak muncul

Periksa versi Node.js Anda:
```bash
node -v
```

Jika versi di bawah 16, update Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Catatan 

- Bot ini menggunakan library @whiskeysockets/baileys untuk terhubung ke WhatsApp
- Disarankan menggunakan VPS dengan spesifikasi minimal 1GB RAM untuk performa optimal
- Penggunaan bot WhatsApp harus mengikuti Terms of Service dari WhatsApp

## Lisensi

MIT License

## Kontribusi

Kontribusi selalu diterima. Silakan buat pull request atau buka issue untuk perbaikan atau penambahan fitur.

## Disclaimer

Bot ini dibuat untuk tujuan edukasi dan memudahkan pengelolaan bisnis. Penggunaan bot WhatsApp harus mengikuti ketentuan dari WhatsApp. Pengembang tidak bertanggung jawab atas penyalahgunaan bot ini.