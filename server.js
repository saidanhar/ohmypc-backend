const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || "ohmypc_secret_key";

app.use(cors());
app.use(express.json());

// BUAT DATABASE
const db = new sqlite3.Database("./ohmypc.db", (err) => {
  if (err) console.error(err);
  else console.log("✅ Database terhubung!");
});

// BUAT TABEL USER
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// BUAT TABEL ORDERS
db.run(`
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

// ========================
// REGISTER
// ========================
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.json({ success: false, message: "Semua field wajib diisi!" });

  if (password.length < 6)
    return res.json({ success: false, message: "Password minimal 6 karakter!" });

  const hashed = await bcrypt.hash(password, 10);

  db.run(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hashed],
    function (err) {
      if (err)
        return res.json({
          success: false,
          message: "Username sudah dipakai!",
        });

      res.json({
        success: true,
        message: "Registrasi berhasil!",
      });
    }
  );
});

// ========================
// LOGIN
// ========================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.json({
      success: false,
      message: "Semua field wajib diisi!",
    });

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (err || !user)
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
    }
  );
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
app.post("/api/orders", (req, res) => {
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

  db.run(
    "INSERT INTO orders (username, items, total_items, total_harga, metode_bayar) VALUES (?, ?, ?, ?, ?)",
    [
      username,
      JSON.stringify(items),
      total_items,
      total_harga,
      metode_bayar,
    ],
    function (err) {
      if (err)
        return res.json({
          success: false,
          message: "Gagal menyimpan order!",
        });

      res.json({
        success: true,
        message: "Order berhasil!",
        order_id: this.lastID,
      });
    }
  );
});

// ========================
// LIHAT SEMUA ORDER (admin)
// ========================
app.get("/api/orders", (req, res) => {
  db.all(
    "SELECT * FROM orders ORDER BY created_at DESC",
    [],
    (err, rows) => {
      if (err) return res.json({ success: false });

      res.json({
        success: true,
        orders: rows,
      });
    }
  );
});

// ========================
// JALANKAN SERVER
// ========================
app.listen(PORT, () => {
  console.log(`🚀 Server jalan di port ${PORT}`);
});