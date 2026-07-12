import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { uploadAsset } from '../services/storageService';
import {
  GraduationCap, BookOpen, ChevronRight, Search,
  Plus, Pencil, Trash2, X, Check, AlertTriangle, Upload,
  CheckCircle2, XCircle, AlertCircle,
  Stethoscope, Cpu, Wrench, BarChart3, Wifi, TrendingUp, Compass
} from 'lucide-react';

/* ─── Icon Mapping ─── */
const ICON_MAP = {
  'stethoscope': Stethoscope,
  'cpu': Cpu,
  'wrench': Wrench,
  'barchart': BarChart3,
  'wifi': Wifi,
  'trendingup': TrendingUp,
  'compass': Compass,
  'graduationcap': GraduationCap
};

/* ─── Level Brand Registry ─────────────────────────────────────── */
const SCHOOL_BRANDS = {
  '2bac_sm': {
    iconKey: 'compass', tag: 'Sciences Mathématiques',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    glow: 'rgba(139, 92, 246, 0.25)', accent: '#8B5CF6', accentSoft: 'rgba(139, 92, 246, 0.08)',
    desc: 'Deuxième année Bac Sciences Mathématiques A & B — Préparation aux Grandes Écoles.',
    scoring: { correct: 1, wrong: -0.25, empty: 0 }
  },
  '2bac_pc_svt': {
    iconKey: 'stethoscope', tag: 'Sciences Expérimentales',
    gradient: 'linear-gradient(135deg, #EF4444 0%, #991B1B 100%)',
    glow: 'rgba(239, 68, 68, 0.25)', accent: '#EF4444', accentSoft: 'rgba(239, 68, 68, 0.08)',
    desc: 'Deuxième année Bac Sciences Physiques & SVT — Préparation aux concours de Médecine, ENSA, etc.',
    scoring: { correct: 1, wrong: -0.25, empty: 0 }
  },
  '1bac_sci': {
    iconKey: 'cpu', tag: 'Sciences',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    glow: 'rgba(59, 130, 246, 0.25)', accent: '#3B82F6', accentSoft: 'rgba(59, 130, 246, 0.08)',
    desc: 'Première année Bac Sciences Expérimentales.',
    scoring: { correct: 1, wrong: 0, empty: 0 }
  },
  'common_core_sci': {
    iconKey: 'wrench', tag: 'Tronc Commun',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%)',
    glow: 'rgba(14, 165, 233, 0.25)', accent: '#0EA5E9', accentSoft: 'rgba(14, 165, 233, 0.08)',
    desc: 'Tronc Commun Scientifique.',
    scoring: { correct: 1, wrong: 0, empty: 0 }
  },
  '2bac_arts': {
    iconKey: 'barchart', tag: 'Lettres',
    gradient: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
    glow: 'rgba(16, 185, 129, 0.25)', accent: 'var(--emerald)', accentSoft: 'rgba(16, 185, 129, 0.08)',
    desc: 'Deuxième année Bac Lettres & Sciences Humaines.',
    scoring: { correct: 1, wrong: 0, empty: 0 }
  },
  '1bac_arts': {
    iconKey: 'wifi', tag: 'Lettres',
    gradient: 'linear-gradient(135deg, #F97316 0%, #C2410C 100%)',
    glow: 'rgba(249, 115, 22, 0.25)', accent: '#F97316', accentSoft: 'rgba(249, 115, 22, 0.08)',
    desc: 'Première année Bac Lettres.',
    scoring: { correct: 1, wrong: 0, empty: 0 }
  },
  'common_core_arts': {
    iconKey: 'trendingup', tag: 'Tronc Commun',
    gradient: 'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)',
    glow: 'rgba(20, 184, 166, 0.25)', accent: '#14B8A6', accentSoft: 'rgba(20, 184, 166, 0.08)',
    desc: 'Tronc Commun Littéraire.',
    scoring: { correct: 1, wrong: 0, empty: 0 }
  }
};

