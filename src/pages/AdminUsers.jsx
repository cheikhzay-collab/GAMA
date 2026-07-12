import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, Crown, Activity, TrendingUp, RefreshCw, Search, User, ChevronRight, Download, GraduationCap } from 'lucide-react';
import { unescapeHTML } from '../utils/security';
import { getAllClasses } from '../services/classService';

const isUserOnline = (user) => {
  if (!user || !user.updatedAt) return false;
  const lastActive = new Date(user.updatedAt);
  const diffMs = new Date() - lastActive;
  return diffMs < 5 * 60 * 1000; // 5 minutes threshold
};

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

export default function AdminUsers() {
  const { users, refreshAdminData, syncStudentsList } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [classes, setClasses] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (refreshAdminData) {
      refreshAdminData();
    }
    const loadClasses = async () => {
      try {
        const cls = await getAllClasses();
        setClasses(cls || []);
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    };
    loadClasses();
  }, [refreshAdminData]);

  const handleRefresh = async () => {
    if (!refreshAdminData) return;
    setIsRefreshing(true);
    try {
      await refreshAdminData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSync = async () => {
    if (!syncStudentsList) return;
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncStudentsList();
      setSyncResult(res);
    } catch (e) {
      alert("Échec de la synchronisation: " + (e.message || e));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCSV = () => {
    // CSV Headers
    const headers = [
      'Nom Complet',
      'Email',
      'Classe',
      'Téléphone',
      'Ville',
      'École Ciblée',
      'Niveau de Compte',
      'Score XP',
      'Statut CRM',
      'Date Inscription'
    ];
    
    // Map rows with HTML entity unescaping
    const rows = filteredUsers.map(u => [
      unescapeHTML(u.name || ''),
      u.email || '',
      u.classId || 'Aucune',
      u.phone || '',
      unescapeHTML(u.city || ''),
      unescapeHTML(u.school || ''),
      u.tier === 'premium' ? 'PREMIUM' : 'GRATUIT',
      u.xp || 0,
      u.crm?.stage || 'Lead',
      u.joined ? new Date(u.joined).toLocaleDateString('fr-FR') : ''
    ]);
    
    // Build CSV String with quote escapes
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => {
        const clean = String(val).replace(/"/g, '""');
        return `"${clean}"`;
      }).join(','))
    ].join('\n');
    
    // Blob and Trigger download with UTF-8 BOM for Arabic character rendering in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `liste_eleves_lconq_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      !searchTerm ||
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.phone?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const currentStage = u.crm?.stage || 'Lead';
    const matchesStage = stageFilter === 'all' || currentStage === stageFilter;
    
    const currentCity = u.city || '';
    const matchesCity = !cityFilter || currentCity.toLowerCase().includes(cityFilter.toLowerCase());
    
    const currentSchool = u.school || '';
    const matchesSchool = !schoolFilter || currentSchool.toLowerCase().includes(schoolFilter.toLowerCase());
    
    const matchesClass = !classFilter || u.classId === classFilter;
    
    return matchesSearch && matchesStage && matchesCity && matchesSchool && matchesClass;
  });

  const stats = [
    { label: 'Total Étudiants', value: users.length, icon: Users, color: 'var(--primary)' },
    { label: 'Abonnés Premium', value: users.filter(u => u.tier === 'premium').length, icon: Crown, color: 'var(--warning)' },
    { label: 'Pistes Chaudes (Hot)', value: users.filter(u => u.crm?.stage === 'Hot Lead').length, icon: Activity, color: 'var(--accent)' },
    { label: 'Risque de Churn', value: users.filter(u => u.crm?.stage === 'Churn Risk').length, icon: TrendingUp, color: 'var(--danger)' },
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      {/* ── Page Header ── */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={22} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Gestion des Étudiants</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>Cliquez sur un élève pour consulter son profil, gérer ses abonnements et suivre sa relation CRM.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleSync}
            disabled={isSyncing || isRefreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(52, 211, 153, 0.1))',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              color: 'var(--emerald)',
              fontWeight: 700, fontSize: '0.875rem',
              cursor: isSyncing ? 'wait' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--emerald)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(52, 211, 153, 0.18))'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(52, 211, 153, 0.1))'; }}
          >
            <RefreshCw size={15} style={{ animation: isSyncing ? 'spin 0.7s linear infinite' : 'none' }} />
            {isSyncing ? 'Mise à jour...' : 'Synchroniser la Base'}
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(124, 58, 237, 0.1))',
              border: '1px solid rgba(79, 70, 229, 0.3)',
              borderRadius: '10px',
              color: '#818CF8',
              fontWeight: 700, fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#818CF8'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(79, 70, 229, 0.18), rgba(124, 58, 237, 0.18))'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.3)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(124, 58, 237, 0.1))'; }}
          >
            <Download size={15} />
            Exporter Excel/CSV
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isSyncing}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              color: 'var(--text-muted)',
              fontWeight: 600, fontSize: '0.875rem',
              cursor: isRefreshing ? 'wait' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--violet)'; e.currentTarget.style.color = 'var(--violet)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <RefreshCw size={15} style={{ animation: isRefreshing ? 'spin 0.7s linear infinite' : 'none' }} />
            {isRefreshing ? 'Chargement...' : 'Actualiser'}
          </button>
        </div>
      </header>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulseGreen {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>

      {/* ── Sync Result Alert ── */}
      {syncResult && (
        <div className="glass-panel animate-fade-in" style={{
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          background: 'rgba(16, 185, 129, 0.05)',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <p style={{ margin: 0, color: 'var(--emerald)', fontWeight: 600, fontSize: '0.92rem' }}>
            ✨ Synchronisation réussie ! {syncResult.synchronized_count} élève(s) synchronisé(s) depuis la table d'authentification.
          </p>
          <button 
            onClick={() => setSyncResult(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '0.75rem' : '1.5rem', marginBottom: '2.5rem' }}>
        {stats.map((stat, idx) => (
          <div key={idx} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ 
              width: '48px', height: '48px', borderRadius: '12px', background: `${stat.color}15`, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color 
            }}>
              <stat.icon size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{stat.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table Controls ── */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 2, minWidth: '250px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Rechercher nom, email, téléphone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', background: 'var(--bg-glass)', 
              border: '1px solid var(--border)', borderRadius: '12px', color: 'white', outline: 'none'
            }}
          />
        </div>

        {/* CRM Stage Dropdown */}
        <div style={{ flex: 1.2, minWidth: '180px' }}>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{
              width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-glass)',
              border: '1px solid var(--border)', borderRadius: '12px', color: 'white', outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all" style={{ background: '#111827' }}>Tous les statuts CRM</option>
            <option value="Lead" style={{ background: '#111827' }}>Lead (Prospect)</option>
            <option value="Trial" style={{ background: '#111827' }}>Trial (Essai actif)</option>
            <option value="Hot Lead" style={{ background: '#111827' }}>Hot Lead (Prospect chaud)</option>
            <option value="Active Premium" style={{ background: '#111827' }}>Active Premium (Abonné actif)</option>
            <option value="Churn Risk" style={{ background: '#111827' }}>Churn Risk (Risque de churn)</option>
            <option value="Inactive" style={{ background: '#111827' }}>Inactive (Inactif)</option>
          </select>
        </div>

        {/* City Filter */}
        <div style={{ flex: 1, minWidth: '140px' }}>
          <input 
            type="text" 
            placeholder="Ville..." 
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            style={{ 
              width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-glass)', 
              border: '1px solid var(--border)', borderRadius: '12px', color: 'white', outline: 'none'
            }}
          />
        </div>

        {/* School Filter */}
        <div style={{ flex: 1, minWidth: '140px' }}>
          <input 
            type="text" 
            placeholder="École..." 
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
            style={{ 
              width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-glass)', 
              border: '1px solid var(--border)', borderRadius: '12px', color: 'white', outline: 'none'
            }}
          />
        </div>

        {/* Class Filter Dropdown */}
        <div style={{ flex: 1, minWidth: '150px' }}>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            style={{
              width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-glass)',
              border: '1px solid var(--border)', borderRadius: '12px', color: 'white', outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="" style={{ background: '#111827' }}>Toutes les classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id} style={{ background: '#111827' }}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Users Table ── */}
      <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Étudiant</th>
              <th style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Classe</th>
              <th style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inscription</th>
              <th style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score Global</th>
              <th style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Plan</th>
              <th style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Statut CRM</th>
              <th style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Users size={40} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    Aucun élève trouvé pour cette recherche ou ces filtres.
                  </p>
                </td>
              </tr>
            ) : filteredUsers.map(u => (
              <tr 
                key={u.id} 
                className="table-row-hover" 
                onClick={() => navigate(`/admin/users/${u.id}`)}
                style={{ borderBottom: '1px solid var(--border)', transition: 'all 0.2s', cursor:'pointer' }}
              >
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ 
                        width: '40px', height: '40px', borderRadius: '50%', 
                        background: 'linear-gradient(45deg, var(--primary), var(--accent))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'white', fontSize: '0.9rem'
                      }}>
                        {unescapeHTML(u.name || '')?.charAt(0) || '?'}
                      </div>
                      {isUserOnline(u) && (
                        <span 
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: '#10B981',
                            border: '2px solid var(--bg-card)',
                            boxShadow: '0 0 8px #10B981',
                            animation: 'pulseGreen 2s infinite'
                          }}
                          title="En ligne"
                        />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{unescapeHTML(u.name)}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  {u.classId ? (
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem', 
                      color: 'var(--emerald)', background: 'rgba(16, 185, 129, 0.08)', 
                      padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 
                    }}>
                      <GraduationCap size={13} /> {u.classId}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>Non assigné</span>
                  )}
                </td>
                <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {u.joined ? new Date(u.joined).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '15 Mai 2026'}
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--emerald)' }}>{u.xp || 0} XP</span>
                    <TrendingUp size={14} color="var(--emerald)" />
                  </div>
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  {u.tier === 'premium' ? (
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem', 
                      color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', 
                      padding: '0.4rem 0.8rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 900 
                    }}>
                      <Crown size={14} /> PREMIUM
                    </span>
                  ) : (
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem', 
                      color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.05)', 
                      padding: '0.4rem 0.8rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 900 
                    }}>
                      <User size={14} /> GRATUIT
                    </span>
                  )}
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  {(() => {
                    const crmStage = u.crm?.stage || 'Lead';
                    let badgeColor = 'var(--primary)';
                    let badgeBg = 'rgba(79, 70, 229, 0.1)';
                    
                    if (crmStage === 'Trial') {
                      badgeColor = '#06B6D4';
                      badgeBg = 'rgba(6, 182, 212, 0.1)';
                    } else if (crmStage === 'Hot Lead') {
                      badgeColor = '#F97316';
                      badgeBg = 'rgba(249, 115, 22, 0.1)';
                    } else if (crmStage === 'Active Premium') {
                      badgeColor = '#10B981';
                      badgeBg = 'rgba(16, 185, 129, 0.1)';
                    } else if (crmStage === 'Churn Risk') {
                      badgeColor = '#EF4444';
                      badgeBg = 'rgba(239, 68, 68, 0.1)';
                    } else if (crmStage === 'Inactive') {
                      badgeColor = '#9CA3AF';
                      badgeBg = 'rgba(156, 163, 175, 0.1)';
                    }
                    
                    return (
                      <span style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem', 
                        color: badgeColor, background: badgeBg, 
                        padding: '0.4rem 0.75rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800,
                        border: `1px solid ${badgeColor}25`
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: badgeColor }} />
                        {crmStage}
                      </span>
                    );
                  })()}
                </td>
                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                  <ChevronRight size={20} color="var(--text-muted)" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
