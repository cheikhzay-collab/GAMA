import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const exams = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'exams.json'), 'utf8'));

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function jsonToSql(obj) {
  if (obj === null || obj === undefined) return 'NULL';
  return escapeSql(JSON.stringify(obj)) + '::jsonb';
}

const statements = exams.map(e => `
INSERT INTO public.exams (id, name, school, level, year, tier, questions, pdf_url, is_active, is_archived, date_added, updated_at)
VALUES (
  ${escapeSql(e.id)},
  ${escapeSql(e.name || e.title)},
  ${escapeSql(e.school || '')},
  ${escapeSql(e.level || '')},
  ${escapeSql(e.year || '')},
  ${escapeSql(e.tier || 'freemium')},
  ${jsonToSql(e.questions || [])},
  ${escapeSql(e.pdfUrl || e.pdf_url || '')},
  ${e.isActive !== undefined ? e.isActive : true},
  ${e.isArchived !== undefined ? e.isArchived : false},
  ${escapeSql(e.dateAdded || e.date_added || new Date().toISOString())},
  ${escapeSql(e.updatedAt || e.updated_at || new Date().toISOString())}
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  school = EXCLUDED.school,
  level = EXCLUDED.level,
  year = EXCLUDED.year,
  tier = EXCLUDED.tier,
  questions = EXCLUDED.questions,
  pdf_url = EXCLUDED.pdf_url,
  is_active = EXCLUDED.is_active,
  is_archived = EXCLUDED.is_archived,
  updated_at = EXCLUDED.updated_at;
`);

fs.writeFileSync(path.join(__dirname, 'seed_exams_generated.sql'), statements.join('\n'));
console.log(`Generated ${statements.length} exam inserts in seed_exams_generated.sql`);
