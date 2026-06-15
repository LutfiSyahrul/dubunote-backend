# Presentasi Analisis Aplikasi DubuNote
Dokumen ini berisi jawaban detail dan teknis atas pertanyaan-pertanyaan seputar arsitektur serta implementasi fitur pada aplikasi **DubuNote** (Frontend Flutter & Backend Node.js).
---
## Daftar Pertanyaan & Penjelasan Teknis
### 1. Bagaimana Mengetahui Setiap Tanggal pada Bulannya?
Sistem kalender pada halaman beranda mendeteksi jumlah hari dan penataan tanggal dalam satu bulan secara dinamis menggunakan objek `DateTime` bawaan Dart di frontend:
* **Mencari Jumlah Hari**: Diperoleh dengan memanggil parameter hari ke-0 pada bulan berikutnya.
  ```dart
  int daysInMonth = DateTime(now.year, now.month + 1, 0).day;
  ```
  Di Dart, hari ke-0 dari bulan $N+1$ otomatis diterjemahkan sebagai hari terakhir dari bulan $N$.
* **Menentukan Posisi Hari Pertama (Weekday)**:
  ```dart
  int firstWeekday = DateTime(now.year, now.month, 1).weekday; // 1 = Senin, 7 = Minggu
  ```
  Ini digunakan untuk menghitung jumlah slot kosong (*padding*) di awal baris kalender sehingga tanggal 1 jatuh tepat pada hari yang sesuai.
