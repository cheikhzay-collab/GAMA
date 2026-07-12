// src/pages/AdminClassDetail.jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getClassById, updateClass } from '../services/classService';
import { getAllUsers, createUserDoc, updateUserDoc } from '../services/userService';
import { getActiveLessons } from '../services/lessonService';
import { getLogbookEntries } from '../services/logbookService';

import { 
  ArrowLeft, Users, FileSpreadsheet, CheckSquare, Plus, Trash2, 
  Sparkles, CheckCircle2, AlertTriangle, Search, ChevronRight, 
  TrendingUp, Activity, Award, UserPlus, Save, Check, X, Printer
} from 'lucide-react';

const SYSTEM_LEVELS = [
  { id: 'common_core_sci', label: 'Tronc Commun Scientifique' },
  { id: 'common_core_arts', label: 'Tronc Commun Littéraire' },
  { id: '1bac_sci', label: '1ère Bac Sciences Expérimentales' },
  { id: '1bac_arts', label: '1ère Bac Littéraire' },
  { id: '2bac_sm', label: '2ème Bac Sciences Mathématiques' },
  { id: '2bac_pc_svt', label: '2ème Bac Sciences Expérimentales (PC/SVT)' },
  { id: '2bac_arts', label: '2ème Bac Lettres & Sciences Humaines' }
];

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

