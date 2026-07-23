import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList, Sparkles, FileText,
  BookMarked, Camera, GraduationCap, FileUp, Layers, Settings,
  Trophy, BookOpen, Library, Zap, Sun, Moon, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LconqLogo from './LconqLogo';

// Helper: nav item with tooltip support when collapsed
const NavItem = ({ to, icon: Icon, label, collapsed }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}${collapsed ? ' nav-item--collapsed' : ''}`}
    title={collapsed ? label : undefined}
  >
    <span className="nav-item__icon"><Icon size={18} /></span>
    {!collapsed && <span className="nav-item__label">{label}</span>}
  </NavLink>
);

const SectionLabel = ({ children, collapsed }) =>
  collapsed ? null : (
    <p className="sidebar-section-label">{children}</p>
  );

export default function Sidebar({ collapsed = false }) {
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const isStudent = user?.role === 'student';
  const isAdmin   = user?.role === 'admin';

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>

      {/* ── Logo ── */}
      <div
        className={`sidebar-logo-wrap${collapsed ? ' sidebar-logo-wrap--collapsed' : ''}`}
        onClick={() => navigate('/')}
        style={{ cursor: 'pointer' }}
      >
        {collapsed ? (
          /* Mini icon when collapsed */
          <div className="sidebar-logo-mini" title="L'CONQ • GIMA">
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="url(#logoGrad)" />
              <text x="18" y="24" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff" fontFamily="'Plus Jakarta Sans',sans-serif">G</text>
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#716DF2" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        ) : (
          <LconqLogo size={36} textSize="1.25rem" style={{ padding: '0 0.25rem' }} />
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">

        {!user && (
          <>
            <SectionLabel collapsed={collapsed}>Visiteur</SectionLabel>
            <NavItem to="/levels"  icon={Layers}        label="Niveaux & Cours" collapsed={collapsed} />
          </>
        )}

        {isStudent && (
          <>
            <SectionLabel collapsed={collapsed}>Espace Élève</SectionLabel>
            <NavItem to="/dashboard"    icon={LayoutDashboard} label="Tableau de bord" collapsed={collapsed} />
            <NavItem to="/levels"       icon={Layers}          label="Niveaux & Cours" collapsed={collapsed} />
            <NavItem to="/scanner"      icon={Camera}          label="Scanner QCM" collapsed={collapsed} />
            <NavItem to="/study"        icon={BookOpen}        label="Révision SRS" collapsed={collapsed} />
            <NavItem to="/ranking"      icon={Trophy}          label="Classement" collapsed={collapsed} />
          </>
        )}

        {isAdmin && (
          <>
            <SectionLabel collapsed={collapsed}>Espace Enseignant</SectionLabel>
            <NavItem to="/admin/dashboard" icon={LayoutDashboard} label="Tableau de Bord" collapsed={collapsed} />
            <NavItem to="/admin/classes"   icon={Users}           label="Classes & Sections" collapsed={collapsed} />
            <NavItem to="/admin/logbook"   icon={ClipboardList}   label="Cahier de Textes" collapsed={collapsed} />
            <NavItem to="/admin/ai-generator" icon={Sparkles}     label="Générateur IA" collapsed={collapsed} />
            <NavItem to="/admin/lessons"   icon={FileText}        label="Fiches de Cours" collapsed={collapsed} />
            <NavItem to="/admin/exams"     icon={GraduationCap}   label="Bibliothèque QCM" collapsed={collapsed} />
            <NavItem to="/admin/upload"    icon={FileUp}          label="Upload QCM" collapsed={collapsed} />
            <NavItem to="/scanner"         icon={Camera}          label="Scanner QCM" collapsed={collapsed} />
            <NavItem to="/admin/ebooks"    icon={BookMarked}      label="E-Books" collapsed={collapsed} />
            <NavItem to="/levels"          icon={Layers}          label="Niveaux" collapsed={collapsed} />
            <NavItem to="/admin/settings"  icon={Settings}        label="Paramètres" collapsed={collapsed} />
          </>
        )}
      </nav>

      {/* ── User card ── */}
      <div className="sidebar-footer">
        {!user ? (
          <button
            onClick={() => navigate('/login')}
            className={`sidebar-login-btn${collapsed ? ' sidebar-login-btn--collapsed' : ''}`}
            title={collapsed ? 'Connexion / Inscription' : undefined}
          >
            <Zap size={15} />
            {!collapsed && <span>Connexion / Inscription</span>}
          </button>
        ) : (
          <div className={`sidebar-user-card${collapsed ? ' sidebar-user-card--collapsed' : ''}`}>
            {/* Avatar */}
            <div
              className="sidebar-avatar"
              style={{
                background: isAdmin
                  ? 'linear-gradient(135deg, var(--violet), #818cf8)'
                  : 'linear-gradient(135deg, var(--emerald), #34d399)',
              }}
              title={collapsed ? user?.name : undefined}
            >
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>

            {/* Name + badge — hidden in collapsed mode */}
            {!collapsed && (
              <div className="sidebar-user-info">
                <p className="sidebar-user-name">{user?.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {isStudent && <span className="badge badge-free">Élève</span>}
                  {isAdmin && <span className="badge badge-emerald">Professeur</span>}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className={`sidebar-user-actions${collapsed ? ' sidebar-user-actions--stacked' : ''}`}>
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                aria-label={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
                className="sidebar-icon-btn"
                style={{ color: theme === 'dark' ? 'var(--warning)' : 'var(--violet)' }}
              >
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                onClick={handleLogout}
                className="sidebar-icon-btn sidebar-icon-btn--logout"
                title="Déconnexion"
                aria-label="Déconnexion"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
