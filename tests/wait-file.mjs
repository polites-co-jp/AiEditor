// Waits until a file exists and contains "TOTAL" (up to N seconds) and prints it. Usage: node tests/wait-file.mjs <file> [seconds]
import fs from 'node:fs';
const [file, secs = '500'] = process.argv.slice(2);
const end = Date.now() + Number(secs) * 1000;
const ready = () => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('TOTAL');
while (Date.now() < end && !ready()) await new Promise((r) => setTimeout(r, 2000));
if (ready()) process.stdout.write(fs.readFileSync(file, 'utf8'));
else console.log('not yet');
