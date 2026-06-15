const express = require("express");
const router = express.Router();
const mysql = require("mysql2");
const PDFDocument = require("pdfkit-table");
const ExcelJS = require("exceljs");
const { Parser } = require("json2csv");

// Hubungkan ke database MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// =======================================================
// 1. ENDPOINT GET KATEGORI (Menampilkan Pilihan Kategori)
// =======================================================
router.get("/kategori", (req, res) => {
    db.query("SELECT * FROM kategori", (err, hasil) => {
        if (err)
            return res
                .status(500)
                .json({
                    pesan: "Gagal mengambil kategori",
                    error: err.message,
                });
        return res.status(200).json(hasil);
    });
});

// =======================================================
// 2. ENDPOINT POST TRANSAKSI (Menyimpan Pengeluaran Manual)
// =======================================================
router.post("/tambah", (req, res) => {
    const { pengguna_id, kategori_id, jumlah, keterangan, tanggal_transaksi } =
        req.body;

    // Validasi input wajib
    if (!pengguna_id || !kategori_id || !jumlah || !tanggal_transaksi) {
        return res
            .status(400)
            .json({ pesan: "Data utama pengeluaran wajib diisi, Boy!" });
    }

    // Query untuk memasukkan data ke tabel transaksi
    const queryInsert = `
        INSERT INTO transaksi (pengguna_id, kategori_id, jumlah, keterangan, tanggal_transaksi) 
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        queryInsert,
        [pengguna_id, kategori_id, jumlah, keterangan, tanggal_transaksi],
        (err, hasil) => {
            if (err)
                return res
                    .status(500)
                    .json({
                        pesan: "Gagal mencatat transaksi",
                        error: err.message,
                    });

            return res.status(201).json({
                pesan: "Pengeluaran berhasil dicatat di DubuNote!",
                id_transaksi: hasil.insertId,
            });
        },
    );
});



// =======================================================
// 3. ENDPOINT SUMMARY (Total Pengeluaran Bulan Ini & Grafik)
// =======================================================
router.get("/summary/:pengguna_id", (req, res) => {
    const userId = req.params.pengguna_id;
    const bulan = req.query.bulan; // Tangkap bulan dari Flutter
    const tahun = req.query.tahun; // Tangkap tahun dari Flutter
    
    // Query 1: Menghitung total jumlah transaksi di bulan yang dikirim
    const querySummary = `
        SELECT SUM(jumlah) as total_pengeluaran 
        FROM transaksi 
        WHERE pengguna_id = ? 
        AND MONTH(tanggal_transaksi) = ? 
        AND YEAR(tanggal_transaksi) = ?
    `;

    // Query 2: Menghitung total transaksi PER HARI untuk grafik
    const queryGrafik = `
        SELECT DAY(tanggal_transaksi) as tanggal, SUM(jumlah) as total 
        FROM transaksi 
        WHERE pengguna_id = ? 
        AND MONTH(tanggal_transaksi) = ? 
        AND YEAR(tanggal_transaksi) = ?
        GROUP BY DAY(tanggal_transaksi)
    `;

    db.query(querySummary, [userId, bulan, tahun], (err, hasilSummary) => {
        if (err) return res.status(500).json({ pesan: "Error server summary", error: err.message });
        
        db.query(queryGrafik, [userId, bulan, tahun], (err, hasilGrafik) => {
            if (err) return res.status(500).json({ pesan: "Error server grafik", error: err.message });
            
            return res.status(200).json({ 
                total_pengeluaran: hasilSummary[0].total_pengeluaran || 0,
                grafik_harian: hasilGrafik 
            });
        });
    });
});

// =======================================================
// 4. ENDPOINT AKTIVITAS TERKINI (5 Transaksi Terakhir)
// =======================================================
router.get("/terkini/:pengguna_id", (req, res) => {
    const userId = req.params.pengguna_id;

    // Menggunakan DATE_FORMAT agar terhindar dari bug zona waktu UTC Node.js
    const query = `
        SELECT t.id, t.jumlah, t.keterangan, DATE_FORMAT(t.tanggal_transaksi, '%Y-%m-%d') as tanggal_transaksi, k.nama_kategori 
        FROM transaksi t
        LEFT JOIN kategori k ON t.kategori_id = k.id
        WHERE t.pengguna_id = ?
        ORDER BY t.tanggal_transaksi DESC
        LIMIT 5
    `;

    db.query(query, [userId], (err, hasil) => {
        if (err) return res.status(500).json({ pesan: "Error server", error: err.message });
        return res.status(200).json(hasil);
    });
});

// =======================================================
// 5. ENDPOINT REFLEKSI (Total Harian, Bulanan, Tahunan & Grafik)
// =======================================================
router.get("/refleksi/:pengguna_id", (req, res) => {
    const userId = req.params.pengguna_id;
    // Tangkap data waktu super akurat dari Flutter
    const { tgl_hari_ini, tgl_kemarin, bulan_ini, bulan_lalu, tahun_ini, tahun_lalu } = req.query;

    const querySummary = `
        SELECT 
            SUM(CASE WHEN DATE(tanggal_transaksi) = ? THEN jumlah ELSE 0 END) AS total_hari_ini,
            SUM(CASE WHEN DATE(tanggal_transaksi) = ? THEN jumlah ELSE 0 END) AS total_kemarin,
            SUM(CASE WHEN MONTH(tanggal_transaksi) = ? AND YEAR(tanggal_transaksi) = ? THEN jumlah ELSE 0 END) AS total_bulan_ini,
            SUM(CASE WHEN MONTH(tanggal_transaksi) = ? AND YEAR(tanggal_transaksi) = ? THEN jumlah ELSE 0 END) AS total_bulan_lalu,
            SUM(CASE WHEN YEAR(tanggal_transaksi) = ? THEN jumlah ELSE 0 END) AS total_tahun_ini
        FROM transaksi
        WHERE pengguna_id = ?
    `;

    const queryGrafik = `
        SELECT MONTH(tanggal_transaksi) as bulan, SUM(jumlah) as total
        FROM transaksi
        WHERE pengguna_id = ? AND YEAR(tanggal_transaksi) = ?
        GROUP BY MONTH(tanggal_transaksi)
    `;

    db.query(querySummary, [tgl_hari_ini, tgl_kemarin, bulan_ini, tahun_ini, bulan_lalu, tahun_lalu, tahun_ini, userId], (err, hasilSummary) => {
        if (err) return res.status(500).json({ pesan: "Error server", error: err.message });
        
        db.query(queryGrafik, [userId, tahun_ini], (err, hasilGrafik) => {
            if (err) return res.status(500).json({ pesan: "Error grafik", error: err.message });
            
            const data = hasilSummary[0];
            return res.status(200).json({
                total_hari_ini: data.total_hari_ini || 0,
                total_kemarin: data.total_kemarin || 0,
                total_bulan_ini: data.total_bulan_ini || 0,
                total_bulan_lalu: data.total_bulan_lalu || 0,
                total_tahun_ini: data.total_tahun_ini || 0,
                grafik_tahunan: hasilGrafik 
            });
        });
    });
});



// =======================================================
// 6. ENDPOINT EXPORT (Cetak PDF, Excel, CSV)
// =======================================================
router.post("/export", async (req, res) => {
    const { pengguna_id, rentang, tahun, bulan, tanggal_lengkap, kategori, format } = req.body;

    // >>> MENGGUNAKAN DATE_FORMAT AGAR ZONA WAKTU AMAN 100% <<<
    let query = `
        SELECT DATE_FORMAT(t.tanggal_transaksi, '%Y-%m-%d') as tanggal, k.nama_kategori, t.keterangan, t.jumlah
        FROM transaksi t
        LEFT JOIN kategori k ON t.kategori_id = k.id
        WHERE t.pengguna_id = ?
    `;
    let params = [pengguna_id];

    if (kategori && kategori !== 'Semua Kategori') {
        query += ` AND k.nama_kategori = ?`;
        params.push(kategori);
    }

    if (rentang === 'Tahunan') {
        query += ` AND YEAR(t.tanggal_transaksi) = ?`;
        params.push(tahun);
    } else if (rentang === 'Bulanan') {
        query += ` AND YEAR(t.tanggal_transaksi) = ? AND MONTH(t.tanggal_transaksi) = ?`;
        params.push(tahun, bulan);
    } else if (rentang === 'Harian') {
        query += ` AND DATE(t.tanggal_transaksi) = ?`;
        params.push(tanggal_lengkap); 
    }

    query += ` ORDER BY t.tanggal_transaksi DESC`;

    db.query(query, params, async (err, hasil) => {
        if (err) return res.status(500).json({ pesan: "Gagal menarik data", error: err.message });
        if (hasil.length === 0) return res.status(404).json({ pesan: "Tidak ada data pada rentang/kategori ini" });

        const fileName = `DubuNote_${rentang}_${kategori.replace(/\s+/g, '')}`;

        try {
            // --- GENERATOR CSV ---
            if (format === 'CSV') {
                const json2csvParser = new Parser();
                const csv = json2csvParser.parse(hasil);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=${fileName}.csv`);
                return res.status(200).send(csv);
            }

            // --- GENERATOR EXCEL (.xlsx) ---
            if (format === 'Excel') {
                const workbook = new ExcelJS.Workbook();
                const sheet = workbook.addWorksheet('Laporan Keuangan');
                
                sheet.columns = [
                    { header: 'Tanggal', key: 'tanggal', width: 15 },
                    { header: 'Kategori', key: 'nama_kategori', width: 20 },
                    { header: 'Keterangan', key: 'keterangan', width: 35 },
                    { header: 'Jumlah (Rp)', key: 'jumlah', width: 15 },
                ];
                
                sheet.addRows(hasil);
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=${fileName}.xlsx`);
                return workbook.xlsx.write(res).then(() => res.status(200).end());
            }

            // --- GENERATOR PDF ---
            if (format === 'PDF') {
                const doc = new PDFDocument({ margin: 30, size: 'A4' });
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=${fileName}.pdf`);
                doc.pipe(res);

                doc.fontSize(20).text('Laporan Keuangan DubuNote', { align: 'center' });
                doc.moveDown();
                doc.fontSize(12).text(`Rentang: ${rentang} | Kategori: ${kategori}`, { align: 'center' });
                doc.moveDown(2);

                const table = {
                    headers: ["Tanggal", "Kategori", "Keterangan", "Nominal (Rp)"],
                    rows: hasil.map(item => [
                        item.tanggal, // <<< LANGSUNG CETAK TANPA UBAH ZONA WAKTU
                        item.nama_kategori || 'Lainnya',
                        item.keterangan || '-',
                        item.jumlah.toString()
                    ])
                };
                
                await doc.table(table, { width: 500 });
                doc.end();
                return;
            }

        } catch (error) {
            return res.status(500).json({ pesan: "Gagal membuat dokumen", error: error.message });
        }
    });
});


