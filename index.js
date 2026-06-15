const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");

// Konfigurasi Environment
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Koneksi ke Database MySQL Laragon
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Tes Hubungan ke MySQL
db.connect((err) => {
    if (err) {
        console.error("Gagal terhubung ke MySQL Laragon:", err.message);
        return;
    }
    console.log("Database MySQL Berhasil Terhubung.");
});

// Endpoint Utama untuk Tes Browser
app.get("/", (req, res) => {
    res.send("Backend DubuNote ");
});

// Import rute autentikasi
const authRoutes = require('./routes/auth');
// Gunakan rute tersebut dengan prefix '/api/auth'
app.use('/api/auth', authRoutes);

// Import rute transaksi
const transaksiRoutes = require('./routes/transaksi');
// Gunakan rute transaksi dengan prefix '/api/transaksi'
app.use('/api/transaksi', transaksiRoutes);

const ocrRoutes = require("./routes/ocr");
app.use("/api/ocr", ocrRoutes);
app.use("/uploads", express.static("uploads"));

// Menjalankan Server
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});

// ENDPOINT AMBIL DATA PROFIL
app.get('/api/pengguna/:id', (req, res) => {
    const userId = req.params.id;
    db.query('SELECT nama, email FROM pengguna WHERE id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "User tidak ditemukan" });
        res.json(results[0]);
    });
});

// ENDPOINT UPDATE DATA PROFIL
app.put('/api/pengguna/:id', (req, res) => {
    const userId = req.params.id;
    const { nama, email } = req.body;

    const query = 'UPDATE pengguna SET nama = ?, email = ? WHERE id = ?';
    db.query(query, [nama, email, userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.affectedRows === 0) return res.status(404).json({ message: "User tidak ditemukan" });
        res.json({ message: "Profil berhasil diperbarui!" });
    });
});

// ENDPOINT UBAH KATA SANDI (DENGAN BCRYPT HASHING)
app.put("/api/pengguna/password/:id", async (req, res) => {
    const userId = req.params.id;
    const { password_lama, password_baru } = req.body;

    db.query(
        "SELECT kata_sandi FROM pengguna WHERE id = ?",
        [userId],
        async (err, results) => {
            if (err)
                return res
                    .status(500)
                    .json({ message: "Error database", error: err.message });
            if (results.length === 0)
                return res
                    .status(404)
                    .json({ message: "User tidak ditemukan" });

            const user = results[0];

            try {
                // 1. CEK KECOCOKAN KATA SANDI LAMA
                let isMatch = false;

                // Fallback: Cek teks biasa dulu (untuk akun lama yang password-nya belum di-hash)
                if (password_lama === user.kata_sandi) {
                    isMatch = true;
                } else {
                    // Kalau beda, coba cek pakai bcrypt (untuk akun baru)
                    // Pakai try-catch kecil agar server tidak crash jika format hash salah
                    try {
                        isMatch = await bcrypt.compare(
                            password_lama,
                            user.kata_sandi,
                        );
                    } catch (e) {
                        isMatch = false;
                    }
                }

                // Jika dua-duanya tidak cocok
                if (!isMatch) {
                    return res
                        .status(400)
                        .json({ message: "Kata sandi lama salah!" });
                }

                // 2. ENKRIPSI KATA SANDI BARU
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password_baru, salt);

                // 3. SIMPAN KE DATABASE
                db.query(
                    "UPDATE pengguna SET kata_sandi = ? WHERE id = ?",
                    [hashedPassword, userId],
                    (err, updateResults) => {
                        if (err)
                            return res
                                .status(500)
                                .json({
                                    message: "Gagal mengupdate database",
                                    error: err.message,
                                });
                        res.status(200).json({
                            message: "Kata sandi berhasil diperbarui!",
                        });
                    },
                );
            } catch (error) {
                return res
                    .status(500)
                    .json({ message: "Terjadi kesalahan pada server" });
            }
        },
    );
});