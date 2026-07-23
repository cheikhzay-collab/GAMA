import React, { useState, useMemo, useCallback } from 'react';
import { Trophy, CheckCircle2, XCircle, Lightbulb, ArrowLeft, TrendingUp, Zap, Lock, Share2, Download, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { renderWithMath } from '../utils/mathRenderer';
import { generateStudentReportHTML, openPrintWindow } from '../utils/generateExamPDF';
import DiagnosticReport from './DiagnosticReport';

const renderOptionText = (text) => renderWithMath(text);

const MockExamResults = React.memo(({ questions, answers, exam, onReturn, schoolBranding }) => {
  const { user } = useAuth();
  const isPremium = user?.role === 'admin' || user?.tier === 'premium';
  const [tab, setTab] = useState('correction');
  const [shareToast, setShareToast] = useState(null);

  const brand = useMemo(
    () => schoolBranding[exam.school] || { scoring: { correct: 1, wrong: -0.25, empty: 0 } },
    [schoolBranding, exam.school]
  );
  const rules = useMemo(() => brand.scoring || { correct: 1, wrong: -0.25, empty: 0 }, [brand]);

  const { score, pct, corrected } = useMemo(() => {
    let pts = 0;
    questions.forEach(q => {
      const ans = answers[q.id];
      if (ans === q.correct_answer) pts += rules.correct;
      else if (!ans) pts += rules.empty;
      else pts += rules.wrong;
    });

    const maxPossible = questions.length * rules.correct;
    const computedPct = maxPossible > 0 ? Math.max(0, Math.round((pts / maxPossible) * 100)) : 0;

    const computedCorrected = questions.map((q, idx) => ({
      q: idx + 1,
      question: q.question,
      correct: q.correct_answer,
      detected: answers[q.id] || null,
      result: answers[q.id] === q.correct_answer ? 'correct' : 'wrong',
      topic: q.topic || 'Général',
    }));

    return { score: pts, pct: computedPct, corrected: computedCorrected };
  }, [questions, answers, rules]);

  // Share results via Web Share API or clipboard
  const handleShare = useCallback(async () => {
    const correctCount = corrected.filter(c => c.result === 'correct').length;
    const totalCount = corrected.length;
    const shareText = `🏆 Résultat L'CONQ — ${exam.name}\n\n📊 Score: ${score}/${totalCount} (${pct}%)\n✅ Correctes: ${correctCount}\n❌ Incorrectes: ${totalCount - correctCount}\n\n🎯 Prêt pour le concours ? Rejoins-moi sur L'CONQ !\n🔗 www.lconq.ma`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Résultat L'CONQ — ${exam.name}`,
          text: shareText,
        });
        setShareToast('Partagé avec succès !');
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Fallback to clipboard
          await navigator.clipboard.writeText(shareText);
          setShareToast('Résultat copié !');
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setShareToast('Résultat copié dans le presse-papier !');
      } catch {
        setShareToast('Impossible de copier');
      }
    }
    setTimeout(() => setShareToast(null), 3000);
  }, [corrected, exam.name, score, pct]);

  // Download PDF report
  const handleDownloadPDF = useCallback(() => {
    const scoreObj = { pts: score, total: questions.length };
    const html = generateStudentReportHTML(exam, scoreObj, corrected, {});
    openPrintWindow(html, `rapport-${exam.name}`);
  }, [exam, score, questions.length, corrected]);

  return (
    <div className="mock-results-root animate-fade-in">

      {/* ── Share Toast ──────────────────────────────────────────── */}
      {shareToast && (
        <div style={{
          position: 'fixed',
          top: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #10B981, #059669)',
          color: '#fff',
          padding: '0.65rem 1.5rem',
          borderRadius: '12px',
          fontWeight: 700,
          fontSize: '0.85rem',
          boxShadow: '0 8px 30px rgba(16, 185, 129, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'fadeIn 0.3s ease',
        }}>
          <Check size={16} /> {shareToast}
        </div>
      )}

      {/* ── Trophy / Score card ───────────────────────────────────── */}
      <div className="mock-results-header glass-panel">
        {/* Trophy icon */}
        <div
          className="mock-results-trophy"
          style={{
            background: pct >= 50 ? 'var(--emerald-soft)' : 'var(--danger-soft)',
            border: `2px solid ${pct >= 50 ? 'var(--emerald)' : 'var(--danger)'}`,
          }}
        >
          <Trophy size={30} color={pct >= 50 ? 'var(--emerald)' : 'var(--danger)'} />
        </div>

        <h1 className="mock-results-title text-gradient">Rapport de Performance</h1>

        {/* Score */}
        <div className="mock-results-score">
          {score}
          <span className="mock-results-score-denom">/{questions.length}</span>
        </div>

        {/* % badge */}
        <div
          className="mock-results-pct-badge"
          style={{
            background: pct >= 50 ? 'var(--emerald-soft)' : 'var(--danger-soft)',
            color:      pct >= 50 ? 'var(--emerald)'      : 'var(--danger)',
            border:     `1px solid ${pct >= 50 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          <Zap size={13} /> {pct}% de réussite
        </div>

        {/* ── Action Buttons (Share + PDF + Return) ── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.6rem',
          justifyContent: 'center',
          marginTop: '0.5rem',
          width: '100%',
        }}>
          <button
            className="btn"
            onClick={handleShare}
            style={{
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '0.55rem 1.1rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.25)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flex: '1 1 auto',
              minWidth: '130px',
              justifyContent: 'center',
            }}
          >
            <Share2 size={15} /> Partager
          </button>

          <button
            className="btn"
            onClick={handleDownloadPDF}
            style={{
              background: 'linear-gradient(135deg, #10B981, #059669)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '0.55rem 1.1rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flex: '1 1 auto',
              minWidth: '130px',
              justifyContent: 'center',
            }}
          >
            <Download size={15} /> Télécharger PDF
          </button>

          <button className="btn mock-results-return-btn" onClick={onReturn} style={{
            flex: '1 1 auto',
            minWidth: '130px',
            justifyContent: 'center',
          }}>
            <ArrowLeft size={15} /> Retour
          </button>
        </div>
      </div>

      {/* ── Tab switcher ──────────────────────────────────────────── */}
      <div className="mock-results-tabs">
        {[
          { id: 'correction', label: 'Correction',  icon: <CheckCircle2 size={14} /> },
          { id: 'diagnostic', label: 'Diagnostic',  icon: <TrendingUp   size={14} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`mock-results-tab-btn${tab === t.id ? ' active' : ''}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Correction tab ────────────────────────────────────────── */}
      {tab === 'correction' && (
        <div className="mock-results-list">
          {questions.map((q, idx) => {
            const userAns  = answers[q.id];
            const isCorrect = userAns === q.correct_answer;
            return (
              <div
                key={q.id}
                className="mock-results-card glass-panel"
                style={{ borderLeftColor: isCorrect ? 'var(--emerald)' : 'var(--danger)' }}
              >
                {/* Question meta row */}
                <div className="mock-results-card-meta">
                  <span className="mock-results-card-label">
                    Question {idx + 1}{q.topic && ` · ${q.topic}`}
                  </span>
                  {isCorrect
                    ? <CheckCircle2 size={18} color="var(--emerald)" />
                    : <XCircle      size={18} color="var(--danger)"  />
                  }
                </div>

                {/* Question text */}
                <div className="mock-results-card-question">
                  {renderWithMath(q.question)}
                </div>

                {/* Answer columns — stack on mobile */}
                <div className="mock-results-answers">
                  <div className="mock-results-answer-box mock-results-answer-user">
                    <p className="mock-results-answer-label">VOTRE RÉPONSE</p>
                    {userAns
                      ? <span style={{ color: isCorrect ? 'var(--emerald)' : 'var(--danger)', fontWeight: 600 }}>
                          {userAns}) {renderOptionText(q.options.find(o => o.id === userAns)?.text)}
                        </span>
                      : <span className="text-muted">Aucune réponse</span>
                    }
                  </div>

                  <div className="mock-results-answer-box mock-results-answer-correct">
                    <p className="mock-results-answer-label" style={{ color: 'var(--emerald)' }}>BONNE RÉPONSE</p>
                    <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>
                      {q.correct_answer}) {renderOptionText(q.options.find(o => o.id === q.correct_answer)?.text)}
                    </span>
                  </div>
                </div>

                {/* Astuce */}
                {!isCorrect && q.astuce && (
                  <div className="astuce-box" style={{ marginTop: '0.75rem', position: 'relative', overflow: 'hidden' }}>
                    <div className="astuce-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Lightbulb size={15} /> Astuce de résolution
                      </span>
                      {!isPremium && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.5rem', borderRadius: '99px', background: 'var(--violet)', color: '#fff', fontSize: '0.65rem', fontWeight: 800 }}>
                          <Lock size={10} /> PRO
                        </span>
                      )}
                    </div>
                    {isPremium ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.4rem 0 0' }}>
                        {renderWithMath(q.astuce)}
                      </div>
                    ) : (
                      <>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.4rem 0 0', filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none' }}>
                          Pour résoudre cette question rapidement en concours, il suffit d'appliquer la formule simplifiée et d'éliminer les options incompatibles directement.
                        </div>
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          top: '24px',
                          background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.02) 0%, rgba(99, 102, 241, 0.15) 100%)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.3rem',
                          padding: '0.5rem',
                          backdropFilter: 'blur(1px)'
                        }}>
                          <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, color: 'var(--violet)' }}>Explication & Astuce masquées</p>
                          <a href="/subscription" style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', background: 'var(--violet)', padding: '0.25rem 0.65rem', borderRadius: '8px', textDecoration: 'none', boxShadow: '0 4px 10px var(--violet-glow)' }}>
                            Débloquer l'astuce ⚡
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Diagnostic tab ────────────────────────────────────────── */}
      {tab === 'diagnostic' && (
        <DiagnosticReport corrected={corrected} exam={exam} onClose={onReturn} />
      )}
    </div>
  );
});

MockExamResults.displayName = 'MockExamResults';
export default MockExamResults;
