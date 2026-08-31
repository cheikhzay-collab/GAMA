// scripts/batch_sql.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function escapeSqlString(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function jsonToSql(obj) {
  if (obj === null || obj === undefined) return 'NULL';
  return escapeSqlString(JSON.stringify(obj)) + '::jsonb';
}

const lessons = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'lessons.json'), 'utf8'));
const exams = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'exams.json'), 'utf8'));

const chunksDir = path.join(rootDir, 'scripts', 'sql_chunks');
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

// Split exams into batches of 4
for (let i = 0; i < exams.length; i += 4) {
  const batch = exams.slice(i, i + 4);
  const sql = batch.map(e => `INSERT INTO public.exams (id, name, school, year, tier, questions, pdf_url, is_active, is_archived, date_added, updated_at)
VALUES (
  ${escapeSqlString(e.id)},
  ${escapeSqlString(e.name || e.title)},
  ${escapeSqlString(e.school || '')},
  ${escapeSqlString(e.year || '')},
  ${escapeSqlString(e.tier || 'freemium')},
  ${jsonToSql(e.questions || [])},
  ${escapeSqlString(e.pdfUrl || e.pdf_url || '')},
  ${e.isActive !== undefined ? e.isActive : true},
  ${e.isArchived !== undefined ? e.isArchived : false},
  ${escapeSqlString(e.dateAdded || e.date_added || new Date().toISOString())},
  ${escapeSqlString(e.updatedAt || e.updated_at || new Date().toISOString())}
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  school = EXCLUDED.school,
  year = EXCLUDED.year,
  tier = EXCLUDED.tier,
  questions = EXCLUDED.questions,
  pdf_url = EXCLUDED.pdf_url,
  is_active = EXCLUDED.is_active,
  is_archived = EXCLUDED.is_archived,
  updated_at = EXCLUDED.updated_at;`).join('\n\n');
  
  fs.writeFileSync(path.join(chunksDir, `exams_batch_${i / 4 + 1}.sql`), sql);
}

// Split lessons into batches of 5
for (let i = 0; i < lessons.length; i += 5) {
  const batch = lessons.slice(i, i + 5);
  const sql = batch.map(l => `INSERT INTO public.lessons (id, title, subject, chapter_number, teacher, phone, schools, level, doc_type, content, is_active, is_archived, created_at, updated_at)
VALUES (
  ${escapeSqlString(l.id)},
  ${escapeSqlString(l.title)},
  ${escapeSqlString(l.subject || '')},
  ${escapeSqlString(l.chapterNumber || l.chapter_number || '')},
  ${escapeSqlString(l.teacher || '')},
  ${escapeSqlString(l.phone || '')},
  ${jsonToSql(l.schools || [])},
  ${escapeSqlString(l.level || l.content?.level || '')},
  ${escapeSqlString(l.docType || l.doc_type || l.content?.doc_type || 'course')},
  ${jsonToSql(l.content || {})},
  ${l.isActive !== undefined ? l.isActive : true},
  ${l.isArchived !== undefined ? l.isArchived : false},
  ${escapeSqlString(l.createdAt || l.created_at || new Date().toISOString())},
  ${escapeSqlString(l.updatedAt || l.updated_at || new Date().toISOString())}
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  subject = EXCLUDED.subject,
  chapter_number = EXCLUDED.chapter_number,
  teacher = EXCLUDED.teacher,
  phone = EXCLUDED.phone,
  schools = EXCLUDED.schools,
  level = EXCLUDED.level,
  doc_type = EXCLUDED.doc_type,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active,
  is_archived = EXCLUDED.is_archived,
  updated_at = EXCLUDED.updated_at;`).join('\n\n');

  fs.writeFileSync(path.join(chunksDir, `lessons_batch_${Math.floor(i / 5) + 1}.sql`), sql);
}

console.log('SQL batches generated in', chunksDir);
