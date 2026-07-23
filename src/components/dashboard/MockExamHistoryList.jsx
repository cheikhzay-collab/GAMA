import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { History, Printer } from 'lucide-react';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year} à ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
};

const ProgressTooltip = React.memo(({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ 
        background: 'rgba(15, 23, 42, 0.95)', 
        backdropFilter: 'blur(12px)', 
        border: '1px solid rgba(255,255,255,0.15)', 
        padding: '0.75rem 1.25rem', 
        borderRadius: 'var(--radius-md)', 
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)' 
      }}>
        <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, fontSize: '0.82rem', color: '#94a3b8' }}>
          {data.date}
        </p>
        <p style={{ margin: '0 0 0.4rem 0', fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
          {data.name}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '0.85rem', alignItems: 'center' }}>
          <span style={{ color: '#818cf8', fontWeight: 800 }}>{data.pct}% de réussite</span>
          <span style={{ color: '#94a3b8' }}>({data.score}/{data.maxScore})</span>
        </div>
        <span style={{ 
          display: 'inline-block', 
          fontSize: '0.7rem', 
          fontWeight: 800, 
          padding: '0.15rem 0.5rem', 
          borderRadius: '4px', 
          background: data.mode === 'En ligne' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.2)', 
          color: data.mode === 'En ligne' ? '#a5b4fc' : '#34d399' 
        }}>
          {data.mode}
        </span>
      </div>
    );
  }
  return null;
});
ProgressTooltip.displayName = 'ProgressTooltip';

const MockExamHistoryList = React.memo(({ mockExamHistory = [], onDownloadReport, onNavigateToLevels, onNavigateToScanner }) => {
  
  const chronologicalHistory = React.useMemo(() => {
    return [...mockExamHistory]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((item, index) => ({
        index: index + 1,
        name: item.examName,
        pct: item.pct,
        score: item.score,
        maxScore: item.maxScore,
        date: formatDate(item.date),
        mode: item.mode === 'online' ? 'En ligne' : 'Scanner OMR'
      }));
  }, [mockExamHistory]);

  return (
    <div className="glass-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, margin: 0 }}>
          <History size={18} color="var(--violet)" /> Suivi des Examens Blancs
        </h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {mockExamHistory.length} tentative{mockExamHistory.length !== 1 ? 's' : ''}
        </span>
      </div>

      {mockExamHistory.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
          <div style={{ 
            width: '72px', height: '72px', 
            background: 'var(--bg-glass)', 
            borderRadius: '50%', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            margin: '0 auto 1.25rem', 
            border: '1px solid var(--border)',
            color: 'var(--text-subtle)'
          }}>
            <History size={32} opacity={0.6} />
          </div>
          <h4 style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.4rem', fontSize: '1rem' }}>
            Aucun examen blanc enregistré
          </h4>
          <p style={{ fontSize: '0.85rem', maxWidth: '380px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
            Lancez un examen blanc en ligne ou scannez une feuille de réponses OMR pour commencer à suivre votre progression.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button 
              className="btn-outline" 
              onClick={onNavigateToLevels}
              style={{ fontSize: '0.8rem', fontWeight: 700 }}
            >
              Examen en ligne
            </button>
            <button 
              className="btn" 
              onClick={onNavigateToScanner}
              style={{ fontSize: '0.8rem', fontWeight: 700 }}
            >
              Scanner OMR
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Progression Chart */}
          <div>
            <h4 style={{ 
              fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-subtle)', 
              textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' 
            }}>
              Évolution des Scores
            </h4>
            
            <div style={{ height: 220, width: '100%', marginTop: '1rem', marginBottom: '1.5rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chronologicalHistory}>
                  <defs>
                    <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--violet)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--violet)" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis 
                    dataKey="index" 
                    stroke="var(--text-subtle)" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(tick) => `Ex. ${tick}`}
                  />
                  <YAxis 
                    stroke="var(--text-subtle)" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    domain={[0, 100]}
                    tickFormatter={(tick) => `${tick}%`}
                  />
                  <Tooltip content={<ProgressTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="pct" 
                    stroke="var(--violet)" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorProgress)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historical list */}
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ 
              fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-subtle)', 
              textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '1rem' 
            }}>
              Historique des Tentatives
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
              {mockExamHistory.map((item) => {
                const isHigh = item.pct >= 70;
                const isMid = item.pct >= 50 && item.pct < 70;
                const pctColor = isHigh ? 'var(--emerald)' : isMid ? 'var(--warning)' : 'var(--danger)';
                const pctBg = isHigh ? 'var(--emerald-soft)' : isMid ? 'var(--warning-soft)' : 'var(--danger-soft)';
                
                return (
                  <div 
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-glass)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      gap: '1rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, minWidth: '150px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                        {item.examName}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                        {formatDate(item.date)} · {item.school}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        background: item.mode === 'online' ? 'var(--violet-soft)' : 'rgba(16, 185, 129, 0.08)',
                        color: item.mode === 'online' ? 'var(--violet)' : 'var(--emerald)',
                        border: `1px solid ${item.mode === 'online' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)'}`
                      }}>
                        {item.mode === 'online' ? 'En ligne' : 'Scanner OMR'}
                      </span>
                      
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: pctBg,
                        color: pctColor,
                        padding: '0.25rem 0.75rem',
                        borderRadius: '99px',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        border: `1px solid ${pctColor}25`
                      }}>
                        {item.score}/{item.maxScore} <span style={{ opacity: 0.85, fontSize: '0.75rem', fontWeight: 600 }}>({item.pct}%)</span>
                      </div>

                       <button
                        onClick={() => onDownloadReport(item)}
                        title="Télécharger le rapport PDF"
                        aria-label="Télécharger le rapport PDF"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--violet-soft)',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          color: 'var(--violet)',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--violet)';
                          e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'var(--violet-soft)';
                          e.currentTarget.style.color = 'var(--violet)';
                        }}
                      >
                        <Printer size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
});

MockExamHistoryList.displayName = 'MockExamHistoryList';

export default MockExamHistoryList;
