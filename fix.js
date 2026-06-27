const { createClient } = require("@libsql/client");

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
  try {
    await db.execute(
      "ALTER TABLE orders ADD COLUMN total_harga INTEGER DEFAULT 0"
    );
    console.log("✅ total_harga ditambah");
  } catch (err) {
    console.log("total_harga:", err.message);
  }

  try {
    await db.execute(
      "ALTER TABLE orders ADD COLUMN metode_bayar TEXT DEFAULT ''"
    );
    console.log("✅ metode_bayar ditambah");
  } catch (err) {
    console.log("metode_bayar:", err.message);
  }
}

migrate();