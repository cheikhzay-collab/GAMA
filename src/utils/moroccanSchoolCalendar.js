// src/utils/moroccanSchoolCalendar.js
// Référence officielle du Calendrier Scolaire & des Vacances - Ministère de l'Éducation Nationale (Maroc)
// Règles de gestion temporelle et de validation pour le Cahier de Textes (دفتر النصوص)

export const OFFICIAL_MOROCCAN_HOLIDAYS_2025_2026 = [
  { id: 'hol-1', label: 'عيد المولد النبوي الشريف', labelFr: 'Aïd Al Mawlid Annabawi', startDate: '2025-09-15', endDate: '2025-09-16' },
  { id: 'hol-2', label: 'عطلة الفترة البينية الأولى', labelFr: '1ères Vacances Intermédiaires', startDate: '2025-10-19', endDate: '2025-10-26' },
  { id: 'hol-3', label: 'ذكرى المسيرة الخضراء', labelFr: 'Anniversaire de la Marche Verte', startDate: '2025-11-06', endDate: '2025-11-06' },
  { id: 'hol-4', label: 'عيد الاستقلال', labelFr: 'Fête de l’Indépendance', startDate: '2025-11-18', endDate: '2025-11-18' },
  { id: 'hol-5', label: 'عطلة الفترة البينية الثانية', labelFr: '2èmes Vacances Intermédiaires', startDate: '2025-12-07', endDate: '2025-12-14' },
  { id: 'hol-6', label: 'فاتح السنة الميلادية', labelFr: 'Nouvel An Grégorien', startDate: '2026-01-01', endDate: '2026-01-01' },
  { id: 'hol-7', label: 'ذكرى تقديم وثيقة الاستقلال', labelFr: 'Manifeste de l’Indépendance', startDate: '2026-01-11', endDate: '2026-01-11' },
  { id: 'hol-8', label: 'رأس السنة الأمازيغية', labelFr: 'Nouvel An Amazigh', startDate: '2026-01-14', endDate: '2026-01-14' },
  { id: 'hol-9', label: 'عطلة منتصف السنة الدراسية', labelFr: 'Vacances de Fin de 1er Semestre', startDate: '2026-01-25', endDate: '2026-02-01' },
  { id: 'hol-10', label: 'عطلة الفترة البينية الثالثة', labelFr: '3èmes Vacances Intermédiaires', startDate: '2026-03-15', endDate: '2026-03-22' },
  { id: 'hol-11', label: 'عيد الفطر المبارك', labelFr: 'Aïd Al Fitr', startDate: '2026-03-29', endDate: '2026-04-01' },
  { id: 'hol-12', label: 'عيد الشغل', labelFr: 'Fête du Travail', startDate: '2026-05-01', endDate: '2026-05-01' },
  { id: 'hol-13', label: 'عطلة الفترة البينية الرابعة', labelFr: '4èmes Vacances Intermédiaires', startDate: '2026-05-03', endDate: '2026-05-10' },
  { id: 'hol-14', label: 'عيد الأضحى المبارك', labelFr: 'Aïd Al Adha', startDate: '2026-06-05', endDate: '2026-06-08' }
];

/**
 * Parse une chaîne YYYY-MM-DD en Date locale
 */
export function parseDate(dateStr, isEndOfDay = false) {
  if (!dateStr) return new Date(NaN);
  const [year, month, day] = dateStr.split('-').map(Number);
  const hour = isEndOfDay ? 23 : 0;
  const min = isEndOfDay ? 59 : 0;
  const sec = isEndOfDay ? 59 : 0;
  const ms = isEndOfDay ? 999 : 0;
  return new Date(year, month - 1, day, hour, min, sec, ms);
}

/**
 * Vérifie si une date donnée tombe dans une période d'une vacance scolaire
 */
export function findHolidayForDate(date, holidays = []) {
  if (!date) return null;
  const d = typeof date === 'string' ? parseDate(date, false) : new Date(date);
  d.setHours(12, 0, 0, 0); // midi pour éviter les décalages de fuseau

  return holidays.find(h => {
    const s = parseDate(h.startDate, false);
    const e = parseDate(h.endDate, true);
    return d >= s && d <= e;
  }) || null;
}

/**
 * Vérifie si une date donnée tombe dans une absence / congé enseignant
 */
export function findAbsenceForDate(date, absences = []) {
  if (!date) return null;
  const d = typeof date === 'string' ? parseDate(date, false) : new Date(date);
  d.setHours(12, 0, 0, 0);

  return absences.find(a => {
    const s = parseDate(a.startDate, false);
    const e = parseDate(a.endDate, true);
    return d >= s && d <= e;
  }) || null;
}

/**
 * RÈGLE PÉDAGOGIQUE ROYALE (DARIJA / MAROC):
 * "ماتكتبش وتسيزا فدفتر النصوص حتى يكون داز التاريخ الفعلي ديالها"
 * Une vacance ou une absence ne peut être actée dans le cahier de textes
 * que si sa date/période est EFFECTIVEMENT et ENTIÈREMENT passée par rapport à aujourd'hui.
 */
export function hasHolidayPassed(holiday, referenceDate = new Date()) {
  if (!holiday || !holiday.endDate) return false;
  const holidayEnd = parseDate(holiday.endDate, true);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  return holidayEnd < ref;
}

export function hasAbsencePassed(absence, referenceDate = new Date()) {
  if (!absence || !absence.endDate) return false;
  const absenceEnd = parseDate(absence.endDate, true);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  return absenceEnd < ref;
}
