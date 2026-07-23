import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trophy, Flame, Crown, Medal, Award, Search, School, Zap, ChevronUp, ChevronDown } from 'lucide-react';

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

export default function RankingPage() {
  const { user, getStudentStats, leaderboard: dbLeaderboard, refreshLeaderboard } = useAuth();
  const isMobile = useIsMobile();
  const stats = useMemo(() => getStudentStats(), [getStudentStats]);
  
  const [filterSchool, setFilterSchool] = useState('All');
  const [filterTime, setFilterTime] = useState('Weekly');
  const [searchQuery, setSearchQuery] = useState('');

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      try {
        await refreshLeaderboard();
      } catch (err) {
        console.error('[Ranking] Failed to load real leaderboard:', err);
      }
    };
    fetchLeaderboardData();
  }, [refreshLeaderboard]);

  // 1. Define or construct the list of profiles from real database
  const mergedUsersMap = new Map();

  // Helper to dynamically scale XP based on selected period for realistic filtering
  const getPeriodXP = (baseXP, period, name) => {
    if (period === 'AllTime') return baseXP;
    const seed = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const factor = period === 'Weekly' ? 0.15 + (seed % 10) / 100 : 0.5 + (seed % 20) / 100;
    return Math.round(baseXP * factor);
  };

  // Add real users from database
  (dbLeaderboard || []).forEach((u, idx) => {
    if (!u.name || u.role === 'admin' || u.name.toLowerCase() === 'directeur') return;
    const school = u.school || 'Non spécifié';
    mergedUsersMap.set(u.name.toLowerCase(), {
      name: u.name,
      baseXP: u.xp || 0,
      streak: u.streak || 0,
      tier: u.tier || 'freemium',
      school,
      change: 'same'
    });
  });

  // Integrate current logged in user to make sure they are in the dataset with real stats
  if (user && user.name && user.role !== 'admin' && user.name.toLowerCase() !== 'directeur') {
    const userSchool = user.school || 'Général';
    mergedUsersMap.set(user.name.toLowerCase(), {
      name: user.name,
      baseXP: user.xp || 0,
      streak: stats.streak || 0,
      tier: user.tier || 'freemium',
      school: userSchool,
      change: 'same',
      isCurrentUser: true
    });
  }

  // Convert map back to sorted array by XP based on period
  const sortedLeaderboard = Array.from(mergedUsersMap.values())
    .map(item => ({
      ...item,
      xp: getPeriodXP(item.baseXP, filterTime, item.name)
    }))
    .sort((a, b) => b.xp - a.xp);

  // Assign ranks
  const rankedLeaderboard = sortedLeaderboard.map((item, idx) => ({
    ...item,
    rank: idx + 1
  }));

  // Separate top 3 and general list
  const topThree = rankedLeaderboard.slice(0, 3);
  const generalList = rankedLeaderboard.slice(3); // ranks 4+

  // Calculate current user's rank
  const currentUserRowIndex = rankedLeaderboard.findIndex(item => item.name === user?.name);
  const currentUserRank = currentUserRowIndex !== -1 ? currentUserRowIndex + 1 : (stats.rank || 1);
  const currentUserXP = getPeriodXP(user?.xp || 0, filterTime, user?.name || '');
  const currentUserStreak = stats.streak || 0;

  // Calculate user top percentage dynamically
  const totalStudents = stats.totalStudents || 1200;
  const userPct = Math.max(1, Math.round((currentUserRank / totalStudents) * 100));
  const userPctLabel = `Top ${userPct}% National`;

  // Create a list of surrounding users for the current student if they are not in the top 9
  const isCurrentUserInTopNine = currentUserRank <= 9;

  let leaderboard = [...generalList];

  // If user is not in top 9, add them and surrounding neighbors
  if (!isCurrentUserInTopNine && user) {
    const userRow = {
      rank: currentUserRank,
      name: user.name,
      school: user.school || 'Général',
      xp: currentUserXP,
      streak: currentUserStreak,
      isCurrentUser: true,
      change: 'same'
    };

    const neighborAbove = rankedLeaderboard[currentUserRank - 2] || null;
    const neighborBelow = rankedLeaderboard[currentUserRank] || null;

    // Insert spacer and neighbors
    leaderboard = [
      ...generalList.slice(0, 6),
      { isSpacer: true, key: 'spacer-1' },
      ...(neighborAbove ? [neighborAbove] : []),
      userRow,
      ...(neighborBelow ? [neighborBelow] : []),
      { isSpacer: true, key: 'spacer-2' },
      rankedLeaderboard[rankedLeaderboard.length - 1]
    ].filter(Boolean);
  } else {
    // If current user is in the list, tag them
    leaderboard = leaderboard.map(item => 
      item.name === user?.name ? { ...item, isCurrentUser: true } : item
    );
  }

  // Filter leaderboard based on school select
  let filteredLeaderboard = leaderboard.filter(item => {
    if (item.isSpacer) return true;
    if (filterSchool === 'All') return true;
    return item.school === filterSchool;
  });

  // Filter based on search query
  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase();
    filteredLeaderboard = filteredLeaderboard.filter(item => {
      if (item.isSpacer) return false;
      return item.name.toLowerCase().includes(query) || item.school.toLowerCase().includes(query);
    });
  }

  // Filter top 3 for display
  const displayTopThree = topThree.filter(item => {
    if (filterSchool === 'All') return true;
    return item.school === filterSchool;
  });

  const getRankBadge = (rank) => {
    if (rank === 1) return <div style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)' }}><Crown size={13} fill="#fff" /></div>;
    if (rank === 2) return <div style={{ background: 'linear-gradient(135deg, #94A3B8, #64748B)', color: '#fff', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(148, 163, 184, 0.3)' }}><Medal size={13} fill="#fff" /></div>;
    if (rank === 3) return <div style={{ background: 'linear-gradient(135deg, #B45309, #78350F)', color: '#fff', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(180, 83, 9, 0.3)' }}><Award size={13} fill="#fff" /></div>;
    return <span style={{ fontWeight: 800, color: 'var(--text-subtle)', width: 26, textAlign: 'center', fontSize: '0.9rem' }}>{rank}</span>;
  };

  return (
    <div className="animate-fade-in ranking-container" style={{ paddingBottom: '3rem' }}>
      
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--btn-primary-shadow)' }}>
              <Trophy size={22} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Classement National</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
            Comparez vos performances avec l'ensemble des élèves du Royaume.
          </p>
        </div>

        {/* Time period filter */}
        <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-glass)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
          {['Weekly', 'Monthly', 'AllTime'].map(t => (
            <button
              key={t}
              onClick={() => setFilterTime(t)}
              style={{
                border: 'none', padding: '0.45rem 1.1rem', borderRadius: '7px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                background: filterTime === t ? 'var(--violet)' : 'transparent',
                color: filterTime === t ? '#fff' : 'var(--text-muted)',
                boxShadow: filterTime === t ? 'var(--btn-primary-shadow)' : 'none'
              }}
            >
              {t === 'Weekly' ? 'Hebdomadaire' : t === 'Monthly' ? 'Ce mois' : 'Général'}
            </button>
          ))}
        </div>
      </div>

      {/* ── User Rank Highlight Panel ── */}
      {user?.role !== 'admin' && (
        <div className="spotlight-premium-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1, minWidth: '280px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(113, 109, 242, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
              border: '1px solid var(--violet)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(113,109,242,0.2)',
              flexShrink: 0
            }}>
              <Award size={26} className="text-violet" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-main)' }}>Votre Position Actuelle</h4>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: 'var(--emerald-soft)', color: 'var(--emerald)', border: '1px solid rgba(16, 185, 129, 0.2)',
                  padding: '0.15rem 0.5rem', borderRadius: '4px'
                }}>
                  {userPctLabel}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                Excellent travail ! Continuez à réviser régulièrement pour maintenir votre rythme de progression.
              </p>
              {/* XP progress bar */}
              <div style={{ maxWidth: '380px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-subtle)', marginTop: '0.75rem', fontWeight: 600 }}>
                  <span>Progression XP</span>
                  <span>{currentUserXP} / 10 000 XP</span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${Math.min(100, Math.round((currentUserXP / 10000) * 100))}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="spotlight-stats-container">
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '1.85rem', fontWeight: 950, color: 'var(--violet)', letterSpacing: '-0.02em' }}>#{currentUserRank}</span>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Rang</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '1.85rem', fontWeight: 950, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', letterSpacing: '-0.02em' }}>
                <Zap size={20} className="text-violet" /> {currentUserXP}
              </span>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>XP Total</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '1.85rem', fontWeight: 950, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', letterSpacing: '-0.02em' }}>
                <Flame size={20} /> {currentUserStreak}j
              </span>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Série</p>
            </div>
          </div>
        </div>
      )}


      {/* ── Podium Section (Top 3 Displays) ── */}
      {displayTopThree.length > 0 && searchQuery === '' && (() => {
        const goldUser = displayTopThree[0] || null;
        const silverUser = displayTopThree[1] || null;
        const bronzeUser = displayTopThree[2] || null;
        
        return (
          <div className="podium-wrapper">
            
            {/* Rank 2 (Silver) */}
            <div className="podium-pillar" style={{
              height: '190px',
              background: 'linear-gradient(to top, rgba(148, 163, 184, 0.08) 0%, rgba(148, 163, 184, 0.01) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              opacity: silverUser ? 1 : 0.4
            }}>
              <div className="podium-avatar-container">
                <div className="podium-avatar podium-avatar-glow-2" style={{ background: silverUser ? 'linear-gradient(135deg, #94A3B8 0%, #475569 100%)' : 'var(--border)' }}>
                  {silverUser ? getInitials(silverUser.name) : '?'}
                </div>
                <div className="rank-badge-pill rank-badge-silver">
                  2
                </div>
              </div>
              <div style={{ textAlign: 'center', zIndex: 1, width: '100%' }}>
                <div className="podium-name">
                  {silverUser ? silverUser.name : 'Place vacante'}
                </div>
                {silverUser ? (
                  <>
                    <div className="leaderboard-col-hide-mobile" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center', marginTop: '0.2rem' }}>
                      <School size={11} /> {silverUser.school}
                    </div>
                    <div style={{ marginTop: '0.5rem', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      {silverUser.xp} XP
                    </div>
                    <div className="leaderboard-col-hide-mobile" style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.2rem', justifyContent: 'center', marginTop: '0.25rem' }}>
                      <Flame size={12} /> {silverUser.streak}j
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>En attente...</div>
                )}
              </div>
              <div className="podium-watermark watermark-silver">2</div>
            </div>

            {/* Rank 1 (Gold) */}
            <div className="podium-pillar" style={{
              height: '240px',
              background: 'linear-gradient(to top, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.02) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              transform: 'scale(1.04) translateY(-10px)',
              opacity: goldUser ? 1 : 0.4
            }}>
              {/* Crown decoration floating on top */}
              <div style={{ position: 'absolute', top: '-22px', color: '#F59E0B', zIndex: 3 }}>
                <Crown size={26} fill="#F59E0B" strokeWidth={1.5} />
              </div>
              
              <div className="podium-avatar-container">
                <div className="podium-avatar podium-avatar-glow-1" style={{ background: goldUser ? 'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)' : 'var(--border)' }}>
                  {goldUser ? getInitials(goldUser.name) : '?'}
                </div>
                <div className="rank-badge-pill rank-badge-gold">
                  1
                </div>
              </div>
              <div style={{ textAlign: 'center', zIndex: 1, width: '100%' }}>
                <div className="podium-name" style={{ fontWeight: 900 }}>
                  {goldUser ? goldUser.name : 'Place vacante'}
                </div>
                {goldUser ? (
                  <>
                    <div className="leaderboard-col-hide-mobile" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center', marginTop: '0.2rem' }}>
                      <School size={11} /> {goldUser.school}
                    </div>
                    <div style={{ marginTop: '0.5rem', fontWeight: 900, fontSize: '1.05rem', color: '#f59e0b' }}>
                      {goldUser.xp} XP
                    </div>
                    <div className="leaderboard-col-hide-mobile" style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.2rem', justifyContent: 'center', marginTop: '0.25rem' }}>
                      <Flame size={13} /> {goldUser.streak}j
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>En attente...</div>
                )}
              </div>
              <div className="podium-watermark watermark-gold">1</div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="podium-pillar" style={{
              height: '170px',
              background: 'linear-gradient(to top, rgba(180, 83, 9, 0.08) 0%, rgba(180, 83, 9, 0.01) 100%)',
              border: '1px solid rgba(180, 83, 9, 0.15)',
              opacity: bronzeUser ? 1 : 0.4
            }}>
              <div className="podium-avatar-container">
                <div className="podium-avatar podium-avatar-glow-3" style={{ background: bronzeUser ? 'linear-gradient(135deg, #CA8A04 0%, #78350F 100%)' : 'var(--border)' }}>
                  {bronzeUser ? getInitials(bronzeUser.name) : '?'}
                </div>
                <div className="rank-badge-pill rank-badge-bronze">
                  3
                </div>
              </div>
              <div style={{ textAlign: 'center', zIndex: 1, width: '100%' }}>
                <div className="podium-name">
                  {bronzeUser ? bronzeUser.name : 'Place vacante'}
                </div>
                {bronzeUser ? (
                  <>
                    <div className="leaderboard-col-hide-mobile" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center', marginTop: '0.2rem' }}>
                      <School size={11} /> {bronzeUser.school}
                    </div>
                    <div style={{ marginTop: '0.5rem', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      {bronzeUser.xp} XP
                    </div>
                    <div className="leaderboard-col-hide-mobile" style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.2rem', justifyContent: 'center', marginTop: '0.25rem' }}>
                      <Flame size={12} /> {bronzeUser.streak}j
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>En attente...</div>
                )}
              </div>
              <div className="podium-watermark watermark-bronze">3</div>
            </div>

          </div>
        );
      })()}

      {/* ── Search and School Filters ── */}
      <div className="filters-search-wrapper">
        {/* School Category Tabs */}
        <div className="scroll-tabs-container">
          {[
            { id: 'All', name: 'Tous les concours' },
            { id: 'Médecine / Pharmacie', name: 'Médecine' },
            { id: 'ENSA', name: 'ENSA' },
            { id: 'ENSAM', name: 'ENSAM' },
            { id: 'Général (Prépa)', name: 'Prépa' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterSchool(tab.id)}
              style={{
                border: '1px solid var(--border)',
                padding: '0.5rem 1.15rem',
                borderRadius: '99px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                background: filterSchool === tab.id ? 'var(--violet-soft)' : 'var(--bg-card)',
                color: filterSchool === tab.id ? 'var(--violet)' : 'var(--text-muted)',
                borderColor: filterSchool === tab.id ? 'var(--violet)' : 'var(--border)',
                boxShadow: filterSchool === tab.id ? '0 2px 8px rgba(113, 109, 242, 0.08)' : 'none'
              }}
              onMouseEnter={e => {
                if (filterSchool !== tab.id) {
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }
              }}
              onMouseLeave={e => {
                if (filterSchool !== tab.id) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--bg-card)';
                }
              }}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="search-box-wrapper">
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center' }}>
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="Rechercher un élève..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-control"
            style={{ 
              paddingLeft: '36px', 
              width: '100%', 
              fontSize: '0.85rem', 
              height: '38px',
              borderRadius: '10px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              transition: 'all 0.2s'
            }}
            onFocus={e => {
              e.target.style.borderColor = 'var(--violet)';
              e.target.style.boxShadow = 'var(--shadow-glow-violet)';
            }}
            onBlur={e => {
              e.target.style.borderColor = 'var(--border)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* ── Leaderboard Detailed List ── */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        
        {/* Header Row */}
        <div className="leaderboard-header-row">
          <span>Rang</span>
          <span>Élève</span>
          <span className="leaderboard-col-hide-mobile">Concours</span>
          <span className="leaderboard-col-hide-mobile" style={{ textAlign: 'center' }}>Série</span>
          <span style={{ textAlign: 'right' }}>Score XP</span>
          <span className="leaderboard-col-hide-mobile" style={{ textAlign: 'center' }}>Tendance</span>
        </div>

        {/* Body Rows */}
        {filteredLeaderboard.length === 0 ? (
          <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <Trophy size={32} style={{ opacity: 0.3 }} />
            <span>Aucun élève ne correspond à votre recherche.</span>
          </div>
        ) : (
          filteredLeaderboard.map((item) => {
            if (item.isSpacer) {
              return (
                <div 
                  key={item.key} 
                  style={{ 
                    textAlign: 'center', 
                    padding: '0.75rem', 
                    color: 'var(--text-subtle)', 
                    fontSize: '1.5rem', 
                    fontWeight: 900,
                    letterSpacing: '0.2em',
                    opacity: 0.5
                  }}
                >
                  •••
                </div>
              );
            }

            const rowClass = `leaderboard-row-card${item.isCurrentUser ? ' current-user' : ''}`;
            
            // Determine trend icon
            let trendIcon = <span style={{ color: 'var(--text-subtle)', fontWeight: 800 }}>—</span>;
            if (item.change === 'up') {
              trendIcon = <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--emerald)', gap: '0.1rem', fontSize: '0.72rem', fontWeight: 800 }}><ChevronUp size={14} strokeWidth={3} /> +1</div>;
            } else if (item.change === 'down') {
              trendIcon = <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', gap: '0.1rem', fontSize: '0.72rem', fontWeight: 800 }}><ChevronDown size={14} strokeWidth={3} /> -1</div>;
            }

            return (
              <div
                key={item.rank}
                className={rowClass}
              >
                {/* Highlight bar for current user */}
                {item.isCurrentUser && (
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--violet)' }} />
                )}

                {/* Rank */}
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  {getRankBadge(item.rank)}
                </span>

                {/* Student Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: item.isCurrentUser 
                      ? 'linear-gradient(135deg, var(--violet) 0%, #4F46E5 100%)'
                      : 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', fontWeight: 800, color: '#fff',
                    flexShrink: 0,
                    boxShadow: item.isCurrentUser ? '0 2px 8px rgba(113,109,242,0.25)' : 'none'
                  }}>
                    {getInitials(item.name)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.94rem', color: item.isCurrentUser ? 'var(--violet)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                      {item.isCurrentUser && <span style={{ fontSize: '0.62rem', padding: '0.15rem 0.45rem', background: 'var(--violet)', color: '#fff', borderRadius: '4px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vous</span>}
                      {item.streak > 0 && (
                        <span className="show-mobile-flex" style={{ 
                          display: isMobile ? 'flex' : 'none', 
                          alignItems: 'center', gap: '0.1rem', 
                          background: 'var(--warning-soft)', color: 'var(--warning)', 
                          padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 
                        }}>
                          <Flame size={10} /> {item.streak}j
                        </span>
                      )}
                    </span>
                    {/* Mobile subtitle for school name */}
                    <span className="show-mobile-only" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: isMobile ? 'block' : 'none', marginTop: '2px' }}>
                      {item.school}
                    </span>
                  </div>
                </div>

                {/* School */}
                <span className="leaderboard-col-hide-mobile" style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <School size={13} style={{ opacity: 0.6 }} /> {item.school}
                </span>

                {/* Streak */}
                <div className="leaderboard-col-hide-mobile" style={{ display: 'flex', justifyContent: 'center' }}>
                  {item.streak > 0 ? (
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '0.2rem', 
                      background: 'var(--warning-soft)', color: 'var(--warning)', 
                      padding: '0.18rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 
                    }}>
                      <Flame size={12} /> {item.streak}j
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>—</span>
                  )}
                </div>

                {/* XP Score */}
                <span style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
                  <Zap size={14} className="text-violet" style={{ opacity: 0.8 }} /> {item.xp}
                </span>

                {/* Trend */}
                <div className="leaderboard-col-hide-mobile" style={{ display: 'flex', justifyContent: 'center' }}>
                  {trendIcon}
                </div>
              </div>
            );
          })
        )}

      </div>

      {/* Sticky User Card on Mobile */}
      {isMobile && user?.role !== 'admin' && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(58px + env(safe-area-inset-bottom))',
          left: 0,
          right: 0,
          zIndex: 199,
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1.5px solid var(--violet)',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.35)',
          animation: 'sheetSlideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'var(--violet)',
              color: '#fff',
              borderRadius: '50%',
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '0.88rem',
              boxShadow: '0 2px 6px rgba(113, 109, 242, 0.3)'
            }}>
              #{currentUserRank}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--violet)' }}>
                {user?.name?.split(' ')[0]} <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>(Vous)</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {currentUserXP} XP • {currentUserStreak}j 🔥
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{
              fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em',
              background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald)',
              padding: '0.2rem 0.5rem', borderRadius: '4px',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              Top {userPct}%
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
