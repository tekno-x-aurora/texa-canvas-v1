# TEXA Tools Manager Extension

Ekstensi Chrome untuk mengelola dan membuka tools dari dashboard TEXA secara aman dan terintegrasi.

## Fitur

- 🔒 **Aman**: Tidak melakukan cookie injection ke situs pihak ketiga
- 🚀 **Cepat**: Buka tools langsung dari popup ekstensi
- 📱 **Terintegrasi**: Terhubung langsung dengan dashboard TEXA
- 🔐 **Autentikasi**: Menggunakan Firebase ID token untuk keamanan
- 🎯 **Mudah**: Interface yang user-friendly

## Instalasi

1. Buka Chrome dan masuk ke `chrome://extensions/`
2. Aktifkan "Developer mode"
3. Klik "Load unpacked"
4. Pilih folder `extension` dari project ini
5. Ekstensi akan muncul di toolbar Chrome

## Cara Penggunaan

### Dari Dashboard TEXA
1. Login ke dashboard TEXA
2. Klik tombol "Open Tools" pada tool yang diinginkan
3. Ekstensi akan otomatis membuka tool tersebut

### Dari Popup Ekstensi
1. Klik ikon ekstensi di toolbar Chrome
2. Pastikan status menunjukkan "Terhubung"
3. Klik tool yang ingin dibuka
4. Tool akan terbuka di tab baru

## Keamanan

Ekstensi ini dirancang dengan prinsip keamanan:
- Tidak menyimpan atau menginject cookies ke situs pihak ketiga
- Hanya membuka URL yang sudah dikonfigurasi di dashboard
- Menggunakan autentikasi Firebase untuk verifikasi user
- Tidak memiliki akses ke data sensitif browser

## Struktur File

```
extension/
├── manifest.json          # Konfigurasi ekstensi
├── popup.html            # Interface popup
├── popup.js              # Logic popup
├── background.js         # Background script
├── contentScript.js      # Content script untuk dashboard
└── README.md             # Dokumentasi
```

## Development

Untuk development:
1. Pastikan Anda sudah login ke dashboard TEXA
2. Ekstensi akan otomatis terdeteksi dan terhubung
3. Gunakan console browser untuk debugging

## Troubleshooting

### Ekstensi tidak terhubung
- Pastikan Anda sudah login ke dashboard TEXA
- Cek koneksi internet
- Refresh halaman dashboard

### Tools tidak bisa dibuka
- Pastikan tool memiliki URL yang valid
- Cek status subscription di dashboard
- Hubungi admin jika masalah berlanjut

## Catatan Keamanan

Ekstensi ini **TIDAK** melakukan:
- Inject cookies ke situs pihak ketiga
- Akses data pribadi user
- Modifikasi konten situs lain
- Bypass autentikasi situs

Ekstensi ini hanya membuka URL yang sudah dikonfigurasi di dashboard TEXA.