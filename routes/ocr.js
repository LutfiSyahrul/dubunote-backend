const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const mysql = require("mysql2");
const Tesseract = require("tesseract.js"); // IMPORT MESIN OCR

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, "nota-" + Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

// ==========================================
// ENDPOINT UPLOAD & PROSES AI OCR ASLI
// ==========================================
router.post("/scan", upload.single("foto_nota"), async (req, res) => {
    const { pengguna_id } = req.body;

    if (!pengguna_id)
        return res.status(400).json({ pesan: "ID Pengguna wajib dikirim!" });
    if (!req.file)
        return res
            .status(400)
            .json({ pesan: "File foto nota tidak ditemukan!" });

    const urlGambar = `/uploads/${req.file.filename}`;
    const imagePath = path.join(__dirname, "../", req.file.path);

    try {
        // 1. JALANKAN MESIN TESSERACT OCR
        // Catatan: Proses ini butuh waktu beberapa detik tergantung spek laptop
        console.log("Mulai membaca gambar: ", req.file.filename);
        const {
            data: { text },
        } = await Tesseract.recognize(imagePath, "ind");
        console.log("Hasil Teks Mentah:\n", text);

        // 2. EKSTRAKSI DATA (PARSING) AI LEBIH PINTAR
        let namaToko = "Toko Tidak Dikenali";
        let totalHarga = 0;

        // Pisahkan teks per baris dan buang baris kosong
        const barisTeks = text
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        // --- MENCARI NAMA TOKO ---
        // Cari baris pertama yang hurufnya masuk akal (panjang > 4 dan ada huruf abjad)
        // Ini berguna untuk nge-skip karakter sampah (noise) logo di pucuk nota seperti "Pe--"
        for (let i = 0; i < barisTeks.length; i++) {
            let baris = barisTeks[i];
            if (baris.length > 4 && /[a-zA-Z]/.test(baris)) {
                namaToko = baris;
                break; // Ketemu tokonya, langsung stop pencarian!
            }
        }

        // MENCARI TOTAL HARGA 
        // Kita cari dari BAWAH ke ATAS, karena total belanja selalu ada di bawah
        for (let i = barisTeks.length - 1; i >= 0; i--) {
            let baris = barisTeks[i].toUpperCase();

            // Cari kata "TOTAL", tapi filter keras: JANGAN ambil baris yang ada kata "QTY" atau "ITEM"
            if (
                baris.includes("TOTAL") &&
                !baris.includes("QTY") &&
                !baris.includes("ITEM")
            ) {
                // Ambil semua kelompok angka di baris tersebut
                let match = baris.match(/([\d.,]+)/g);
                if (match) {
                    // Ambil kelompok angka paling belakang (biasanya formatnya: Total Rp 70.000)
                    let angkaKotor = match[match.length - 1];
                    let angkaBersih = angkaKotor.replace(/[^\d]/g, ""); // Buang titik/koma

                    // Validasi: Pastikan angkanya masuk akal (bukan cuma angka 1 atau 14)
                    if (parseInt(angkaBersih) > 100) {
                        totalHarga = parseInt(angkaBersih, 10);
                        break; // Ketemu harganya, langsung stop!
                    }
                }
            }
        }

        const dataTerurai = {
            toko: namaToko,
            total_harga: totalHarga || 0,
        };

        // 3. SIMPAN KE DATABASE
        const queryInsert = `INSERT INTO nota_ocr (pengguna_id, url_gambar, teks_mentah, json_terurai, status) VALUES (?, ?, ?, ?, 'SUKSES')`;
        db.query(
            queryInsert,
            [pengguna_id, urlGambar, text, JSON.stringify(dataTerurai)],
            (err, hasil) => {
                if (err)
                    return res.status(500).json({
                        pesan: "Gagal menyimpan data",
                        error: err.message,
                    });

                return res.status(200).json({
                    pesan: "Berhasil mengekstrak nota!",
                    nota_id: hasil.insertId,
                    url_gambar: urlGambar,
                    data_terurai: dataTerurai,
                });
            },
        );
    } catch (error) {
        console.error("OCR Error:", error);
        return res
            .status(500)
            .json({
                pesan: "Gagal membaca teks dari gambar",
                error: error.message,
            });
    }
});

module.exports = router;
