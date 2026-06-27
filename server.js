require("dotenv").config();

const express = require("express");
const { createClient } = require("@libsql/client");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || "ohmypc_secret_key";

app.use(cors());
app.use(express.json());

// KONEKSI KE TURSO
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// BUAT TABEL (jalan sekali saat server start)
async function initDb() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        items TEXT NOT NULL,
        total_items INTEGER NOT NULL,
        total_harga REAL,
        metode_bayar TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Database & tabel siap (Turso)!");
  } catch (err) {
    console.error("❌ Gagal init database:", err.message);
  }
}

initDb();

// ========================
// REGISTER
// ========================
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.json({ success: false, message: "Semua field wajib diisi!" });

  if (password.length < 6)
    return res.json({ success: false, message: "Password minimal 6 karakter!" });

  try {
    const hashed = await bcrypt.hash(password, 10);

    await db.execute({
      sql: "INSERT INTO users (username, password) VALUES (?, ?)",
      args: [username, hashed],
    });

    res.json({
      success: true,
      message: "Registrasi berhasil!",
    });
  } catch (err) {
    // Kalau username sudah dipakai, libsql akan melempar error UNIQUE constraint
    res.json({
      success: false,
      message: "Username sudah dipakai!",
    });
  }
});

// ========================
// LOGIN
// ========================
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.json({
      success: false,
      message: "Semua field wajib diisi!",
    });

  try {
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE username = ?",
      args: [username],
    });

    const user = result.rows[0];

    if (!user)
      return res.json({
        success: false,
        message: "Username tidak ditemukan!",
      });

    const match = await bcrypt.compare(password, user.password);

    if (!match)
      return res.json({
        success: false,
        message: "Password salah!",
      });

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
      },
      SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      success: true,
      token,
      username: user.username,
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Terjadi kesalahan server!" });
  }
});

// ========================
// CEK TOKEN
// ========================
app.get("/api/me", (req, res) => {
  const auth = req.headers.authorization;

  if (!auth) return res.json({ success: false });

  try {
    const decoded = jwt.verify(auth.split(" ")[1], SECRET);

    res.json({
      success: true,
      username: decoded.username,
    });
  } catch {
    res.json({ success: false });
  }
});

// ========================
// CHECKOUT / BUAT ORDER
// ========================
app.post("/api/orders", async (req, res) => {
  const { items, total_items, total_harga, metode_bayar } = req.body;

  let username = "guest";

  const auth = req.headers.authorization;

  if (auth) {
    try {
      const decoded = jwt.verify(auth.split(" ")[1], SECRET);
      username = decoded.username;
    } catch {}
  }

  if (!items || !total_items)
    return res.json({
      success: false,
      message: "Data order tidak lengkap!",
    });

  try {
    const result = await db.execute({
      sql: "INSERT INTO orders (username, items, total_items, total_harga, metode_bayar) VALUES (?, ?, ?, ?, ?)",
      args: [
        username,
        JSON.stringify(items),
        total_items,
        total_harga,
        metode_bayar,
      ],
    });

    res.json({
      success: true,
      message: "Order berhasil!",
      order_id: Number(result.lastInsertRowid),
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Gagal menyimpan order!",
    });
  }
});

// ========================
// LIHAT SEMUA ORDER (admin)
// ========================
app.get("/api/orders", async (req, res) => {
  try {
    const result = await db.execute(
      "SELECT * FROM orders ORDER BY created_at DESC"
    );

    res.json({
      success: true,
      orders: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

// ========================
// JALANKAN SERVER
// ========================
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`🚀 Server jalan di port ${PORT}`);
  });
}

module.exports = app;