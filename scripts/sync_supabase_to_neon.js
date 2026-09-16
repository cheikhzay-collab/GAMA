// scripts/sync_supabase_to_neon.js
// Directly extract all live data from Supabase and insert it into Neon Serverless PostgreSQL
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { Client } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function getEnvValue(key) {
  if (process.env[key]) return process.env[key];
  const envFiles = ['.env.local', '.env'];
  for (const f of envFiles) {
    const p = path.join(rootDir, f);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (match && match[1]) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return null;
}

const SUPABASE_URL = getEnvValue('VITE_SUPABASE_URL');
const SUPABASE_KEY = getEnvValue('VITE_SUPABASE_ANON_KEY');
const NEON_URL = getEnvValue('NEON_DATABASE_URL');

async function sync() {
  console.log('\n=============================================================');
  console.log('       🔄 SUPABASE ➔ NEON DIRECT FULL DATA MIGRATION        ');
  console.log('=============================================================\n');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase credentials missing in .env.local');
    process.exit(1);
  }
  if (!NEON_URL) {
    console.error('❌ Neon database URL missing in .env.local');
    process.exit(1);
  }

  console.log('📡 Connecting to Supabase...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('📡 Connecting to Neon PostgreSQL...');
  const neon = new Client(NEON_URL);
  await neon.connect();
  console.log('✅ Connected to both databases successfully!\n');

  // 1. MIGRATE ALL LESSONS
  console.log('📚 Fetching all lessons from live Supabase...');
  const { data: supabaseLessons, error: lessonErr } = await supabase
    .from('lessons')
    .select('*');

  if (lessonErr) {
    console.error('❌ Failed to fetch lessons from Supabase:', lessonErr.message);
  } else if (Array.isArray(supabaseLessons)) {
    console.log(`📥 Retrieved ${supabaseLessons.length} lessons from Supabase.`);

    let inserted = 0;
    for (const l of supabaseLessons) {
      await neon.query(
        `INSERT INTO public.lessons (
          id, title, subject, chapter_number, teacher, phone, schools, level, doc_type, content, is_active, is_archived, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
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
          updated_at = EXCLUDED.updated_at;`,
        [
          String(l.id),
          l.title || 'Sans titre',
          l.subject || '',
          String(l.chapter_number || l.chapterNumber || ''),
          l.teacher || '',
          l.phone || '',
          JSON.stringify(l.schools || []),
          l.level || l.content?.level || '',
          l.doc_type || l.docType || 'course',
          JSON.stringify(l.content || {}),
          l.is_active !== undefined ? l.is_active : true,
          l.is_archived !== undefined ? l.is_archived : false,
          l.created_at || new Date().toISOString(),
          l.updated_at || new Date().toISOString()
        ]
      );
      inserted++;
      if (inserted % 15 === 0 || inserted === supabaseLessons.length) {
        process.stdout.write(`\r   -> Migrated ${inserted} / ${supabaseLessons.length} lessons to Neon...`);
      }
    }
    console.log(`\n✅ Finished migrating ${inserted} lessons to Neon.`);

    // Also update local data/lessons.json as a backup
    try {
      const localLessonsPath = path.join(rootDir, 'data', 'lessons.json');
      fs.writeFileSync(localLessonsPath, JSON.stringify(supabaseLessons, null, 2), 'utf8');
      console.log(`💾 Saved complete ${supabaseLessons.length} lessons to local backup (data/lessons.json).`);
    } catch (e) {
      console.warn('Could not update local lessons.json:', e.message);
    }
  }

  // 2. MIGRATE ALL EXAMS
  console.log('\n📝 Fetching all exams from live Supabase...');
  const { data: supabaseExams, error: examErr } = await supabase
    .from('exams')
    .select('*');

  if (examErr) {
    console.error('❌ Failed to fetch exams from Supabase:', examErr.message);
  } else if (Array.isArray(supabaseExams) && supabaseExams.length > 0) {
    console.log(`📥 Retrieved ${supabaseExams.length} exams from Supabase.`);
    let inserted = 0;
    for (const e of supabaseExams) {
      await neon.query(
        `INSERT INTO public.exams (
          id, name, school, level, year, tier, questions, pdf_url, is_active, is_archived, date_added, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          school = EXCLUDED.school,
          level = EXCLUDED.level,
          year = EXCLUDED.year,
          tier = EXCLUDED.tier,
          questions = EXCLUDED.questions,
          pdf_url = EXCLUDED.pdf_url,
          is_active = EXCLUDED.is_active,
          is_archived = EXCLUDED.is_archived,
          updated_at = EXCLUDED.updated_at;`,
        [
          String(e.id),
          e.name || 'Examen',
          e.school || '',
          e.level || '',
          String(e.year || ''),
          e.tier || 'freemium',
          JSON.stringify(e.questions || []),
          e.pdf_url || '',
          e.is_active !== undefined ? e.is_active : true,
          e.is_archived !== undefined ? e.is_archived : false,
          e.date_added || new Date().toISOString(),
          e.updated_at || new Date().toISOString()
        ]
      );
      inserted++;
    }
    console.log(`✅ Finished migrating ${inserted} exams to Neon.`);
  }

  // 3. MIGRATE ALL CLASSES
  console.log('\n🏫 Fetching all classes from live Supabase...');
  const { data: supabaseClasses, error: classErr } = await supabase
    .from('classes')
    .select('*');

  if (classErr) {
    console.error('❌ Failed to fetch classes from Supabase:', classErr.message);
  } else if (Array.isArray(supabaseClasses) && supabaseClasses.length > 0) {
    console.log(`📥 Retrieved ${supabaseClasses.length} classes from Supabase.`);
    let inserted = 0;
    for (const c of supabaseClasses) {
      await neon.query(
        `INSERT INTO public.classes (
          id, name, level, students, student_count, competitions, competition_grades,
          controls, grades, homework, language, program, created_at, updated_at
        ) VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12::jsonb, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
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
          updated_at = EXCLUDED.updated_at;`,
        [
          String(c.id),
          c.name || 'Sans titre',
          c.level || '',
          JSON.stringify(c.students || []),
          c.student_count || (c.students ? c.students.length : 0),
          JSON.stringify(c.competitions || []),
          JSON.stringify(c.competition_grades || {}),
          JSON.stringify(c.controls || []),
          JSON.stringify(c.grades || {}),
          JSON.stringify(c.homework || {}),
          c.language || 'fr',
          JSON.stringify(c.program || []),
          c.created_at || new Date().toISOString(),
          c.updated_at || new Date().toISOString()
        ]
      );
      inserted++;
    }
    console.log(`✅ Finished migrating ${inserted} classes to Neon.`);
  }

  // 4. MIGRATE ALL CONFIG
  console.log('\n⚙️  Fetching all configs from live Supabase...');
  const { data: supabaseConfig, error: configErr } = await supabase
    .from('config')
    .select('*');

  if (configErr) {
    console.error('❌ Failed to fetch config from Supabase:', configErr.message);
  } else if (Array.isArray(supabaseConfig) && supabaseConfig.length > 0) {
    console.log(`📥 Retrieved ${supabaseConfig.length} config entries from Supabase.`);
    let inserted = 0;
    for (const item of supabaseConfig) {
      await neon.query(
        `INSERT INTO public.config (key, value, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           updated_at = now();`,
        [item.key, JSON.stringify(item.value)]
      );
      inserted++;
    }
    console.log(`✅ Finished migrating ${inserted} config entries to Neon.`);
  }

  // 5. AUDIT FINAL COUNTS ON NEON
  console.log('\n=============================================================');
  console.log('           📊 FINAL LIVE NEON POSTGRESQL TOTALS              ');
  console.log('=============================================================');

  const tables = ['lessons', 'exams', 'classes', 'config', 'profiles'];
  for (const t of tables) {
    const res = await neon.query(`SELECT COUNT(*)::int as count FROM public.${t};`);
    console.log(`  • ${t.padEnd(20)} : ${res.rows[0].count} total rows in Neon`);
  }

  await neon.end();
  console.log('\n🎉 Direct Supabase to Neon synchronization complete!');
  console.log('=============================================================\n');
}

sync().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
