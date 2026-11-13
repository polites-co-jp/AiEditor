// Waits until a file exists (up to N seconds) and prints it. Usage: node tests/build/wait-file.mjs <file> [seconds]
import fs from 'node:fs';
const [file, secs = '500'] = process.argv.slice(2);
const end = Date.now() + Number(secs) * 1000;
while (Date.now() < end && !fs.existsSync(file)) await new Promise((r) => setTimeout(r, 2000));
if (fs.existsSync(file)) {
  await new Promise((r) => setTimeout(r, 500));
  process.stdout.write(fs.readFileSync(file, 'utf8'));
} else {
  console.log('not yet');
}
