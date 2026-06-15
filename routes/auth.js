const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const mysql = require("mysql2");

// Hubungkan ke database (bisa pakai koneksi yang sama)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// ==========================================
// 1. ENDPOINT REGISTRASI (DAFTAR AKUN)
// ==========================================
router.post("/daftar", async (req, res) => {
    const { nama, email, kata_sandi } = req.body;

    // Validasi input kosong
    if (!nama || !email || !kata_sandi) {
        return res.status(400).json({ pesan: "Semua data wajib diisi, Boy!" });
    }

    try {
        // Cek apakah email sudah terdaftar di database
        db.query(
            "SELECT email FROM pengguna WHERE email = ?",
            [email],
            async (err, hasil) => {
                if (err)
                    return res
                        .status(500)
                        .json({ pesan: "Error database", error: err.message });

                if (hasil.length > 0) {
                    return res
                        .status(400)
                        .json({
                            pesan: "Email ini sudah dipakai, gunakan email lain!",
                        });
                }

                // Enkripsi / Hashing password agar aman dari hacker
                const salt = await bcrypt.genSalt(10);
                const passwordHashed = await bcrypt.hash(kata_sandi, salt);

                // Simpan pengguna baru ke tabel 'pengguna'
                db.query(
                    "INSERT INTO pengguna (nama, email, kata_sandi) VALUES (?, ?, ?)",
                    [nama, email, passwordHashed],
                    (err, hasilInsert) => {
                        if (err)
                            return res
                                .status(500)
                                .json({
                                    pesan: "Gagal menyimpan pengguna",
                                    error: err.message,
                                });

                        return res.status(201).json({
                            pesan: "Akun DubuNote berhasil dibuat! Silakan login.",
                            id_pengguna: hasilInsert.insertId,
                        });
                    },
                );
            },
        );
    } catch (error) {
        res.status(500).json({ pesan: "Server Error", error: error.message });
    }
});

// ==========================================
// 2. ENDPOINT LOGIN (MASUK AKUN) - WITH FALLBACK
// ==========================================
router.post("/login", (req, res) => {
    const { email, kata_sandi } = req.body;

    if (!email || !kata_sandi) {
        return res
            .status(400)
            .json({ pesan: "Email dan password tidak boleh kosong!" });
    }

    // Cari pengguna berdasarkan email
    db.query(
        "SELECT * FROM pengguna WHERE email = ?",
        [email],
        async (err, hasil) => {
            if (err)
                return res
                    .status(500)
                    .json({ pesan: "Error database", error: err.message });

            // Jika pengguna tidak ditemukan
            if (hasil.length === 0) {
                return res
                    .status(401)
                    .json({ pesan: "Email atau password salah, Boy!" });
            }

            const pengguna = hasil[0];

            // 1. Cek pakai Bcrypt (Untuk akun baru / akun yang sudah ganti password)
            const isBcryptMatch = await bcrypt.compare(kata_sandi, pengguna.kata_sandi);
            
            // 2. Fallback: Cek manual teks biasa (Untuk akun lama)
            const isPlaintextMatch = (kata_sandi === pengguna.kata_sandi);

            // Jika kedua pengecekan GAGAL
            if (!isBcryptMatch && !isPlaintextMatch) {
                return res
                    .status(401)
                    .json({ pesan: "Email atau password salah, Boy!" });
            }

            // Login Sukses, kirim data pengguna ke Flutter
            return res.status(200).json({
                pesan: "Selamat Datang di DubuNote!",
                pengguna: {
                    id: pengguna.id,
                    nama: pengguna.nama,
                    email: pengguna.email,
                },
            });
        },
    );
});

module.exports = router;
