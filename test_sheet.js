const POWERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1lyE5dr0l18JeUxGj_jrkZ0P4bhj2VgYJbB3Oy5-0CrA/export?format=csv&gid=1431635962';

function parseCsvRows(csvText) {
  return csvText.split('\n').map(line => {
    const row = [];
    let currentCell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentCell.trim());
        currentCell = '';
      } else if (char !== '\r') {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    return row;
  });
}

fetch(POWERS_CSV_URL)
  .then(r => r.text())
  .then(text => {
    const rows = parseCsvRows(text);
    console.log("Total rows:", rows.length);
    console.log("Headers:", rows[0]);
    console.log("First item:", rows[1]);
  });
