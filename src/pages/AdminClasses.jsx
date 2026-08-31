// src/pages/AdminClasses.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllClasses, addClass, deleteClass } from '../services/classService';
import { getAllUsers, createUserDoc, updateUserDoc } from '../services/userService';
import * as XLSX from 'xlsx';
import { 
  Users, UploadCloud, FolderOpen, Trash2, CheckCircle2, AlertTriangle, 
  Search, GraduationCap, Calendar, X, Plus, ArrowRight, FileSpreadsheet, ListFilter,
  Sparkles
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const handler = (e) => setIsMobile(e.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function AdminClasses() {
  const { user, refreshAdminData } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Guard role
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Component States
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(null); // id of class to delete

  // Import Modal & States
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parsedClassInfo, setParsedClassInfo] = useState(null); // { name, level, rawLevelText, students: [] }
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Fetch classes and students on mount
  const fetchData = async () => {
    setLoading(true);
    try {
      const cls = await getAllClasses();
      const std = await getAllUsers();
      setClasses(cls || []);
      setStudents(std.filter(u => u.role === 'student') || []);
    } catch (err) {
      console.error(err);
      setError('Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Drag handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Drop handler
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadModalOpen(false);
      await processFile(e.dataTransfer.files[0]);
    }
  };

  // File input handler
  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadModalOpen(false);
      await processFile(e.target.files[0]);
    }
  };

  // Parse Excel file structure
  const processFile = async (file) => {
    setIsProcessingFile(true);
    setError('');
    
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (!rows || rows.length < 5) {
            throw new Error("Le fichier Excel semble vide ou mal structuré.");
          }

          // Scan first 15 rows for Level and Class Name
          let className = '';
          let levelText = '';
          
          for (let r = 0; r < Math.min(rows.length, 15); r++) {
            const row = rows[r];
            if (!row) continue;
            for (let c = 0; c < row.length; c++) {
              const cellVal = String(row[c] || '').trim();
              if (cellVal.includes('المستوى')) {
                if (cellVal.includes(':')) {
                  levelText = cellVal.split(':')[1]?.trim() || '';
                }
                if (!levelText) {
                  levelText = String(row[c + 1] || row[c + 2] || row[c + 3] || '').trim();
                }
              }
              if (cellVal.includes('القسم')) {
                if (cellVal.includes(':')) {
                  className = cellVal.split(':')[1]?.trim() || '';
                }
                if (!className) {
                  className = String(row[c + 1] || row[c + 2] || row[c + 3] || row[c + 4] || '').trim();
                }
              }
            }
          }

          // Smart auto-mapper for Level
          const autoDetectLevel = (levelTxt, classNm) => {
            const txt = (String(levelTxt) + ' ' + String(classNm)).toLowerCase();
            
            if (txt.includes('2bac') || txt.includes('2ème bac') || txt.includes('ثانية باك')) {
              if (txt.includes('math') || txt.includes('رياضية')) return '2bac_sm';
              if (txt.includes('exp') || txt.includes('pc') || txt.includes('svt') || txt.includes('تجريبية') || txt.includes('فيزياء')) return '2bac_pc_svt';
              if (txt.includes('arts') || txt.includes('lettres') || txt.includes('آداب') || txt.includes('إنسانية')) return '2bac_arts';
              return '2bac_pc_svt';
            }
            
            if (txt.includes('1bac') || txt.includes('1ère bac') || txt.includes('أولى باك')) {
              if (txt.includes('arts') || txt.includes('lettres') || txt.includes('آداب') || txt.includes('إنسانية')) return '1bac_arts';
              return '1bac_sci';
            }
            
            if (txt.includes('tc') || txt.includes('tronc') || txt.includes('مشترك')) {
              if (txt.includes('arts') || txt.includes('lettres') || txt.includes('آداب') || txt.includes('إنسانية')) return 'common_core_arts';
              return 'common_core_sci';
            }
            
            // Try startsWith prefixes
            if (classNm.toUpperCase().startsWith('2BAC')) {
              if (classNm.includes('SM')) return '2bac_sm';
              if (classNm.includes('LET')) return '2bac_arts';
              return '2bac_pc_svt';
            }
            if (classNm.toUpperCase().startsWith('1BAC')) {
              if (classNm.includes('LET')) return '1bac_arts';
              return '1bac_sci';
            }
            if (classNm.toUpperCase().startsWith('TC')) {
              if (classNm.includes('LET')) return 'common_core_arts';
              return 'common_core_sci';
            }
            
            return '2bac_pc_svt';
          };

          const autoDetectLanguage = (levelTxt, classNm) => {
            const txt = (String(levelTxt) + ' ' + String(classNm)).toLowerCase();
            if (txt.includes('biof') || txt.includes('french') || txt.includes('français') || txt.includes('francais') || txt.includes('sef') || /-\s*[fF]\s*$/.test(classNm) || classNm.toUpperCase().includes('SEF')) {
              return 'fr';
            }
            if (txt.includes('arabe') || txt.includes('عربي') || txt.includes('العربية')) {
              return 'ar';
            }
            return 'fr';
          };

          const detectedLevel = autoDetectLevel(levelText, className);
          const detectedLanguage = autoDetectLanguage(levelText, className);

          // Robust helpers for column detection
          const isMassarHeader = (val) => {
            const v = String(val || '').toLowerCase().trim();
            return v.includes('مسار') || 
                   v.includes('massar') || 
                   v.includes('رقم التلميذ') || 
                   v.includes('رقم التلميد') || 
                   v.includes('الرقم الوطني') || 
                   v.includes('c.n.e') || 
                   v.includes('cne') || 
                   v.includes('code élève') || 
                   v.includes('code eleve') || 
                   v.includes('code éléve') ||
                   v.includes('code de l\'élève') ||
                   v.includes('code de l’élève');
          };

          const isNameHeader = (val) => {
            const v = String(val || '').toLowerCase().trim();
            return v.includes('إسم التلميذ') || 
                   v.includes('اسم التلميذ') || 
                   v.includes('إسم التلميد') || 
                   v.includes('اسم التلميد') || 
                   v.includes('الاسم والنسب') || 
                   v.includes('الاسم الكامل') || 
                   v.includes('nom') || 
                   v.includes('prénom') || 
                   v.includes('prenom') || 
                   v.includes('élève') || 
                   v.includes('eleve');
          };

          const isDobHeader = (val) => {
            const v = String(val || '').toLowerCase().trim();
            return v.includes('تاريخ') || 
                   v.includes('ازدياد') || 
                   v.includes('إزدياد') || 
                   v.includes('ميلاد') || 
                   v.includes('naissance') || 
                   v.includes('né') || 
                   v.includes('ne le');
          };

          // Find student list headers
          let studentHeaderRowIdx = -1;
          let massarColIdx = -1;
          let nameColIdx = -1;
          let dobColIdx = -1;

          for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            if (!row) continue;
            let foundMassar = -1;
            let foundName = -1;
            let foundDob = -1;

            for (let c = 0; c < row.length; c++) {
              const val = row[c];
              if (val !== undefined && val !== null) {
                if (isMassarHeader(val)) foundMassar = c;
                if (isNameHeader(val)) foundName = c;
                if (isDobHeader(val)) foundDob = c;
              }
            }

            if (foundMassar !== -1 && foundName !== -1) {
              studentHeaderRowIdx = r;
              massarColIdx = foundMassar;
              nameColIdx = foundName;
              if (foundDob !== -1) dobColIdx = foundDob;
              break;
            }
          }

          // Fallbacks for header indices
          if (studentHeaderRowIdx === -1) {
            studentHeaderRowIdx = 16; // default Row 17
            massarColIdx = 2; // Column C
            nameColIdx = 3;   // Column D
            dobColIdx = 4;    // Column E
          }

          // Find controls in the header row or row above
          const controlColIndices = [];
          const checkHeaderRow = (rIdx) => {
            if (rIdx < 0 || rIdx >= rows.length) return;
            const r = rows[rIdx];
            for (let c = 0; c < r.length; c++) {
              const val = String(r[c] || '').trim();
              if (
                val.toLowerCase().includes('contrôle') || 
                val.toLowerCase().includes('controle') || 
                val.includes('فرض') || 
                val.toLowerCase().includes('évaluation') ||
                val.toLowerCase().includes('evaluation')
              ) {
                // Check if this column is a rank/absence column (usually has "رتبة" or "غياب" in subheader)
                const subHeaderVal = studentHeaderRowIdx !== -1 ? String(rows[studentHeaderRowIdx]?.[c] || '').toLowerCase().trim() : '';
                const isExcluded = subHeaderVal.includes('رتبة') || 
                                   subHeaderVal.includes('الرتبة') || 
                                   subHeaderVal.includes('غياب') || 
                                   subHeaderVal.includes('الغياب') || 
                                   subHeaderVal.includes('absence') || 
                                   subHeaderVal.includes('classement') || 
                                   subHeaderVal.includes('coeff');
                
                if (!isExcluded && !controlColIndices.some(col => col.idx === c)) {
                  controlColIndices.push({ name: val, idx: c });
                }
              }
            }
          };

          checkHeaderRow(studentHeaderRowIdx);
          if (studentHeaderRowIdx > 0) {
            checkHeaderRow(studentHeaderRowIdx - 1);
          }

          // Dedup by control name (keeping the first occurrence of each unique name)
          const uniqueControls = [];
          controlColIndices.forEach(col => {
            const cleanName = col.name.trim();
            if (!uniqueControls.some(uc => uc.name === cleanName)) {
              uniqueControls.push({ ...col, name: cleanName });
            }
          });

          const parsedStudents = [];
          const gradesData = {};

          // Relaxed student code validator
          const isValidStudentCode = (code, rIdx) => {
            const cleanCode = String(code || '').replace(/\s+/g, '').toUpperCase();
            if (!cleanCode || rIdx <= studentHeaderRowIdx) return false;
            
            const isStrictMassar = /^[A-Z]\d{7,12}$/i.test(cleanCode);
            const isNumeric = /^\d{5,12}$/.test(cleanCode);
            const isTestAlphanumeric = cleanCode.length >= 5 && !cleanCode.includes('CODE') && !cleanCode.includes('MASSAR') && !cleanCode.includes('رقم') && !cleanCode.includes('تلميذ');
            
            return isStrictMassar || isNumeric || isTestAlphanumeric;
          };

          for (let r = studentHeaderRowIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row) continue;
            
            const rawMassar = String(row[massarColIdx] || '').trim();
            if (isValidStudentCode(rawMassar, r)) {
              const cleanMassar = rawMassar.replace(/\s+/g, '').toUpperCase();
              const name = String(row[nameColIdx] || '').trim();
              
              // Handle Date parsing
              const rawDob = dobColIdx !== -1 ? row[dobColIdx] : null;
              let dobStr = '';
              if (rawDob) {
                if (typeof rawDob === 'string') {
                  dobStr = rawDob.trim();
                } else if (rawDob instanceof Date) {
                  const d = rawDob.getDate().toString().padStart(2, '0');
                  const m = (rawDob.getMonth() + 1).toString().padStart(2, '0');
                  const y = rawDob.getFullYear();
                  dobStr = `${d}/${m}/${y}`;
                } else {
                  dobStr = String(rawDob).trim();
                }
              }

              parsedStudents.push({
                massarCode: cleanMassar,
                name: name || 'Élève Sans Nom',
                dob: dobStr || '01/01/2009'
              });

              // Extract grades for detected unique controls
              gradesData[cleanMassar] = {};
              uniqueControls.forEach(col => {
                const rawGrade = row[col.idx];
                let numGrade = null;
                if (rawGrade !== undefined && rawGrade !== null && rawGrade !== '') {
                  const cleanGrade = String(rawGrade).replace(',', '.');
                  const parsedGrade = parseFloat(cleanGrade);
                  if (!isNaN(parsedGrade)) {
                    numGrade = parsedGrade;
                  }
                }
                gradesData[cleanMassar][col.name] = numGrade;
              });
            }
          }

          if (parsedStudents.length === 0) {
            throw new Error("Aucun élève trouvé avec un code Massar valide dans le tableau.");
          }

          setParsedClassInfo({
            name: className || 'Classe Importée',
            level: detectedLevel,
            language: detectedLanguage,
            rawLevelText: levelText || 'Non spécifié',
            students: parsedStudents,
            controls: uniqueControls,
            grades: gradesData
          });
          setImportModalOpen(true);
        } catch (innerErr) {
          console.error(innerErr);
          setError(innerErr.message);
        } finally {
          setIsProcessingFile(false);
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setIsProcessingFile(false);
    }
  };

  // Perform import
  const executeImport = async () => {
    if (!parsedClassInfo) return;
    setLoading(true);
    try {
      // 1. Create Class with controls and grades metadata
      await addClass({
        id: parsedClassInfo.name,
        name: parsedClassInfo.name,
        level: parsedClassInfo.level,
        language: parsedClassInfo.language || 'fr',
        studentCount: parsedClassInfo.students.length,
        controls: parsedClassInfo.controls.map(c => c.name),
        grades: parsedClassInfo.grades,
        homework: {}
      });

      // 2. Create/update Student Profiles
      for (const std of parsedClassInfo.students) {
        // Password format: date of birth without slashes, ex: '31052009'
        const cleanPassword = std.dob.replace(/\//g, '');
        const studentEmail = `${std.massarCode.toLowerCase()}@lconq.ma`;

        await createUserDoc(std.massarCode, {
          name: std.name,
          email: studentEmail,
          role: 'student',
          tier: 'premium',
          xp: 0,
          school: 'Lycée Qualifiant 18 Novembre',
          classId: parsedClassInfo.name,
          crm: { stage: 'Lead', notes: [`Importé via fichier Excel. Date de Naissance : ${std.dob}`], reminders: [], interactions: [] }
        });
      }

      setSuccess(`La classe "${parsedClassInfo.name}" et ses ${parsedClassInfo.students.length} élèves ont été importés avec succès.`);
      setImportModalOpen(false);
      setParsedClassInfo(null);
      await refreshAdminData();
      await fetchData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'importation finale.");
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDeleteClass = async () => {
    if (!showConfirmDelete) return;
    setLoading(true);
    try {
      // 1. Delete class record
      await deleteClass(showConfirmDelete);
      
      // 2. Clear classId from students
      const classStudents = students.filter(s => s.classId === showConfirmDelete);
      for (const std of classStudents) {
        await updateUserDoc(std.id, { classId: null });
      }

      setSuccess(`La classe "${showConfirmDelete}" a été supprimée.`);
      setShowConfirmDelete(null);
      await refreshAdminData();
      await fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la suppression de la classe.");
    } finally {
      setLoading(false);
    }
  };

  // Filters
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            c.level.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [classes, searchTerm]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', paddingBottom: '3rem' }}>
      
      {/* Glow blobs */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%', width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.05) 0%, transparent 70%)',
        filter: 'blur(85px)', zIndex: 0, pointerEvents: 'none'
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: '14px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(113, 109, 242, 0.15)' }}>
                <FolderOpen size={22} color="#fff" />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-main)' }}>
                Gestion des Classes & Sections
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
              Importez vos fichiers Massar Excel pour configurer vos sections et enregistrer vos élèves automatiquement.
            </p>
          </div>
          
          <button 
            onClick={() => setUploadModalOpen(true)}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
              border: 'none', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.7rem 1.3rem', fontSize: '0.85rem', borderRadius: '12px',
              boxShadow: '0 8px 20px rgba(124, 58, 237, 0.2)'
            }}
          >
            <Plus size={16} /> Importer une classe (Excel)
          </button>
        </header>

        {/* Error / Success */}
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

        {/* Collapsed Upload Excel Box is now inside the uploadModalOpen popup below */}

        {/* Grid and list */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Rechercher une classe..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', background: 'var(--bg-glass)', 
                border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', outline: 'none',
                fontSize: '0.88rem'
              }}
            />
          </div>
        </div>

        {/* Grid of classes */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.1)', borderTop: '3px solid var(--violet)', animation: 'spinCls 1s linear infinite', marginBottom: '1rem' }} />
            <p>Chargement des classes...</p>
            <style>{`@keyframes spinCls { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={44} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
            <p style={{ fontWeight: 700, margin: 0 }}>Aucune classe enregistrée.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Importez un fichier Excel Massar ci-dessus pour configurer votre première classe.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {filteredClasses.map(c => {
              const levelName = SYSTEM_LEVELS.find(lvl => lvl.id === c.level)?.label || c.level;
              return (
                <div 
                  key={c.id} 
                  className="glass-panel hover-card" 
                  onClick={() => navigate(`/admin/classes/${c.id}`)}
                  style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', cursor: 'pointer' }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '0 0 0.3rem 0', color: 'var(--text-main)' }}>{c.name}</h3>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(c.id); }}
                        className="btn-outline" 
                        style={{ border: 'none', background: 'transparent', padding: '0.4rem', color: 'var(--danger-hover)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <GraduationCap size={14} /> {levelName}
                      </span>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        fontWeight: 800, 
                        padding: '0.12rem 0.45rem', 
                        borderRadius: '6px',
                        background: c.language === 'ar' ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
                        color: c.language === 'ar' ? 'var(--warning)' : 'var(--violet)',
                        border: c.language === 'ar' ? '1px solid rgba(245,158,11,0.22)' : '1px solid rgba(99,102,241,0.22)',
                        marginTop: '0.2rem'
                      }}>
                        {c.language === 'ar' ? 'Option Arabe' : 'Option Français (BIOF)'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.8rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                      <Users size={15} /> {c.studentCount} Élèves
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-subtle)', fontSize: '0.72rem' }}>
                      <Calendar size={13} /> {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Delete Modal */}
      {showConfirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-panel animate-scale-in" style={{ padding: '2rem', maxWidth: '440px', width: '90%', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>Supprimer la classe ?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
              Êtes-vous sûr de vouloir supprimer la classe <strong>"{showConfirmDelete}"</strong> ? Les élèves importés de cette classe ne seront pas supprimés, mais ils ne seront plus liés à cette section.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setShowConfirmDelete(null)} className="btn-outline" style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}>Annuler</button>
              <button onClick={handleDeleteClass} className="btn" style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--danger)' }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {importModalOpen && parsedClassInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="glass-panel animate-scale-in" style={{ maxWidth: '750px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', padding: 0 }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileSpreadsheet size={20} className="text-emerald" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>Aperçu de la Classe Massar</h3>
              </div>
              <button onClick={() => setImportModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Scroll Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="input-group">
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem' }}>Nom de la classe (Massar)</label>
                  <input 
                    type="text" 
                    className="input-control" 
                    value={parsedClassInfo.name}
                    onChange={(e) => setParsedClassInfo({ ...parsedClassInfo, name: e.target.value })}
                  />
                </div>
                
                <div className="input-group">
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem' }}>Niveau Scolaire Correspondant</label>
                  <select 
                    className="input-control" 
                    value={parsedClassInfo.level}
                    onChange={(e) => setParsedClassInfo({ ...parsedClassInfo, level: e.target.value })}
                  >
                    {SYSTEM_LEVELS.map(lvl => (
                      <option key={lvl.id} value={lvl.id}>{lvl.label}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.4rem' }}>Langue d'enseignement</label>
                  <select 
                    className="input-control" 
                    value={parsedClassInfo.language || 'fr'}
                    onChange={(e) => setParsedClassInfo({ ...parsedClassInfo, language: e.target.value })}
                  >
                    <option value="fr">Option Français (BIOF)</option>
                    <option value="ar">Option Arabe</option>
                  </select>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <span>Niveau détecté dans le fichier : </span>
                <strong style={{ color: 'var(--text-main)' }}>{parsedClassInfo.rawLevelText}</strong>
              </div>

              {parsedClassInfo.controls && parsedClassInfo.controls.length > 0 && (
                <div style={{ 
                  background: 'rgba(16, 185, 129, 0.08)', 
                  padding: '0.75rem 1rem', 
                  borderRadius: '10px', 
                  fontSize: '0.8rem', 
                  color: 'var(--emerald)', 
                  border: '1px solid rgba(16, 185, 129, 0.2)', 
                  marginBottom: '1.5rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem' 
                }}>
                  <Sparkles size={16} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>{parsedClassInfo.controls.length} contrôles détectés</strong> avec leurs notes et seront importés : <strong>{parsedClassInfo.controls.map(c => c.name).join(', ')}</strong>
                  </span>
                </div>
              )}

              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Users size={16} /> Liste des élèves extraits ({parsedClassInfo.students.length})
              </h4>

              {/* Student Table */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', maxHeight: '250px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.6rem 1rem', fontWeight: 700, color: 'var(--text-subtle)' }}>Code Massar</th>
                      <th style={{ padding: '0.6rem 1rem', fontWeight: 700, color: 'var(--text-subtle)' }}>Nom Complet</th>
                      <th style={{ padding: '0.6rem 1rem', fontWeight: 700, color: 'var(--text-subtle)' }}>Date de Naissance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedClassInfo.students.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: idx === parsedClassInfo.students.length - 1 ? 'none' : '1px solid var(--border)' }}>
                        <td style={{ padding: '0.6rem 1rem', fontWeight: 700, color: 'var(--text-main)' }}>{s.massarCode}</td>
                        <td style={{ padding: '0.6rem 1rem', color: 'var(--text-main)' }}>{s.name}</td>
                        <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)' }}>{s.dob}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--violet-soft)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '0.75rem 1rem', borderRadius: '10px', marginTop: '1.25rem', color: 'var(--violet)' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '0.78rem', margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                  Chaque élève se verra attribuer un identifiant unique (Code Massar), un e-mail par défaut (<code>code@lconq.ma</code>), et un mot de passe par défaut généré à partir de sa date de naissance sans slashes (ex: <code>31052009</code>).
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                onClick={() => setImportModalOpen(false)} 
                className="btn-outline" 
                style={{ padding: '0.6rem 1.2rem', borderRadius: '10px' }}
                disabled={loading}
              >
                Annuler
              </button>
              <button 
                onClick={executeImport} 
                className="btn" 
                style={{ padding: '0.6rem 1.5rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                disabled={loading}
              >
                Confirmer l'Importation <ArrowRight size={16} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Upload Excel Modal */}
      {uploadModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-panel animate-scale-in" style={{ padding: '2rem', maxWidth: '550px', width: '90%', border: '1px solid var(--border)', position: 'relative' }}>
            <button 
              onClick={() => setUploadModalOpen(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSpreadsheet size={20} className="text-violet" /> Importer une classe Massar
            </h3>

            {/* Drag and Drop Uploader */}
            <div 
              onDragEnter={handleDrag} 
              onDragOver={handleDrag} 
              onDragLeave={handleDrag} 
              onDrop={handleDrop}
              className={`glass-panel ${dragActive ? 'border-violet' : ''}`}
              style={{
                border: dragActive ? '2px dashed var(--violet)' : '2px dashed var(--border)',
                borderRadius: '16px', padding: '2.5rem 1.5rem', textAlign: 'center',
                background: dragActive ? 'var(--violet-soft)' : 'rgba(255,255,255,0.01)',
                transition: 'all 0.3s ease', position: 'relative'
              }}
            >
              <input 
                type="file" 
                id="excel-file-upload" 
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="excel-file-upload" style={{ cursor: 'pointer' }}>
                <UploadCloud size={44} style={{ color: dragActive ? 'var(--violet)' : 'var(--text-muted)', margin: '0 auto 1rem', transition: 'all 0.2s' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
                  Glissez-déposez le fichier Excel Massar
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: '350px', margin: '0 auto 1.25rem' }}>
                  Sélectionnez un fichier d'exportation de notes ou listes Excel.
                </p>
                <span className="btn" style={{ display: 'inline-flex', padding: '0.6rem 1.25rem', borderRadius: '10px', fontSize: '0.82rem' }}>
                  {isProcessingFile ? 'Analyse...' : 'Sélectionner un fichier'}
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
