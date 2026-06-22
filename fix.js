const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./ohmypc.db");

db.serialize(() => {
  db.run("ALTER TABLE orders ADD COLUMN total_harga INTEGER DEFAULT 0", (err) => {
    if (err) console.log("total_harga:", err.message);
    else console.log("✅ total_harga ditambah");
  });
  db.run("ALTER TABLE orders ADD COLUMN metode_bayar TEXT DEFAULT ''", (err) => {
    if (err) console.log("metode_bayar:", err.message);
    else console.log("✅ metode_bayar ditambah");
    db.close();
  });
});