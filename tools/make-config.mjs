// Creates public/api/config.php with a fresh admin password and fresh secrets.
// usage (from the project folder):  node tools/make-config.mjs          creates it if missing
//                                    node tools/make-config.mjs --force  replaces it (new password)
// The password is printed once and never stored; only its keyed hash goes into config.php.
// Replacing config.php also changes the data key, so the site starts a new, empty database file.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'public', 'api', 'config.php');
const force = process.argv.includes('--force');

if (fs.existsSync(target) && !force) {
  console.log('public/api/config.php already exists. Use --force to replace it with a new password.');
  process.exit(0);
}

const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
const bytes = crypto.randomBytes(20);
const chunk = i => Array.from(bytes.subarray(i, i + 5)).map(b => alphabet[b % alphabet.length]).join('');
const password = `ngs-${chunk(0)}-${chunk(5)}-${chunk(10)}-${chunk(15)}`;
const salt = crypto.randomBytes(24).toString('hex');
const hash = crypto.createHmac('sha256', salt).update(password).digest('hex');

fs.writeFileSync(target, `<?php
/* Next Gen Summit private settings. Never served to browsers (see api/.htaccess)
   and never committed to git (see .gitignore). The admin password itself is not
   stored anywhere, only its keyed hash. */
declare(strict_types=1);

const NGS_ADMIN_SALT = '${salt}';
const NGS_ADMIN_HASH = '${hash}';
const NGS_SECRET = '${crypto.randomBytes(32).toString('hex')}';
const NGS_DATA_KEY = '${crypto.randomBytes(12).toString('hex')}';
`, 'utf8');

console.log('Created public/api/config.php');
console.log('Admin password (shown once, save it now): ' + password);
