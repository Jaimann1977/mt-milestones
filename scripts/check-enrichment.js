const { parse } = require('csv-parse/sync');
const fs = require('fs');
const rows = parse(fs.readFileSync('data/milestones.csv', 'utf8'), { columns: true, bom: true });
const withNotes = rows.filter(r => r.Notes && r.Notes.trim() !== '');
const empty = rows.filter(r => !r.Notes || r.Notes.trim() === '');
console.log('Total rows:', rows.length);
console.log('With notes:', withNotes.length);
console.log('Still empty:', empty.length);
if (withNotes.length > 0) {
  console.log('\nSample note:');
  console.log(withNotes[0].Notes.slice(0, 200));
}
if (empty.length > 0) {
  console.log('\nFirst few empty rows:');
  empty.slice(0, 5).forEach(r => console.log(' -', r['Store Name'], '|', r['Event']));
}