* **Implementasi Kode**: Dapat dilihat langsung di fungsi `_generateDynamicCalendar()` pada berkas [dashboard_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/dashboard/dashboard_screen.dart#L279-L335).
---
### 2. Grafik pada File Masing-Masing (Layout Builder)
Aplikasi ini merancang grafik batang (*bar chart*) secara manual tanpa library pihak ketiga menggunakan widget `LayoutBuilder` agar ukurannya fleksibel dan proporsional terhadap layar:
* **Grafik Harian (Bulan Berjalan)**:
  Terletak di [dashboard_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/dashboard/dashboard_screen.dart#L396-L431). Tinggi batang dihitung proporsional terhadap pengeluaran tertinggi harian (`maxPengeluaran`) dengan tinggi maksimum `50.0`. Hari ini di-highlight dengan warna putih solid, sedangkan hari lainnya semi-transparan.
* **Grafik Tahunan (12 Bulan)**:
  Terletak di [refleksi_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/refleksi/refleksi_screen.dart#L317-L352). Menampilkan 12 batang mewakili Januari hingga Desember. Bulan saat ini di-highlight dengan warna cokelat pekat, sedangkan bulan lainnya pudar.
* **Fungsi LayoutBuilder**: Digunakan untuk membaca constraints lebar/tinggi dari widget induk, lalu mendistribusikan ruang secara merata untuk seluruh batang grafik.
---
### 3. Widgetnya Apa Saja?
Berikut adalah komponen-komponen widget utama yang menyusun layar-layar penting di DubuNote:
* **DashboardScreen** ([dashboard_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/dashboard/dashboard_screen.dart)):
  * `Scaffold` & `AppBar` (Navigasi & Header).
  * `RefreshIndicator` (Untuk fitur tarik-ke-bawah / *pull-to-refresh*).
  * `Table` (Menyusun layout grid 7 kolom kalender secara presisi).
  * `LayoutBuilder` & `AnimatedContainer` (Menyusun grafik tren belanja harian).
  * `SingleChildScrollView` & `Column` (Wadah scroll vertikal).
  * `FloatingActionButton` (Tombol tambah pengeluaran).
  * `RichText` & `TextSpan` (Format nominal Rupiah tebal-tipis).
* **RefleksiScreen** ([refleksi_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/refleksi/refleksi_screen.dart)):
  * `FadeTransition` dianimasikan dengan `AnimationController` (Efek masuk halus).
  * `RefreshIndicator` (Refresh data refleksi keuangan).
  * Custom Cards: `_buildInsightCard()`, `_buildDailySummaryCard()`, `_buildMonthlySummaryCard()`, dan `_buildYearlyProjectionCard()`.
  * `Stack` (Membuat linear progress bar pembanding bulan lalu vs bulan ini).
* **ExportScreen** ([export_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/export/export_screen.dart)):
  * `GestureDetector` (Mengatur pills filter rentang waktu: Harian, Bulanan, Tahunan).
  * `InkWell` & `showDatePicker` (Kalender pemilih tanggal interaktif).
  * `showModalBottomSheet` (Memunculkan pilihan kategori di bagian bawah layar).
  * `ElevatedButton` (Dengan indikator loading saat memroses unduhan & bagikan).
* **ScanPage** ([scan_page.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/scan/scan_page.dart)):
  * `CameraPreview` (Tampilan kamera live).
  * `CustomPaint` dengan `ViewfinderCornerPainter` (Menggambar bingkai target nota di tengah kamera).
  * `AnimatedBuilder` (Animasi garis laser pemindai naik-turun).
* **ScanDetailPage** ([scan_detail_page.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/scan/scan_detail_page.dart)):
  * `Image.file` (Menampilkan gambar pratinjau nota yang telah diambil).
  * `TextField` & `TextEditingController` (Untuk mengoreksi data nominal harga, nama toko, dan keterangan hasil OCR).
  * `Wrap` & `GestureDetector` (Pilihan kategori berbentuk chips interaktif).
---
### 4. Perhitungan Bagaimana?
Kalkulasi data pada aplikasi DubuNote terbagi menjadi beberapa bagian:
1. **Proporsi Tinggi Batang Grafik**:
   ```dart
   double factor = val / maxPengeluaran;
   double pixelHeight = factor * maxBarHeight;
   if (pixelHeight < minHeight) pixelHeight = minHeight; // Agar batang nilai 0 tetap sedikit terlihat
   ```
2. **Kalkulasi Persentase Selisih (Refleksi)**:
   Perhitungan kenaikan atau penurunan pengeluaran dibanding periode sebelumnya:
   ```dart
   _persenHarian = _totalKemarin == 0 
       ? (_totalHariIni > 0 ? 100.0 : 0.0) 
       : ((_totalHariIni - _totalKemarin) / _totalKemarin) * 100;
   ```
3. **Agregasi Data SQL (Backend)**:
   * **Total Bulanan**: Menggunakan fungsi SQL `SUM(jumlah)` dengan filter `MONTH` dan `YEAR`.
   * **Grafik Harian**: Menggunakan `GROUP BY DAY(tanggal_transaksi)`.
   * **Data Refleksi Terpadu**: Menggunakan teknik `SUM(CASE WHEN ... THEN jumlah ELSE 0 END)` untuk menghitung total hari ini, kemarin, bulan ini, bulan lalu, dan tahun ini dalam satu kali eksekusi query MySQL. Selengkapnya ada di [transaksi.js](file:///d:/dubunote/dubunote-backend/routes/transaksi.js#L140-L180).
---
### 5. Untuk Kebagikan Menggunakan Package share_plus
Fitur membagikan (*share*) dokumen laporan keuangan ke aplikasi lain (seperti WhatsApp, Telegram, Email, dll.) diimplementasikan dengan memanfaatkan library `share_plus` di frontend:
* **Alur Eksekusi**:
  1. Pengguna menekan tombol "Bagikan" pada [export_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/export/export_screen.dart#L331-L354).
  2. Aplikasi mengirim permintaan format dokumen (PDF/Excel/CSV) ke backend Node.js.
  3. Respons berupa file mentah (binary buffer) diunduh lalu disimpan sementara di folder temporer perangkat menggunakan path provider:
     ```dart
     final dir = await getTemporaryDirectory();
     ```
  4. File tersebut kemudian dibagikan melalui sistem berbagi bawaan OS perangkat (Native Share Tray):
     ```dart
     await Share.shareXFiles(
       [XFile(filePath)], 
       text: 'Berikut adalah Laporan $_selectedRentang DubuNote saya.',
     );
     ```
* **Kode Lengkap**: Bisa dipelajari di metode `_prosesBagikan()` pada berkas [export_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/export/export_screen.dart#L214-L266).
---
### 6. Wawasan Hari Ini Bagaimana? Cara Munculnya Berdasarkan Apa?
* **Kondisi Saat Ini**: Wawasan hari ini yang tampil pada halaman Refleksi Keuangan di [refleksi_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/refleksi/refleksi_screen.dart#L182-L207) dirancang secara **statis / hardcoded** di dalam widget UI Flutter:
  ```dart
  Text(
    'Pengeluaran harian Anda menunjukkan tren penurunan yang positif. Pertahankan pola konsumsi ini...',
    style: TextStyle(...)
  )
  ```
* **Cara Muncul**: Teks tersebut muncul secara langsung saat layar Refleksi dibuka dan dimuat, tanpa ada evaluasi algoritma dinamis atau pemanggilan API AI khusus dari backend untuk memproses logika teks saran tersebut.
---
### 7. Cara System Mengetahui Bulan Sekarang Secara Realtime
* **Deteksi Waktu Perangkat**: Frontend Flutter mendeteksi tanggal dan waktu saat ini menggunakan class bawaan Dart `DateTime.now()` yang mengambil waktu aktual jam sistem di HP secara realtime.
* **Komunikasi ke Backend**:
  * Pada [dashboard_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/dashboard/dashboard_screen.dart#L69-L70), bulan dan tahun saat ini dikirimkan sebagai parameter HTTP query:
    `.../api/transaksi/summary/$userId?bulan=${now.month}&tahun=${now.year}`
  * Pada [refleksi_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/refleksi/refleksi_screen.dart#L60-L72), parameter dikirim secara detail untuk membandingkan hari ini, kemarin, bulan ini, hingga bulan lalu agar pencarian database selalu sesuai waktu HP terkini.
---
### 8. Scan OCR Menggunakan flutter pub add image_picker
Untuk mengunggah gambar nota belanja dari galeri foto di perangkat, aplikasi menggunakan package `image_picker`:
* **Deklarasi dependencies**: Terdaftar di berkas [pubspec.yaml](file:///d:/dubunote/dubunote-frontend/pubspec.yaml#L42) sebagai `image_picker: ^1.2.2`.
* **Penggunaan**: Diimpor di [scan_page.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/scan/scan_page.dart#L5). Saat tombol "GALLERY" ditekan, fungsi memanggil picker untuk memiih gambar:
  ```dart
  image = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
  ```
  Path gambar lokal ini (`image.path`) kemudian dikirim melalui request Multipart ke endpoint backend OCR.
---
### 9. flutter pub add camera pada AndroidManifest.xml
Package `camera` digunakan untuk menyajikan pratinjau kamera secara langsung (*live camera feed*) pada layar Scan:
* **Deklarasi dependencies**: Terdaftar di berkas [pubspec.yaml](file:///d:/dubunote/dubunote-frontend/pubspec.yaml#L43) sebagai `camera: ^0.12.0+1`.
* **Konfigurasi Izin Android**: Wajib ditambahkan di berkas [AndroidManifest.xml](file:///d:/dubunote/dubunote-frontend/android/app/src/main/AndroidManifest.xml#L2-L3) agar sistem operasi Android mengizinkan aplikasi mengakses perangkat keras kamera:
  ```xml
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-feature android:name="android.hardware.camera" />
  ```
* **Penggunaan**: Di [scan_page.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/scan/scan_page.dart#L43-L60), fungsi `_initCamera()` memanggil `availableCameras()` lalu melakukan inisialisasi controller untuk menampilkan feed video realtime melalui widget `CameraPreview`.
---
### 10. flutter pub add path_provider
Package `path_provider` digunakan di frontend untuk mendeteksi jalur direktori penyimpanan lokal (baik di Android maupun iOS) secara aman:
* **Deklarasi dependencies**: Terdaftar di berkas [pubspec.yaml](file:///d:/dubunote/dubunote-frontend/pubspec.yaml#L39) sebagai `path_provider: ^2.1.5`.
* **Penggunaan**: Diimpor di [export_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/export/export_screen.dart#L4) untuk mendapatkan dua jenis folder:
  1. **Folder Dokumen Aplikasi (Permanen)**:
     `getApplicationDocumentsDirectory()` digunakan untuk menulis file hasil unduhan laporan keuangan yang disimpan secara permanen di perangkat pengguna.
  2. **Folder Sementara (Temporer)**:
     `getTemporaryDirectory()` digunakan untuk menulis file laporan sementara sebelum dibagikan lewat `share_plus` agar folder tidak dipenuhi sampah file.
---
### 11. Backend OCR (npm install tesseract.js) Scanning
Proses pemindaian teks pada nota belanja dilakukan di backend Node.js menggunakan engine OCR Tesseract.js:
* **Instalasi & Package**: Terdaftar di backend [package.json](file:///d:/dubunote/dubunote-backend/package.json#L23) sebagai `"tesseract.js": "^7.0.0"`.
* **Proses Scanning**:
  1. API menerima gambar nota via library `multer` di endpoint `/api/ocr/scan` yang dikelola di berkas [ocr.js](file:///d:/dubunote/dubunote-backend/routes/ocr.js#L29-L133).
  2. Gambar dibaca menggunakan model bahasa Indonesia ("ind"):
     ```javascript
     const { data: { text } } = await Tesseract.recognize(imagePath, "ind");
     ```
  3. **Ekstraksi Nama Toko**: Sistem menyaring baris awal teks nota yang memiliki panjang karakter > 4 dan mengandung huruf abjad untuk dijadikan nama toko.
  4. **Ekstraksi Total Belanja**: Sistem melakukan pencarian teks dari bawah ke atas (karena total selalu berada di bawah struk) mencari baris yang mengandung kata "TOTAL" (tapi bukan QTY/ITEM) lalu mengambil angka di baris tersebut menggunakan ekspresi reguler (Regex) `([\d.,]+)`.
---
### 12. Dimana Fitur Unduh pada Backend dan Frontendnya?
Fitur unduh laporan terintegrasi penuh antara frontend dan backend:
* **Di Backend (Node.js)**:
  * Terletak di berkas [transaksi.js](file:///d:/dubunote/dubunote-backend/routes/transaksi.js#L187-L283) pada endpoint `router.post("/export", ...)`.
  * Endpoint ini memfilter data transaksi di database MySQL berdasarkan input rentang waktu dan kategori.
  * Data tersebut dikonversi ke format dokumen pilihan menggunakan library pendukung:
    * **PDF**: Menggunakan library `pdfkit-table`.
    * **Excel**: Menggunakan library `exceljs`.
    * **CSV**: Menggunakan library `json2csv`.
  * Hasil konversi langsung dikirim kembali ke klien (Flutter) melalui HTTP response stream lengkap dengan header nama file (`Content-Disposition: attachment; filename=...`).
* **Di Frontend (Flutter)**:
  * Terletak di berkas [export_screen.dart](file:///d:/dubunote/dubunote-frontend/lib/screens/export/export_screen.dart#L149-L211) pada fungsi `_prosesUnduh()`.
  * Fungsi ini memanggil endpoint backend `/api/transaksi/export`, mengonversi data response bytes menjadi file fisik di folder penyimpanan perangkat, dan secara otomatis membukanya menggunakan package `open_filex` via perintah:
    ```dart
    await OpenFilex.open(filePath);
    ```
