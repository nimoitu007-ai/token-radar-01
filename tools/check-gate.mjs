// Local replica of the token-radar-01 gate's seven checks.
// Usage: node tools/check-gate.mjs <out-dir> [--snapshot <snapshot.json>]
// Exits 0 when all seven pass, 1 otherwise. Reads only; writes nothing.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from '../vendor/makefun-board.ts';

const out = process.argv[2] ?? 'out';
const snapArg = process.argv.indexOf('--snapshot');
const snapFile = snapArg >= 0 ? process.argv[snapArg + 1] : null;
const snap = snapFile ? JSON.parse(readFileSync(snapFile, 'utf8')) : null;

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++;
  else fail++;
}

const NET = /https?:\/\//;
// 1. dashboard_files
{
  const dir = join(out, 'dashboard');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile()) : [];
  const hasHtml = files.includes('index.html');
  const hasCss = files.some((f) => f.endsWith('.css'));
  const hasJs = files.some((f) => f.endsWith('.js'));
  let bad = null;
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    if (f.endsWith('.html')) {
      const attrs = [...text.matchAll(/<[^>]+(?:href|src|action|poster)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
      if (attrs.some((a) => NET.test(a))) { bad = `${f}: network address in attribute`; break; }
    }
    if (f.endsWith('.css') && NET.test(text)) { bad = `${f}: network address in CSS`; break; }
    if (f.endsWith('.js') && /(?:from\s+['"]|import\s*\(['"]|require\s*\(['"])[^'"]*https?:\/\//.test(text)) { bad = `${f}: network import`; break; }
  }
  check('dashboard_files', hasHtml && hasCss && hasJs && files.length <= 400 && bad === null, `${files.length} files${bad ? `, ${bad}` : ''}`);
}
// 2-5. board
let board = null;
{
  const raw = readFileSync(join(out, 'board.json'), 'utf8');
  const parsed = JSON.parse(raw);
  board = Array.isArray(parsed) ? parsed : parsed.rows;
  const rowsOk = board.length >= 100 && board.length <= 4000;
  const eachOk = board.every((r) =>
    typeof r.slug === 'string' && r.slug && !/\s/.test(r.slug) &&
    typeof r.name === 'string' && r.name.length > 0 &&
    Number.isSafeInteger(r.rank) && r.rank > 0 &&
    Number.isSafeInteger(r.implied_value_usd) && r.implied_value_usd > 0 && r.implied_value_usd <= 1e14 &&
    Array.isArray(r.farm_steps));
  const inSnap = snap ? board.every((r) => snap.protocols.some((p) => p.slug === r.slug)) : true;
  const distinct = new Set(board.map((r) => r.implied_value_usd)).size > 1 || board.length < 2;
  check('board_file', rowsOk && eachOk && inSnap && distinct, `${board.length} rows`);
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  const ranksOk = ranks.every((v, i) => v === i + 1);
  const sortedOk = board.every((r, i) => i === 0 || r.implied_value_usd <= board[i - 1].implied_value_usd);
  check('sorted_by_value', ranksOk && sortedOk, `ranks 1..${board.length}, non-increasing implied value`);
  if (snap) {
    const slugs = new Set(board.map((r) => r.slug));
    const missing = snap.watchlist.filter((s) => !slugs.has(s));
    check('coverage', missing.length === 0, missing.length === 0 ? `all ${snap.watchlist.length} watchlist slugs` : `missing ${missing.slice(0, 5).join(', ')}`);
  } else {
    check('coverage', false, 'no snapshot given, pass --snapshot');
  }
  const stepsOk = board.every((r) => r.farm_steps.length >= 3 && r.farm_steps.length <= 12 && r.farm_steps.every((s) => s.trim().length >= 20 && s.trim().length <= 600));
  check('farm_steps', stepsOk, '3-12 steps, 20-600 chars each');
}
// 6. screenshots
{
  const dir = join(out, 'screenshots');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')) : [];
  let ok = files.length >= 3 && files.length <= 4;
  let detail = `${files.length} images`;
  for (const f of files) {
    const buf = readFileSync(join(dir, f));
    if (buf.length > 524288) { ok = false; detail += `, ${f} over 512 KiB`; }
    const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50;
    const isJpg = buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8;
    if (!isPng && !isJpg) { ok = false; detail += `, ${f} not PNG/JPEG`; }
    if (isPng) {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      if (Math.max(w, h) > 1440 || Math.min(w, h) < 800) { ok = false; detail += `, ${f} is ${w}x${h}`; }
      else detail += `, ${f} ${w}x${h} ${Math.round(buf.length / 1024)} KiB`;
    }
  }
  check('screenshots', ok, detail);
}
// 7. dossier_matches
{
  const expected = buildDossier(out, { text_max_bytes: 65536, screenshots: { max: 4, max_bytes: 524288 }, dashboard: { max_files: 400, max_bytes: 4194304 } });
  const actual = readFileSync(join(out, 'dossier.json'));
  check('dossier_matches', Buffer.compare(Buffer.from(expected), actual) === 0, `${actual.length} bytes`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
