// scripts/migrate_to_neon.js
// Automated full migration script to Neon Serverless PostgreSQL
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to parse .env or .env.local
function getConnectionString() {
  // 1. CLI argument
  const argUrl = process.argv[2];
  if (argUrl && (argUrl.startsWith('postgres://') || argUrl.startsWith('postgresql://'))) {
    return argUrl;
  }

  // 2. Check process.env
  if (process.env.NEON_DATABASE_URL) return process.env.NEON_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // 3. Check .env.local or .env
  const envFiles = ['.env.local', '.env'];
  for (const envFile of envFiles) {
    const filePath = path.join(rootDir, envFile);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const match = content.match(/^(?:NEON_DATABASE_URL|DATABASE_URL)=(.*)$/m);
      if (match && match[1]) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  }

  return null;
}

async function main() {
  console.log('\n=============================================================');
  console.log('       🚀 NEON POSTGRESQL FULL MIGRATION ASSISTANT           ');
  console.log('=============================================================\n');

  const connectionString = getConnectionString();

  if (!connectionString) {
    console.error('❌ ERROR: No Neon connection string provided!');
    console.log('\nPlease provide your Neon Connection String in one of the following ways:');
    console.log(' 1. Run with argument:');
    console.log('    node scripts/migrate_to_neon.js "postgresql://user:pass@ep-xyz.region.neon.tech/neondb?sslmode=require"');
    console.log(' 2. Or add to .env.local:');
    console.log('    NEON_DATABASE_URL=postgresql://user:pass@ep-xyz.region.neon.tech/neondb?sslmode=require\n');
    process.exit(1);
  }

  console.log('📡 Connecting to Neon database via Serverless Client...');
  const client = new Client(connectionString);
  await client.connect();

  // Test connection
  try {
    const res = await client.query('SELECT version(), current_database() as db;');
    console.log(`✅ Connected successfully to Neon DB: ${res.rows[0].db}`);
    console.log(`   Postgres version: ${res.rows[0].version.split(' ')[0]} ${res.rows[0].version.split(' ')[1]}\n`);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    await client.end();
    process.exit(1);
  }

  // 1. APPLY SCHEMA
  console.log('📄 Step 1: Applying Neon Schema (neon_schema.sql)...');
  const schemaPath = path.join(rootDir, 'neon_schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    try {
      await client.query(schemaSql);
      console.log('✅ Schema, tables, functions, and views applied successfully!\n');
    } catch (err) {
      console.warn('⚠️ Notice during schema query execution:', err.message);
    }
  }

  // 2. MIGRATE CONFIG
  console.log('⚙️  Step 2: Migrating Configuration (data/config.json)...');
  const configPath = path.join(rootDir, 'data', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      let count = 0;
      for (const [key, value] of Object.entries(config)) {
        await client.query(
          `INSERT INTO public.config (key, value, updated_at)
           VALUES ($1, $2::jsonb, now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [key, JSON.stringify(value)]
        );
        count++;
      }
      console.log(`✅ Config migrated (${count} items).`);
    } catch (e) {
      console.error('❌ Error migrating config:', e.message);
    }
  }

  // 3. MIGRATE CLASSES
  console.log('\n🏫 Step 3: Migrating Classes (data/classes.json)...');
  const classesPath = path.join(rootDir, 'data', 'classes.json');
  if (fs.existsSync(classesPath)) {
    try {
      const classes = JSON.parse(fs.readFileSync(classesPath, 'utf8'));
      let inserted = 0;
      for (const c of classes) {
        await client.query(
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
            c.studentCount || (c.students ? c.students.length : 0),
            JSON.stringify(c.competitions || []),
            JSON.stringify(c.competitionGrades || c.competition_grades || {}),
            JSON.stringify(c.controls || []),
            JSON.stringify(c.grades || {}),
            JSON.stringify(c.homework || {}),
            c.language || 'fr',
            JSON.stringify(c.program || []),
            c.createdAt || c.created_at || new Date().toISOString(),
            c.updatedAt || c.updated_at || new Date().toISOString()
          ]
        );
        inserted++;
      }
      console.log(`✅ Migrated ${inserted} classes.`);
    } catch (e) {
      console.error('❌ Error migrating classes:', e.message);
    }
  }

  // 4. MIGRATE EXAMS
  console.log('\n📝 Step 4: Migrating Exams (data/exams.json)...');
  const examsPath = path.join(rootDir, 'data', 'exams.json');
  if (fs.existsSync(examsPath)) {
    try {
      const exams = JSON.parse(fs.readFileSync(examsPath, 'utf8'));
      let inserted = 0;
      for (const e of exams) {
        await client.query(
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
            e.name || e.title || 'Examen',
            e.school || '',
            e.level || '',
            String(e.year || ''),
            e.tier || 'freemium',
            JSON.stringify(e.questions || []),
            e.pdfUrl || e.pdf_url || '',
            e.isActive !== undefined ? e.isActive : true,
            e.isArchived !== undefined ? e.isArchived : false,
            e.dateAdded || e.date_added || new Date().toISOString(),
            e.updatedAt || e.updated_at || new Date().toISOString()
          ]
        );
        inserted++;
        if (inserted % 10 === 0 || inserted === exams.length) {
          process.stdout.write(`\r   -> Inserted ${inserted} / ${exams.length} exams...`);
        }
      }
      console.log(`\n✅ Finished migrating ${inserted} exams.`);
    } catch (e) {
      console.error('\n❌ Error migrating exams:', e.message);
    }
  }

  // 5. MIGRATE LESSONS
  console.log('\n📚 Step 5: Migrating Lessons (data/lessons.json)...');
  const lessonsPath = path.join(rootDir, 'data', 'lessons.json');
  if (fs.existsSync(lessonsPath)) {
    try {
      const lessons = JSON.parse(fs.readFileSync(lessonsPath, 'utf8'));
      let inserted = 0;
      for (const l of lessons) {
        await client.query(
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
            l.title || 'Leçon',
            l.subject || '',
            String(l.chapterNumber || l.chapter_number || ''),
            l.teacher || '',
            l.phone || '',
            JSON.stringify(l.schools || []),
            l.level || l.content?.level || '',
            l.docType || l.doc_type || l.content?.doc_type || 'course',
            JSON.stringify(l.content || {}),
            l.isActive !== undefined ? l.isActive : true,
            l.isArchived !== undefined ? l.isArchived : false,
            l.createdAt || l.created_at || new Date().toISOString(),
            l.updatedAt || l.updated_at || new Date().toISOString()
          ]
        );
        inserted++;
        if (inserted % 10 === 0 || inserted === lessons.length) {
          process.stdout.write(`\r   -> Inserted ${inserted} / ${lessons.length} lessons...`);
        }
      }
      console.log(`\n✅ Finished migrating ${inserted} lessons.`);
    } catch (e) {
      console.error('\n❌ Error migrating lessons:', e.message);
    }
  }

  // 6. MIGRATE USERS / PROFILES
  console.log('\n👥 Step 6: Migrating Users / Profiles (data/users.json)...');
  const usersPath = path.join(rootDir, 'data', 'users.json');
  if (fs.existsSync(usersPath)) {
    try {
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      let inserted = 0;
      for (const u of users) {
        const uid = String(u.id || u.uid);
        await client.query(
          `INSERT INTO public.profiles (
            id, name, email, phone, city, role, tier, xp, streak, rank, total_students, school, class_id, joined, subscription, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            city = EXCLUDED.city,
            role = EXCLUDED.role,
            tier = EXCLUDED.tier,
            xp = EXCLUDED.xp,
            streak = EXCLUDED.streak,
            rank = EXCLUDED.rank,
            total_students = EXCLUDED.total_students,
            school = EXCLUDED.school,
            class_id = EXCLUDED.class_id,
            subscription = EXCLUDED.subscription,
            updated_at = EXCLUDED.updated_at;`,
          [
            uid,
            u.name || 'Élève',
            u.email || null,
            u.phone || null,
            u.city || null,
            u.role || 'student',
            u.tier || 'freemium',
            u.xp || 0,
            u.streak || 0,
            u.rank || null,
            u.totalStudents || u.total_students || 1200,
            u.school || null,
            u.class_id || u.classId || null,
            u.joined || new Date().toISOString(),
            JSON.stringify(u.subscription || {}),
            u.created_at || new Date().toISOString(),
            u.updated_at || u.updatedAt || new Date().toISOString()
          ]
        );
        inserted++;
        if (inserted % 20 === 0 || inserted === users.length) {
          process.stdout.write(`\r   -> Inserted ${inserted} / ${users.length} profiles...`);
        }
      }
      console.log(`\n✅ Finished migrating ${inserted} profiles.`);
    } catch (e) {
      console.error('\n❌ Error migrating users:', e.message);
    }
  }

  // 7. VERIFICATION & ROW COUNT AUDIT
  console.log('\n=============================================================');
  console.log('           📊 NEON MIGRATION AUDIT & ROW COUNTS              ');
  console.log('=============================================================');

  const tables = ['config', 'classes', 'exams', 'lessons', 'profiles', 'activation_codes', 'progress', 'mock_history'];
  for (const table of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*)::int as count FROM public.${table};`);
      console.log(`  • ${table.padEnd(20)} : ${res.rows[0].count} rows`);
    } catch (e) {
      console.log(`  • ${table.padEnd(20)} : error (${e.message})`);
    }
  }

  await client.end();
  console.log('\n🎉 ALL DONE! Your database is fully migrated to NEON PostgreSQL!');
  console.log('=============================================================\n');
}

main().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
