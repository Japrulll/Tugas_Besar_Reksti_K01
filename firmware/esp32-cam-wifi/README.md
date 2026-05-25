# Votely ESP32-CAM WiFi

Firmware ini membuat ESP32-CAM menjadi HTTP camera untuk `votely-mobile`.

## Wiring FTDI FT232RL

- FTDI `5V` -> ESP32-CAM `5V`
- FTDI `GND` -> ESP32-CAM `GND`
- FTDI `TX` -> ESP32-CAM `U0R`
- FTDI `RX` -> ESP32-CAM `U0T`
- ESP32-CAM `IO0` -> `GND` hanya saat flashing

Gunakan power 5V yang stabil. Setelah upload selesai, lepaskan `IO0` dari `GND`, lalu reset ESP32-CAM.

## Flashing

1. Buka `VotelyEsp32CamWifi/VotelyEsp32CamWifi.ino` di Arduino IDE.
2. Pilih board `AI Thinker ESP32-CAM`.
3. Isi `WIFI_SSID` dan `WIFI_PASSWORD`.
4. Upload firmware melalui FTDI.
5. Buka Serial Monitor `115200`, reset ESP32-CAM, lalu catat IP yang tampil.

## Endpoint

- `GET /health`
  - Response contoh: `{ "ok": true, "device": "Votely-CAM", "ip": "192.168.1.50" }`
- `GET /capture`
  - Response: JPEG snapshot dari OV2640.

## Penggunaan di Votely Mobile

1. Pastikan HP dan ESP32-CAM berada di WiFi yang sama.
2. Buka Votely Mobile.
3. Pada Face Scanner pilih `ESP32-CAM WiFi`.
4. Masukkan URL, contoh `http://192.168.1.50`.
5. Klik `Tes Koneksi`, lalu `Mulai Verifikasi Wajah`.

App juga bisa menerima URL JPEG langsung dari firmware camera web server lain, misalnya `http://192.168.1.50/cam-hi.jpg`. Mobile akan meminta backend mengambil gambar tersebut supaya tidak terkena batasan CORS browser.

Jika aplikasi berjalan di HTTPS production, browser dapat memblokir request HTTP lokal ke ESP32-CAM. Untuk demo lokal, jalankan Votely Mobile lewat HTTP di jaringan yang sama.
