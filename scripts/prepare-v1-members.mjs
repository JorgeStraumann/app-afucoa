// Normaliza un CSV exportado de V1 sin escribir en Supabase.
// Uso: node scripts/prepare-v1-members.mjs entrada.csv [salida.csv]
import fs from 'node:fs';
import path from 'node:path';
import { prepareMemberCsv, preparedCsv } from './lib/pilot-members.mjs';
import { writeJsonAtomic } from './lib/pilot-cli.mjs';

const [,, input, output = 'members-v2.csv'] = process.argv;
if (!input) throw new Error('Indicá el CSV de entrada.');

const raw = fs.readFileSync(input, 'utf8');
const { accepted, rejected } = prepareMemberCsv(raw);
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
const temporary = `${output}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${preparedCsv(accepted)}\n`);
fs.renameSync(temporary, output);

const reportPath = `${output}.report.json`;
writeJsonAtomic(reportPath, {
  generated_at: new Date().toISOString(),
  input: path.resolve(input),
  output: path.resolve(output),
  summary: { input: accepted.length + rejected.length, accepted: accepted.length, rejected: rejected.length },
  rejected,
});

console.log(JSON.stringify({ accepted: accepted.length, rejected: rejected.length, output, report: reportPath }));
