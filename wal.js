const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./ohmypc.db", (err) => {
  if (err) {
    console.error(err);
    return;
  }

  db.run("PRAGMA journal_mode=WAL;", (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("✅ Database sudah menggunakan WAL mode");
    }

    db.close();
  });
});