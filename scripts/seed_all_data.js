// scripts/seed_all_data.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SUPABASE_URL = 'https://gnokmutjfanekaxjswew.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub2ttdXRqZmFuZWtheGpzd2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNjcxMTAsImV4cCI6MjEwMzc0MzExMH0.WrUhI2idk2lBw9ChG6IFd70JiuOci-UK0sYMXKwOYqA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runSeed() {
  console.log('🚀 Starting Data Seeding to Supabase...');

  // 1. Seed Exams
  try {
    const exams = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'exams.json'), 'utf8'));
    console.log(`Uploading ${exams.length} exams...`);
    for (let i = 0; i < exams.length; i++) {
      const exam = exams[i];
      const { error } = await supabase.rpc('admin_upsert_exam', { p_exam: exam });
      if (error) {
        console.error(`❌ Failed to upload exam ${exam.id}:`, error.message);
      } else {
        console.log(`✅ Exam [${i + 1}/${exams.length}] ${exam.name || exam.id} uploaded.`);
      }
    }
  } catch (err) {
    console.error('Error seeding exams:', err);
  }

  // 2. Seed Lessons
  try {
    const lessons = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'lessons.json'), 'utf8'));
    console.log(`\nUploading ${lessons.length} lessons...`);
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const { error } = await supabase.rpc('admin_upsert_lesson', { p_lesson: lesson });
      if (error) {
        console.error(`❌ Failed to upload lesson ${lesson.id}:`, error.message);
      } else {
        console.log(`✅ Lesson [${i + 1}/${lessons.length}] ${lesson.title || lesson.id} uploaded.`);
      }
    }
  } catch (err) {
    console.error('Error seeding lessons:', err);
  }

  console.log('\n🎉 Seeding complete!');
}

runSeed();
