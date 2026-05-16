const db = require('better-sqlite3')('data/stockcell.db');
console.log(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='os_items'").get().sql);
