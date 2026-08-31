// scripts/generate_sql_inserts.js
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

function generateSql() {
  const exams = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'exams.json'), 'utf8'));
  const lessons = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'lessons.json'), 'utf8'));
  const classes = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'classes.json'), 'utf8'));

  // 1. Exams SQL
  const examInserts = exams.map(e => {
    return `INSERT INTO public.exams (id, name, school, year, tier, questions, pdf_url, is_active, is_archived, date_added, updated_at)
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
  updated_at = EXCLUDED.updated_at;`;
  });

  fs.writeFileSync(path.join(rootDir, 'scripts', 'seed_exams.sql'), examInserts.join('\n\n'));
  console.log(`Generated ${examInserts.length} exams SQL statements.`);

  // 2. Classes SQL
  const classInserts = classes.map(c => {
    return `INSERT INTO public.classes (id, name, level, students, student_count, competitions, competition_grades, controls, grades, homework, language, program, created_at, updated_at)
VALUES (
  ${escapeSqlString(c.id)},
  ${escapeSqlString(c.name)},
  ${escapeSqlString(c.level || '')},
  ${jsonToSql(c.students || [])},
  ${c.studentCount || (c.students ? c.students.length : 0)},
  ${jsonToSql(c.competitions || [])},
  ${jsonToSql(c.competitionGrades || c.competition_grades || {})},
  ${jsonToSql(c.controls || [])},
  ${jsonToSql(c.grades || {})},
  ${jsonToSql(c.homework || {})},
  ${escapeSqlString(c.language || 'fr')},
  ${jsonToSql(c.program || [])},
  ${escapeSqlString(c.createdAt || c.created_at || new Date().toISOString())},
  ${escapeSqlString(c.updatedAt || c.updated_at || new Date().toISOString())}
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  level = EXCLUDED.level,
  students = EXCLUDED.students,
  student_count = EXCLUDED.student_count,
  competitions = EXCLUDED.competitions,
  competition_grades = EXCLUDED.competition_grades,
  controls = EXCLUDED.controls,
  grades = EXCLUDED.grades,
  homework = EXCLUDED.homework,
  language = EXCLUDED.language,
  program = EXCLUDED.program,
  updated_at = EXCLUDED.updated_at;`;
  });

  fs.writeFileSync(path.join(rootDir, 'scripts', 'seed_classes.sql'), classInserts.join('\n\n'));
  console.log(`Generated ${classInserts.length} classes SQL statements.`);

  // 3. Lessons SQL
  const lessonInserts = lessons.map(l => {
    return `INSERT INTO public.lessons (id, title, subject, chapter_number, teacher, phone, schools, level, doc_type, content, is_active, is_archived, created_at, updated_at)
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
  updated_at = EXCLUDED.updated_at;`;
  });

  fs.writeFileSync(path.join(rootDir, 'scripts', 'seed_lessons.sql'), lessonInserts.join('\n\n'));
  console.log(`Generated ${lessonInserts.length} lessons SQL statements.`);
}

generateSql();
