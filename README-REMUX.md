Tujuan

File `remux-faststart.ps1` membantu memindahkan atom `moov` ke awal file MP4 (faststart) tanpa melakukan re-encoding. Ini meningkatkan kemungkinan platform seperti TikTok menerima file tanpa re-encoding server-side.

Prasyarat

- ffmpeg harus terpasang dan tersedia di PATH (Windows).

Cara pakai (PowerShell)

1. Buka PowerShell dan jalankan:

```powershell
./remux-faststart.ps1 "C:\path\to\input.mp4"
```

2. Script akan menghasilkan file `input_faststart.mp4` di folder yang sama.

Catatan

- Script hanya melakukan remux (tanpa re-encode) sehingga kualitas video/audio tidak berubah.
- Beberapa file MP4 kompleks mungkin tetap perlu di-encode ulang jika atom/offset internal tidak standar.
- Untuk kontrol penuh (profil H.264, bitrate, dll.) gunakan ffmpeg manual:

Re-mux (tanpa re-encode) + faststart:

```bash
ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4
```

Re-encode berkualitas tinggi (jika perlu):

```bash
ffmpeg -i input.mp4 -c:v libx264 -profile:v high -level 4.2 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k output.mp4
```

Verifikasi

- Setelah menjalankan `remux-faststart.ps1`, coba upload `*_faststart.mp4` ke TikTok Studio dan bandingkan hasil.
- Anda dapat menggunakan `ffprobe` untuk memeriksa metadata/stream info sebelum dan sesudah.
