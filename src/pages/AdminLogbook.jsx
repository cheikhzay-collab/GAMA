// src/pages/AdminLogbook.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Trash2, Edit, Printer, Calendar, BookOpen, Clock, Tag, AlertCircle,
  User, ArrowLeft, FileText, CheckCircle2, ClipboardList, X, Check, Save, Sparkles,
  Eye, EyeOff, Settings
} from 'lucide-react';
import { getAllClasses } from '../services/classService';
import { getActiveLessons } from '../services/lessonService';
import { 
  getLogbookEntries, addLogbookEntry, updateLogbookEntry, deleteLogbookEntry 
} from '../services/logbookService';
import { renderWithMath } from '../utils/mathRenderer';
import { openLogbookPrintWindow } from '../utils/generateLogbookPDF';


// Convert **bold** markdown to React strong elements
const parseBold = (text) => {
  if (!text || !text.includes('**')) return text;
  const parts = text.split(/\*\*/);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} style={{ fontWeight: 800 }}>{part}</strong> : part
  );
};


const SYSTEM_LEVELS = [
  { id: 'common_core_sci', label: 'Tronc Commun Scientifique' },
  { id: 'common_core_arts', label: 'Tronc Commun Lettres' },
  { id: '1bac_sci', label: '1ère Année Bac Sciences' },
  { id: '1bac_arts', label: '1ère Année Bac Lettres' },
  { id: '2bac_pc_svt', label: '2ème Année Bac PC / SVT' },
  { id: '2bac_sm', label: '2ème Année Bac Sciences Math' }
];

const WEEKDAYS_MAP = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi'
};

const CLASS_COLORS = [
  '#0f4c81', // Classic Navy Blue (like in the photo)
  '#065f46', // Dark Emerald Green
  '#7c2d12', // Dark Amber Rust
  '#4c1d95', // Deep Purple
  '#1e3a8a', // Dark Royal Blue
  '#831843', // Deep Rose/Magenta
  '#0369a1'  // Ocean Blue
];

const getClassColor = (cls) => {
  if (!cls) return '#0f4c81';
  let hash = 0;
  for (let i = 0; i < cls.name.length; i++) {
    hash = cls.name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % CLASS_COLORS.length;
  return CLASS_COLORS[idx];
};

const getShortLevelLabel = (levelId) => {
  if (levelId === 'common_core_sci') return 'TCS';
  if (levelId === 'common_core_arts') return 'TCL';
  if (levelId === '1bac_sci') return '1Bac';
  if (levelId === '1bac_arts') return '1Bac Lettres';
  if (levelId === '2bac_pc_svt') return '2Bac';
  if (levelId === '2bac_sm') return '2Bac SM';
  return levelId || '';
};

const getAcademicYearDates = (date = new Date()) => {
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1; // 1-indexed
  let startYear, endYear;
  if (currentMonth >= 9) { // September to December
    startYear = currentYear;
    endYear = currentYear + 1;
  } else { // January to August
    startYear = currentYear - 1;
    endYear = currentYear;
  }
  const startDate = new Date(`${startYear}-09-01T00:00:00`);
  const endDate = new Date(`${endYear}-08-31T23:59:59`);
  const label = `${startYear}/${endYear}`;
  return { startDate, endDate, label };
};

const getAcademicYearMonths = () => {
  const today = new Date();
  const currentAcademicYear = getAcademicYearDates(today);
  const start = currentAcademicYear.startDate;
  const end = new Date(Math.min(today.getTime(), currentAcademicYear.endDate.getTime()));

  const months = [];
  let current = new Date(start.getFullYear(), start.getMonth(), 1);

  const monthNamesAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 
    'يوليوز', 'غشت', 'شتمبر', 'أكتوبر', 'نونبر', 'دجنبر'
  ];

  while (current <= end) {
    const year = current.getFullYear();
    const monthIndex = current.getMonth();
    const month = monthIndex + 1; // 1-indexed
    const formatted = `${year}-${String(month).padStart(2, '0')}`;
    
    const dateLabel = current.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const capitalizedLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
    const labelAr = `${monthNamesAr[monthIndex]} ${year}`;

    months.push({
      value: formatted,
      labelFr: capitalizedLabel,
      labelAr: labelAr
    });
    
    current.setMonth(current.getMonth() + 1);
  }
  
  return months.reverse();
};

const parseLocalDate = (dateStr, isEnd = false) => {
  if (!dateStr) return new Date(NaN);
  const [year, month, day] = dateStr.split('-').map(Number);
  const hour = isEnd ? 23 : 0;
  const minute = isEnd ? 59 : 0;
  const second = isEnd ? 59 : 0;
  const ms = isEnd ? 999 : 0;
  return new Date(year, month - 1, day, hour, minute, second, ms);
};

