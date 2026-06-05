const Database = require('better-sqlite3');
const db = new Database('./server/database.sqlite');
const weapons = db.prepare("SELECT id, name, qualities FROM character_weapons").all();
console.log(JSON.stringify(weapons, null, 2));