const DEFAULT_BRAND = {
  iconKey: 'graduationcap', tag: 'Niveau',
  gradient: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
  glow: 'rgba(99, 102, 241, 0.25)', accent: '#818CF8', accentSoft: 'rgba(129, 140, 248, 0.08)',
  desc: 'Concours nationaux par niveau d\'études.',
  scoring: { correct: 1, wrong: -0.25, empty: 0 }
};

const ICON_PALETTE = [
  { key: 'graduationcap', label: 'Diplôme' },
  { key: 'stethoscope', label: 'Santé' },
  { key: 'cpu', label: 'Tech' },
  { key: 'wrench', label: 'Industrie' },
  { key: 'barchart', label: 'Finance' },
  { key: 'wifi', label: 'Télécom' },
  { key: 'trendingup', label: 'Statistiques' },
  { key: 'compass', label: 'Prépa' }
];

const GRADIENT_PALETTE = [
  { label:'Ciel',     value:'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)', dot:'#0ea5e9' },
  { label:'Menthe',   value:'linear-gradient(135deg, #10b981 0%, #34d399 100%)', dot:'var(--emerald)' },
  { label:'Pêche',    value:'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', dot:'var(--warning)' },
  { label:'Rose',     value:'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)', dot:'#ec4899' },
  { label:'Violet',   value:'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)', dot:'#8b5cf6' },
  { label:'Indigo',   value:'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', dot:'var(--violet)' },
  { label:'Corail',   value:'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)', dot:'#f43f5e' },
  { label:'Émeraude', value:'linear-gradient(135deg, #059669 0%, #10b981 100%)', dot:'var(--emerald)' },
  { label:'Or',       value:'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', dot:'var(--warning)' },
];

export const getLevelDisplayName = (id, isArabic = false) => {
  switch (id) {
    case 'common_core_sci': return isArabic ? 'جدع مشترك علوم' : 'Tronc Commun Scientifique';
    case 'common_core_arts': return isArabic ? 'جدع مشترك آداب' : 'Tronc Commun Littéraire';
    case '1bac_sci': return isArabic ? 'أولى باك علوم تجريبية' : '1ère Bac Sciences Expérimentales';
    case '1bac_arts': return isArabic ? 'أولى باك آداب' : '1ère Bac Littéraire';
    case '2bac_sm': return isArabic ? 'ثانية باك علوم رياضية' : '2ème Bac Sciences Mathématiques';
    case '2bac_pc_svt': return isArabic ? 'ثانية باك علوم تجريبية (PC/SVT)' : '2ème Bac Sciences Expérimentales (PC/SVT)';
    case '2bac_arts': return isArabic ? 'ثانية باك آداب' : '2ème Bac Lettres & Sciences Humaines';
    default: return id;
  }
};

export const mapLegacySchoolToLevel = (sch) => {
  if (!sch) return sch;
  if (sch === 'Médecine / Pharmacie' || sch === 'ENCG') return '2bac_pc_svt';
  if (['ENSA', 'ENSAM', 'INPT', 'INSEA', 'Général (Prépa)'].includes(sch)) return '2bac_sm';
  return sch;
};

function getBrand(name, schoolBranding) {
  const custom = schoolBranding?.[name] || {};
  const base   = SCHOOL_BRANDS[name] || { ...DEFAULT_BRAND, tag: name };
  return { ...base, ...custom };
}

