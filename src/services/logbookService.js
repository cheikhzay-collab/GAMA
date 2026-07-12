// src/services/logbookService.js
// Logbook CRUD utilities with localStorage persistence.

export const getLogbookEntries = async (classId) => {
  const saved = localStorage.getItem('logbook_entries');
  const all = saved ? JSON.parse(saved) : [];
  if (classId) {
    return all
      .filter(e => e.classId === classId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }
  return all;
};

export const addLogbookEntry = async (entryData) => {
  const saved = localStorage.getItem('logbook_entries');
  const all = saved ? JSON.parse(saved) : [];
  const newEntry = {
    id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
    ...entryData,
    createdAt: new Date().toISOString()
  };
  all.push(newEntry);
  localStorage.setItem('logbook_entries', JSON.stringify(all));
  return newEntry;
};

export const updateLogbookEntry = async (entryId, updates) => {
  const saved = localStorage.getItem('logbook_entries');
  const all = saved ? JSON.parse(saved) : [];
  const idx = all.findIndex(e => e.id === entryId);
  if (idx > -1) {
    all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
    localStorage.setItem('logbook_entries', JSON.stringify(all));
    return all[idx];
  }
  throw new Error("Entrée non trouvée");
};

export const deleteLogbookEntry = async (entryId) => {
  const saved = localStorage.getItem('logbook_entries');
  let all = saved ? JSON.parse(saved) : [];
  all = all.filter(e => e.id !== entryId);
  localStorage.setItem('logbook_entries', JSON.stringify(all));
  return true;
};
