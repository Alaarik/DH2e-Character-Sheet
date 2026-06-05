const Database = require('better-sqlite3');
const db = new Database('./data/charsheet.db');
const weapons = db.prepare("SELECT id, name, qualities FROM weapons").all();
console.log(JSON.stringify(weapons, null, 2));
