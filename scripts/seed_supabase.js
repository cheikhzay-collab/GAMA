// scripts/seed_supabase.js
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

async function main() {
  console.log('--- Seeding Supabase Database ---');
  
  // 1. Seed Config
  try {
    const configRaw = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'config.json'), 'utf8'));
    console.log('Config keys loaded from config.json');
  } catch (e) {
    console.error('Error reading config.json:', e);
  }

  // 2. Seed Exams
  try {
    const exams = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'exams.json'), 'utf8'));
    console.log(`Found ${exams.length} exams.`);
  } catch (e) {
    console.error('Error reading exams.json:', e);
  }

  // 3. Seed Lessons
  try {
    const lessons = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'lessons.json'), 'utf8'));
    console.log(`Found ${lessons.length} lessons.`);
  } catch (e) {
    console.error('Error reading lessons.json:', e);
  }

  // 4. Seed Classes
  try {
    const classes = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'classes.json'), 'utf8'));
    console.log(`Found ${classes.length} classes.`);
  } catch (e) {
    console.error('Error reading classes.json:', e);
  }
}

main();
