// scripts/sync_settings_and_schedule.js
// Synchronize Timetable (جدول الحصص) and All Configurations across:
// 1. Neon PostgreSQL (public.config)
// 2. Supabase (public.config)
// 3. Local data/config.json (Companion DB)

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

const SUPABASE_URL = getEnvValue('VITE_SUPABASE_URL') || 'https://gnokmutjfanekaxjswew.supabase.co';
const SUPABASE_KEY = getEnvValue('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub2ttdXRqZmFuZWtheGpzd2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNjcxMTAsImV4cCI6MjEwMzc0MzExMH0.WrUhI2idk2lBw9ChG6IFd70JiuOci-UK0sYMXKwOYqA';
const NEON_URL = getEnvValue('NEON_DATABASE_URL');

async function runSync() {
  console.log('\n=============================================================');
  console.log('  🔄 SYNC TIMETABLE (جدول الحصص) & ALL SETTINGS (الإعدادات) ');
  console.log('=============================================================\n');

  if (!NEON_URL) {
    throw new Error('NEON_DATABASE_URL not found in .env.local');
  }

  // 1. Connect to Neon
  console.log('📡 Connecting to Neon PostgreSQL...');
  const neon = new Client(NEON_URL);
  await neon.connect();
  console.log('✅ Connected to Neon PostgreSQL.');

  // 2. Connect to Supabase
  console.log('📡 Connecting to Supabase...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('✅ Connected to Supabase.');

  // 3. Fetch all current configs from Neon
  console.log('\n📥 Reading configuration from Neon...');
  const neonRes = await neon.query('SELECT key, value, updated_at FROM public.config;');
  const neonMap = new Map();
  neonRes.rows.forEach(r => neonMap.set(r.key, r.value));
  console.log(`   Found ${neonMap.size} keys in Neon.`);

  // 4. Fetch all current configs from Supabase
  console.log('📥 Reading configuration from Supabase...');
  const { data: supaRows, error: supaErr } = await supabase.from('config').select('key, value, updated_at');
  if (supaErr) throw supaErr;
  const supaMap = new Map();
  (supaRows || []).forEach(r => supaMap.set(r.key, r.value));
  console.log(`   Found ${supaMap.size} keys in Supabase.`);

  // 5. Read local config.json if exists
  const configPath = path.join(rootDir, 'data', 'config.json');
  let localConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      localConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (_) {
      localConfig = {};
    }
  }

  // 6. Build Consolidated Master Configuration Map
  const masterConfig = {};

  // A. Teacher Schedule (جدول الحصص)
  // Neon has the latest complete 4-slot schedule
  const neonSchedule = neonMap.get('teacher_schedule_current') || {};
  const supaSchedule = supaMap.get('teacher_schedule_current') || {};
  const localSchedule = localConfig.teacher_schedule_current || {};
  masterConfig['teacher_schedule_current'] = {
    ...supaSchedule,
    ...localSchedule,
    ...neonSchedule
  };

  // B. School Holidays (العطل المدرسية)
  const neonHols = neonMap.get('school_holidays');
  const supaHols = supaMap.get('school_holidays');
  const localHols = localConfig.school_holidays;
  // Pick the most comprehensive array
  const allHols = Array.isArray(neonHols) && neonHols.length >= 10 
    ? neonHols 
    : (Array.isArray(localHols) && localHols.length >= 10 ? localHols : (supaHols || []));
  masterConfig['school_holidays'] = allHols;

  // C. Teacher Branding / Profile (هوية الأستاذ والمؤسسة)
  const neonBranding = neonMap.get('branding') || {};
  const supaBranding = supaMap.get('branding') || {};
  masterConfig['branding'] = {
    ...supaBranding,
    ...neonBranding
  };

  // D. AI Settings (إعدادات الذكاء الاصطناعي)
  const neonAi = neonMap.get('ai_settings') || {};
  const supaAi = supaMap.get('ai_settings') || {};
  masterConfig['ai_settings'] = {
    groqApiKey: neonAi.groqApiKey || supaAi.groqApiKey || '',
    claudeApiKey: neonAi.claudeApiKey || supaAi.claudeApiKey || '',
    geminiApiKey: supaAi.geminiApiKey || neonAi.geminiApiKey || '',
    openaiApiKey: neonAi.openaiApiKey || supaAi.openaiApiKey || '',
    claudeProxyUrl: neonAi.claudeProxyUrl || supaAi.claudeProxyUrl || '',
    deepseekApiKey: supaAi.deepseekApiKey || neonAi.deepseekApiKey || getEnvValue('VITE_DEEPSEEK_API_KEY') || '',
    deepseekApiUrl: supaAi.deepseekApiUrl || neonAi.deepseekApiUrl || 'https://api.deepseek.com',
    claude_solve_solutions: neonAi.claude_solve_solutions ?? supaAi.claude_solve_solutions ?? true,
    gemini_solve_solutions: neonAi.gemini_solve_solutions ?? supaAi.gemini_solve_solutions ?? true,
    deepseek_solve_solutions: neonAi.deepseek_solve_solutions ?? supaAi.deepseek_solve_solutions ?? true,
  };

  // E. Logbook Styling (إعدادات مظهر دفتر النصوص)
  const neonStyle = neonMap.get('logbook_style_settings') || {};
  const supaStyle = supaMap.get('logbook_style_settings') || {};
  masterConfig['logbook_style_settings'] = {
    arFont: neonStyle.arFont || supaStyle.arFont || 'UKIJ Merdane',
    frFont: neonStyle.frFont || supaStyle.frFont || 'Inter',
    fontSize: neonStyle.fontSize || supaStyle.fontSize || '0.9rem',
    lineHeight: neonStyle.lineHeight || supaStyle.lineHeight || 20,
    colorInk: neonStyle.colorInk || supaStyle.colorInk || '#334155',
    colorChapter: neonStyle.colorChapter || supaStyle.colorChapter || '#243f7f',
    colorAxis: neonStyle.colorAxis || supaStyle.colorAxis || '#0639a7',
    colorExercise: neonStyle.colorExercise || supaStyle.colorExercise || '#d97706'
  };

  // F. Logbook Entries (دفتر النصوص)
  const neonEntries = neonMap.get('logbook_entries') || [];
  const supaEntries = supaMap.get('logbook_entries') || [];
  const entryMap = new Map();
  (supaEntries || []).forEach(e => { if (e && e.id) entryMap.set(e.id, e); });
  (neonEntries || []).forEach(e => { if (e && e.id) entryMap.set(e.id, e); });
  masterConfig['logbook_entries'] = Array.from(entryMap.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // G. PDF Settings
  const neonPdf = neonMap.get('pdf_settings') || {};
  const supaPdf = supaMap.get('pdf_settings') || {};
  masterConfig['pdf_settings'] = {
    pdfFontSize: neonPdf.pdfFontSize || supaPdf.pdfFontSize || '11pt',
    pdfFontFamily: neonPdf.pdfFontFamily || supaPdf.pdfFontFamily || 'Computer Modern Serif',
    pdfPageMargins: neonPdf.pdfPageMargins || supaPdf.pdfPageMargins || 'standard',
    pdfShowSidebar: neonPdf.pdfShowSidebar ?? supaPdf.pdfShowSidebar ?? true,
    pdfTemplateStyle: neonPdf.pdfTemplateStyle || supaPdf.pdfTemplateStyle || 'classic_latex',
    pdfAvoidPageBreaks: neonPdf.pdfAvoidPageBreaks ?? supaPdf.pdfAvoidPageBreaks ?? true,
    pdfForcePrintColors: neonPdf.pdfForcePrintColors ?? supaPdf.pdfForcePrintColors ?? true
  };

  // H. Flashcard Settings
  const neonFlash = neonMap.get('flashcard_settings') || {};
  const supaFlash = supaMap.get('flashcard_settings') || {};
  masterConfig['flashcard_settings'] = {
    cardFontSize: neonFlash.cardFontSize || supaFlash.cardFontSize || '1rem',
    cardFontFamily: neonFlash.cardFontFamily || supaFlash.cardFontFamily || 'Computer Modern Serif',
    cardRevealMode: neonFlash.cardRevealMode || supaFlash.cardRevealMode || 'flip',
    cardFlipEnabled: neonFlash.cardFlipEnabled ?? supaFlash.cardFlipEnabled ?? true,
    cardAstuceWeight: neonFlash.cardAstuceWeight || supaFlash.cardAstuceWeight || '400',
    cardSoundEnabled: neonFlash.cardSoundEnabled ?? supaFlash.cardSoundEnabled ?? true,
    cardSwipeEnabled: neonFlash.cardSwipeEnabled ?? supaFlash.cardSwipeEnabled ?? true,
    cardOptionsWeight: neonFlash.cardOptionsWeight || supaFlash.cardOptionsWeight || '400',
    cardQuestionWeight: neonFlash.cardQuestionWeight || supaFlash.cardQuestionWeight || '400'
  };

  // I. OMR Settings
  masterConfig['omr_scanner_settings'] = { scannerDirectCapture: true };
  masterConfig['omr_settings'] = { scannerDirectCapture: true };

  // J. WhatsApp Settings
  const neonWa = neonMap.get('whatsapp_settings') || {};
  const supaWa = supaMap.get('whatsapp_settings') || {};
  masterConfig['whatsapp_settings'] = {
    enabled: neonWa.enabled ?? supaWa.enabled ?? true,
    message: neonWa.message || supaWa.message || "Bonjour, j'ai une question concernant la plateforme Gima.",
    position: neonWa.position || supaWa.position || 'right',
    phoneNumber: neonWa.phoneNumber || supaWa.phoneNumber || '',
    tooltipText: neonWa.tooltipText || supaWa.tooltipText || "Besoin d'aide ?"
  };

  // K. Schools, Branding, Plans, Activation Codes
  masterConfig['schools'] = neonMap.get('schools') || supaMap.get('schools') || [
    "2bac_sm", "2bac_pc_svt", "1bac_sci", "common_core_sci", "2bac_arts", "1bac_arts", "common_core_arts"
  ];
  masterConfig['schoolBranding'] = neonMap.get('schoolBranding') || supaMap.get('schoolBranding') || {};
  masterConfig['plans'] = neonMap.get('plans') || supaMap.get('plans') || [];
  masterConfig['activationCodes'] = neonMap.get('activationCodes') || supaMap.get('activationCodes') || [];

  const nowIso = new Date().toISOString();

  // 7. Write to Neon Database
  console.log('\n🚀 Writing consolidated configurations to Neon...');
  let neonUpdated = 0;
  for (const [key, value] of Object.entries(masterConfig)) {
    await neon.query(
      `INSERT INTO public.config (key, value, updated_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = EXCLUDED.updated_at;`,
      [key, JSON.stringify(value), nowIso]
    );
    neonUpdated++;
  }
  console.log(`✅ Neon updated: ${neonUpdated} keys saved.`);

  // 8. Write to Supabase Database
  console.log('\n🚀 Writing consolidated configurations to Supabase...');
  let supaUpdated = 0;
  for (const [key, value] of Object.entries(masterConfig)) {
    const { error } = await supabase
      .from('config')
      .upsert({
        key,
        value,
        updated_at: nowIso
      });
    if (error) {
      console.warn(`⚠️ Supabase error updating key '${key}':`, error.message);
    } else {
      supaUpdated++;
    }
  }
  console.log(`✅ Supabase updated: ${supaUpdated} keys saved.`);

  // 9. Write to data/config.json
  console.log('\n🚀 Writing to data/config.json...');
  fs.writeFileSync(configPath, JSON.stringify(masterConfig, null, 2), 'utf8');
  console.log(`✅ data/config.json updated with ${Object.keys(masterConfig).length} keys.`);

  await neon.end();

  console.log('\n=============================================================');
  console.log('🎉 SYNC COMPLETED SUCCESSFULLY!');
  console.log('   • Teacher Schedule: ' + Object.keys(masterConfig['teacher_schedule_current']).length + ' session slots');
  console.log('   • School Holidays: ' + masterConfig['school_holidays'].length + ' holidays');
  console.log('   • Logbook Entries: ' + masterConfig['logbook_entries'].length + ' entries');
  console.log('   • AI Keys: Gemini & DeepSeek synced');
  console.log('   • Branding: ' + masterConfig['branding'].profName + ' (' + masterConfig['branding'].profSchool + ')');
  console.log('=============================================================\n');
}

runSync().catch(err => {
  console.error('❌ Sync script failed:', err);
  process.exit(1);
});