// =======================================================
// 7. ENDPOINT RIWAYAT PENGELUARAN (Filter Dinamis)
// =======================================================
router.post("/riwayat", (req, res) => {
    const { pengguna_id, bulan, tahun, kategori, search } = req.body;

    // Base query
    let query = `
        SELECT t.tanggal_transaksi, k.nama_kategori, t.keterangan, t.jumlah
        FROM transaksi t
        LEFT JOIN kategori k ON t.kategori_id = k.id
        WHERE t.pengguna_id = ? AND MONTH(t.tanggal_transaksi) = ? AND YEAR(t.tanggal_transaksi) = ?
    `;
    let params = [pengguna_id, bulan, tahun];

    // Filter Kategori (Jika bukan "Semua")
    if (kategori && kategori !== 'Semua') {
        query += ` AND k.nama_kategori = ?`;
        params.push(kategori);
    }

    // Filter Pencarian (Jika ada teks yang diketik)
    if (search) {
        query += ` AND t.keterangan LIKE ?`;
        params.push(`%${search}%`);
    }

    query += ` ORDER BY t.tanggal_transaksi DESC`;

    db.query(query, params, (err, hasil) => {
        if (err) return res.status(500).json({ pesan: "Error server", error: err.message });
        
        // Hitung total pengeluaran dari hasil filter ini
        const totalPengeluaran = hasil.reduce((sum, item) => sum + item.jumlah, 0);

        return res.status(200).json({
            total_pengeluaran: totalPengeluaran,
            data: hasil
        });
    });
});



// WAJIB TARUH DI BARIS PALING BAWAH FILE 
module.exports = router;