export default function AdminClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshAdminData } = useAuth();

  // Guard role
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Component States
  const [classObj, setClassObj] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('students'); // 'students', 'homework', 'grades'
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals / Editing States
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ massarCode: '', name: '', dob: '' });
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [columnType, setColumnType] = useState('homework'); // 'homework' or 'grades'
  
  // Grade Editing Inline
  const [editingCell, setEditingCell] = useState(null); // { massarCode, controlName }
  const [editValue, setEditValue] = useState('');
  
  // Programme States
  const [lessons, setLessons] = useState([]);
  const [logbookEntries, setLogbookEntries] = useState([]);
  const [selectedProgramLessonId, setSelectedProgramLessonId] = useState('');
  const [customProgramTitle, setCustomProgramTitle] = useState('');


  const fetchData = async () => {
    setLoading(true);
    try {
      const cls = await getClassById(id);
      if (!cls) {
        setError("Cette classe n'existe pas.");
        return;
      }
      setClassObj(cls);
      const allUsers = await getAllUsers();
      const clsStudents = allUsers.filter(u => u.role === 'student' && u.classId === id);
      setStudents(clsStudents);

      // Fetch all active lessons
      const activeLessons = await getActiveLessons();
      setLessons(activeLessons);
      // Fetch logbook entries for the class
      const entries = await getLogbookEntries(id);
      setLogbookEntries(entries);
    } catch (err) {
      console.error(err);
      setError('Erreur lors du chargement des détails de la classe.');
    } finally {
      setLoading(false);
    }
  };

  // Add item to Class Program
  const handleAddProgramItem = async (e) => {
    e.preventDefault();
    if (!selectedProgramLessonId && !customProgramTitle.trim()) {
      setError("Veuillez sélectionner un cours ou saisir un titre personnalisé.");
      return;
    }

    try {
      let newItem = null;
      if (selectedProgramLessonId) {
        const found = lessons.find(l => l.id === selectedProgramLessonId);
        if (found) {
          newItem = {
            id: 'prog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            type: found.docType || 'course',
            title: found.title,
            lessonId: found.id
          };
        }
      } else {
        newItem = {
          id: 'prog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          type: 'custom',
          title: customProgramTitle.trim(),
          lessonId: null
        };
      }

      if (newItem) {
        const nextProgram = [...(classObj.program || []), newItem];
        setClassObj(prev => ({ ...prev, program: nextProgram }));
        await updateClass(id, { program: nextProgram });
        
        setSelectedProgramLessonId('');
        setCustomProgramTitle('');
        setSuccess("Élément ajouté au programme.");
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'ajout au programme.");
    }
  };

  // Reorder program items (swap index)
  const handleMoveProgramItem = async (index, direction) => {
    const nextProgram = [...(classObj.program || [])];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= nextProgram.length) return;

    // Swap
    const temp = nextProgram[index];
    nextProgram[index] = nextProgram[targetIdx];
    nextProgram[targetIdx] = temp;

    setClassObj(prev => ({ ...prev, program: nextProgram }));
    try {
      await updateClass(id, { program: nextProgram });
    } catch (err) {
      console.error(err);
      setError("Erreur de sauvegarde de l'ordre.");
    }
  };

  // Remove program item
  const handleRemoveProgramItem = async (index) => {
    if (!window.confirm("Retirer cet élément du programme ?")) return;
    const nextProgram = (classObj.program || []).filter((_, idx) => idx !== index);

    setClassObj(prev => ({ ...prev, program: nextProgram }));
    try {
      await updateClass(id, { program: nextProgram });
      setSuccess("Élément retiré du programme.");
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Erreur de sauvegarde de la suppression.");
    }
  };

  // Calculate status of program item relative to logbook entries
  const getProgramItemStatus = (item) => {
    // Collect all covered section titles across all logbook entries
    const coveredSections = new Set();
    logbookEntries.forEach(entry => {
      if (entry.selectedSections && Array.isArray(entry.selectedSections)) {
        entry.selectedSections.forEach(s => coveredSections.add(s));
      }
    });

    if (item.type === 'custom') {
      // Check if custom text is present in logbook entries
      const isLogged = logbookEntries.some(e => 
        (e.customContent && e.customContent.includes(item.title)) ||
        (e.component === 'Contrôle' && item.title.toUpperCase().includes('CONTRÔLE'))
      );
      return isLogged 
        ? { label: 'Terminé', color: 'var(--emerald)', bg: 'rgba(16, 185, 129, 0.08)' } 
        : { label: 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)' };
    }

    if (item.lessonId) {
      const lesson = lessons.find(l => l.id === item.lessonId);
      if (!lesson) return { label: 'N/A', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)' };
      const sections = lesson.content?.sections || [];
      if (sections.length === 0) return { label: 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)' };

      const completedCount = sections.filter(sec => coveredSections.has(sec.title)).length;
      if (completedCount === sections.length) {
        return { label: 'Terminé', color: 'var(--emerald)', bg: 'rgba(16, 185, 129, 0.08)' };
      } else if (completedCount > 0) {
        return { label: `En cours (${completedCount}/${sections.length})`, color: 'var(--violet)', bg: 'var(--violet-soft)' };
      } else {
        return { label: 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)' };
      }
    }

    return { label: 'Non commencé', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)' };
  };


  useEffect(() => {
    fetchData();
  }, [id]);

  // Add student manually
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.massarCode || !newStudent.name) {
      setError('Veuillez remplir le code Massar et le nom.');
      return;
    }
    setLoading(true);
    try {
      const dobStr = newStudent.dob || '01/01/2009';
      const cleanPassword = dobStr.replace(/\//g, '');
      const studentEmail = `${newStudent.massarCode.toLowerCase()}@lconq.ma`;

      await createUserDoc(newStudent.massarCode, {
        name: newStudent.name,
        email: studentEmail,
        role: 'student',
        tier: 'premium',
        xp: 0,
        school: 'Lycée Qualifiant 18 Novembre',
        classId: id,
        crm: { 
          stage: 'Lead', 
          notes: [`Ajouté manuellement à la classe ${id}. Date de Naissance : ${dobStr}`], 
          reminders: [], 
          interactions: [] 
        }
      });

      // Update studentCount
      await updateClass(id, {
        studentCount: (classObj.studentCount || 0) + 1
      });

      setSuccess(`L'élève ${newStudent.name} a été ajouté.`);
      setNewStudent({ massarCode: '', name: '', dob: '' });
      setShowAddStudent(false);
      await refreshAdminData();
      await fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'ajout de l'élève.");
    } finally {
      setLoading(false);
    }
  };

  // Remove student from class
  const handleRemoveStudent = async (studentId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir retirer cet élève de la classe ?")) return;
    setLoading(true);
    try {
      await updateUserDoc(studentId, { classId: null });
      await updateClass(id, {
        studentCount: Math.max(0, (classObj.studentCount || 0) - 1)
      });
      setSuccess("L'élève a été retiré de la classe.");
      await refreshAdminData();
      await fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Erreur lors du retrait de l'élève.");
    } finally {
      setLoading(false);
    }
  };

  // Add Homework or Control Column
  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    setLoading(true);
    try {
      const colName = newColumnName.trim();
      if (columnType === 'homework') {
        const homeworkData = classObj.homework || {};
        // Initialize for all students
        students.forEach(s => {
          if (!homeworkData[s.id]) homeworkData[s.id] = {};
          homeworkData[s.id][colName] = false;
        });
        await updateClass(id, { homework: homeworkData });
      } else {
        const controlsList = [...(classObj.controls || [])];
        if (controlsList.includes(colName)) {
          setError("Ce contrôle existe déjà.");
          setLoading(false);
          return;
        }
        controlsList.push(colName);
        const gradesData = classObj.grades || {};
        students.forEach(s => {
          if (!gradesData[s.id]) gradesData[s.id] = {};
          gradesData[s.id][colName] = null;
        });
        await updateClass(id, { 
          controls: controlsList,
          grades: gradesData
        });
      }

      setSuccess(`Colonne "${colName}" ajoutée.`);
      setNewColumnName('');
      setShowAddColumn(false);
      await fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'ajout de la colonne.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle Homework checkmark
  const handleToggleHomework = async (studentId, hwName) => {
    try {
      const homeworkData = { ...(classObj.homework || {}) };
      if (!homeworkData[studentId]) homeworkData[studentId] = {};
      homeworkData[studentId][hwName] = !homeworkData[studentId][hwName];
      
      // Optimistic state update
      setClassObj(prev => ({
        ...prev,
        homework: homeworkData
      }));

      await updateClass(id, { homework: homeworkData });
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la modification du devoir.");
    }
  };

  // Enter edit mode for cell
  const startEditCell = (massarCode, controlName, currentVal) => {
    setEditingCell({ massarCode, controlName });
    setEditValue(currentVal !== null && currentVal !== undefined ? String(currentVal) : '');
  };

  // Save grade value
  const handleSaveGrade = async () => {
    if (!editingCell) return;
    const { massarCode, controlName } = editingCell;
    const parsed = editValue.trim() === '' ? null : parseFloat(editValue.replace(',', '.'));
    
    if (parsed !== null && (isNaN(parsed) || parsed < 0 || parsed > 20)) {
      alert("La note doit être un nombre valide entre 0 et 20.");
      return;
    }

    try {
      const gradesData = { ...(classObj.grades || {}) };
      if (!gradesData[massarCode]) gradesData[massarCode] = {};
      gradesData[massarCode][controlName] = parsed;

      // Optimistic update
      setClassObj(prev => ({
        ...prev,
        grades: gradesData
      }));

      setEditingCell(null);
      await updateClass(id, { grades: gradesData });
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la sauvegarde de la note.");
    }
  };

  // Calculate statistics for each Control Column
  const controlStats = useMemo(() => {
    if (!classObj || !classObj.controls || students.length === 0) return {};
    
    const stats = {};
    classObj.controls.forEach(col => {
      const gradesList = students
        .map(s => {
          const sGrades = classObj.grades?.[s.id] || classObj.grades?.[s.massarCode] || {};
          return sGrades[col];
        })
        .filter(g => g !== null && g !== undefined && !isNaN(g));

      if (gradesList.length > 0) {
        const sum = gradesList.reduce((acc, curr) => acc + curr, 0);
        const avg = sum / gradesList.length;
        const min = Math.min(...gradesList);
        const max = Math.max(...gradesList);
        stats[col] = {
          avg: parseFloat(avg.toFixed(2)),
          min: parseFloat(min.toFixed(2)),
          max: parseFloat(max.toFixed(2)),
          count: gradesList.length
        };
      } else {
        stats[col] = { avg: '-', min: '-', max: '-', count: 0 };
      }
    });
    return stats;
  }, [classObj, students]);

  // Filter students by search term
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const nameMatch = s.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const massarMatch = s.massarCode?.toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch || massarMatch;
    });
  }, [students, searchTerm]);

  // Get homework list from students' homework data
  const homeworkList = useMemo(() => {
    if (!classObj || !classObj.homework) return [];
    const keys = new Set();
    Object.values(classObj.homework).forEach(hwObj => {
      if (hwObj) {
        Object.keys(hwObj).forEach(k => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [classObj]);

  // Print generation handler
  const handlePrint = (printType) => {
    let printHTML = '';
    const schoolYear = '2025/2026';
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const levelLabel = SYSTEM_LEVELS.find(lvl => lvl.id === classObj.level)?.label || classObj.level;

    // Header styling
    const htmlHeader = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Impression - ${classObj.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          
          @page {
            size: A4 portrait;
            margin: 0.5cm 0.7cm;
          }
          
          body { 
            font-family: 'Inter', sans-serif; 
            color: #0f172a; 
            background: #fff; 
            margin: 0; 
            padding: 0;
            font-size: 11px; 
            line-height: 1.3; 
          }
          
          .print-header-modern {
            margin-bottom: 14px;
          }
          
          .header-top-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
          }
          
          .logo-text {
            font-size: 18px;
            font-weight: 800;
            letter-spacing: -0.04em;
            color: #4f46e5;
          }
          
          .year-badge {
            font-size: 10px;
            font-weight: 800;
            background: #4f46e5;
            color: #ffffff;
            padding: 2px 6px;
            border-radius: 4px;
            margin-left: 6px;
            display: inline-block;
            vertical-align: middle;
          }
          
          .sub-text {
            font-size: 10px;
            color: #475569;
            margin-top: 2px;
            font-weight: 500;
          }
          
          .header-right {
            text-align: right;
          }
          
          .header-right strong {
            font-size: 12px;
            color: #0f172a;
          }
          
          .gradient-bar {
            height: 3px;
            background-color: #4f46e5;
            border-radius: 2px;
            margin-top: 4px;
          }

          .print-title-card {
            text-align: center;
            margin: 12px 0;
            padding: 8px 12px;
            background: #f8fafc;
            border: 2px solid #0f172a;
            border-radius: 6px;
          }
          
          .print-title {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.05em;
            margin: 0;
            text-transform: uppercase;
          }
          
          .print-meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin: 10px 0 14px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 8px 12px;
          }
          
          .meta-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          
          .meta-label {
            font-size: 8px;
            font-weight: 800;
            color: #64748b;
            letter-spacing: 0.06em;
            margin-bottom: 2px;
          }
          
          .meta-value {
            font-size: 11px;
            font-weight: 700;
            color: #0f172a;
          }
          
          .print-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 8px; 
            font-size: 10px;
          }
          
          .print-table th { 
            background-color: #f1f5f9; 
            color: #0f172a;
            font-weight: 800; 
            text-transform: uppercase;
            font-size: 9px; 
            letter-spacing: 0.04em;
            border: 1.5px solid #0f172a; 
            padding: 5px 6px; 
            text-align: left;
          }
          
          .print-table td { 
            border: 1px solid #cbd5e1; 
            padding: 4px 6px; 
            color: #0f172a;
            line-height: 1.15;
          }
          
          .print-table tr:nth-child(even) {
            background-color: #f8fafc;
          }
          
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          
          .print-signature {
            margin-top: 15px;
            display: flex;
            justify-content: flex-end;
          }
          
          .signature-card {
            border: 1px dashed #cbd5e1;
            border-radius: 6px;
            padding: 8px 15px;
            width: 200px;
            text-align: center;
            font-size: 9.5px;
            font-weight: 700;
            color: #475569;
          }
          
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="print-header-modern">
          <div class="header-top-row">
            <div class="header-left">
              <span class="logo-text">L'CONQ</span> <span class="year-badge">2026</span>
              <div class="sub-text">Plateforme de Suivi Pédagogique</div>
            </div>
            <div class="header-right" style="text-align: right;">
              <strong>Lycée Qualifiant 18 Novembre</strong>
              <div class="sub-text">Année Scolaire : 2025/2026</div>
            </div>
          </div>
          <div class="gradient-bar"></div>
        </div>
    `;

    const teacherName = user?.name || 'Enseignant';

    const htmlFooter = `
        <div class="print-signature">
          <div class="signature-card">
            Signature de l'Enseignant<br/>
            <span style="font-weight: 800; font-size: 11px; color: #0f172a; display: block; margin-top: 5px;">${teacherName}</span>
          </div>
        </div>
      </body>
      </html>
    `;

    if (printType === 'list') {
      printHTML += htmlHeader;
      printHTML += `
        <div class="print-title-card">
          <h2 class="print-title">Liste Officielle des Élèves</h2>
        </div>
        <div class="print-meta-grid">
          <div class="meta-item">
            <span class="meta-label">CLASSE</span>
            <span class="meta-value">${classObj.name}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">NIVEAU</span>
            <span class="meta-value">${levelLabel}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">EFFECTIF</span>
            <span class="meta-value">${students.length} Élèves</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">DATE D'ÉDITION</span>
            <span class="meta-value">${dateStr}</span>
          </div>
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 5%;" class="text-center">N°</th>
              <th style="width: 25%;">Code Massar</th>
              <th style="width: 40%;">Nom & Prénom</th>
              <th style="width: 15%;" class="text-center">Né(e) le</th>
              <th style="width: 15%;" class="text-center">Émargement</th>
            </tr>
          </thead>
          <tbody>
      `;
      students.forEach((s, idx) => {
        const dob = s.crm?.notes?.[0]?.split('Naissance : ')[1] || '01/01/2009';
        printHTML += `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${s.massarCode || s.id}</strong></td>
            <td>${s.name}</td>
            <td class="text-center">${dob}</td>
            <td></td>
          </tr>
        `;
      });
      printHTML += `
          </tbody>
        </table>
      `;
      printHTML += htmlFooter;
    } else if (printType === 'homework') {
      printHTML += htmlHeader;
      printHTML += `
        <div class="print-title-card">
          <h2 class="print-title">Fiche de Suivi des Devoirs de Maison</h2>
        </div>
        <div class="print-meta-grid">
          <div class="meta-item">
            <span class="meta-label">CLASSE</span>
            <span class="meta-value">${classObj.name}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">NIVEAU</span>
            <span class="meta-value">${levelLabel}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">MATIÈRE</span>
            <span class="meta-value">Physique-Chimie</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">DATE DE SUIVI</span>
            <span class="meta-value">${dateStr}</span>
          </div>
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 5%;" class="text-center">N°</th>
              <th style="width: 30%;">Nom & Prénom</th>
      `;
      homeworkList.forEach(hw => {
        printHTML += `<th class="text-center">${hw}</th>`;
      });
      printHTML += `
              <th style="width: 25%;">Observations</th>
            </tr>
          </thead>
          <tbody>
      `;
      students.forEach((s, idx) => {
        printHTML += `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${s.name}</strong></td>
        `;
        homeworkList.forEach(hw => {
          const isDone = classObj.homework?.[s.id]?.[hw] || false;
          printHTML += `<td class="text-center" style="font-weight: bold; font-size: 11px;">${isDone ? '✓' : '☐'}</td>`;
        });
        printHTML += `
            <td></td>
          </tr>
        `;
      });
      printHTML += `
          </tbody>
        </table>
      `;
      printHTML += htmlFooter;
    } else if (printType === 'grades') {
      printHTML += htmlHeader;
      printHTML += `
        <div class="print-title-card">
          <h2 class="print-title">Bulletin de Notes des Contrôles Continus</h2>
        </div>
        <div class="print-meta-grid">
          <div class="meta-item">
            <span class="meta-label">CLASSE</span>
            <span class="meta-value">${classObj.name}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">NIVEAU</span>
            <span class="meta-value">${levelLabel}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">MATIÈRE</span>
            <span class="meta-value">Physique-Chimie</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">MISE À JOUR</span>
            <span class="meta-value">${dateStr}</span>
          </div>
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 5%;" class="text-center">N°</th>
              <th style="width: 35%;">Nom & Prénom</th>
      `;
      (classObj.controls || []).forEach(col => {
        printHTML += `<th class="text-center">${col}</th>`;
      });
      printHTML += `
              <th class="text-center" style="width: 15%;">Moyenne</th>
            </tr>
          </thead>
          <tbody>
      `;
      students.forEach((s, idx) => {
        printHTML += `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${s.name}</strong></td>
        `;
        let sum = 0;
        let count = 0;
        (classObj.controls || []).forEach(col => {
          const studentKey = s.id?.toUpperCase();
          const emailPrefix = s.email?.split('@')[0]?.toUpperCase();
          const studentGrades = classObj.grades?.[s.id] || 
                                classObj.grades?.[studentKey] || 
                                classObj.grades?.[emailPrefix] || 
                                {};
          const grade = studentGrades[col];
          const hasGrade = grade !== null && grade !== undefined && !isNaN(grade);
          printHTML += `<td class="text-center">${hasGrade ? grade : '-'}</td>`;
          if (hasGrade) {
            sum += grade;
            count++;
          }
        });
        const avg = count > 0 ? (sum / count).toFixed(2) : '-';
        printHTML += `<td class="text-center" style="font-weight: bold; background-color: #f8fafc;">${avg}</td>`;
        printHTML += `</tr>`;
      });

      // Stats row
      printHTML += `
        <tr style="background-color: #f1f5f9; font-weight: 700;">
          <td colspan="2" class="text-right">Moyenne de Classe :</td>
      `;
      (classObj.controls || []).forEach(col => {
        const stat = controlStats[col];
        printHTML += `<td class="text-center" style="color: #4f46e5;">${stat?.avg !== '-' ? stat?.avg : '-'}</td>`;
      });
      printHTML += `
          <td style="background-color: #e2e8f0;"></td>
        </tr>
        <tr style="background-color: #f8fafc; font-size: 8px; color: #475569; font-weight: 600;">
          <td colspan="2" class="text-right">Note Min / Max :</td>
      `;
      (classObj.controls || []).forEach(col => {
        const stat = controlStats[col];
        printHTML += `<td class="text-center">${stat?.min !== '-' ? `${stat?.min} / ${stat?.max}` : '-'}</td>`;
      });
      printHTML += `
          <td></td>
        </tr>
      `;

      printHTML += `
          </tbody>
        </table>
      `;
      printHTML += htmlFooter;
    }

    try {
      localStorage.setItem('print_html', printHTML);
      window.open('/print', '_blank');
    } catch (err) {
      console.error('Printing error:', err);
      alert('Impossible d\'ouvrir la page d\'impression.');
    }
  };

  if (loading && !classObj) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-muted)' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.1)', borderTop: '3px solid var(--violet)', animation: 'spinDetail 1s linear infinite', marginBottom: '1rem' }} />
        <p>Chargement des informations de la section...</p>
        <style>{`@keyframes spinDetail { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem', position: 'relative' }}>
      
      {/* Back button */}
      <button 
        onClick={() => navigate('/admin/classes')} 
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          background: 'none', border: 'none', color: 'var(--text-muted)',
          fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', marginBottom: '1.5rem',
          transition: 'color 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--violet)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <ArrowLeft size={16} /> Retour aux classes
      </button>

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
            <span style={{ 
              background: 'linear-gradient(135deg, var(--violet), var(--emerald))', 
              color: 'white', fontWeight: 900, fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '6px' 
            }}>
              SECTION
            </span>
            <span style={{ 
              background: classObj.language === 'ar' ? 'var(--warning)' : 'var(--violet)', 
              color: 'white', fontWeight: 900, fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '6px' 
            }}>
              {classObj.language === 'ar' ? 'Option Arabe' : 'Option Français (BIOF)'}
            </span>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{classObj.name}</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            Niveau : <strong>{SYSTEM_LEVELS.find(lvl => lvl.id === classObj.level)?.label || classObj.level}</strong> 
            • Effectif : <strong>{students.length} élèves</strong>
            • Langue : 
            <select
              value={classObj.language || 'fr'}
              onChange={async (e) => {
                const newLang = e.target.value;
                try {
                  setClassObj(prev => ({ ...prev, language: newLang }));
                  await updateClass(id, { language: newLang });
                  setSuccess("La langue de la classe a été mise à jour.");
                  setTimeout(() => setSuccess(''), 3000);
                } catch (err) {
                  console.error(err);
                  setError("Impossible de modifier la langue de la classe.");
                  setTimeout(() => setError(''), 3000);
                }
              }}
              className="input-control"
              style={{
                display: 'inline-block',
                width: 'auto',
                padding: '0.15rem 1.75rem 0.15rem 0.5rem',
                fontSize: '0.8rem',
                height: 'auto',
                fontWeight: 700,
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-glass)',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <option value="fr">Option Français (BIOF)</option>
              <option value="ar">Option Arabe</option>
            </select>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {activeTab === 'students' && (
            <>
              <button 
                onClick={() => handlePrint('list')}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px'
                }}
              >
                <Printer size={15} /> Imprimer la Liste
              </button>
              <button 
                onClick={() => setShowAddStudent(true)}
                className="btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--violet), var(--emerald))', border: 'none'
                }}
              >
                <UserPlus size={16} /> Ajouter un élève
              </button>
            </>
          )}

          {activeTab === 'homework' && (
            <>
              <button 
                onClick={() => handlePrint('homework')}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px'
                }}
              >
                <Printer size={15} /> Imprimer Suivi Devoirs
              </button>
              <button 
                onClick={() => {
                  setColumnType('homework');
                  setShowAddColumn(true);
                }}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px'
                }}
              >
                <Plus size={16} /> Ajouter un devoir
              </button>
            </>
          )}

          {activeTab === 'grades' && (
            <>
              <button 
                onClick={() => handlePrint('grades')}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px'
                }}
              >
                <Printer size={15} /> Imprimer les Notes
              </button>
              <button 
                onClick={() => {
                  setColumnType('grades');
                  setShowAddColumn(true);
                }}
                className="btn-outline"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.85rem', padding: '0.6rem 1.1rem', borderRadius: '10px'
                }}
              >
                <Plus size={16} /> Ajouter un contrôle
              </button>
            </>
          )}
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '1rem', color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={20} />
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}
      {success && (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid var(--emerald)', borderRadius: '12px', padding: '1rem', color: 'var(--emerald)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle2 size={20} />
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{success}</p>
        </div>
      )}

      {/* Tabs list */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '2rem', gap: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('students')}
          style={{
            background: 'none', border: 'none', padding: '0.75rem 0.25rem',
            color: activeTab === 'students' ? 'var(--violet)' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
            borderBottom: activeTab === 'students' ? '2.5px solid var(--violet)' : 'none',
            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s'
          }}
        >
          <Users size={16} /> Liste des Élèves
        </button>

        <button
          onClick={() => setActiveTab('homework')}
          style={{
            background: 'none', border: 'none', padding: '0.75rem 0.25rem',
            color: activeTab === 'homework' ? 'var(--violet)' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
            borderBottom: activeTab === 'homework' ? '2.5px solid var(--violet)' : 'none',
            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s'
          }}
        >
          <CheckSquare size={16} /> Suivi des Devoirs
        </button>

        <button
          onClick={() => setActiveTab('grades')}
          style={{
            background: 'none', border: 'none', padding: '0.75rem 0.25rem',
            color: activeTab === 'grades' ? 'var(--violet)' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
            borderBottom: activeTab === 'grades' ? '2.5px solid var(--violet)' : 'none',
            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s'
          }}
        >
          <FileSpreadsheet size={16} /> Notes des Contrôles (Féroods)
        </button>

        <button
          onClick={() => setActiveTab('program')}
          style={{
            background: 'none', border: 'none', padding: '0.75rem 0.25rem',
            color: activeTab === 'program' ? 'var(--violet)' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
            borderBottom: activeTab === 'program' ? '2.5px solid var(--violet)' : 'none',
            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s'
          }}
        >
          <Activity size={16} /> Programme
        </button>
      </div>

      {/* Search Input for active tab */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
          <Search size={17} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Rechercher par nom ou code Massar..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', padding: '0.65rem 1rem 0.65rem 2.8rem', background: 'var(--bg-glass)', 
              border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-main)', outline: 'none',
              fontSize: '0.85rem'
            }}
          />
        </div>
      </div>

      {/* Tab 1: Students list */}
      {activeTab === 'students' && (
        <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Élève</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Code Massar</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date Naissance</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Identifiants par défaut</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Users size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>Aucun élève trouvé.</p>
                    </td>
                  </tr>
                ) : filteredStudents.map(s => {
                  const plainPass = s.joined ? '••••••••' : (s.crm?.notes?.[0]?.split('Naissance : ')[1]?.replace(/\//g, '') || '31052009');
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ 
                            width: '32px', height: '32px', borderRadius: '50%', 
                            background: 'linear-gradient(45deg, var(--violet), var(--emerald))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'white', fontSize: '0.82rem'
                          }}>
                            {s.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>{s.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                        {s.massarCode || s.id}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {s.crm?.notes?.[0]?.split('Naissance : ')[1] || '01/01/2009'}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div>Email: <code style={{ color: 'var(--emerald)' }}>{s.email}</code></div>
                          <div>Pass: <code style={{ color: 'var(--violet)' }}>{plainPass}</code></div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleRemoveStudent(s.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger-hover)', cursor: 'pointer', padding: '0.25rem' }}
                          title="Retirer de la classe"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Homework Tracker */}
      {activeTab === 'homework' && (
        <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ borderCollapse: 'collapse', textAlign: 'left', minWidth: '100%' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', minWidth: '220px', sticky: 'left', background: 'var(--bg-card)' }}>Élève</th>
                  {homeworkList.map((hw, idx) => (
                    <th key={idx} style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center', minWidth: '130px' }}>
                      {hw}
                    </th>
                  ))}
                  {homeworkList.length === 0 && (
                    <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>Aucun devoir enregistré</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={homeworkList.length + 1} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <CheckSquare size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>Aucun élève trouvé.</p>
                    </td>
                  </tr>
                ) : filteredStudents.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem', sticky: 'left', background: 'var(--bg-card)' }}>
                      {s.name}
                    </td>
                    {homeworkList.map((hw, idx) => {
                      const isChecked = classObj.homework?.[s.id]?.[hw] || false;
                      return (
                        <td key={idx} style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleHomework(s.id, hw)}
                            style={{ 
                              width: '18px', height: '18px', cursor: 'pointer',
                              accentColor: 'var(--violet)'
                            }}
                          />
                        </td>
                      );
                    })}
                    {homeworkList.length === 0 && (
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-subtle)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                        Cliquez sur "Ajouter un devoir" en haut à droite pour commencer le suivi.
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Grades Tracker */}
      {activeTab === 'grades' && (
        <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ borderCollapse: 'collapse', textAlign: 'left', minWidth: '100%' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', minWidth: '220px' }}>Élève</th>
                  {(classObj.controls || []).map((col, idx) => (
                    <th key={idx} style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center', minWidth: '150px' }}>
                      {col}
                    </th>
                  ))}
                  {(classObj.controls || []).length === 0 && (
                    <th style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>Aucun contrôle enregistré</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={(classObj.controls || []).length + 1} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <FileSpreadsheet size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>Aucun élève trouvé.</p>
                    </td>
                  </tr>
                ) : filteredStudents.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                      {s.name}
                    </td>
                    {(classObj.controls || []).map((col, idx) => {
                      // Fetch grades by s.id, uppercase ID, or email prefix
                      const studentKey = s.id?.toUpperCase();
                      const emailPrefix = s.email?.split('@')[0]?.toUpperCase();
                      const studentGrades = classObj.grades?.[s.id] || 
                                            classObj.grades?.[studentKey] || 
                                            classObj.grades?.[emailPrefix] || 
                                            {};
                      const grade = studentGrades[col];
                      
                      const isEditing = editingCell?.massarCode === s.id && editingCell?.controlName === col;

                      return (
                        <td 
                          key={idx} 
                          style={{ padding: '0.8rem 1rem', textAlign: 'center' }}
                        >
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                              <input 
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveGrade();
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                style={{
                                  width: '55px', padding: '0.3rem', background: 'var(--bg-glass)',
                                  border: '1px solid var(--violet)', borderRadius: '6px', color: 'var(--text-main)',
                                  textAlign: 'center', fontSize: '0.82rem', outline: 'none'
                                }}
                                autoFocus
                              />
                              <button onClick={handleSaveGrade} style={{ background: 'var(--violet)', border: 'none', color: 'white', padding: '0.25rem', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}><Check size={12} /></button>
                              <button onClick={() => setEditingCell(null)} style={{ background: 'var(--border)', border: 'none', color: 'var(--text-muted)', padding: '0.25rem', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}><X size={12} /></button>
                            </div>
                          ) : (
                            <div 
                              onClick={() => startEditCell(s.id, col, grade)}
                              style={{ 
                                display: 'inline-block',
                                padding: '0.4rem 0.8rem',
                                borderRadius: '8px',
                                background: grade === null || grade === undefined ? 'rgba(255,255,255,0.03)' : grade >= 10 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                color: grade === null || grade === undefined ? 'var(--text-subtle)' : grade >= 10 ? 'var(--emerald)' : 'var(--danger)',
                                fontWeight: 700,
                                minWidth: '45px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: '1px solid transparent'
                              }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--violet)'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                              title="Double-cliquez pour modifier"
                            >
                              {grade !== null && grade !== undefined ? grade : '-'}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {(classObj.controls || []).length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: '1.5rem', color: 'var(--text-subtle)', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center' }}>
                      Cliquez sur "Ajouter un contrôle" en haut à droite pour commencer à saisir les notes.
                    </td>
                  </tr>
                )}

                {/* Stats Row 1: Average */}
                {students.length > 0 && (classObj.controls || []).length > 0 && (
                  <tr style={{ background: 'rgba(99, 102, 241, 0.03)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 800, color: 'var(--violet)' }}>
                      Moyenne de Classe
                    </td>
                    {(classObj.controls || []).map((col, idx) => {
                      const stat = controlStats[col];
                      return (
                        <td key={idx} style={{ padding: '1rem 1.25rem', textAlign: 'center', fontWeight: 800, color: 'var(--violet)' }}>
                          {stat?.avg !== '-' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <TrendingUp size={14} /> {stat?.avg} / 20
                            </span>
                          ) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                )}

                {/* Stats Row 2: Min / Max */}
                {students.length > 0 && (classObj.controls || []).length > 0 && (
                  <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.8rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      Notes Min / Max
                    </td>
                    {(classObj.controls || []).map((col, idx) => {
                      const stat = controlStats[col];
                      return (
                        <td key={idx} style={{ padding: '0.8rem 1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                          {stat?.min !== '-' ? `${stat?.min} / ${stat?.max}` : '-'}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Programme */}
      {activeTab === 'program' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Progress Header Panel */}
          {(() => {
            const programItems = classObj.program || [];
            const completedCount = programItems.filter(item => {
              const status = getProgramItemStatus(item);
              return status.label === 'Terminé';
            }).length;
            const progressPct = programItems.length > 0 ? Math.round((completedCount / programItems.length) * 100) : 0;
            
            return (
              <div className="glass-panel" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '2.5rem', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Progression Globale du Programme</h3>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    Vous avez complété <strong>{completedCount}</strong> sur <strong>{programItems.length}</strong> éléments planifiés pour cette classe.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(124, 58, 237, 0.05)', border: '4px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 900, color: progressPct === 100 ? 'var(--emerald)' : 'var(--violet)' }}>{progressPct}%</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.1rem' }}>Complété</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* List and Plan Section Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'flex-start' }}>
            
            {/* 1. Ordered Program Timeline */}
            <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border)', margin: 0 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1.5rem 0' }}>Liste Ordonnée des Activités</h3>
              
              {(!classObj.program || classObj.program.length === 0) ? (
                <div style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FileSpreadsheet size={40} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontWeight: 700, margin: 0 }}>Aucune activité planifiée.</p>
                  <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Utilisez le panneau de droite pour planifier vos premiers cours et contrôles.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {classObj.program.map((item, idx) => {
                    const status = getProgramItemStatus(item);
                    return (
                      <div 
                        key={item.id} 
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)',
                          borderRadius: '12px', padding: '0.85rem 1.25rem', gap: '1rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                          {/* Ordering Number */}
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: 'var(--bg-glass)', border: '1.5px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0
                          }}>
                            {idx + 1}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {/* Type Badge */}
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 800,
                                background: item.type === 'homework' ? 'rgba(239, 68, 68, 0.08)' : item.type === 'exercises' ? 'rgba(245, 158, 11, 0.08)' : item.type === 'course' ? 'rgba(99, 102, 241, 0.08)' : item.type === 'concours' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                                color: item.type === 'homework' ? 'var(--danger)' : item.type === 'exercises' ? 'var(--warning)' : item.type === 'course' ? 'var(--violet)' : item.type === 'concours' ? 'var(--emerald)' : 'var(--text-muted)',
                                padding: '0.15rem 0.45rem', borderRadius: '4px', textTransform: 'uppercase'
                              }}>
                                {item.type === 'homework' ? 'devoir' : item.type === 'exercises' ? 'série' : item.type === 'course' ? 'cours' : item.type === 'concours' ? 'concours' : 'perso'}
                              </span>
                              
                              {/* Status Badge */}
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 800,
                                color: status.color, background: status.bg,
                                padding: '0.15rem 0.45rem', borderRadius: '4px'
                              }}>
                                {status.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions (Reordering & Deleting) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveProgramItem(idx, 'up')}
                            style={{
                              background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                              width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'rgba(255,255,255,0.05)' : 'var(--text-muted)',
                              transition: 'all 0.2s'
                            }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === classObj.program.length - 1}
                            onClick={() => handleMoveProgramItem(idx, 'down')}
                            style={{
                              background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                              width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: idx === classObj.program.length - 1 ? 'not-allowed' : 'pointer', color: idx === classObj.program.length - 1 ? 'rgba(255,255,255,0.05)' : 'var(--text-muted)',
                              transition: 'all 0.2s'
                            }}
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveProgramItem(idx)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.03)', border: '1px solid var(--border)', borderRadius: '6px',
                              width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: 'var(--danger)', transition: 'all 0.2s', marginLeft: '0.25rem'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Planning Form */}
            <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border)', margin: 0 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1.25rem 0' }}>Planifier une Activité</h3>
              
              <form onSubmit={handleAddProgramItem} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="input-group">
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Sélectionner une fiche de cours</label>
                  <select
                    className="input-control"
                    value={selectedProgramLessonId}
                    onChange={e => {
                      setSelectedProgramLessonId(e.target.value);
                      if (e.target.value) setCustomProgramTitle('');
                    }}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="">-- Choisir un cours / série --</option>
                    {lessons
                      .filter(l => normalizeLevel(l.level) === classObj.level)
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {l.docType === 'exercises' ? '📝 ' : l.docType === 'homework' ? '📑 ' : '📖 '} 
                          {l.title} ({l.subject})
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-subtle)', fontWeight: 700, margin: '0.2rem 0' }}>— OU / أو —</div>

                <div className="input-group">
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Titre personnalisé / عنوان خاص</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Ex: Contrôle N°1 ou Séance de soutien"
                    value={customProgramTitle}
                    onChange={e => {
                      setCustomProgramTitle(e.target.value);
                      if (e.target.value) setSelectedProgramLessonId('');
                    }}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn"
                  style={{
                    width: '100%', padding: '0.65rem', borderRadius: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    background: 'linear-gradient(135deg, var(--violet), var(--emerald))', border: 'none',
                    fontWeight: 800, fontSize: '0.85rem', marginTop: '0.5rem'
                  }}
                >
                  <Plus size={16} /> Ajouter au programme
                </button>
              </form>

            </div>

          </div>

        </div>
      )}

      {/* Manual Add Student Modal */}
      {showAddStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifycontent: 'center', zIndex: 9999 }}>
          <div className="glass-panel animate-scale-in" style={{ padding: '2rem', maxWidth: '440px', width: '95%', border: '1px solid var(--border)', position: 'relative', margin: 'auto' }}>
            <button 
              onClick={() => setShowAddStudent(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserPlus size={20} className="text-violet" /> Ajouter un Élève Manuellement
            </h3>

            <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem' }}>Code Massar (Identifiant)</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="Ex: N152008459"
                  value={newStudent.massarCode}
                  onChange={(e) => setNewStudent({ ...newStudent, massarCode: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div className="input-group">
                <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem' }}>Nom Complet</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="Ex: Yassine Belkadi"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  required
                />
              </div>

              <div className="input-group">
                <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem' }}>Date de Naissance</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="Ex: 14/08/2009"
                  value={newStudent.dob}
                  onChange={(e) => setNewStudent({ ...newStudent, dob: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddStudent(false)} className="btn-outline" style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}>Annuler</button>
                <button type="submit" className="btn" style={{ padding: '0.5rem 1.25rem', borderRadius: '8px' }}>Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Homework or Control Column Modal */}
      {showAddColumn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifycontent: 'center', zIndex: 9999 }}>
          <div className="glass-panel animate-scale-in" style={{ padding: '2rem', maxWidth: '420px', width: '95%', border: '1px solid var(--border)', position: 'relative', margin: 'auto' }}>
            <button 
              onClick={() => setShowAddColumn(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} className="text-violet" /> Ajouter {columnType === 'homework' ? 'un Devoir Maison' : 'un Contrôle Continu'}
            </h3>

            <form onSubmit={handleAddColumn} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem' }}>Nom de l'évaluation</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder={columnType === 'homework' ? "Ex: Devoir Maison 2" : "Ex: Contrôle Continu 4"}
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddColumn(false)} className="btn-outline" style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}>Annuler</button>
                <button type="submit" className="btn" style={{ padding: '0.5rem 1.25rem', borderRadius: '8px' }}>Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