/* ─── Edit Modal ─────────────────────────────────────────────────── */
function EditModal({ school, brand, onSave, onClose }) {
  const [name,     setName]     = useState(school);
  const [iconKey,  setIconKey]  = useState(brand.iconKey || 'graduationcap');
  const [gradient, setGradient] = useState(brand.gradient);
  const [tag,      setTag]      = useState(brand.tag);
  const [logoUrl,  setLogoUrl]  = useState(brand.logoUrl || null);
  const [scoring,  setScoring]  = useState(brand.scoring || { correct: 1, wrong: -0.25, empty: 0 });
  const [isActive, setIsActive] = useState(brand.isActive !== false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setIsUploading(true);
    try {
      const fileName = `logos/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const publicUrl = await uploadAsset(file, fileName);
      setLogoUrl(publicUrl);
    } catch (err) {
      alert("Erreur lors du téléversement du logo : " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const PreviewIcon = ICON_MAP[iconKey] || GraduationCap;

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1000,
      background:'rgba(15, 23, 42, 0.75)', backdropFilter:'blur(12px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem',
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:'1.75rem', width:'100%', maxWidth:640,
        maxHeight:'90vh', overflowY:'auto',
        boxShadow:'0 32px 80px rgba(0,0,0,0.5)',
        animation:'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {/* Header */}
        <div style={{ padding:'1.5rem 2rem', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'var(--bg-card)', zIndex:10 }}>
          <div>
            <h3 style={{ fontWeight:900, fontSize:'1.25rem', display:'flex', alignItems:'center', gap:'0.6rem' }}>
              <Pencil size={20} color="var(--violet)" /> Configurer l'Établissement
            </h3>
            <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'0.2rem' }}>Personnalisez l'identité et les règles de calcul.</p>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ borderRadius:'12px' }}><X size={20} /></button>
        </div>

        <div style={{ padding:'2rem' }}>
          
          {/* Section 1: Identité */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap:'1.5rem', marginBottom:'2rem' }}>
            <div className="input-group">
              <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:700, marginBottom:'0.6rem', fontSize:'0.82rem' }}>
                <BookOpen size={14} /> Nom de l'école
              </label>
              <input className="input-control" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: ENSA Agadir..." />
            </div>
            <div className="input-group">
              <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:700, marginBottom:'0.6rem', fontSize:'0.82rem' }}>
                <Search size={14} /> Filière / Spécialité
              </label>
              <input className="input-control" value={tag} onChange={e => setTag(e.target.value)} placeholder="Ex: Ingénierie..." />
            </div>
          </div>

          {/* Statut d'activation */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border)', borderRadius: '1.25rem', marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? 'var(--emerald)' : 'var(--danger)' }}>
                <GraduationCap size={16} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontWeight: 800, fontSize: '0.88rem', margin: 0 }}>Statut de l'établissement</p>
                <p style={{ fontSize: '0.73rem', color: 'var(--text-subtle)', margin: 0 }}>
                  {isActive ? "Visible par les étudiants et accessible pour révision" : "Masqué pour les étudiants (Désactivé)"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                background: isActive ? 'var(--emerald)' : 'var(--danger)',
                position: 'relative', transition: 'background 0.2s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3, transition: 'left 0.2s',
                left: isActive ? 25 : 3,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>

          {/* Preview Card */}
          <div style={{ borderRadius:'1.25rem', overflow:'hidden', marginBottom:'2rem', border:'1px solid var(--border)', background:'var(--bg-glass)' }}>
             <div style={{ background: gradient, padding:'1.25rem 1.75rem', display:'flex', alignItems:'center', gap:'1.25rem' }}>
               {logoUrl ? (
                 <div style={{ width:56, height:56, borderRadius:'14px', background:'rgba(255,255,255,0.15)', padding:'5px', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 20px rgba(0,0,0,0.2)' }}>
                   <img src={logoUrl} alt="logo" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
                 </div>
               ) : (
                 <div style={{
                   width: 52, height: 52, borderRadius: '14px',
                   background: 'rgba(255, 255, 255, 0.15)',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                   color: '#fff'
                 }}>
                   <PreviewIcon size={24} />
                 </div>
               )}
               <div>
                 <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.68rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.15em' }}>Aperçu de la carte</p>
                 <h4 style={{ color:'#fff', fontWeight:900, fontSize:'1.2rem', textShadow:'0 2px 4px rgba(0,0,0,0.2)', margin: 0 }}>{name || "Établissement"}</h4>
               </div>
             </div>
          </div>

          {/* Logo & Icon Selection */}
          <div style={{ marginBottom:'2.5rem' }}>
             <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <h5 style={{ fontWeight:800, fontSize:'0.88rem', margin: 0 }}>🎨 Identité Visuelle</h5>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn" style={{ fontSize:'0.75rem', padding:'0.4rem 0.8rem' }} disabled={isUploading}>
                   <Upload size={13} style={{ marginRight:'0.3rem' }} /> {isUploading ? 'Téléchargement...' : logoUrl ? 'Changer logo' : 'Uploader logo'}
                </button>
             </div>
             <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display:'none' }} />

             {!logoUrl ? (
               <div className="glass-panel" style={{ padding:'1rem', borderRadius:'1.25rem' }}>
                 <p style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.04em' }}>Sélectionner une Icône</p>
                 <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'0.5rem' }}>
                   {ICON_PALETTE.map(item => {
                     const IconComp = ICON_MAP[item.key] || GraduationCap;
                     return (
                       <button 
                         key={item.key} 
                         type="button"
                         onClick={() => setIconKey(item.key)}
                         style={{
                           padding:'0.6rem 0.4rem', borderRadius:'10px', fontSize:'0.8rem', cursor:'pointer', border:'1px solid var(--border)',
                           background: iconKey === item.key ? 'var(--violet-soft)' : 'var(--bg-card)',
                           color: iconKey === item.key ? 'var(--violet)' : 'var(--text-muted)',
                           borderColor: iconKey === item.key ? 'var(--violet)' : 'var(--border)',
                           fontWeight: 700,
                           display: 'flex',
                           flexDirection: 'column',
                           alignItems: 'center',
                           gap: '0.35rem',
                           transition:'all 0.2s',
                         }}>
                         <IconComp size={18} />
                         <span>{item.label}</span>
                       </button>
                     );
                   })}
                 </div>
               </div>
             ) : (
               <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.75rem', background:'var(--emerald-soft)', borderRadius:'1rem', border:'1px solid rgba(16, 185, 129, 0.2)' }}>
                 <Check size={16} color="var(--emerald)" />
                 <span style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--emerald)', flex:1 }}>Logo personnalisé actif</span>
                 <button className="btn-ghost" onClick={() => setLogoUrl(null)} style={{ color:'var(--danger)', fontSize:'0.75rem' }}>Supprimer</button>
               </div>
             )}
          </div>

          {/* Theme Colors */}
          <div style={{ marginBottom:'2.5rem' }}>
            <h5 style={{ fontWeight:800, fontSize:'0.88rem', marginBottom:'1rem', margin: 0 }}>✨ Couleurs du thème</h5>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.75rem', marginTop: '0.75rem' }}>
              {GRADIENT_PALETTE.map(g => (
                <button key={g.label} onClick={() => setGradient(g.value)}
                  style={{
                    width:38, height:38, borderRadius:'50%', background: g.value,
                    border: gradient === g.value ? `3px solid #fff` : '2px solid transparent',
                    boxShadow: gradient === g.value ? `0 0 15px ${g.dot}, 0 0 0 2px var(--violet)` : 'none',
                    cursor:'pointer', transition:'all 0.2s',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Scoring Section */}
          <div style={{ 
            padding:'1.25rem', background:'linear-gradient(135deg, var(--bg-card), var(--bg-glass))', 
            borderRadius:'1.25rem', border:'1px solid var(--border)',
            boxShadow:'inset 0 0 20px rgba(99, 102, 241, 0.03)',
            width: '100%'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'1.5rem' }}>
              <div style={{ width:28, height:28, borderRadius:'8px', background:'var(--violet-soft)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Plus size={14} color="var(--violet)" />
              </div>
              <h5 style={{ fontWeight:800, fontSize:'0.9rem', color:'var(--text-main)', margin: 0 }}>Système de Notation (Points)</h5>
            </div>
            
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'0.75rem' }}>
              {[
                { id:'correct', label:'Correct', color:'var(--emerald)', icon:<CheckCircle2 size={12}/> },
                { id:'wrong',   label:'Erreur',  color:'var(--danger)',  icon:<XCircle size={12}/> },
                { id:'empty',   label:'Oubli',   color:'var(--text-muted)', icon:<AlertCircle size={12}/> }
              ].map(field => (
                <div key={field.id} className="input-group" style={{ textAlign:'center' }}>
                  <label style={{ fontSize:'0.7rem', fontWeight:800, color:field.color, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.3rem', marginBottom:'0.6rem' }}>
                    {field.icon} {field.label}
                  </label>
                  <input 
                    type="number" step="0.25" className="input-control" 
                    style={{ textAlign:'center', fontWeight:900, fontSize:'0.95rem', background:'rgba(0,0,0,0.2)', width:'100%', padding:'0.6rem' }}
                    value={scoring[field.id]} 
                    onChange={e => setScoring(s => ({ ...s, [field.id]: parseFloat(e.target.value) || 0 }))} 
                  />
                </div>
              ))}
            </div>
            <p style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:'1rem', fontStyle:'italic', textAlign:'center', margin: '1rem 0 0' }}>
               💡 Ces valeurs seront appliquées à tous les examens de cet établissement.
            </p>
          </div>

          {/* Footer Actions */}
          <div style={{ display:'flex', gap:'1rem', marginTop:'3rem' }}>
            <button className="btn-outline" onClick={onClose} style={{ flex:1, padding:'0.9rem' }}>Annuler</button>
            <button className="btn-emerald" onClick={() => onSave({ name, iconKey, gradient, tag, logoUrl, scoring, isActive })}
              style={{ flex:2, padding:'0.9rem', fontSize:'1rem', fontWeight:900, boxShadow:'0 10px 25px var(--emerald-glow)' }}>
              <Check size={18} style={{ marginRight:'0.5rem' }} /> Enregistrer les modifications
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ─── Delete Confirm Modal ───────────────────────────────────────── */
function DeleteModal({ school, onConfirm, onClose }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1000,
      background:'rgba(0,0,0,0.65)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem',
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:'1.5rem', padding:'2rem', width:'100%', maxWidth:400,
        boxShadow:'0 24px 64px rgba(0,0,0,0.5)', textAlign:'center',
        animation:'fadeIn 0.25s ease',
      }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--danger-soft)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.25rem' }}>
          <AlertTriangle size={26} color="var(--danger)" />
        </div>
        <h3 style={{ fontWeight:800, marginBottom:'0.5rem' }}>Supprimer cette école ?</h3>
        <p style={{ color:'var(--text-muted)', fontSize:'0.9rem', marginBottom:'1.75rem' }}>
          L'école <strong>«{school}»</strong> et toutes ses configurations seront supprimées. Les examens liés resteront dans le système.
        </p>
        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center' }}>
          <button className="btn-outline" onClick={onClose}>Annuler</button>
          <button onClick={onConfirm}
            style={{ background:'var(--danger)', color:'#fff', border:'none', padding:'0.7rem 1.5rem', borderRadius:'var(--radius-md)', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.5rem', fontFamily:'inherit' }}>
            <Trash2 size={15} /> Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── School Card ───────────────────────────────────────────────── */
function SchoolCard({ school, examCount, brand, isAdmin, onEdit, onDelete, onClick, progressPct = 0 }) {
  const [hovered, setHovered] = useState(false);
  const IconComponent = ICON_MAP[brand.iconKey] || GraduationCap;

  return (
    <div style={{ position:'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ all:'unset', cursor:'pointer', display:'block', width:'100%' }}
      >
        <div style={{
          borderRadius:'1.5rem', overflow:'hidden',
          border:`1px solid ${hovered ? brand.accent + '33' : 'var(--border)'}`,
          background:'var(--bg-card)',
          boxShadow: hovered ? `0 12px 32px ${brand.glow}, 0 4px 12px rgba(0,0,0,0.1)` : 'var(--shadow-card)',
          transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
          transition:'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: '270px'
        }}>
          {/* Top color accent strip */}
          <div style={{ height: '4px', background: brand.gradient, width: '100%' }} />

          {/* Card Content container */}
          <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            
            {/* Watermark Logo/Vector in background */}
            <div style={{
              position: 'absolute',
              right: '-15px',
              bottom: '-15px',
              opacity: brand.logoUrl ? (hovered ? 0.07 : 0.03) : (hovered ? 0.08 : 0.04),
              color: brand.accent,
              transform: hovered ? 'scale(1.18) rotate(-5deg)' : 'scale(1) rotate(-12deg)',
              transition: 'all 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)',
              pointerEvents: 'none',
              zIndex: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {brand.logoUrl ? (
                <img 
                  src={brand.logoUrl} 
                  style={{
                    width: '150px',
                    height: '150px',
                    objectFit: 'contain',
                    filter: 'grayscale(100%) contrast(0.8)'
                  }} 
                  alt="" 
                />
              ) : (
                <IconComponent size={140} strokeWidth={1} />
              )}
            </div>

            {/* Icon Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', zIndex: 1 }}>
              {/* Glowing Icon Wrapper */}
              <div style={{
                width: 52, height: 52, borderRadius: '14px',
                background: brand.gradient,
                boxShadow: `0 8px 16px ${brand.glow}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s ease',
                transform: hovered ? 'scale(1.05) rotate(3deg)' : 'none',
                overflow: 'hidden',
                padding: brand.logoUrl ? '6px' : '0'
              }}>
                {brand.logoUrl ? (
                  <img 
                    src={brand.logoUrl} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' 
                    }} 
                    alt="" 
                  />
                ) : (
                  <IconComponent size={24} color="#fff" />
                )}
              </div>

              {/* Tag Badge */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                  background: brand.accentSoft,
                  color: brand.accent,
                  border: `1px solid ${brand.accent}25`,
                  padding: '0.25rem 0.75rem',
                  borderRadius: '99px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em'
                }}>
                  {brand.tag}
                </span>
                {brand.isActive === false && (
                  <span style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--danger)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '99px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.02em'
                  }}>
                    INACTIF
                  </span>
                )}
              </div>
            </div>

            {/* Title & Description */}
            <div style={{ zIndex: 1, flex: 1 }}>
              <h3 style={{ fontSize:'1.1rem', fontWeight:800, marginBottom:'0.5rem', color:'var(--text-main)' }}>{school}</h3>
              <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', lineHeight:1.55, marginBottom:'1.25rem' }}>{brand.desc}</p>
            </div>

            {/* Progress and Completion Section */}
            <div style={{ zIndex: 1, marginBottom: '1rem', marginTop: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', fontWeight: 800, textTransform: 'uppercase' }}>
                  {isAdmin ? "Contenu disponible" : "Progression"}
                </span>
                <span style={{ fontSize: '0.72rem', color: brand.accent, fontWeight: 800 }}>{progressPct}%</span>
              </div>
              <div style={{ height: '5px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: brand.gradient,
                  borderRadius: '99px',
                  boxShadow: hovered ? `0 0 8px ${brand.accent}` : 'none',
                  transition: 'width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s ease'
                }} />
              </div>
            </div>

            {/* Footer Stats and Action */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', zIndex: 1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', background: 'var(--bg-glass)', padding:'0.28rem 0.75rem', borderRadius:'99px', fontSize:'0.76rem', fontWeight:700, border:`1px solid var(--border)` }}>
                <BookOpen size={11} style={{ color: brand.accent }} />
                <span style={{ color: 'var(--text-muted)' }}>{examCount > 0 ? `${examCount} examen${examCount > 1 ? 's' : ''}` : 'Bientôt'}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.25rem', color: hovered ? brand.accent : 'var(--text-subtle)', fontSize:'0.8rem', fontWeight:700, transition:'all 0.2s', transform: hovered ? 'translateX(4px)' : 'translateX(0)' }}>
                Voir <ChevronRight size={15} />
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* Admin overlay buttons */}
      {isAdmin && (
        <div style={{ position:'absolute', top:'0.875rem', right:'0.875rem', display:'flex', gap:'0.35rem', zIndex:10 }}>
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            title="Modifier"
            style={{ width:30, height:30, borderRadius:'8px', border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--violet)'; e.currentTarget.style.borderColor = 'var(--violet)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            title="Supprimer"
            style={{ width:30, height:30, borderRadius:'8px', border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function SchoolsPage() {
  const { exams, schools, addSchool, removeSchool, renameSchool, schoolBranding, updateSchoolBranding, user, progress } = useAuth();
  const navigate    = useNavigate();
  const isAdmin     = user?.role === 'admin';
  const isMobile    = useIsMobile();

  const [search,       setSearch]       = useState('');
  const [editTarget,   setEditTarget]   = useState(null);   // school name being edited
  const [deleteTarget, setDeleteTarget] = useState(null);   // school name being deleted
  const [addName,      setAddName]      = useState('');
  const [showAddForm,  setShowAddForm]  = useState(false);
  const [selectedTag,  setSelectedTag]  = useState('Tous');

  const allSchoolNames = Array.from(new Set([
    ...schools,
    ...exams.map(e => e.level || mapLegacySchoolToLevel(e.school)).filter(Boolean),
  ]));

  const uniqueTags = ['Tous', ...Array.from(new Set(allSchoolNames.map(name => getBrand(name, schoolBranding).tag).filter(Boolean)))];

  const filtered = allSchoolNames.filter(name => {
    const brand = getBrand(name, schoolBranding);
    if (!isAdmin && brand.isActive === false) return false;

    const matchesSearch = getLevelDisplayName(name).toLowerCase().includes(search.toLowerCase()) || name.toLowerCase().includes(search.toLowerCase());
    if (selectedTag === 'Tous') return matchesSearch;
    return matchesSearch && brand.tag === selectedTag;
  });

  const getExamCount = s => exams.filter(e => (e.level === s || mapLegacySchoolToLevel(e.school) === s) && e.isArchived !== true).length;

  const handleEdit = (school) => setEditTarget(school);
  const handleDelete = (school) => setDeleteTarget(school);

  const handleSaveEdit = ({ name, iconKey, gradient, tag, logoUrl, scoring, isActive }) => {
    const old = editTarget;
    updateSchoolBranding(name, { iconKey, gradient, tag, logoUrl, scoring, isActive, desc: getBrand(old, schoolBranding).desc });
    if (name !== old) renameSchool(old, name);
    setEditTarget(null);
  };

  const handleConfirmDelete = () => {
    removeSchool(deleteTarget);
    setDeleteTarget(null);
  };

  const handleAdd = () => {
    if (addName.trim()) {
      addSchool(addName.trim());
      setAddName('');
      setShowAddForm(false);
    }
  };

  const editBrand = editTarget ? getBrand(editTarget, schoolBranding) : null;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <header style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom: isMobile ? '1rem' : '1.5rem', flexWrap:'wrap', gap:'0.875rem' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.4rem' }}>
            <div style={{ width:40, height:40, borderRadius:'12px', background:'linear-gradient(135deg,var(--violet),var(--emerald))', display:'flex', alignItems:'center', justifyContent: 'center', boxShadow: 'var(--btn-primary-shadow)' }}>
              <GraduationCap size={22} color="#fff" />
            </div>
            <h1 style={{ fontSize:'1.75rem', fontWeight:800, letterSpacing:'-0.02em', margin:0 }}>Concours par Niveau</h1>
          </div>
          {!isMobile && (
            <p style={{ color:'var(--text-muted)', fontSize:'0.9rem', margin:0 }}>
              {isAdmin
                ? 'Gérez les niveaux, personnalisez leurs logos, icônes et règles de notation.'
                : 'Choisissez votre niveau pour accéder aux annales et QCM officiels.'}
            </p>
          )}
        </div>

        {/* Admin: Add school button */}
        {isAdmin && (
          <button className="btn-emerald" onClick={() => setShowAddForm(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:'0.5rem', boxShadow: '0 8px 20px var(--emerald-glow)' }}>
            <Plus size={16} /> Ajouter un niveau
          </button>
        )}
      </header>

      {/* Add school form (admin) */}
      {isAdmin && showAddForm && (
        <div className="glass-panel animate-fade-in" style={{ marginBottom:'1.5rem', display:'flex', gap:'0.75rem', alignItems:'center', flexWrap:'wrap' }}>
          <input
            className="input-control"
            placeholder="Nom du nouveau niveau..."
            value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ flex:1, minWidth:200 }}
            autoFocus
          />
          <button className="btn-emerald" onClick={handleAdd} style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <Check size={15} /> Confirmer
          </button>
          <button className="btn-outline" onClick={() => { setShowAddForm(false); setAddName(''); }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Sticky Search & Category Bar */}
      <div style={{
        position: isMobile ? 'sticky' : 'static',
        top: isMobile ? '0' : 'auto',
        zIndex: isMobile ? 100 : 'auto',
        background: isMobile ? 'var(--bg-base)' : 'transparent',
        padding: isMobile ? '0.75rem 0' : '0',
        margin: isMobile ? '-0.75rem 0 1rem 0' : '0 0 1.5rem 0',
        borderBottom: isMobile ? '1px solid var(--border)' : 'none',
      }}>
        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div style={{ position:'relative', flex:'1 1 200px', minWidth:'180px' }}>
            <Search size={16} style={{ position:'absolute', left:'0.875rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-subtle)', pointerEvents:'none' }} />
            <input 
              className="input-control" 
              placeholder="Rechercher un niveau..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ paddingLeft:'2.5rem', width:'100%', borderRadius: '10px' }} 
            />
          </div>
          {!isMobile && (
            <div style={{ display:'flex', gap:'1.25rem', fontSize:'0.83rem', color:'var(--text-muted)' }}>
              <span><strong className="text-main" style={{ color: 'var(--text-main)' }}>{allSchoolNames.length}</strong> niveaux</span>
              <span><strong className="text-emerald" style={{ color: 'var(--emerald)' }}>{exams.filter(e => e.isArchived !== true).length}</strong> concours</span>
            </div>
          )}
        </div>

        {/* Categories Tab Row */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          margin: isMobile ? '0 -1rem' : '0',
          paddingLeft: isMobile ? '1rem' : '0',
          paddingRight: isMobile ? '1rem' : '0',
          paddingBottom: '0.25rem'
        }}>
          {uniqueTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              style={{
                whiteSpace: 'nowrap',
                padding: '0.45rem 1rem',
                borderRadius: '99px',
                border: '1.5px solid var(--border)',
                background: selectedTag === tag ? 'var(--violet-soft)' : 'var(--bg-card)',
                color: selectedTag === tag ? 'var(--violet)' : 'var(--text-muted)',
                borderColor: selectedTag === tag ? 'var(--violet)' : 'var(--border)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'4rem', color:'var(--text-muted)' }}>
          <GraduationCap size={48} style={{ opacity:0.25, margin:'0 auto 1rem' }} />
          <p>Aucun niveau trouvé</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(290px, 1fr))', gap: isMobile ? '1rem' : '1.5rem' }}>
          {filtered.map(school => {
            const brand = getBrand(school, schoolBranding);
            
            // Calculate interacted questions percentage
            const schoolExams = exams.filter(e => (e.level === school || mapLegacySchoolToLevel(e.school) === school) && e.isArchived !== true);
            const totalQuestions = schoolExams.reduce((sum, exam) => sum + (exam.questionsCount || 0), 0);
            let interactedCount = 0;
            schoolExams.forEach(exam => {
              (exam.questions || []).forEach(q => {
                if (progress && progress[q.id]) {
                  interactedCount++;
                }
              });
            });
            const progressPct = totalQuestions > 0 ? Math.min(100, Math.round((interactedCount / totalQuestions) * 100)) : 0;

            return (
              <SchoolCard
                key={school}
                school={getLevelDisplayName(school)}
                examCount={getExamCount(school)}
                brand={brand}
                isAdmin={isAdmin}
                onEdit={() => handleEdit(school)}
                onDelete={() => handleDelete(school)}
                onClick={() => navigate(`/schools/${encodeURIComponent(school)}`)}
                progressPct={progressPct}
              />
            );
          })}
        </div>
      )}

      {/* Modals */}
      {editTarget && editBrand && (
        <EditModal
          school={editTarget}
          brand={editBrand}
          onSave={handleSaveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          school={deleteTarget}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