const formatLocalDate = (date = new Date()) => {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isTimeOverlapping = (slotTime, entryTime) => {
  if (!entryTime || !slotTime) return false;
  const slotNums = slotTime.match(/\d+/g)?.map(Number) || [];
  const entryHours = entryTime.split('-').map(t => {
    const hrMatch = t.match(/(\d+)(?::\d+)?/);
    return hrMatch ? parseInt(hrMatch[1], 10) : null;
  }).filter(h => h !== null);
  
  if (slotNums.length >= 2 && entryHours.length >= 2) {
    const [sStart, sEnd] = slotNums;
    const [eStart, eEnd] = entryHours;
    return Math.max(sStart, eStart) < Math.min(sEnd, eEnd);
  }
  const slotStartStr = slotNums[0]?.toString().padStart(2, '0') || '';
  return entryTime.includes(slotStartStr) || entryTime.includes(slotNums[0]?.toString() || '');
};

const getSelectedComponents = (compString) => {
  if (!compString || typeof compString !== 'string') return [];
  return compString.split(/\s*[\+&]\s*/).map(s => s.trim());
};

const getTranslatedComponent = (comp, isAr) => {
  if (!comp) return '';
  const map = {
    'Cours': isAr ? 'درس' : 'Cours',
    'Exercices': isAr ? 'تمارين' : 'Exercices',
    'Contrôle': isAr ? 'فرض' : 'Contrôle',
    'Activité': isAr ? 'نشاط' : 'Activité'
  };
  return comp.split(/\s*\+\s*/).map(c => map[c] || c).join(isAr ? ' + ' : ' + ');
};

const checkTimeOverlap = (t1, t2) => {
  if (!t1 || !t2) return false;
  const getRange = (t) => {
    const nums = t.match(/\d+/g)?.map(Number) || [];
    if (nums.length >= 2) {
      const parts = t.split('-').map(p => {
        const matches = p.match(/(\d+)(?::(\d+))?/);
        if (matches) {
          const h = parseInt(matches[1], 10);
          const m = matches[2] ? parseInt(matches[2], 10) / 60 : 0;
          return h + m;
        }
        return null;
      }).filter(x => x !== null);
      if (parts.length >= 2) return [parts[0], parts[1]];
    }
    const first = nums[0];
    const last = nums[nums.length - 2] || nums[nums.length - 1];
    return [first, last];
  };

  const range1 = getRange(t1);
  const range2 = getRange(t2);

  if (range1 && range2) {
    const [start1, end1] = range1;
    const [start2, end2] = range2;
    return Math.max(start1, start2) < Math.min(end1, end2);
  }
  return false;
};

const normalizeLevel = (rawLevel) => {
  if (!rawLevel) return '2bac_pc_svt';
  const normalized = rawLevel.toLowerCase().trim();
  
  if (normalized.includes('common_core_sci') || normalized.includes('common-core-sci')) return 'common_core_sci';
  if (normalized.includes('common_core_arts') || normalized.includes('common-core-arts')) return 'common_core_arts';
  if (normalized.includes('1bac_sci') || normalized.includes('1bac-sci')) return '1bac_sci';
  if (normalized.includes('1bac_arts') || normalized.includes('1bac-arts')) return '1bac_arts';
  if (normalized.includes('2bac_sm') || normalized.includes('2bac-sm')) return '2bac_sm';
  if (normalized.includes('2bac_pc_svt') || normalized.includes('2bac-pc-svt') || normalized.includes('2bac_pc/svt')) return '2bac_pc_svt';
  if (normalized.includes('2bac_arts') || normalized.includes('2bac-arts')) return '2bac_arts';

  if (normalized.includes('sm') || normalized.includes('math') || normalized.includes('رياضية')) {
    return '2bac_sm';
  }
  if (normalized.includes('pc') || normalized.includes('svt') || normalized.includes('تجريبية')) {
    return '2bac_pc_svt';
  }
  if (normalized.includes('2bac') || normalized.includes('ثانية باك')) {
    if (normalized.includes('letter') || normalized.includes('art') || normalized.includes('آداب') || normalized.includes('إنسانية')) {
      return '2bac_arts';
    }
    return '2bac_pc_svt';
  }
  if (normalized.includes('1bac') || normalized.includes('أولى باك') || normalized.includes('1ère bac') || normalized.includes('première bac')) {
    if (normalized.includes('letter') || normalized.includes('art') || normalized.includes('آداب') || normalized.includes('إنسانية')) {
      return '1bac_arts';
    }
    return '1bac_sci';
  }
  if (normalized.includes('commun') || normalized.includes('tc') || normalized.includes('مشترك')) {
    if (normalized.includes('letter') || normalized.includes('art') || normalized.includes('آداب') || normalized.includes('إنسانية')) {
      return 'common_core_arts';
    }
    return 'common_core_sci';
  }
  
  const validKeys = ['common_core_sci', 'common_core_arts', '1bac_sci', '1bac_arts', '2bac_sm', '2bac_pc_svt', '2bac_arts'];
  if (validKeys.includes(rawLevel)) {
    return rawLevel;
  }
  
  return '2bac_pc_svt';
};

export default function AdminLogbook() {
  const { profName } = useAuth();
  
  // State
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [entries, setEntries] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [levelLessons, setLevelLessons] = useState([]);
  const [activeSessionSuggestion, setActiveSessionSuggestion] = useState(null);
  const [missingSessions, setMissingSessions] = useState([]);
  const [missingDaysFilter, setMissingDaysFilter] = useState('30days');

  // Timetable and calendar configurations state
  const [schedule, setSchedule] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [absences, setAbsences] = useState([]);
  
  // Style states
  const [arFont, setArFont] = useState('UKIJ Merdane');
  const [frFont, setFrFont] = useState('Outfit');
  const [baseFontSize, setBaseFontSize] = useState('0.8rem');
  const [gridLineHeight, setGridLineHeight] = useState(20);
  const [colorInk, setColorInk] = useState('#334155');
  const [colorChapter, setColorChapter] = useState('#0f172a');
  const [colorAxis, setColorAxis] = useState('#2563eb');
  const [colorExercise, setColorExercise] = useState('#d97706');

  // Control settings modal open & tabs
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('timetable'); // 'timetable' | 'holidays' | 'absences' | 'style'

  // Temp states for unsaved modal changes
  const [tempSchedule, setTempSchedule] = useState({});
  const [tempHolidays, setTempHolidays] = useState([]);
  const [tempAbsences, setTempAbsences] = useState([]);
  const [tempArFont, setTempArFont] = useState('UKIJ Merdane');
  const [tempFrFont, setTempFrFont] = useState('Outfit');
  const [tempBaseFontSize, setTempBaseFontSize] = useState('0.8rem');
  const [tempGridLineHeight, setTempGridLineHeight] = useState(20);
  const [tempColorInk, setTempColorInk] = useState('#334155');
  const [tempColorChapter, setTempColorChapter] = useState('#0f172a');
  const [tempColorAxis, setTempColorAxis] = useState('#2563eb');
  const [tempColorExercise, setTempColorExercise] = useState('#d97706');

  // Temp forms for adding holiday/absence
  const [holidayLabel, setHolidayLabel] = useState('');
  const [holidayStart, setHolidayStart] = useState('');
  const [holidayEnd, setHolidayEnd] = useState('');

  const [absenceType, setAbsenceType] = useState('Maladie');
  const [absenceReason, setAbsenceReason] = useState('');
  const [absenceStart, setAbsenceStart] = useState('');
  const [absenceEnd, setAbsenceEnd] = useState('');

  const handleTempScheduleChange = (slotKey, field, value) => {
    setTempSchedule(prev => ({
      ...prev,
      [slotKey]: {
        ...(prev[slotKey] || {}),
        [field]: value
      }
    }));
  };

  const handleAddHoliday = () => {
    if (!holidayLabel || !holidayStart || !holidayEnd) return;
    const newHol = {
      id: `hol-${Date.now()}`,
      label: holidayLabel,
      startDate: holidayStart,
      endDate: holidayEnd
    };
    setTempHolidays([...tempHolidays, newHol]);
    setHolidayLabel('');
    setHolidayStart('');
    setHolidayEnd('');
  };

  const handleAddAbsence = () => {
    if (!absenceStart || !absenceEnd) return;
    const newAbs = {
      id: `abs-${Date.now()}`,
      type: absenceType,
      reason: absenceReason,
      startDate: absenceStart,
      endDate: absenceEnd
    };
    setTempAbsences([...tempAbsences, newAbs]);
    setAbsenceReason('');
    setAbsenceStart('');
    setAbsenceEnd('');
  };

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('teacher_schedule_current', JSON.stringify(tempSchedule));
      setSchedule(tempSchedule);

      localStorage.setItem('school_holidays', JSON.stringify(tempHolidays));
      setHolidays(tempHolidays);

      localStorage.setItem('teacher_absences', JSON.stringify(tempAbsences));
      setAbsences(tempAbsences);

      localStorage.setItem('logbook_ar_font', tempArFont);
      setArFont(tempArFont);
      
      localStorage.setItem('logbook_fr_font', tempFrFont);
      setFrFont(tempFrFont);
      
      localStorage.setItem('logbook_font_size', tempBaseFontSize);
      setBaseFontSize(tempBaseFontSize);
      
      localStorage.setItem('logbook_line_height', String(tempGridLineHeight));
      setGridLineHeight(tempGridLineHeight);
      
      localStorage.setItem('logbook_color_ink', tempColorInk);
      setColorInk(tempColorInk);
      
      localStorage.setItem('logbook_color_chapter', tempColorChapter);
      setColorChapter(tempColorChapter);
      
      localStorage.setItem('logbook_color_axis', tempColorAxis);
      setColorAxis(tempColorAxis);
      
      localStorage.setItem('logbook_color_exercise', tempColorExercise);
      setColorExercise(tempColorExercise);

      setSettingsModalOpen(false);
      setSuccess(isArMode ? 'تم تحديث الإعدادات والجدول بنجاح!' : 'Paramètres mis à jour avec succès !');
      setTimeout(() => setSuccess(''), 3000);
      
      scanMissingSessions();
    } catch (e) {
      console.error("Error saving settings:", e);
      setError(isArMode ? 'حدث خطأ أثناء حفظ الإعدادات.' : 'Erreur lors de l\'enregistrement des paramètres.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const displayMissingSessions = useMemo(() => {
    let filtered = missingSessions;
    
    if (selectedClass) {
      filtered = filtered.filter(s => s.class && s.class.id === selectedClass.id);
    }
    
    if (missingDaysFilter === '30days') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(s => {
        const sessionDate = new Date(s.date);
        return sessionDate >= thirtyDaysAgo && sessionDate <= today;
      });
    } else {
      filtered = filtered.filter(s => s.date.startsWith(missingDaysFilter));
    }
    
    return filtered;
  }, [missingSessions, selectedClass, missingDaysFilter]);
  const [missingPanelOpen, setMissingPanelOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewSections, setPreviewSections] = useState({});

  const toggleSectionPreview = (sectionId) => {
    setPreviewSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const getSectionContentString = (s) => {
    if (!s) return '';
    if (s.content) {
      return s.content;
    }
    if (s.items && s.items.length > 0) {
      return s.items.map(item => item.text || '').filter(t => t.trim() !== '').join('\n');
    }
    return '';
  };

  const insertSectionContent = (s) => {
    const contentToInsert = getSectionContentString(s);
    if (!contentToInsert) return;
    
    setFormData(prev => {
      let currentContent = prev.customContent;
      if (currentContent.trim() === '') {
        currentContent = contentToInsert;
      } else {
        currentContent = currentContent.endsWith('\n') 
          ? `${currentContent}${contentToInsert}` 
          : `${currentContent}\n${contentToInsert}`;
      }
      
      // Check the checkbox if not checked
      const nextSections = prev.selectedSections.includes(s.title)
        ? prev.selectedSections
        : [...prev.selectedSections, s.title];

      return {
        ...prev,
        selectedSections: nextSections,
        customContent: currentContent
      };
    });
  };
  
  // Form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null); // null for new entry
  const [formData, setFormData] = useState({
    date: formatLocalDate(),
    time: '08:00 - 10:00',
    component: 'Cours',
    subject: 'Mathématiques',
    lessonId: '',
    selectedSections: [],
    customContent: '',
    isHeaderSéance: false
  });
  
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Load classes and all lessons on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const cls = await getAllClasses();
        setClasses(cls || []);
        
        const lsns = await getActiveLessons();
        setLessons(lsns || []);
      } catch (err) {
        console.error("Error loading data:", err);
      }
    };
    initData();
  }, []);

  // Initialize configurations from localStorage on mount
  useEffect(() => {
    try {
      const sched = localStorage.getItem('teacher_schedule_current');
      if (sched) setSchedule(JSON.parse(sched));
      
      const hols = localStorage.getItem('school_holidays');
      if (hols) setHolidays(JSON.parse(hols));
      
      const abs = localStorage.getItem('teacher_absences');
      if (abs) setAbsences(JSON.parse(abs));
      
      setArFont(localStorage.getItem('logbook_ar_font') || 'UKIJ Merdane');
      setFrFont(localStorage.getItem('logbook_fr_font') || 'Outfit');
      setBaseFontSize(localStorage.getItem('logbook_font_size') || '0.8rem');
      setGridLineHeight(parseInt(localStorage.getItem('logbook_line_height') || '20', 10));
      setColorInk(localStorage.getItem('logbook_color_ink') || '#334155');
      setColorChapter(localStorage.getItem('logbook_color_chapter') || '#0f172a');
      setColorAxis(localStorage.getItem('logbook_color_axis') || '#2563eb');
      setColorExercise(localStorage.getItem('logbook_color_exercise') || '#d97706');
    } catch (e) {
      console.error("Error loading schedule settings:", e);
    }
  }, []);

  // Sync temp states when settings modal opens
  useEffect(() => {
    if (settingsModalOpen) {
      setTempSchedule({ ...schedule });
      setTempHolidays([...holidays]);
      setTempAbsences([...absences]);
      setTempArFont(arFont);
      setTempFrFont(frFont);
      setTempBaseFontSize(baseFontSize);
      setTempGridLineHeight(gridLineHeight);
      setTempColorInk(colorInk);
      setTempColorChapter(colorChapter);
      setTempColorAxis(colorAxis);
      setTempColorExercise(colorExercise);
    }
  }, [settingsModalOpen, schedule, holidays, absences, arFont, frFont, baseFontSize, gridLineHeight, colorInk, colorChapter, colorAxis, colorExercise]);

  // Auto-detect current session from schedule
  useEffect(() => {
    const checkActiveSession = () => {
      const now = new Date();
      const dayNum = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
      const dayName = WEEKDAYS_MAP[dayNum];
      if (!dayName) return; // Sunday

      const currentHour = now.getHours();
      // Find matching hour slot from schedule
      let activeSlot = null;
      if (currentHour >= 8 && currentHour < 9) activeSlot = '08-09';
      else if (currentHour >= 9 && currentHour < 10) activeSlot = '09-10';
      else if (currentHour >= 10 && currentHour < 11) activeSlot = '10-11';
      else if (currentHour >= 11 && currentHour < 12) activeSlot = '11-12';
      else if (currentHour >= 14 && currentHour < 15) activeSlot = '14-15';
      else if (currentHour >= 15 && currentHour < 16) activeSlot = '15-16';
      else if (currentHour >= 16 && currentHour < 17) activeSlot = '16-17';
      else if (currentHour >= 17 && currentHour < 18) activeSlot = '17-18';

      if (!activeSlot) return;

      const slotKey = `${dayName}-${activeSlot}`;
      const slotData = schedule[slotKey];
      if (slotData && slotData.classId) {
        const matchingClass = classes.find(c => c.name === slotData.classId);
        if (matchingClass) {
          setActiveSessionSuggestion({
            class: matchingClass,
            time: `${activeSlot.replace('-', 'h - ')}h`,
            rawSlot: activeSlot,
            room: slotData.room || '—',
            day: dayName
          });
        }
      } else {
        setActiveSessionSuggestion(null);
      }
    };

    if (classes.length > 0) {
      checkActiveSession();
    }
  }, [classes, schedule]);

  // Scan for missing sessions
  const scanMissingSessions = () => {
    if (!schedule || Object.keys(schedule).length === 0) {
      setMissingSessions([]);
      return;
    }

    const savedEntries = localStorage.getItem('logbook_entries');
    const allEntries = savedEntries ? JSON.parse(savedEntries) : [];

    const list = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkAcademicYear = getAcademicYearDates(today);

    if (missingDaysFilter === '30days') {
      // Scan last 30 calendar days
      for (let i = 1; i <= 30; i++) {
        const scanDate = new Date();
        scanDate.setDate(today.getDate() - i);
        scanDate.setHours(0, 0, 0, 0);

        // Exclude outside academic year
        if (scanDate < checkAcademicYear.startDate || scanDate > checkAcademicYear.endDate) {
          continue;
        }

        // Exclude Sunday
        const dayNum = scanDate.getDay();
        if (dayNum === 0) continue;

        const dayName = WEEKDAYS_MAP[dayNum];
        if (!dayName) continue;

        const dateStr = formatLocalDate(scanDate);

        // Exclude Holidays
        const isHoliday = holidays.some(h => {
          const start = parseLocalDate(h.startDate, false);
          const end = parseLocalDate(h.endDate, true);
          return scanDate >= start && scanDate <= end;
        });
        if (isHoliday) continue;

        // Exclude Teacher Absences
        const isAbsent = absences.some(a => {
          const start = parseLocalDate(a.startDate, false);
          const end = parseLocalDate(a.endDate, true);
          return scanDate >= start && scanDate <= end;
        });
        if (isAbsent) continue;

        // Find schedule slots
        const daySlots = Object.keys(schedule).filter(k => k.startsWith(`${dayName}-`));

        daySlots.forEach(slotKey => {
          const slotData = schedule[slotKey];
          if (slotData && slotData.classId) {
            const slotTime = slotKey.split('-').slice(1).join('-');
            
            const matchingClass = classes.find(c => c.name === slotData.classId);
            if (!matchingClass) return;

            const hasEntry = allEntries.some(e => {
              if (e.classId !== matchingClass.id) return false;
              if (e.date !== dateStr) return false;
              return isTimeOverlapping(slotTime, e.time);
            });

            if (!hasEntry) {
              list.push({
                id: `${dateStr}-${slotKey}`,
                date: dateStr,
                dayName,
                time: slotTime,
                class: matchingClass,
                room: slotData.room || '—'
              });
            }
          }
        });
      }
    } else {
      // Scan specific month (YYYY-MM)
      const [yearStr, monthStr] = missingDaysFilter.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1; // 0-indexed month

      // Get number of days in this month
      const numDays = new Date(year, month + 1, 0).getDate();

      for (let d = 1; d <= numDays; d++) {
        const scanDate = new Date(year, month, d);
        scanDate.setHours(0, 0, 0, 0);

        // Do not scan future dates
        if (scanDate > today) continue;

        // Exclude outside academic year
        if (scanDate < checkAcademicYear.startDate || scanDate > checkAcademicYear.endDate) {
          continue;
        }

        // Exclude Sunday
        const dayNum = scanDate.getDay();
        if (dayNum === 0) continue;

        const dayName = WEEKDAYS_MAP[dayNum];
        if (!dayName) continue;

        const dateStr = formatLocalDate(scanDate);

        // Exclude Holidays
        const isHoliday = holidays.some(h => {
          const start = parseLocalDate(h.startDate, false);
          const end = parseLocalDate(h.endDate, true);
          return scanDate >= start && scanDate <= end;
        });
        if (isHoliday) continue;

        // Exclude Teacher Absences
        const isAbsent = absences.some(a => {
          const start = parseLocalDate(a.startDate, false);
          const end = parseLocalDate(a.endDate, true);
          return scanDate >= start && scanDate <= end;
        });
        if (isAbsent) continue;

        // Find schedule slots
        const daySlots = Object.keys(schedule).filter(k => k.startsWith(`${dayName}-`));

        daySlots.forEach(slotKey => {
          const slotData = schedule[slotKey];
          if (slotData && slotData.classId) {
            const slotTime = slotKey.split('-').slice(1).join('-');
            
            const matchingClass = classes.find(c => c.name === slotData.classId);
            if (!matchingClass) return;

            const hasEntry = allEntries.some(e => {
              if (e.classId !== matchingClass.id) return false;
              if (e.date !== dateStr) return false;
              return isTimeOverlapping(slotTime, e.time);
            });

            if (!hasEntry) {
              list.push({
                id: `${dateStr}-${slotKey}`,
                date: dateStr,
                dayName,
                time: slotTime,
                class: matchingClass,
                room: slotData.room || '—'
              });
            }
          }
        });
      }
    }

    list.sort((a, b) => new Date(a.date) - new Date(b.date));
    setMissingSessions(list);
  };

  // Trigger scan when entries, classes, schedule, holidays, absences, or month filter change
  useEffect(() => {
    if (classes.length > 0) {
      scanMissingSessions();
    }
  }, [classes, entries, schedule, holidays, absences, missingDaysFilter]);

  // Load entries when selected class changes
  useEffect(() => {
    if (selectedClass) {
      const loadEntries = async () => {
        const data = await getLogbookEntries(selectedClass.id);
        const yearDates = getAcademicYearDates();
        const isAr = selectedClass.language === 'ar';
        
        // 1. Filter actual manual entries to current academic year
        const actualFiltered = (data || []).filter(e => {
          const d = new Date(e.date);
          return d >= yearDates.startDate && d <= yearDates.endDate;
        });

        // 2. Generate virtual holiday and absence entries for the selected class slots
        const classSlots = [];
        if (schedule) {
          Object.keys(schedule).forEach(slotKey => {
            if (schedule[slotKey] && schedule[slotKey].classId === selectedClass.name) {
              classSlots.push({
                slotKey,
                dayName: slotKey.split('-')[0],
                time: slotKey.split('-').slice(1).join('-')
              });
            }
          });
        }

        const virtualEntries = [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(yearDates.startDate);
        const endDate = new Date(today);

        // Loop day by day from start of year to today
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const scanDate = new Date(d);
          scanDate.setHours(0, 0, 0, 0);
          const dayNum = scanDate.getDay();
          if (dayNum === 0) continue; // Sunday

          const dayName = WEEKDAYS_MAP[dayNum];
          const dateStr = formatLocalDate(scanDate);

          const todaySlots = classSlots.filter(s => s.dayName === dayName);
          if (todaySlots.length === 0) continue;

          // Check if date is a Holiday
          const holiday = holidays.find(h => {
            const start = parseLocalDate(h.startDate, false);
            const end = parseLocalDate(h.endDate, true);
            return scanDate >= start && scanDate <= end;
          });

          if (holiday) {
            todaySlots.forEach(slot => {
              virtualEntries.push({
                id: `holiday-${dateStr}-${slot.slotKey}`,
                classId: selectedClass.id,
                date: dateStr,
                time: slot.time.replace('-', ' - '),
                component: isAr ? 'عطلة' : 'Vacance',
                subject: 'Mathématiques',
                customContent: isAr ? `=== عطلة: ${holiday.label} ===` : `=== Vacance : ${holiday.label} ===`,
                isHeaderSéance: true,
                isHolidayEntry: true
              });
            });
            continue;
          }

          // Check if date is a Teacher Absence
          const absence = absences.find(a => {
            const start = parseLocalDate(a.startDate, false);
            const end = parseLocalDate(a.endDate, true);
            return scanDate >= start && scanDate <= end;
          });

          if (absence) {
            todaySlots.forEach(slot => {
              virtualEntries.push({
                id: `absence-${dateStr}-${slot.slotKey}`,
                classId: selectedClass.id,
                date: dateStr,
                time: slot.time.replace('-', ' - '),
                component: isAr ? 'رخصة/غياب' : 'Absence/Congé',
                subject: 'Mathématiques',
                customContent: isAr 
                  ? `=== رخصة/غياب: ${absence.type} ===\nالسبب: ${absence.reason || 'غير محدد'}` 
                  : `=== Absence/Congé : ${absence.type} ===\nMotif : ${absence.reason || 'non spécifié'}`,
                isHeaderSéance: true,
                isAbsenceEntry: true
              });
            });
          }
        }

        // Combine manual & virtual entries, then sort chronologically
        const combined = [...actualFiltered, ...virtualEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
        setEntries(combined);
      };
      loadEntries();
      
      const filtered = lessons.filter(l => normalizeLevel(l.level) === selectedClass.level);
      setLevelLessons(filtered);
    } else {
      setEntries([]);
      setLevelLessons([]);
    }
  }, [selectedClass, lessons, schedule, holidays, absences]);

  // Handle lesson select in form: load sections for checkbox selection
  const handleLessonChange = (val) => {
    if (val.startsWith('custom_prog_')) {
      const itemId = val.replace('custom_prog_', '');
      const progItem = selectedClass.program.find(item => item.id === itemId);
      if (progItem) {
        setFormData(prev => ({
          ...prev,
          lessonId: '',
          selectedProgramItemId: itemId,
          selectedSections: [],
          customContent: `=== ${progItem.title.toUpperCase()} ===\n`,
          component: (progItem.title.toUpperCase().includes('CONTRÔLE') || progItem.title.includes('فرض')) ? 'Contrôle' : prev.component,
          isHeaderSéance: true
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        lessonId: val,
        selectedProgramItemId: '',
        selectedSections: [] // Reset selection tags for the new dropdown list
      }));
    }
  };

  // Toggle section checkbox selection incrementally
  const handleToggleSection = (sectionTitle) => {
    setFormData(prev => {
      const isSelected = prev.selectedSections.includes(sectionTitle);
      const nextSections = isSelected
        ? prev.selectedSections.filter(s => s !== sectionTitle)
        : [...prev.selectedSections, sectionTitle];
      
      let currentContent = prev.customContent;
      const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      if (isSelected) {
        // Unchecked: remove the bullet point line for this section
        const regex = new RegExp(`^\\s*•\\s*${escaped}\\s*\\n?`, 'm');
        currentContent = currentContent.replace(regex, '');
      } else {
        // Checked: append the bullet point
        if (currentContent.trim() === '') {
          currentContent = `• ${sectionTitle}`;
        } else {
          currentContent = currentContent.endsWith('\n') 
            ? `${currentContent}• ${sectionTitle}` 
            : `${currentContent}\n• ${sectionTitle}`;
        }
      }
      
      return {
        ...prev,
        selectedSections: nextSections,
        customContent: currentContent
      };
    });
  };

  const toggleComponent = (compName) => {
    setFormData(prev => {
      const currentList = getSelectedComponents(prev.component);
      let nextList;
      if (currentList.includes(compName)) {
        nextList = currentList.filter(c => c !== compName);
      } else {
        nextList = [...currentList, compName];
      }
      if (nextList.length === 0) {
        nextList = [compName];
      }
      return { ...prev, component: nextList.join(' + ') };
    });
  };

  const handleOpenAddModal = () => {
    setEditingEntry(null);
    setFormData({
      date: formatLocalDate(),
      time: '08:00 - 10:00',
      component: 'Cours',
      subject: 'Mathématiques',
      lessonId: '',
      selectedProgramItemId: '',
      selectedSections: [],
      customContent: '',
      isHeaderSéance: false
    });
    setModalOpen(true);
  };

  // Get the first uncompleted planned item in the program
  const getNextPlannedItem = () => {
    if (!selectedClass || !selectedClass.program || selectedClass.program.length === 0) return null;
    
    // Get all covered sections from logbook entries
    const coveredSections = new Set();
    entries.forEach(e => {
      if (e.selectedSections && Array.isArray(e.selectedSections)) {
        e.selectedSections.forEach(s => coveredSections.add(s));
      }
    });

    // Check each program item
    for (const item of selectedClass.program) {
      if (item.type === 'custom') {
        const isLogged = entries.some(e => 
          (e.customContent && e.customContent.includes(item.title)) || 
          (e.component === 'Contrôle' && item.title.toUpperCase().includes('CONTRÔLE'))
        );
        if (!isLogged) return item;
      } else if (item.lessonId) {
        const lesson = lessons.find(l => l.id === item.lessonId);
        if (!lesson) continue;
        const sections = lesson.content?.sections || [];
        const completedCount = sections.filter(sec => coveredSections.has(sec.title)).length;
        if (completedCount < sections.length) {
          const uncoveredSections = sections.filter(sec => !coveredSections.has(sec.title));
          return {
            ...item,
            lesson,
            uncoveredSections
          };
        }
      }
    }
    return null; // All completed
  };

  // Open "Add Séance" modal pre-filled with the next planned item
  const handleOpenAddFromProgram = () => {
    const nextItem = getNextPlannedItem();
    if (!nextItem) {
      alert(isArMode ? "لقد تم إنجاز جميع دروس البرنامج!" : "Tous les éléments du programme ont été complétés !");
      handleOpenAddModal();
      return;
    }

    setEditingEntry(null);
    
    let docTypeComponent = 'Cours';
    if (nextItem.type === 'exercises') docTypeComponent = 'Exercices';
    if (nextItem.type === 'homework' || nextItem.type === 'exam') docTypeComponent = 'Contrôle';

    let suggestedSections = [];
    let customContent = '';
    let isHeaderSéance = false;

    if (nextItem.lesson) {
      // Suggest the first uncovered section
      const firstUncovered = nextItem.uncoveredSections[0];
      if (firstUncovered) {
        suggestedSections = [firstUncovered.title];
        customContent = `• ${firstUncovered.title}`;
        
        // If this is the very first section of the lesson, make it a Header Séance
        const allSections = nextItem.lesson.content?.sections || [];
        if (nextItem.uncoveredSections.length === allSections.length) {
          isHeaderSéance = true;
          customContent = `=== ${nextItem.lesson.title.toUpperCase()} ===\n` + customContent;
        }
      }
    } else {
      // Custom item
      customContent = nextItem.title;
      if (nextItem.title.toUpperCase().includes('CONTRÔLE') || nextItem.title.includes('فرض')) {
        isHeaderSéance = true;
        customContent = `=== ${nextItem.title.toUpperCase()} ===\n`;
      }
    }

    setFormData({
      date: formatLocalDate(),
      time: '08:00 - 10:00', // default slot
      component: docTypeComponent,
      subject: nextItem.lesson?.subject || 'Mathématiques',
      lessonId: nextItem.lessonId || '',
      selectedProgramItemId: nextItem.lessonId ? '' : nextItem.id,
      selectedSections: suggestedSections,
      customContent: customContent,
      isHeaderSéance: isHeaderSéance
    });
    setModalOpen(true);
  };


  const handleOpenEditModal = (entry) => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date,
      time: entry.time,
      component: entry.component || 'Cours',
      subject: entry.subject || 'Mathématiques',
      lessonId: entry.lessonId || '',
      selectedProgramItemId: entry.selectedProgramItemId || '',
      selectedSections: entry.selectedSections || [],
      customContent: entry.customContent || entry.activities?.join('\n') || '',
      isHeaderSéance: entry.isHeaderSéance || false
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass) return;

    // Validation: Check for duplicate/overlapping session
    const savedEntries = localStorage.getItem('logbook_entries');
    const allEntries = savedEntries ? JSON.parse(savedEntries) : [];
    
    const overlapExists = allEntries.some(entry => {
      // Must be same class and same date
      if (entry.classId !== selectedClass.id) return false;
      if (entry.date !== formData.date) return false;
      
      // If editing, ignore the entry currently being edited
      if (editingEntry && entry.id === editingEntry.id) return false;
      
      // Check if times overlap
      return checkTimeOverlap(entry.time, formData.time);
    });

    if (overlapExists) {
      setError(selectedClass.language === 'ar'
        ? "تنبيه: توجد بالفعل حصة مسجلة في هذا التاريخ وهذا التوقيت!" 
        : "Erreur : Une séance est déjà enregistrée pour cette date et cet horaire !"
      );
      setTimeout(() => setError(''), 5000);
      return; // Stop form submission
    }

    const entryPayload = {
      classId: selectedClass.id,
      date: formData.date,
      time: formData.time,
      component: formData.component,
      subject: formData.subject,
      lessonId: formData.lessonId,
      selectedSections: formData.selectedSections,
      customContent: formData.customContent,
      isHeaderSéance: formData.isHeaderSéance,
      activities: formData.customContent.split('\n').filter(line => line.trim().length > 0)
    };

    try {
      if (editingEntry) {
        await updateLogbookEntry(editingEntry.id, entryPayload);
        setSuccess("Séance modifiée avec succès.");
      } else {
        await addLogbookEntry(entryPayload);
        setSuccess("Séance ajoutée au cahier de textes.");
      }
      
      // Reload entries
      const data = await getLogbookEntries(selectedClass.id);
      setEntries(data || []);
      
      setModalOpen(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError("Impossible d'enregistrer la séance.");
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDelete = async (entryId) => {
    if (window.confirm("Voulez-vous supprimer cette séance du cahier de textes ?")) {
      try {
        await deleteLogbookEntry(entryId);
        setEntries(prev => prev.filter(e => e.id !== entryId));
        setSuccess("Séance supprimée.");
        setTimeout(() => setSuccess(''), 2500);
      } catch (err) {
        setError("Erreur lors de la suppression.");
      }
    }
  };

  const triggerPrint = () => {
    openLogbookPrintWindow(selectedClass, entries, profName, {
      arFont,
      frFont,
      baseFontSize,
      gridLineHeight,
      colorInk,
      colorChapter,
      colorAxis,
      colorExercise
    });
  };

  const selectedClassLevelLabel = selectedClass
    ? SYSTEM_LEVELS.find(lvl => lvl.id === selectedClass.level)?.label || selectedClass.level
    : '';

  const isArMode = selectedClass?.language === 'ar';

  // Style properties are bound to React state variables

  const hexToRgba = (hex, alpha) => {
    if (!hex || hex.charAt(0) !== '#') return `rgba(245, 158, 11, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const renderActivityContent = (content, isHeader) => {
    if (!content) return null;
    const lines = content.split('\n');

    const startsWithArabic = (str) => {
      if (!str) return false;
      const clean = str.trim();
      if (!clean) return false;
      const cleanFormatting = clean.replace(/^[\*\s_#\-✏■›✏]+/, '').trim();
      if (!cleanFormatting) return false;
      const firstChar = cleanFormatting.charAt(0);
      return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(firstChar);
    };

    // Render **bold** inline markers
    const renderBold = (text) => {
      if (!text.includes('**')) return text;
      const parts = text.split(/\*\*/);
      return parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i} style={{ fontWeight: 800 }}>{part}</strong> : part
      );
    };

    // Detect the type and styling of a single content line
    const getLineStyle = (raw) => {
      const trimmed = raw.trim();
      if (trimmed === '') return { type: 'empty', text: '' };

      const line = raw.replace(/^•\s*/, '').trim();

      // === TITLE === (chapitre header)
      if ((raw.startsWith('===') && raw.endsWith('===')) || (isHeader && lines.indexOf(raw) === 0)) {
        return { type: 'chapter', text: line.replace(/===/g, '').trim() };
      }

      // Roman numeral axis: I., II., III. …
      if (/^(I{1,3}|IV|V?I{0,3}|IX|X{0,3})\.\s+/i.test(line)) {
        return { type: 'axis', text: line };
      }

      // Numbered subsection: 1., 2. …
      if (/^\d+\.(\d+\.)*\s+/.test(line) || /^[a-zA-Z]\.\s+/.test(line)) {
        return { type: 'sub', text: line };
      }

      // Pedagogical blocks by keyword
      const lower = line.toLowerCase();
      const pedagKeywords = {
        activité: { color: '#d97706', bg: 'rgba(245,158,11,0.06)', label: '▸' },
        نشاط:     { color: '#d97706', bg: 'rgba(245,158,11,0.06)', label: '▸' },
        définition: { color: '#4f46e5', bg: 'rgba(79,70,229,0.06)', label: '▸' },
        تعريف:      { color: '#4f46e5', bg: 'rgba(79,70,229,0.06)', label: '▸' },
        propriété: { color: '#7c3aed', bg: 'rgba(124,58,237,0.06)', label: '▸' },
        خاصية:     { color: '#7c3aed', bg: 'rgba(124,58,237,0.06)', label: '▸' },
        théorème: { color: '#db2777', bg: 'rgba(219,39,119,0.06)', label: '▸' },
        مبرهنة:   { color: '#db2777', bg: 'rgba(219,39,119,0.06)', label: '▸' },
        remarque: { color: '#475569', bg: 'rgba(71,85,105,0.06)', label: '▸' },
        ملاحظة:   { color: '#475569', bg: 'rgba(71,85,105,0.06)', label: '▸' },
        application: { color: '#059669', bg: 'rgba(5,150,105,0.06)', label: '▸' },
        تطبيق:       { color: '#059669', bg: 'rgba(5,150,105,0.06)', label: '▸' },
        correction: { color: '#dc2626', bg: 'rgba(220,38,38,0.06)', label: '▸' },
        تصحيح:      { color: '#dc2626', bg: 'rgba(220,38,38,0.06)', label: '▸' },
        exemple: { color: '#0284c7', bg: 'rgba(2,132,199,0.06)', label: '▸' },
        مثال:    { color: '#0284c7', bg: 'rgba(2,132,199,0.06)', label: '▸' },
      };
      for (const [kw, style] of Object.entries(pedagKeywords)) {
        if (lower.startsWith(`**${kw}`) || lower.startsWith(kw)) {
          return { type: 'block', text: line, ...style };
        }
      }

      // Exercise
      if (/^(exercice|تمرين)\s*n?°?\s*\d*/i.test(line)) {
        return { type: 'exercise', text: line };
      }

      return { type: 'bullet', text: line };
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
        {lines.map((raw, idx) => {
          const { type, text, color, bg } = getLineStyle(raw);

          if (type === 'empty') {
            return <div key={idx} style={{ minHeight: `${gridLineHeight}px`, height: `${gridLineHeight}px` }} />;
          }

          const isArabic = isArMode || startsWithArabic(text);
          const lineDirection = isArabic ? 'rtl' : 'ltr';
          const lineTextAlign = isArabic ? 'right' : 'left';

          const commonStyle = {
            direction: lineDirection,
            textAlign: lineTextAlign,
            boxSizing: 'border-box',
            fontFamily: `'${isArabic ? arFont : frFont}', 'Outfit', 'Cairo', sans-serif`,
            margin: '0'
          };

          if (type === 'chapter') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: `calc(${baseFontSize} * 1.3)`,
                fontWeight: 800,
                color: colorChapter,
                minHeight: `${gridLineHeight}px`,
                lineHeight: `${gridLineHeight}px`,
                marginBottom: '0px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: !isArabic ? 'flex-start' : 'center',
                textTransform: 'uppercase',
                transform: 'translateY(3px)'
              }}>
                {renderWithMath(text)}
              </div>
            );
          }

          if (type === 'axis') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: `calc(${baseFontSize} * 1.1)`,
                fontWeight: 700,
                color: colorAxis,
                borderLeft: lineDirection === 'ltr' ? `3px solid ${colorAxis}` : 'none',
                borderRight: lineDirection === 'rtl' ? `3px solid ${colorAxis}` : 'none',
                paddingLeft: lineDirection === 'ltr' ? '0.65rem' : '0',
                paddingRight: lineDirection === 'rtl' ? '0.65rem' : '0',
                minHeight: `${gridLineHeight}px`,
                lineHeight: `${gridLineHeight}px`,
                marginBottom: '0px',
                display: 'flex',
                alignItems: 'flex-end',
                transform: 'translateY(3px)'
              }}>
                {renderWithMath(text)}
              </div>
            );
          }

          if (type === 'sub') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: `calc(${baseFontSize} * 1.025)`,
                fontWeight: 600,
                color: colorInk,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                minHeight: `${gridLineHeight}px`,
                lineHeight: `${gridLineHeight}px`,
                transform: 'translateY(3px)'
              }}>
                <span style={{ color: '#3b82f6', fontWeight: 900 }}>›</span>
                <span>{renderWithMath(text)}</span>
              </div>
            );
          }

          if (type === 'block') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: baseFontSize,
                fontWeight: 600,
                color: color,
                background: bg,
                borderLeft: lineDirection === 'ltr' ? `2px solid ${color}` : 'none',
                borderRight: lineDirection === 'rtl' ? `2px solid ${color}` : 'none',
                borderRadius: '4px',
                padding: '0 0.55rem 0 0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                minHeight: `${gridLineHeight}px`,
                lineHeight: `${gridLineHeight}px`,
                transform: 'translateY(3px)'
              }}>
                {renderWithMath(text)}
              </div>
            );
          }

          if (type === 'exercise') {
            return (
              <div key={idx} style={{
                ...commonStyle,
                fontSize: baseFontSize,
                fontWeight: 600,
                color: colorExercise,
                background: hexToRgba(colorExercise, 0.05),
                borderLeft: lineDirection === 'ltr' ? `2px solid ${colorExercise}` : 'none',
                borderRight: lineDirection === 'rtl' ? `2px solid ${colorExercise}` : 'none',
                borderRadius: '4px',
                padding: '0 0.55rem 0 0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                minHeight: `${gridLineHeight}px`,
                lineHeight: `${gridLineHeight}px`,
                transform: 'translateY(3px)'
              }}>
                <span style={{ fontWeight: 900 }}>✏</span>
                <span>{renderWithMath(text)}</span>
              </div>
            );
          }

          // Default bullet
          return (
            <div key={idx} className="notebook-line-text" style={{ 
              ...commonStyle,
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem',
              minHeight: `${gridLineHeight}px`,
              lineHeight: `${gridLineHeight}px`,
              color: colorInk,
              fontSize: baseFontSize,
              transform: 'translateY(3px)'
            }}>
              <span style={{ color: '#64748b', fontSize: '0.55rem', flexShrink: 0 }}>■</span>
              <span>{renderWithMath(text)}</span>
            </div>
          );
        })}
      </div>
    );
  };


  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      
      <style>{`
        /* Notebook Squared Grid Look */
        .squared-grid-cell {
          background-color: #fafbfd;
          background-image: 
            linear-gradient(#e2e8f0 1px, transparent 1px),
            linear-gradient(90deg, #e2e8f0 1px, transparent 1px);
          background-size: ${gridLineHeight}px ${gridLineHeight}px;
          padding: ${gridLineHeight}px !important;
          vertical-align: top;
          min-height: 100px;
        }

        /* Force KaTeX formulas in notebook cells to fit within the grid line height */
        .squared-grid-cell .katex {
          font-size: 0.85em !important;
          line-height: 1.1 !important;
        }
        .squared-grid-cell .katex-display {
          margin: 0 !important;
          padding: 0 !important;
          display: inline !important;
        }
        .squared-grid-cell .katex-display .katex {
          display: inline-block !important;
        }

        .notebook-line-text {
          font-family: '${isArMode ? arFont : frFont}', 'Outfit', 'Cairo', sans-serif;
          font-size: ${baseFontSize};
          line-height: ${gridLineHeight}px; /* Aligns text with grid size */
          color: ${colorInk};
          font-weight: 600;
          white-space: pre-wrap;
        }

        @media print {
          /* Force everything to be visible and ignore animations/opacities */
          *, *::before, *::after {
            box-shadow: none !important;
            text-shadow: none !important;
            opacity: 1 !important;
            visibility: visible !important;
            animation: none !important;
            transition: none !important;
          }

          /* Hide navigation & screen-only elements */
          .sidebar, 
          .sidebar-float-toggle, 
          .mobile-bottom-nav, 
          .whatsapp-floating-btn,
          .whatsapp-tooltip-bubble,
          .no-print,
          .no-print * {
            display: none !important;
          }

          /* Show print-only elements */
          .print-only {
            display: flex !important;
          }

          /* Reset layouts for full page printing */
          body, html, #root, .app-layout, .main-content {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            position: static !important;
            display: block !important;
          }

          /* Force text to black except inside th */
          body, html, #root, .app-layout, .main-content, td, div, p, span {
            color: #000000 !important;
          }

          .main-content {
            margin-left: 0 !important;
            padding: 0 !important;
          }

          /* Reset flexbox columns to normal block layout except print-only headers */
          div[style*="display: flex"]:not(.print-only), 
          div[style*="display:flex"]:not(.print-only) {
            display: block !important;
            float: none !important;
            width: 100% !important;
            max-width: 100% !important;
            position: static !important;
          }

          .glass-panel {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Force black text variables */
          :root {
            --text-main: #000000 !important;
            --text-muted: #334155 !important;
            --text-subtle: #475569 !important;
            --border: #000000 !important;
          }

          /* Dotted line fills */
          .print-header-dotted {
            border-bottom: 1px dotted #000000 !important;
            display: inline-block;
            min-width: 120px;
            padding: 0 0.5rem;
            font-weight: bold;
          }

          /* High fidelity squared grid print adjust */
          .squared-grid-cell {
            background-color: #ffffff !important;
            background-image: 
              linear-gradient(#cbd5e1 1px, transparent 1px),
              linear-gradient(90deg, #cbd5e1 1px, transparent 1px) !important;
            background-size: ${gridLineHeight}px ${gridLineHeight}px !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          .squared-grid-cell * {
            background: transparent !important;
          }

          .notebook-table {
            border: 1.5px solid #0f172a !important;
            width: 100% !important;
            border-collapse: collapse !important;
            border-radius: 0 !important;
          }

          .notebook-table th {
            border: 1.5px solid #0f172a !important;
            background-color: #1e3a8a !important; /* Premium navy header */
            color: #ffffff !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            padding: 6px 8px !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            border-radius: 0 !important;
          }

          .notebook-table td {
            border: 1px solid #cbd5e1 !important; /* Soft gray cell borders */
            color: #000000 !important;
            border-radius: 0 !important;
          }

          .notebook-table tr {
            border-radius: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-page-header-row {
            display: table-row !important;
          }
        }
      `}</style>

      {/* ── Screen Header (Hidden on Print) ── */}
      <header className="no-print" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={22} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Cahier de Textes</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>Remplissez le journal de classe à partir des titres des fiches de cours.</p>
        </div>

        {/* Class Selection Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-muted)' }}>Classe / القسم :</label>
          <select
            className="input-control"
            value={selectedClass ? selectedClass.id : ''}
            onChange={(e) => {
              const cls = classes.find(c => c.id === e.target.value);
              setSelectedClass(cls || null);
            }}
            style={{ width: '220px', fontWeight: 700 }}
          >
            <option value="">-- Choisir une classe --</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.language === 'ar' ? 'Arabe' : 'Français'})
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Notifications */}
      {success && (
        <div className="no-print" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid var(--emerald)', borderRadius: '12px', padding: '1rem', color: 'var(--emerald)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle2 size={20} />
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{success}</p>
        </div>
      )}
      {error && (
        <div className="no-print" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '1rem', color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle2 size={20} />
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}

      {/* activeSessionSuggestion Banner */}
      {activeSessionSuggestion && (
        <div className="no-print" style={{ 
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.12) 100%)', 
          border: '1px solid var(--violet)', 
          borderRadius: '16px', 
          padding: '1.25rem', 
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--violet)' }}>
              <Clock size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {activeSessionSuggestion.class.language === 'ar' ? 'حصة مجدولة حالياً!' : 'Séance en cours détectée !'}
              </h4>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {activeSessionSuggestion.class.language === 'ar' 
                  ? `لديك حصة مع ${activeSessionSuggestion.class.name} (${activeSessionSuggestion.time}) في القاعة ${activeSessionSuggestion.room}` 
                  : `Vous avez un cours prévu avec ${activeSessionSuggestion.class.name} (${activeSessionSuggestion.time}) en Salle ${activeSessionSuggestion.room}`}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => {
              setSelectedClass(activeSessionSuggestion.class);
              setEditingEntry(null);
              setFormData({
                date: formatLocalDate(),
                time: activeSessionSuggestion.rawSlot.replace('-', ' - '),
                component: 'Cours',
                subject: 'Mathématiques',
                lessonId: '',
                selectedSections: [],
                customContent: '',
                isHeaderSéance: false
              });
              setModalOpen(true);
            }}
            className="btn"
            style={{ 
              fontSize: '0.82rem', 
              padding: '0.45rem 1rem', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.3rem', 
              boxShadow: 'var(--shadow-sm)' 
            }}
          >
            <Check size={14} />
            {activeSessionSuggestion.class.language === 'ar' ? 'تعبئة دفتر النصوص' : 'Remplir le cahier'}
          </button>
        </div>
      )}

      {/* ── Smart Missing Sessions Alert Banner ── */}
      {missingSessions.length > 0 && (
        <div className="no-print animate-fade-in" style={{ 
          background: displayMissingSessions.length === 0
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.09) 100%)'
            : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.12) 100%)', 
          border: displayMissingSessions.length === 0
            ? '1px solid rgba(16, 185, 129, 0.4)'
            : '1px solid var(--warning)', 
          borderRadius: '16px', 
          padding: '1.25rem', 
          marginBottom: '1.5rem',
          boxShadow: displayMissingSessions.length === 0
            ? '0 4px 20px rgba(16, 185, 129, 0.06)'
            : '0 4px 20px rgba(245, 158, 11, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ 
                width: 36, 
                height: 36, 
                borderRadius: '10px', 
                background: displayMissingSessions.length === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: displayMissingSessions.length === 0 ? 'var(--emerald)' : 'var(--warning)', 
                position: 'relative' 
              }}>
                {displayMissingSessions.length === 0 ? <Check size={18} strokeWidth={3} /> : <Calendar size={18} />}
                {displayMissingSessions.length > 0 && (
                  <span className="animate-pulse" style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: 'var(--warning)' }} />
                )}
              </div>
              
              {(() => {
                const activeMonthObj = getAcademicYearMonths().find(m => m.value === missingDaysFilter);
                const monthLabel = activeMonthObj ? (isArMode ? activeMonthObj.labelAr : activeMonthObj.labelFr) : '';
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {displayMissingSessions.length === 0
                          ? (isArMode ? 'رائع! الحصص مكتملة' : 'Séances au complet !')
                          : (isArMode ? 'تنبيه: حصص غير مسجلة متأخرة!' : 'Séances en retard de saisie !')}
                      </h4>
                      <select
                        value={missingDaysFilter}
                        onChange={e => setMissingDaysFilter(e.target.value)}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 1.6rem 0.2rem 0.5rem',
                          borderRadius: '8px',
                          border: displayMissingSessions.length === 0
                            ? '1px solid rgba(16, 185, 129, 0.3)'
                            : '1px solid rgba(245, 158, 11, 0.3)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          outline: 'none',
                          fontWeight: 700,
                          marginLeft: isArMode ? undefined : '0.5rem',
                          marginRight: isArMode ? '0.5rem' : undefined
                        }}
                      >
                        <option value="30days" style={{ background: 'var(--bg-base)', color: 'var(--text-main)' }}>
                          {isArMode ? 'آخر 30 يوماً' : '30 derniers jours'}
                        </option>
                        {getAcademicYearMonths().map(m => (
                          <option key={m.value} value={m.value} style={{ background: 'var(--bg-base)', color: 'var(--text-main)' }}>
                            {isArMode ? m.labelAr : m.labelFr}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {displayMissingSessions.length === 0
                        ? (isArMode
                            ? `عمل رائع! جميع حصصك مسجلة بالكامل لشهر ${monthLabel || 'المحدد'}.`
                            : `Excellent travail ! Toutes vos séances sont documentées pour ${monthLabel || 'la période sélectionnée'}.`)
                        : (isArMode 
                            ? (missingDaysFilter === '30days' 
                                ? `لديك ${displayMissingSessions.length} حصص في الـ 30 يوماً الماضية لم يتم ملؤها في دفتر النصوص.` 
                                : `لديك ${displayMissingSessions.length} حصص غير مسجلة في شهر ${monthLabel}.`) 
                            : (missingDaysFilter === '30days'
                                ? `Vous avez ${displayMissingSessions.length} séances programmées dans les 30 derniers jours et non documentées.`
                                : `Vous avez ${displayMissingSessions.length} séances programmées en ${monthLabel} et non documentées.`))}
                    </p>
                  </div>
                );
              })()}
            </div>
            
            {displayMissingSessions.length > 0 && (
              <button
                onClick={() => setMissingPanelOpen(!missingPanelOpen)}
                className="btn-outline"
                style={{ 
                  fontSize: '0.82rem', 
                  padding: '0.45rem 1rem', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.3rem',
                  borderColor: 'var(--warning)',
                  color: 'var(--warning)',
                  background: 'transparent'
                }}
              >
                {missingPanelOpen 
                  ? (isArMode ? 'إخفاء الحصص' : 'Masquer la liste') 
                  : (isArMode ? 'عرض الحصص المتأخرة' : 'Voir les séances en retard')}
              </button>
            )}
          </div>

          {/* Collapsible Panel with list of missing sessions */}
          {displayMissingSessions.length > 0 && missingPanelOpen && (
            <div style={{ 
              marginTop: '1.25rem', 
              paddingTop: '1.25rem', 
              borderTop: '1px solid rgba(245, 158, 11, 0.2)',
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', 
              gap: '0.75rem' 
            }}>
              {displayMissingSessions.map(session => (
                <div key={session.id} style={{ 
                  background: 'var(--bg-glass)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '12px', 
                  padding: '0.85rem 1rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {session.class.name}
                    </h5>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} • {session.time.replace('-', 'h - ')}h
                    </p>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-subtle)' }}>
                      Salle / القاعة: {session.room}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedClass(session.class);
                      setEditingEntry(null);
                      setFormData({
                        date: session.date,
                        time: session.time.replace('-', ' - '),
                        component: 'Cours',
                        subject: 'Mathématiques',
                        lessonId: '',
                        selectedSections: [],
                        customContent: '',
                        isHeaderSéance: false
                      });
                      setModalOpen(true);
                    }}
                    className="btn"
                    style={{ 
                      fontSize: '0.75rem', 
                      padding: '0.35rem 0.75rem', 
                      borderRadius: '6px',
                      background: 'var(--warning)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      fontWeight: 750,
                      boxShadow: '0 2px 6px rgba(217, 119, 6, 0.2)'
                    }}
                  >
                    {isArMode ? 'تعبئة' : 'Saisir'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Empty State ── */}
      {!selectedClass ? (
        <div className="glass-panel no-print" style={{ padding: '3.5rem 2rem', textAlign: 'center', borderRadius: '24px' }}>
          <ClipboardList size={48} style={{ color: 'var(--text-subtle)', marginBottom: '1.25rem', opacity: 0.4 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Aucune classe sélectionnée</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>
            Veuillez sélectionner une classe dans le menu déroulant en haut à droite pour afficher et gérer son cahier de textes.
          </p>
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          
          {/* Left / Main column: Table & Headers */}
          <div>
          
          {/* ── Class Header Block (Dotted print style at top) ── */}
          <div className="glass-panel" style={{ padding: '1.5rem 2rem', borderRadius: '20px', marginBottom: '2rem', border: '1px solid var(--border)' }}>
            
            {/* Screen layout */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.3rem' }}>
                  <span style={{ 
                    background: isArMode ? 'var(--warning)' : 'var(--violet)', 
                    color: 'white', fontWeight: 900, fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '6px' 
                  }}>
                    {isArMode ? 'Option Arabe' : 'Option Français (BIOF)'}
                  </span>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>{selectedClass.name}</h2>
                </div>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
                  Niveau : <strong>{selectedClassLevelLabel}</strong> • Année Scolaire : <strong>{getAcademicYearDates().label}</strong> • Enseignant : <strong>{profName || 'Professeur'}</strong>
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', padding: '0.6rem 1.25rem', borderRadius: '10px', background: 'transparent', borderColor: 'var(--emerald)', color: 'var(--emerald)' }}
                >
                  <CheckCircle2 size={16} /> {isArMode ? 'مؤشر التقدم' : 'Progression'}
                </button>
                <button
                  onClick={triggerPrint}
                  className="btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', padding: '0.6rem 1.25rem', borderRadius: '10px', background: 'transparent' }}
                >
                  <Printer size={16} /> Imprimer le cahier
                </button>
                {selectedClass && selectedClass.program && selectedClass.program.length > 0 && (
                  <button
                    onClick={handleOpenAddFromProgram}
                    className="btn"
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '0.4rem', 
                      fontSize: '0.88rem', padding: '0.6rem 1.25rem', borderRadius: '10px',
                      background: 'linear-gradient(135deg, var(--emerald) 0%, #059669 100%)',
                      border: 'none', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                    }}
                  >
                    <Sparkles size={16} /> {isArMode ? 'تعبئة من البرنامج' : 'Remplir depuis le Programme'}
                  </button>
                )}
                <button
                  onClick={handleOpenAddModal}
                  className="btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', padding: '0.6rem 1.25rem', borderRadius: '10px' }}
                >
                  <Plus size={16} /> Ajouter une séance
                </button>
              </div>
            </div>

            {/* Print Dotted Layout (Only visible when printing) */}
            <div className="print-only" style={{ 
              display: 'none', 
              width: '100%', 
              flexDirection: 'column',
              fontFamily: "'UKIJ Merdane', 'Outfit', 'Cairo', sans-serif", 
              color: '#0f172a',
              marginBottom: '1.5rem' 
            }}>
              {/* Top Row: Brand & Title */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingBottom: '0.5rem', 
                borderBottom: '2px solid #0f172a',
                width: '100%' 
              }}>
                <div>
                  <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#4f46e5', letterSpacing: '-0.03em' }}>L'CONQ</span>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '-2px' }}>
                    {isArMode ? 'دفتر النصوص الإلكتروني' : 'Cahier de Textes Électronique'}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {isArMode ? 'دفتر النصوص المنجزة' : 'Cahier de Textes'}
                  </h1>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 800, 
                    background: '#4f46e5', 
                    color: '#ffffff', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px' 
                  }}>
                    {getAcademicYearDates().label}
                  </span>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '3px', fontWeight: 500 }}>
                    {isArMode ? 'تاريخ الطبع: ' : 'Imprimé le : '} {new Date().toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>

              {/* Coordinates Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: '1px', 
                background: '#cbd5e1', 
                border: '1px solid #94a3b8', 
                borderRadius: '6px', 
                overflow: 'hidden',
                marginTop: '0.8rem',
                fontSize: '0.75rem',
                direction: isArMode ? 'rtl' : 'ltr'
              }}>
                <div style={{ background: '#f8fafc', padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 800, display: 'block', textTransform: 'uppercase' }}>
                    {isArMode ? 'المستوى' : 'Niveau'}
                  </span>
                  <strong style={{ color: '#0f172a' }}>{selectedClassLevelLabel}</strong>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 800, display: 'block', textTransform: 'uppercase' }}>
                    {isArMode ? 'القسم' : 'Classe / Section'}
                  </span>
                  <strong style={{ color: '#0f172a' }}>{selectedClass.name}</strong>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 800, display: 'block', textTransform: 'uppercase' }}>
                    {isArMode ? 'المادة' : 'Matière'}
                  </span>
                  <strong style={{ color: '#0f172a' }}>{selectedClass.subject || 'Mathématiques'}</strong>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 800, display: 'block', textTransform: 'uppercase' }}>
                    {isArMode ? 'الأستاذ' : 'Enseignant'}
                  </span>
                  <strong style={{ color: '#0f172a' }}>{profName || 'Professeur'}</strong>
                </div>
              </div>
            </div>

          </div>

          {/* ── Timetable Logbook entries table ── */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '24px', overflowX: 'auto', border: '1px solid var(--border)' }}>
            
            {/* Arabic Class Table (RTL) */}
            {isArMode ? (
              <table className="notebook-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', direction: 'rtl', textAlign: 'right' }}>
                <thead>
                  {/* Print-only page header repeating row */}
                  <tr className="print-page-header-row" style={{ display: 'none' }}>
                    <th colSpan={6} style={{ 
                      padding: '10px 16px', 
                      backgroundColor: '#f8fafc', 
                      border: '1.5px solid #0f172a',
                      color: '#0f172a',
                      textAlign: 'right',
                      fontFamily: "'Cairo', sans-serif"
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', direction: 'rtl' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#4f46e5', fontWeight: 900, fontSize: '1rem', letterSpacing: '-0.02em' }}>L'CONQ</span>
                          <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>| دفتر النصوص المنجزة</span>
                        </div>
                        <div style={{ display: 'flex', gap: '24px', fontSize: '0.8rem', fontWeight: 850 }}>
                          <div>
                            <span style={{ color: '#64748b', fontWeight: 700 }}>القسم:</span>
                            <span style={{ marginRight: '6px', color: '#0f172a', background: 'rgba(79, 70, 229, 0.08)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(79, 70, 229, 0.15)' }}>{selectedClass.name}</span>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', fontWeight: 700 }}>المادة:</span>
                            <span style={{ marginRight: '6px', color: '#0f172a', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>{selectedClass.subject || 'الرياضيات'}</span>
                          </div>
                        </div>
                      </div>
                    </th>
                  </tr>
                  <tr style={{ background: getClassColor(selectedClass), borderBottom: `2px solid ${getClassColor(selectedClass)}` }}>
                    <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>التاريخ</th>
                    <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>التوقيت</th>
                    <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>المكون</th>
                    <th style={{ padding: '0.85rem', width: '52%', fontWeight: 800, border: '1px solid var(--border)', color: '#ffffff' }}>طبيعة الأنشطة المنجزة</th>
                    <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>التوقيع</th>
                    <th className="no-print" style={{ padding: '0.85rem', width: '100px', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-main)' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 700, color: 'var(--text-main)' }}>
                        {new Date(e.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {e.time}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {getTranslatedComponent(e.component, true)}
                      </td>
                      <td className="squared-grid-cell" style={{ border: '1px solid var(--border)' }}>
                        {renderActivityContent(e.customContent, e.isHeaderSéance)}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', verticalAlign: 'middle' }}>
                        {e.isHolidayEntry || e.isAbsenceEntry ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>Signé</span>
                        )}
                      </td>
                      <td className="no-print" style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', verticalAlign: 'middle' }}>
                        {e.isHolidayEntry || e.isAbsenceEntry ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontStyle: 'italic', fontWeight: 600 }}>
                            {e.isHolidayEntry ? 'عطلة' : 'رخصة'}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button onClick={() => handleOpenEditModal(e)} style={{ background: 'transparent', border: 'none', color: 'var(--violet)', cursor: 'pointer', padding: '0.3rem' }} title="Modifier">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(e.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem' }} title="Supprimer">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        لا توجد حصص مسجلة في دفتر النصوص حالياً. اضغط على "إضافة حصة" لبدء التعبئة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              /* French Class Table (LTR) */
              <table className="notebook-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', direction: 'ltr', textAlign: 'left' }}>
                <thead>
                  {/* Print-only page header repeating row */}
                  <tr className="print-page-header-row" style={{ display: 'none' }}>
                    <th colSpan={6} style={{ 
                      padding: '10px 16px', 
                      backgroundColor: '#f8fafc', 
                      border: '1.5px solid #0f172a',
                      color: '#0f172a',
                      textAlign: 'left',
                      fontFamily: "'Outfit', sans-serif"
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', direction: 'ltr' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#4f46e5', fontWeight: 900, fontSize: '1rem', letterSpacing: '-0.02em' }}>L'CONQ</span>
                          <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>| Cahier de Textes</span>
                        </div>
                        <div style={{ display: 'flex', gap: '24px', fontSize: '0.8rem', fontWeight: 850 }}>
                          <div>
                            <span style={{ color: '#64748b', fontWeight: 700 }}>Classe :</span>
                            <span style={{ marginLeft: '6px', color: '#0f172a', background: 'rgba(79, 70, 229, 0.08)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(79, 70, 229, 0.15)' }}>{selectedClass.name}</span>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', fontWeight: 700 }}>Matière :</span>
                            <span style={{ marginLeft: '6px', color: '#0f172a', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>{selectedClass.subject || 'Mathématiques'}</span>
                          </div>
                        </div>
                      </div>
                    </th>
                  </tr>
                  <tr style={{ background: getClassColor(selectedClass), borderBottom: `2px solid ${getClassColor(selectedClass)}` }}>
                    <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>Date</th>
                    <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>Horaire</th>
                    <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>Composant</th>
                    <th style={{ padding: '0.85rem', width: '52%', fontWeight: 800, border: '1px solid var(--border)', color: '#ffffff' }}>Nature des activités réalisées</th>
                    <th style={{ padding: '0.85rem', width: '12%', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: '#ffffff' }}>Signature</th>
                    <th className="no-print" style={{ padding: '0.85rem', width: '100px', fontWeight: 800, border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-main)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 700, color: 'var(--text-main)' }}>
                        {new Date(e.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {e.time}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {getTranslatedComponent(e.component, false)}
                      </td>
                      <td className="squared-grid-cell" style={{ border: '1px solid var(--border)' }}>
                        {renderActivityContent(e.customContent, e.isHeaderSéance)}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', verticalAlign: 'middle' }}>
                        {e.isHolidayEntry || e.isAbsenceEntry ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>Signé</span>
                        )}
                      </td>
                      <td className="no-print" style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'center', verticalAlign: 'middle' }}>
                        {e.isHolidayEntry || e.isAbsenceEntry ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontStyle: 'italic', fontWeight: 600 }}>
                            {e.isHolidayEntry ? 'Vacance' : 'Absence'}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button onClick={() => handleOpenEditModal(e)} style={{ background: 'transparent', border: 'none', color: 'var(--violet)', cursor: 'pointer', padding: '0.3rem' }} title="Modifier">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(e.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem' }} title="Supprimer">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Aucune séance enregistrée pour le moment. Cliquez sur "Ajouter une séance" pour commencer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            
          </div>

          {/* Dotted Signatures block at bottom (only visible on print) */}
          <div className="print-only" style={{ display: 'none', marginTop: '3.5rem', width: '100%', fontFamily: "'UKIJ Merdane', 'Outfit', 'Cairo', sans-serif" }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', width: '100%', direction: isArMode ? 'rtl' : 'ltr' }}>
              <div style={{ border: '1px dashed #94a3b8', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: '#f8fafc' }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                  {isArMode ? 'توقيع المفتش التربوي' : "Signature de l'Inspecteur"}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3.5rem' }}>..........................................</div>
              </div>
              <div style={{ border: '1px dashed #94a3b8', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: '#f8fafc' }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                  {isArMode ? 'توقيع رئيس المؤسسة' : "Signature du Directeur"}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3.5rem' }}>..........................................</div>
              </div>
              <div style={{ border: '1px dashed #94a3b8', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: '#f8fafc' }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                  {isArMode ? 'توقيع الأستاذ' : "Signature de l'Enseignant"}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 700, marginTop: '1.5rem', marginBottom: '0.5rem' }}>{profName || 'Professeur'}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1rem' }}>..........................................</div>
              </div>
            </div>
          </div>

          </div>

        </div>
      )}

      {/* ── Slide-over Drawer for Syllabus Progress ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="no-print"
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              animation: 'fadeInLogbook 0.2s ease'
            }}
          />
          {/* Drawer Panel */}
          <div 
            className="no-print"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '385px',
              maxWidth: '90vw',
              background: 'var(--bg-card)',
              borderLeft: '1px solid var(--border)',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.3)',
              zIndex: 10000,
              padding: '2rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              animation: 'slideInRightLogbook 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} color="var(--emerald)" />
                {isArMode ? 'مؤشر تقدم الدروس' : 'Progression du Programme'}
              </h3>
              <button 
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {levelLessons.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {isArMode ? 'لا توجد دروس محملة لهذا المستوى حالياً.' : 'Aucune fiche de cours chargée pour ce niveau.'}
                </p>
              ) : (
                levelLessons.map(lesson => {
                  const lessonSections = lesson.content?.sections || [];
                  const totalCount = lessonSections.length;
                  
                  const coveredSectionTitles = new Set();
                  entries.forEach(e => {
                    if (e.selectedSections && Array.isArray(e.selectedSections)) {
                      e.selectedSections.forEach(s => coveredSectionTitles.add(s));
                    }
                  });

                  const coveredCount = lessonSections.filter(s => coveredSectionTitles.has(s.title)).length;
                  const progressPercent = totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : 0;
                  
                  return (
                    <div key={lesson.id} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }} title={lesson.title}>
                          {renderWithMath(lesson.title)}
                        </span>
                        <span style={{ fontWeight: 800, color: progressPercent === 100 ? 'var(--emerald)' : 'var(--violet)' }}>
                          {progressPercent}%
                        </span>
                      </div>
                      
                      <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', overflow: 'hidden', marginBottom: '0.4rem' }}>
                        <div style={{ 
                          width: `${progressPercent}%`, 
                          height: '100%', 
                          borderRadius: '4px',
                          background: progressPercent === 100 
                            ? 'linear-gradient(90deg, var(--emerald) 0%, #34d399 100%)' 
                            : 'linear-gradient(90deg, var(--violet) 0%, #8b5cf6 100%)',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                        <span>{coveredCount} / {totalCount} {isArMode ? 'فقرات منجزة' : 'sections couvertes'}</span>
                        {progressPercent === 100 && (
                          <span style={{ color: 'var(--emerald)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                            <Check size={12} strokeWidth={3} /> {isArMode ? 'مكتمل' : 'Complété'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <style dangerouslySetInnerHTML={{__html: `
            @keyframes fadeInLogbook {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideInRightLogbook {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}} />
        </>
      )}

      {/* ── Add / Edit Séance Modal ── */}
      {modalOpen && (
        <div style={{
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(9, 9, 11, 0.65)', 
          backdropFilter: 'blur(10px)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 9999, 
          padding: '1rem',
          animation: 'modalFadeIn 0.25s ease'
        }}>
          {/* Custom style overrides for modal controls */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes modalFadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes modalScaleIn {
              from { transform: scale(0.96); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            .modal-input {
              background: rgba(255, 255, 255, 0.02) !important;
              border: 1px solid var(--border) !important;
              color: var(--text-main) !important;
              border-radius: 12px !important;
              padding: 0.75rem 1rem !important;
              font-size: 0.9rem !important;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
              width: 100% !important;
              outline: none !important;
            }
            .modal-input:focus {
              border-color: var(--violet) !important;
              box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15) !important;
              background: rgba(255, 255, 255, 0.04) !important;
            }
            .modal-close-btn {
              background: transparent;
              border: none;
              color: var(--text-muted);
              cursor: pointer;
              padding: 0.5rem;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s ease;
            }
            .modal-close-btn:hover {
              background: rgba(255, 255, 255, 0.05);
              color: var(--text-main);
              transform: rotate(90deg);
            }
            .quick-tag-btn-ar {
              font-size: 0.75rem !important;
              padding: 0.35rem 0.8rem !important;
              border-radius: 20px !important;
              background: rgba(245, 158, 11, 0.05) !important;
              border: 1px solid rgba(245, 158, 11, 0.2) !important;
              color: var(--warning) !important;
              cursor: pointer !important;
              font-weight: 700 !important;
              transition: all 0.2s ease !important;
            }
            .quick-tag-btn-ar:hover {
              background: rgba(245, 158, 11, 0.12) !important;
              border-color: var(--warning) !important;
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(245, 158, 11, 0.1);
            }
            .quick-tag-btn-fr {
              font-size: 0.75rem !important;
              padding: 0.35rem 0.8rem !important;
              border-radius: 20px !important;
              background: rgba(139, 92, 246, 0.05) !important;
              border: 1px solid rgba(139, 92, 246, 0.2) !important;
              color: var(--violet) !important;
              cursor: pointer !important;
              font-weight: 700 !important;
              transition: all 0.2s ease !important;
            }
            .quick-tag-btn-fr:hover {
              background: rgba(139, 92, 246, 0.12) !important;
              border-color: var(--violet) !important;
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
            }
            .modal-save-btn {
              background: linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%) !important;
              color: #ffffff !important;
              border: none !important;
              box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3) !important;
              transition: all 0.2s ease !important;
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              gap: 0.5rem !important;
            }
            .modal-save-btn:hover {
              background: linear-gradient(135deg, #7c3aed 0%, #4338ca 100%) !important;
              transform: translateY(-1px) !important;
              box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4) !important;
            }
          `}} />

          <div className="glass-panel" style={{ 
            maxWidth: '620px', 
            width: '100%', 
            padding: '2.25rem', 
            maxHeight: '92vh', 
            overflowY: 'auto', 
            borderRadius: '24px', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            background: 'var(--bg-card)',
            animation: 'modalScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                  {editingEntry 
                    ? (isArMode ? "تعديل حصة دفتر النصوص" : "Modifier la séance") 
                    : (isArMode ? "إضافة حصة جديدة" : "Ajouter une séance")}
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedClass?.name} • {getAcademicYearDates().label}
                </p>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="animate-fade-in" style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid var(--danger)', 
                borderRadius: '12px', 
                padding: '0.85rem 1.25rem', 
                color: 'var(--danger)', 
                marginBottom: '1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.6rem', 
                fontSize: '0.85rem' 
              }}>
                <AlertCircle size={18} />
                <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Form Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {/* Date */}
                <div className="input-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>Date</label>
                  <input
                    type="date"
                    required
                    className="modal-input"
                    value={formData.date}
                    onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                
                {/* Time */}
                <div className="input-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>Horaire / Durée</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 08:00 - 10:00"
                    className="modal-input"
                    value={formData.time}
                    onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  />
                </div>
              </div>

              {/* Component Pills Selection */}
              <div className="input-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
                  Composant(s) / المكون(ات)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                  {[
                    { value: 'Cours', labelAr: 'درس', labelFr: 'Cours' },
                    { value: 'Exercices', labelAr: 'تمارين', labelFr: 'Exercices' },
                    { value: 'Contrôle', labelAr: 'فرض', labelFr: 'Contrôle' },
                    { value: 'Activité', labelAr: 'نشاط', labelFr: 'Activité' }
                  ].map(item => {
                    const isSelected = getSelectedComponents(formData.component).includes(item.value);
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleComponent(item.value)}
                        style={{
                          fontSize: '0.82rem',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '20px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          transition: 'all 0.2s ease',
                          background: isSelected 
                            ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' 
                            : 'rgba(255, 255, 255, 0.04)',
                          border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#ffffff' : '#a1a1aa',
                          boxShadow: isSelected ? '0 4px 15px rgba(139, 92, 246, 0.3)' : 'none'
                        }}
                      >
                        {isArMode ? item.labelAr : item.labelFr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lesson Selection (Fiche de Cours) */}
              <div className="input-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
                  Fiche de Cours Correspondante / درس القسم
                </label>
                <select
                  className="modal-input"
                  value={formData.lessonId || (formData.selectedProgramItemId ? `custom_prog_${formData.selectedProgramItemId}` : '')}
                  onChange={e => handleLessonChange(e.target.value)}
                >
                  <option value="">-- Sélectionner un élément du programme --</option>
                  {selectedClass && selectedClass.program && selectedClass.program.length > 0 ? (
                    selectedClass.program.map(item => {
                      if (item.lessonId) {
                        return (
                          <option key={item.id} value={item.lessonId}>
                            {item.title}
                          </option>
                        );
                      } else {
                        return (
                          <option key={item.id} value={`custom_prog_${item.id}`}>
                            ★ {item.title}
                          </option>
                        );
                      }
                    })
                  ) : (
                    levelLessons.map(l => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))
                  )}
                </select>
                <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-subtle)', margin: '0.35rem 0 0 0' }}>
                  Choisissez une fiche de cours pour extraire les titres de ses sections.
                </p>
              </div>

              {/* Start new Chapter or Exam header toggle */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  background: formData.isHeaderSéance 
                    ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(99, 102, 241, 0.08) 100%)' 
                    : 'rgba(255, 255, 255, 0.01)', 
                  padding: '1rem 1.25rem', 
                  borderRadius: '16px', 
                  border: formData.isHeaderSéance ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border)',
                  boxShadow: formData.isHeaderSéance ? '0 4px 15px rgba(139, 92, 246, 0.05)' : 'none',
                  transition: 'all 0.25s ease',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  if (e.target.id === 'isHeaderSéance' || e.target.tagName === 'LABEL' || e.target.closest('label')) {
                    return;
                  }
                  const nextChecked = !formData.isHeaderSéance;
                  setFormData(prev => {
                    let customContent = prev.customContent;
                    if (nextChecked) {
                      if (prev.lessonId) {
                        const selectedLesson = lessons.find(l => l.id === prev.lessonId);
                        if (selectedLesson) {
                          customContent = `=== ${selectedLesson.title.toUpperCase()} ===\n` + prev.customContent;
                        }
                      } else if (prev.component === 'Contrôle') {
                        customContent = `=== CONTRÔLE N°1 ===\n` + prev.customContent;
                      } else {
                        customContent = `=== NOUVEAU CHAPITRE ===\n` + prev.customContent;
                      }
                    } else {
                      customContent = prev.customContent.replace(/^===.*===\n?/, '');
                    }
                    return { ...prev, isHeaderSéance: nextChecked, customContent };
                  });
                }}
              >
                <input
                  type="checkbox"
                  id="isHeaderSéance"
                  checked={formData.isHeaderSéance || false}
                  onChange={(e) => {
                    const nextChecked = e.target.checked;
                    setFormData(prev => {
                      let customContent = prev.customContent;
                      if (nextChecked) {
                        if (prev.lessonId) {
                          const selectedLesson = lessons.find(l => l.id === prev.lessonId);
                          if (selectedLesson) {
                            customContent = `=== ${selectedLesson.title.toUpperCase()} ===\n` + prev.customContent;
                          }
                        } else if (prev.component === 'Contrôle') {
                          customContent = `=== CONTRÔLE N°1 ===\n` + prev.customContent;
                        } else {
                          customContent = `=== NOUVEAU CHAPITRE ===\n` + prev.customContent;
                        }
                      } else {
                        customContent = prev.customContent.replace(/^===.*===\n?/, '');
                      }
                      return { ...prev, isHeaderSéance: nextChecked, customContent };
                    });
                  }}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--violet)', cursor: 'pointer' }}
                />
                <label 
                  htmlFor="isHeaderSéance" 
                  style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none', lineHeight: 1.35 }}
                >
                  Début de chapitre ou contrôle (Afficher un grand titre centré et élégant) / درس جديد أو فرض (عنوان كبير)
                </label>
              </div>

              {/* Checkbox selector for Sections */}
              {formData.lessonId && (
                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--violet)', display: 'block', marginBottom: '0.75rem' }}>
                    {isArMode ? 'العناوين المنجزة :' : 'Sélectionner les titres couverts :'}
                  </label>
                  
                  {(() => {
                    const selectedLesson = lessons.find(l => l.id === formData.lessonId);
                    const sections = selectedLesson?.content?.sections || [];
                    if (sections.length === 0) {
                      return <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>Aucune section dans cette fiche.</span>;
                    }

                    // Find all sections covered in other entries for this class
                    const coveredInOtherEntries = new Set();
                    entries.forEach(e => {
                      if (editingEntry && e.id === editingEntry.id) return; // Skip the current entry we are editing
                      if (e.selectedSections && Array.isArray(e.selectedSections)) {
                        e.selectedSections.forEach(title => coveredInOtherEntries.add(title));
                      }
                    });

                    const visibleSections = sections.filter(s => !coveredInOtherEntries.has(s.title));
                    if (visibleSections.length === 0) {
                      return <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>{isArMode ? 'تم إنجاز جميع فقرات هذا الدرس!' : 'Toutes les sections ont été complétées !'}</span>;
                    }

                    // Detect block type from text prefix
                    const getBlockType = (s) => {
                      const t = (s.items?.[0]?.text || s.title || '').toLowerCase();
                      if (/^\*\*(activité|نشاط)/.test(t)) return { label: isArMode ? 'نشاط' : 'Activité', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
                      if (/^\*\*(définition|تعريف)/.test(t)) return { label: isArMode ? 'تعريف' : 'Déf.', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
                      if (/^\*\*(propriété|خاصية)/.test(t)) return { label: isArMode ? 'خاصية' : 'Prop.', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' };
                      if (/^\*\*(théorème|مبرهنة)/.test(t)) return { label: isArMode ? 'مبرهنة' : 'Thm.', color: '#ec4899', bg: 'rgba(236,72,153,0.12)' };
                      if (/^\*\*(remarque|ملاحظة)/.test(t)) return { label: isArMode ? 'ملاحظة' : 'Rem.', color: '#64748b', bg: 'rgba(100,116,139,0.12)' };
                      if (/^\*\*(application|تطبيق)/.test(t)) return { label: isArMode ? 'تطبيق' : 'Appl.', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
                      if (/^\*\*(correction|تصحيح)/.test(t)) return { label: isArMode ? 'تصحيح' : 'Corr.', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
                      if (s.type === 'exercise') return { label: isArMode ? 'تمرين' : 'Exo', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
                      return { label: isArMode ? 'درس' : 'Cours', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
                    };

                    let lastHeader = null;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {visibleSections.map(s => {
                          const isChecked = formData.selectedSections.includes(s.title);
                          const isPreviewOpen = !!previewSections[s.id || s.title];
                          const blockType = getBlockType(s);
                          const showHeader = s.section_header && s.section_header !== lastHeader;
                          if (showHeader) lastHeader = s.section_header;
                          return (
                            <div key={s.id || s.title} style={{ marginBottom: '0.35rem' }}>
                              {/* Roman numeral section header — selectable checkbox */}
                              {showHeader && (() => {
                                const headerTitle = s.section_header;
                                const isHeaderChecked = formData.selectedSections.includes(headerTitle);
                                return (
                                  <label
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.55rem',
                                      padding: '0.4rem 0.75rem',
                                      marginTop: '0.35rem',
                                      background: isHeaderChecked
                                        ? 'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.08) 100%)'
                                        : 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.02) 100%)',
                                      borderLeft: `3px solid ${isHeaderChecked ? 'var(--violet)' : 'rgba(99,102,241,0.4)'}`,
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                      transition: 'all 0.18s ease'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isHeaderChecked}
                                      onChange={() => handleToggleSection(headerTitle)}
                                      style={{ accentColor: 'var(--violet)', width: '14px', height: '14px', flexShrink: 0 }}
                                    />
                                    <span style={{
                                      fontSize: '0.75rem',
                                      fontWeight: 900,
                                      color: isHeaderChecked ? 'var(--violet)' : 'rgba(99,102,241,0.7)',
                                      letterSpacing: '0.02em',
                                      flex: 1
                                    }}>
                                      {parseBold(headerTitle)}
                                    </span>
                                    <span style={{
                                      fontSize: '0.6rem',
                                      fontWeight: 800,
                                      color: 'var(--violet)',
                                      background: 'rgba(99,102,241,0.1)',
                                      padding: '0.1rem 0.4rem',
                                      borderRadius: '4px',
                                      flexShrink: 0
                                    }}>
                                      {isArMode ? 'محور' : 'Axe'}
                                    </span>
                                  </label>
                                );
                              })()}

                              {/* Section row */}
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  background: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                                  border: isChecked ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.04)',
                                  borderRadius: '10px',
                                  transition: 'all 0.18s ease',
                                  padding: '0.55rem 0.9rem',
                                  marginTop: '0.2rem'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1, cursor: 'pointer', margin: 0 }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleSection(s.title)}
                                      style={{ accentColor: 'var(--violet)', width: '15px', height: '15px', flexShrink: 0 }}
                                    />
                                    <span style={{
                                      fontWeight: isChecked ? 700 : 500,
                                      fontSize: '0.8rem',
                                      color: isChecked ? 'var(--text-main)' : 'var(--text-muted)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {parseBold(s.title)}
                                    </span>
                                  </label>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
                                    {/* Insert Content Button */}
                                    {(s.content || (s.items && s.items.length > 0)) && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          insertSectionContent(s);
                                        }}
                                        style={{
                                          background: 'rgba(16, 185, 129, 0.08)',
                                          border: '1px solid rgba(16, 185, 129, 0.25)',
                                          color: 'var(--emerald)',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.2rem',
                                          padding: '0.2rem 0.45rem',
                                          borderRadius: '6px',
                                          fontSize: '0.66rem',
                                          fontWeight: 700,
                                          transition: 'all 0.2s',
                                        }}
                                        title={isArMode ? 'إدراج محتوى التمرين في الحصة' : 'Insérer le contenu dans la séance'}
                                      >
                                        <Plus size={11} />
                                        {isArMode ? 'إدراج' : 'Insérer'}
                                      </button>
                                    )}

                                    {/* Preview Toggle Button */}
                                    {(s.content || (s.items && s.items.length > 0)) && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          toggleSectionPreview(s.id || s.title);
                                        }}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: isPreviewOpen ? 'var(--violet)' : 'var(--text-muted)',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          padding: '0.25rem',
                                          borderRadius: '6px',
                                          transition: 'all 0.2s',
                                          background: isPreviewOpen ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
                                        }}
                                        title={isArMode ? 'عرض المحتوى' : 'Voir le contenu'}
                                      >
                                        {isPreviewOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                                      </button>
                                    )}

                                    <span style={{
                                      fontSize: '0.66rem',
                                      fontWeight: 800,
                                      color: blockType.color,
                                      background: blockType.bg,
                                      padding: '0.12rem 0.45rem',
                                      borderRadius: '6px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {blockType.label}
                                    </span>
                                  </div>
                                </div>

                                {/* Content Preview Drawer */}
                                {isPreviewOpen && (s.content || (s.items && s.items.length > 0)) && (() => {
                                  const textVal = getSectionContentString(s);
                                  return (
                                    <div style={{
                                      marginTop: '0.55rem',
                                      marginLeft: '1.8rem',
                                      padding: '0.65rem 0.85rem',
                                      background: 'rgba(255, 255, 255, 0.02)',
                                      border: '1px solid var(--border)',
                                      borderRadius: '8px',
                                      fontSize: '0.75rem',
                                      color: 'var(--text-muted)',
                                      maxHeight: '160px',
                                      overflowY: 'auto',
                                      direction: 'ltr',
                                      textAlign: 'left',
                                      whiteSpace: 'pre-wrap'
                                    }}>
                                      {renderWithMath(textVal)}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Nature of activities realized */}
              <div className="input-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
                  Nature des activités réalisées (طبيعة الأنشطة المنجزة)
                </label>

                {/* Quick Insert Tooltip Bar */}
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.5rem', 
                  marginBottom: '0.75rem', 
                  background: 'rgba(255, 255, 255, 0.01)', 
                  padding: '0.6rem 0.8rem', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border)' 
                }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontWeight: 800, alignSelf: 'center', marginRight: '0.3rem' }}>
                    {isArMode ? 'إدراج سريع:' : 'Insertion rapide :'}
                  </span>
                  
                  {isArMode ? (
                    // Arabic Quick Tags
                    ['تعريف', 'خاصية', 'مبرهنة', 'ملاحظة', 'مثال', 'تطبيق', 'تصحيح'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setFormData(prev => {
                            let nextContent = prev.customContent.trim();
                            if (nextContent === '') {
                              nextContent = `• ${tag}`;
                            } else if (nextContent.endsWith('\n') || prev.customContent.endsWith('\n')) {
                              nextContent = `${prev.customContent}• ${tag}`;
                            } else {
                              nextContent = `${prev.customContent} - ${tag}`;
                            }
                            return { ...prev, customContent: nextContent };
                          });
                        }}
                        className="quick-tag-btn-ar"
                      >
                        + {tag}
                      </button>
                    ))
                  ) : (
                    // French Quick Tags
                    ['Définition', 'Propriété', 'Théorème', 'Remarque', 'Exemple', 'Application', 'Correction'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setFormData(prev => {
                            let nextContent = prev.customContent.trim();
                            if (nextContent === '') {
                              nextContent = `• ${tag}`;
                            } else if (nextContent.endsWith('\n') || prev.customContent.endsWith('\n')) {
                              nextContent = `${prev.customContent}• ${tag}`;
                            } else {
                              nextContent = `${prev.customContent} - ${tag}`;
                            }
                            return { ...prev, customContent: nextContent };
                          });
                        }}
                        className="quick-tag-btn-fr"
                      >
                        + {tag}
                      </button>
                    ))
                  )}
                </div>

                <textarea
                  required
                  rows={5}
                  placeholder={isArMode ? "اكتب تفاصيل الدرس المنجز هنا..." : "Écrivez le contenu couvert dans la séance..."}
                  className="modal-input"
                  value={formData.customContent}
                  onChange={e => setFormData(prev => ({ ...prev, customContent: e.target.value }))}
                  style={{ fontFamily: 'inherit', resize: 'vertical', fontSize: '0.9rem', lineHeight: 1.45 }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-outline"
                  style={{ padding: '0.65rem 1.75rem', borderRadius: '12px', background: 'transparent', fontSize: '0.88rem' }}
                >
                  {isArMode ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  className="btn modal-save-btn"
                  style={{ 
                    padding: '0.65rem 2.25rem', 
                    borderRadius: '12px', 
                    fontSize: '0.88rem'
                  }}
                >
                  <Save size={16} /> {isArMode ? 'حفظ' : 'Enregistrer'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


    </div>
  );
}
