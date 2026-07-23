import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Flashcard from '../components/Flashcard';
import MobileFlashcard from '../components/MobileFlashcard';
import SessionSummary from '../components/SessionSummary';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, BrainCircuit, CheckCircle2, Zap, RefreshCw, Sparkles, Trophy, BookOpen, Loader2 } from 'lucide-react';

// Helper to group cards by context, preserving original exam order and avoiding duplicates.
function groupCardsByContext(compiledCards, questionsPool) {
  const grouped = [];
  const seenIds = new Set();

  compiledCards.forEach(card => {
    if (seenIds.has(card.id)) return;

    if (card.context && card.context.trim()) {
      const siblings = questionsPool.filter(q =>
        q.context &&
        q.context.trim() === card.context.trim() &&
        q.examName === card.examName
      );

      siblings.forEach(q => {
        if (!seenIds.has(q.id)) {
          seenIds.add(q.id);
          grouped.push({
            ...q,
            stage: card.stage || 'révision',
            stageLabel: q.id === card.id ? (card.stageLabel || 'Révision') : `${card.stageLabel || 'Révision'} (Lié)`
          });
        }
      });
    } else {
      seenIds.add(card.id);
      grouped.push(card);
    }
  });

  return grouped;
}

export default function StudyMode() {
  const { user, exams, progress: allProgress, updateCardProgress, loadExamQuestions, supabaseEnabled } = useAuth();
  const [searchParams] = useSearchParams();
  const examId = searchParams.get('exam');
  const topicId = searchParams.get('topic');
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = location.state?.from || (user ? '/dashboard' : '/schools');

  // State hooks declared at the very top to avoid accessed-before-declaration ReferenceErrors
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [sessionStarted, setSessionStarted] = useState(!!examId || !!topicId);
  const [sessionCards, setSessionCards] = useState(null); // null = not initialized yet
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [showExitModal, setShowExitModal] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Mobile detection — updated on resize
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const activeExamsList = useMemo(() => {
    return exams.filter(e => e.isActive !== false && e.isArchived !== true);
  }, [exams]);
  const currentExam = examId ? exams.find(e => e.id === examId) : activeExamsList[0];

  const isParcours = !examId && !topicId;

  // Lazy load questions for study session before initialization
  useEffect(() => {
    if (!supabaseEnabled) return;
    if (loadingQuestions) return;

    if (!sessionStarted) {
      const examsToLoad = activeExamsList.filter(e => e.isActive !== false && e.isArchived !== true && e.questions === undefined);
      if (examsToLoad.length > 0) {
        setLoadingQuestions(true);
        Promise.all(examsToLoad.map(e => loadExamQuestions(e.id)))
          .catch(err => console.error('[StudyMode] Failed to pre-load active exam questions:', err))
          .finally(() => setLoadingQuestions(false));
      }
      return;
    }

    if (examId) {
      const exam = exams.find(e => e.id === examId);
      if (exam && exam.questions === undefined) {
        setLoadingQuestions(true);
        loadExamQuestions(examId)
          .catch(err => console.error('[StudyMode] Failed to load exam questions:', err))
          .finally(() => setLoadingQuestions(false));
      }
    } else if (topicId) {
      const examsToLoad = activeExamsList.filter(e => e.questions === undefined);
      if (examsToLoad.length > 0) {
        setLoadingQuestions(true);
        Promise.all(examsToLoad.map(e => loadExamQuestions(e.id)))
          .catch(err => console.error('[StudyMode] Failed to load active exams questions for topic:', err))
          .finally(() => setLoadingQuestions(false));
      }
    } else {
      const examsToLoad = activeExamsList.filter(e => e.questions === undefined);
      if (examsToLoad.length > 0) {
        setLoadingQuestions(true);
        Promise.all(examsToLoad.map(e => loadExamQuestions(e.id)))
          .catch(err => console.error('[StudyMode] Failed to load active exams questions for general review:', err))
          .finally(() => setLoadingQuestions(false));
      }
    }
  }, [examId, topicId, sessionStarted, exams, loadExamQuestions, activeExamsList, supabaseEnabled, loadingQuestions]);

  // Dynamically allow scrolling on selector dashboard, but lock it in study session focus mode
  useEffect(() => {
    const layoutEl = document.querySelector('.focus-layout');
    if (!sessionStarted) {
      if (layoutEl) {
        layoutEl.style.setProperty('overflow-y', 'auto', 'important');
        layoutEl.style.setProperty('overflow-x', 'hidden', 'important');
        layoutEl.style.setProperty('height', 'auto', 'important');
      }
      document.body.style.setProperty('overflow-y', 'auto', 'important');
      document.body.style.setProperty('overflow-x', 'hidden', 'important');
      document.body.style.setProperty('position', 'relative', 'important');
    } else {
      if (layoutEl) {
        layoutEl.style.removeProperty('overflow-y');
        layoutEl.style.removeProperty('overflow-x');
        layoutEl.style.removeProperty('height');
      }
      document.body.style.removeProperty('overflow-y');
      document.body.style.removeProperty('overflow-x');
      document.body.style.removeProperty('position');
    }
    return () => {
      if (layoutEl) {
        layoutEl.style.removeProperty('overflow-y');
        layoutEl.style.removeProperty('overflow-x');
        layoutEl.style.removeProperty('height');
      }
      document.body.style.removeProperty('overflow-y');
      document.body.style.removeProperty('overflow-x');
      document.body.style.removeProperty('position');
    };
  }, [sessionStarted]);

  // Track sessionType/examId/topicId URL changes
  useEffect(() => {
    const shouldBeStarted = !!(examId || topicId);
    if (shouldBeStarted !== sessionStarted) {
      Promise.resolve().then(() => {
        setSessionStarted(shouldBeStarted);
      });
    }
    if (!shouldBeStarted) {
      Promise.resolve().then(() => {
        setSessionCards(null);
        setCurrentIndex(0);
        setSessionHistory([]);
      });
    }
  }, [examId, topicId, sessionStarted]);

  useEffect(() => {
    if (!sessionStarted || sessionCards !== null || loadingQuestions) return;

    // Check if questions are actually loaded for what we need
    if (examId) {
      const exam = exams.find(e => e.id === examId);
      if (!exam) return;
      if (supabaseEnabled && exam.questions === undefined) {
        return; // wait for lazy loading to populate questions
      }
      if (!exam.questions || exam.questions.length === 0) {
        Promise.resolve().then(() => {
          setSessionCards([]);
        });
        return;
      }
    }

    if (supabaseEnabled) {
      if (topicId) {
        if (activeExamsList.some(e => e.questions === undefined)) return;
      } else if (!examId) {
        if (activeExamsList.some(e => e.questions === undefined)) return;
      }
    }

    const now = new Date();
    let questionsPool;

    if (examId) {
      if (!currentExam || !currentExam.questions) return;
      questionsPool = (currentExam.questions || []).map(q => ({ ...q, examName: currentExam.name }));

      // Map and filter questions that are due (unseen or due for review)
      const compiledCards = questionsPool
        .filter(q => {
          const p = allProgress[q.id];
          if (!p) return true;
          return new Date(p.nextReviewDate) <= now;
        })
        .map(q => {
          const p = allProgress[q.id];
          let stage = 'révision';
          let stageLabel = 'Révision';
          if (!p) {
            stage = 'nouveautés';
            stageLabel = 'Nouvelle Notion';
          } else if (p.repetitions >= 3) {
            stage = 'échauffement';
            stageLabel = 'Échauffement';
          } else if (p.easeFactor < 2.2) {
            stage = 'défi';
            stageLabel = 'Défi du Jour';
          } else if (p.repetitions > 0 && new Date(p.nextReviewDate) <= now) {
            stage = 'consolidation';
            stageLabel = 'Consolidation';
          }
          return {
            ...q,
            stage,
            stageLabel
          };
        });

      // Keep cards completely independent, do not pull un-due sibling questions
      Promise.resolve().then(() => {
        setSessionCards(compiledCards);
      });
    } else if (topicId) {
      questionsPool = activeExamsList.flatMap(e =>
        (e.questions || []).map(q => ({ ...q, examName: e.name }))
      );

      // Filter questions by topic and keep only independent questions (exclude questions with a context)
      const topicQuestions = questionsPool.filter(q => 
        (q.topic || 'Général').trim().toLowerCase() === topicId.trim().toLowerCase() &&
        (!q.context || !q.context.trim())
      );

      // Separate into due and reviewed
      const duePool = topicQuestions.filter(q => {
        const p = allProgress[q.id];
        return !p || new Date(p.nextReviewDate) <= now;
      });

      const otherPool = topicQuestions.filter(q => {
        const p = allProgress[q.id];
        return p && new Date(p.nextReviewDate) > now;
      });

      // Prioritize due cards first (up to 10)
      const selectedDue = duePool.sort(() => 0.5 - Math.random()).slice(0, 10);
      let selectedCards = [...selectedDue];

      // If less than 10, backfill from other cards of this topic
      if (selectedCards.length < 10 && otherPool.length > 0) {
        const needed = 10 - selectedCards.length;
        const additional = otherPool.sort(() => 0.5 - Math.random()).slice(0, needed);
        selectedCards = [...selectedCards, ...additional];
      }

      const compiledCards = selectedCards.map(q => {
        const p = allProgress[q.id];
        let stage = 'révision';
        let stageLabel = 'Révision';
        if (!p) {
          stage = 'nouveautés';
          stageLabel = 'Nouvelle Notion';
        } else if (p.repetitions >= 3) {
          stage = 'échauffement';
          stageLabel = 'Échauffement';
        } else if (p.easeFactor < 2.2) {
          stage = 'défi';
          stageLabel = 'Défi du Jour';
        } else if (p.repetitions > 0 && new Date(p.nextReviewDate) <= now) {
          stage = 'consolidation';
          stageLabel = 'Consolidation';
        }
        return {
          ...q,
          stage,
          stageLabel
        };
      });

      // Keep cards completely independent, do not pull un-due sibling questions
      Promise.resolve().then(() => {
        setSessionCards(compiledCards.slice(0, 10));
      });
    } else {
      questionsPool = activeExamsList.flatMap(e =>
        (e.questions || []).map(q => ({ ...q, examName: e.name }))
      );

      // Classification
      // 1. Échauffement (repetitions >= 3)
      const echauffementPool = questionsPool.filter(q => allProgress[q.id]?.repetitions >= 3);
      const echauffement = echauffementPool.sort(() => 0.5 - Math.random()).slice(0, 3)
        .map(q => ({ ...q, stage: 'échauffement', stageLabel: 'Échauffement' }));

      // 2. Consolidation (due & repetitions > 0)
      const consolidationPool = questionsPool.filter(q => {
        const p = allProgress[q.id];
        return p && p.repetitions > 0 && new Date(p.nextReviewDate) <= now;
      });
      const consolidation = consolidationPool.sort(() => 0.5 - Math.random()).slice(0, 5)
        .map(q => ({ ...q, stage: 'consolidation', stageLabel: 'Consolidation' }));

      // 3. Nouveautés (not seen)
      const nouveautesPool = questionsPool.filter(q => !allProgress[q.id]);
      const nouveautes = nouveautesPool.sort(() => 0.5 - Math.random()).slice(0, 5)
        .map(q => ({ ...q, stage: 'nouveautés', stageLabel: 'Nouvelle Notion' }));

      // 4. Défi (easeFactor < 2.2)
      const defiPool = questionsPool.filter(q => {
        const p = allProgress[q.id];
        return p && p.easeFactor < 2.2;
      });
      const fallbackDefiPool = defiPool.length > 0 ? defiPool : questionsPool.filter(q => allProgress[q.id]);
      const defi = fallbackDefiPool.sort(() => 0.5 - Math.random()).slice(0, 2)
        .map(q => ({ ...q, stage: 'défi', stageLabel: 'Défi du Jour' }));

      const compiledCards = [...echauffement, ...consolidation, ...nouveautes, ...defi];
      const groupedCards = groupCardsByContext(compiledCards, questionsPool);
      Promise.resolve().then(() => {
        setSessionCards(groupedCards);
      });
    }
  }, [currentExam, examId, topicId, exams, allProgress, sessionCards, sessionStarted, activeExamsList, supabaseEnabled]);
  // ────────────────────────────────────────────────────────────────────────────

  const handleBackClick = () => {
    if (sessionHistory.length > 0) {
      setShowExitModal(true);
    } else {
      navigate(fromPath);
    }
  };

  // Redirect if exam is invalid
  useEffect(() => {
    if (isParcours) {
      if (activeExamsList.length === 0) {
        navigate(fromPath);
      }
      return;
    }
    if (!topicId) {
      if (!currentExam && activeExamsList.length > 0) {
        navigate(`/study?exam=${activeExamsList[0].id}`, { replace: true });
      } else if (activeExamsList.length === 0) {
        navigate(fromPath);
      }
    }
  }, [currentExam, activeExamsList, navigate, isParcours, topicId, user]);

  const handleNext = (questionId, quality) => {
    updateCardProgress(questionId, quality); // Updates SRS data in background
    
    // Track history for session summary
    const card = sessionCards[currentIndex];
    setSessionHistory(prev => [
      ...prev,
      {
        questionId,
        quality,
        topic: card?.topic || 'Général'
      }
    ]);

    if (currentIndex < sessionCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setSessionFinished(true);
    }
  };

  const handleForceReview = () => {
    if (!currentExam || !currentExam.questions) return;
    const questionsPool = (currentExam.questions || []).map(q => ({ ...q, examName: currentExam.name }));
    const shuffled = [...questionsPool].sort(() => 0.5 - Math.random());
    
    const sliced = shuffled.slice(0, 10).map(q => ({
      ...q,
      stage: 'révision',
      stageLabel: 'Révision'
    }));

    const grouped = groupCardsByContext(sliced, questionsPool);
    setSessionCards(grouped);
    setSessionFinished(false);
    setCurrentIndex(0);
    setSessionHistory([]);
  };



  // ── Study Selector Dashboard (Main screen when no exam/session is selected) ──
  if (!sessionStarted) {
    return (
      <div className="animate-fade-in" style={{ padding: 'clamp(1rem, 4vw, 2.5rem) 1rem', maxWidth: '1100px', width: '100%', boxSizing: 'border-box', margin: '0 auto', minHeight: '85vh', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Top Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button 
            onClick={() => navigate(user ? '/dashboard' : '/schools')}
            className="btn-outline"
            style={{ 
              padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 800, 
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem' 
            }}
          >
            <ArrowLeft size={16} /> {user ? 'Retour au Dashboard' : 'Retour aux écoles'}
          </button>
        </div>

        {/* Hub Header Title */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ 
            width: '60px', height: '60px', background: 'var(--violet-soft)', borderRadius: '18px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem',
            border: '1px solid rgba(113, 109, 242, 0.2)', color: 'var(--violet)'
          }}>
            <BrainCircuit size={30} />
          </div>
          <h1 className="text-gradient" style={{ fontSize: 'clamp(1.6rem, 5vw, 2.3rem)', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Espace Révision (SRS)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.85rem, 2.5vw, 1rem)', maxWidth: '580px', margin: '0 auto', lineHeight: 1.6 }}>
            Consolidez votre mémoire à long terme en révisant les notions au moment optimal calculé par notre algorithme de répétition espacée.
          </p>
        </div>

        {/* Centered Chapter Review */}
        <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
          {(() => {
            const topicCounts = {};
            const now = new Date();
            
            activeExamsList.forEach(e => {
              (e.questions || []).forEach(q => {
                const topic = q.topic || 'Général';
                if (!topicCounts[topic]) {
                  topicCounts[topic] = { total: 0, due: 0 };
                }
                topicCounts[topic].total++;
                
                const p = allProgress[q.id];
                const isDue = !p || new Date(p.nextReviewDate) <= now;
                if (isDue) {
                  topicCounts[topic].due++;
                }
              });
            });
            
            const topicsData = Object.entries(topicCounts).map(([name, counts]) => ({
              name,
              total: counts.total,
              due: counts.due
            })).sort((a, b) => b.due - a.due || b.total - a.total);

            if (topicsData.length === 0) {
              return (
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, margin: 0, fontSize: '1.15rem' }}>
                      <BrainCircuit size={20} color="var(--violet)" /> Révision par Chapitres
                    </h3>
                  </div>
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <BrainCircuit size={36} opacity={0.4} style={{ marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 600 }}>Aucun chapitre disponible</p>
                  </div>
                </div>
              );
            }

            return (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem', marginBottom: '0.25rem' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, margin: 0, fontSize: '1.15rem' }}>
                    <BrainCircuit size={20} color="var(--violet)" /> Révision par Chapitres
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    {topicsData.length} chapitre{topicsData.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {topicsData.map((topic) => {
                    const isCompleted = topic.due === 0;
                    
                    // Select an appropriate design based on the topic name
                    const nameLower = topic.name.toLowerCase();
                    let bgSoft = 'var(--violet-soft)';
                    let textColor = 'var(--violet)';
                    
                    if (nameLower.includes('analyse') || nameLower.includes('suit')) {
                      bgSoft = 'rgba(16, 185, 129, 0.08)';
                      textColor = 'var(--emerald)';
                    } else if (nameLower.includes('algè') || nameLower.includes('alge') || nameLower.includes('matric')) {
                      bgSoft = 'rgba(239, 68, 68, 0.08)';
                      textColor = 'var(--danger)';
                    } else if (nameLower.includes('géo') || nameLower.includes('geo') || nameLower.includes('espac')) {
                      bgSoft = 'rgba(245, 158, 11, 0.08)';
                      textColor = 'var(--warning)';
                    }

                    return (
                      <div 
                        key={topic.name} 
                        className="exam-card-premium"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1 }}>
                          <div style={{ 
                            width: '38px', height: '38px', borderRadius: '10px', 
                            background: isCompleted ? 'rgba(16, 185, 129, 0.05)' : bgSoft,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            color: isCompleted ? 'var(--emerald)' : textColor
                          }}>
                            <BrainCircuit size={16} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                              {topic.name}
                            </h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                              <span>{topic.total} fiches au total</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="exam-card-premium-actions">
                          {!isCompleted ? (
                            <div className="exam-card-premium-action-row">
                              <div style={{ 
                                background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger)', 
                                padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 900,
                                display: 'inline-flex', alignItems: 'center', gap: '0.2rem', border: '1px solid rgba(239, 68, 68, 0.1)',
                                flexShrink: 0
                              }}>
                                {topic.due} À RÉVISER
                              </div>
                              <button 
                                className="btn" 
                                onClick={() => navigate(`/study?topic=${encodeURIComponent(topic.name)}`)}
                                style={{ 
                                  padding: '0.45rem 1rem', 
                                  fontSize: '0.72rem', 
                                  fontWeight: 800,
                                  minHeight: '38px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                Réviser (Max 10)
                              </button>
                            </div>
                          ) : (
                            <div className="exam-card-premium-action-row">
                              <div style={{ 
                                background: 'rgba(16, 185, 129, 0.05)', color: 'var(--emerald)', 
                                padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 900,
                                display: 'inline-flex', alignItems: 'center', gap: '0.2rem', border: '1px solid rgba(16, 185, 129, 0.1)',
                                flexShrink: 0
                              }}>
                                COMPLÉTÉ ✨
                              </div>
                              <button 
                                className="btn-outline"
                                onClick={() => navigate(`/study?topic=${encodeURIComponent(topic.name)}`)}
                                style={{ 
                                  padding: '0.45rem 0.85rem', 
                                  fontSize: '0.72rem', 
                                  fontWeight: 800,
                                  minHeight: '38px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                Entraînement
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }


  // ── Loading state ──
  if ((!isParcours && !currentExam && !topicId) || sessionCards === null || loadingQuestions) {
    return (
      <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <BrainCircuit size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <h2 className="text-muted">
            {loadingQuestions ? "Chargement des questions..." : (isParcours ? "Chargement du parcours guidé..." : "Chargement de la session...")}
          </h2>
        </div>
      </div>
    );
  }

  // ── Empty exam ──
  if (!isParcours && !topicId && currentExam?.questions && currentExam?.questions.length === 0) {
    return (
      <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', maxWidth: '500px' }}>
          <BrainCircuit size={48} color="var(--danger)" style={{ marginBottom: '1.5rem' }} />
          <h3 style={{ marginBottom: '1rem' }}>Module Vide</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
            Ce module ne contient aucune question. Contactez l'administration.
          </p>
          <button className="btn" onClick={() => navigate(fromPath)}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  // ── All cards already reviewed today (SRS) ──
  if (sessionCards.length === 0) {
    return (
      <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem', maxWidth: '500px' }}>
          <div style={{ width: '80px', height: '80px', background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
            <CheckCircle2 size={40} color="var(--emerald)" />
          </div>
          <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '1rem' }}>{isParcours ? "Parcours Complété !" : topicId ? "Tout est révisé !" : "Tout est à jour !"}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.1rem' }}>
            {isParcours 
              ? "Vous avez terminé tout votre parcours guidé d'aujourd'hui. Excellent travail pour maintenir votre régularité !"
              : topicId 
                ? `Toutes les fiches du chapitre ${topicId} sont révisées pour aujourd'hui.`
                : `Vous avez révisé toutes les cartes prévues pour aujourd'hui dans ${currentExam.name}.`
            }
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
            {!isParcours && !topicId && (
              <button className="btn-outline" onClick={handleForceReview} style={{ width: '100%', borderColor: 'var(--violet)', color: 'var(--violet)' }}>
                Forcer une révision (10 cartes)
              </button>
            )}
            <button className="btn" onClick={() => navigate(fromPath)} style={{ width: '100%' }}>
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Session finished (Show the premium SessionSummary) ──
  if (sessionFinished) {
    return (
      <SessionSummary 
        sessionHistory={sessionHistory}
        examName={isParcours ? "Session de révision du jour" : topicId ? `Chapitre : ${topicId}` : currentExam.name}
        onForceReview={isParcours || topicId ? null : handleForceReview}
        onBackToDashboard={() => navigate(fromPath)}
        user={user}
      />
    );
  }

  const progress = (currentIndex / sessionCards.length) * 100;
  const currentCard = sessionCards[currentIndex];

  return (
    <div className="animate-fade-in" style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      maxWidth: isMobile ? '100%' : '1200px',
      margin: '0 auto',
      padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 1rem',
      overflowX: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* ── Unified Minimalist Header (Single Line for Focus) ── */}
      <div className="study-session-header">
        {/* Left: Back Button & Title & Stage */}
        <div className="study-header-left">
          <button 
            className="study-back-btn"
            onClick={handleBackClick} 
          >
            <ArrowLeft size={18} />
          </button>
          
          <span className="study-session-title">
            {isParcours ? "Révision du jour" : topicId ? `Quiz : ${topicId}` : currentExam.name}
          </span>

          {currentCard?.stageLabel && (
            <div style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '99px',
              background: 
                currentCard.stage === 'échauffement' ? 'var(--violet-soft)' :
                currentCard.stage === 'consolidation' ? 'var(--warning-soft)' :
                currentCard.stage === 'nouveautés' ? 'var(--emerald-soft)' :
                'rgba(239, 68, 68, 0.08)',
              color: 
                currentCard.stage === 'échauffement' ? 'var(--violet)' :
                currentCard.stage === 'consolidation' ? 'var(--warning)' :
                currentCard.stage === 'nouveautés' ? 'var(--emerald)' :
                'var(--danger)',
              border: '1px solid currentColor',
              fontSize: '0.68rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              whiteSpace: 'nowrap'
            }}>
              {currentCard.stage === 'échauffement' && <Zap size={11} style={{ strokeWidth: 3 }} />}
              {currentCard.stage === 'consolidation' && <RefreshCw size={11} style={{ strokeWidth: 3 }} />}
              {currentCard.stage === 'nouveautés' && <Sparkles size={11} style={{ strokeWidth: 3 }} />}
              {currentCard.stage === 'défi' && <Trophy size={11} style={{ strokeWidth: 3 }} />}
              {currentCard.stageLabel}
            </div>
          )}
        </div>

        {/* Center: Progress Bar */}
        <div className="study-header-center">
          <div className="study-progress-track">
            <div 
              className="study-progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Right: Counter */}
        <div className="study-header-right">
          <span>{currentIndex + 1}</span>
          <span style={{ color: 'var(--text-subtle)', fontWeight: 500 }}>/</span>
          <span style={{ color: 'var(--text-subtle)' }}>{sessionCards.length}</span>
        </div>
      </div>

      {/* ── Flashcard: desktop vs mobile ── */}
      <div 
        className="study-scroll-container"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'flex-start',
          justifyContent: 'center',
          /* On mobile: natural scroll, not squeezed */
          overflowY: isMobile ? 'auto' : 'visible',
          paddingBottom: isMobile ? '5rem' : 0,
        }}>
        {isMobile ? (
          <MobileFlashcard
            key={currentCard.id}
            card={currentCard}
            onNext={handleNext}
          />
        ) : (
          <Flashcard
            key={currentCard.id}
            card={currentCard}
            onNext={handleNext}
          />
        )}
      </div>

      {/* ── Exit Confirmation Modal ── */}
      {showExitModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2, 6, 23, 0.8)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="animate-fade-in" style={{
            maxWidth: '460px',
            width: '100%',
            padding: '2.5rem',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            boxShadow: 'var(--shadow-card)',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'var(--violet-soft)',
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              border: '1px solid rgba(99, 102, 241, 0.15)',
              color: 'var(--violet)'
            }}>
              <BrainCircuit size={28} />
            </div>
            
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
              Quitter la session ?
            </h3>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55, marginBottom: '2rem' }}>
              Votre progression sur les <strong>{sessionHistory.length}</strong> fiche{sessionHistory.length !== 1 ? 's' : ''} révisée{sessionHistory.length !== 1 ? 's' : ''} a bien été enregistrée.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <button 
                className="btn" 
                onClick={() => {
                  setShowExitModal(false);
                  setSessionFinished(true);
                }}
                style={{ 
                  width: '100%', 
                  padding: '0.85rem', 
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
                  border: 'none',
                  boxShadow: '0 8px 20px rgba(99, 102, 241, 0.2)'
                }}
              >
                Voir le bilan de session
              </button>
              
              <button 
                className="btn-outline" 
                onClick={() => navigate(fromPath, { state: { partialSave: true, count: sessionHistory.length } })}
                style={{ width: '100%', padding: '0.85rem', fontWeight: 800, borderColor: 'var(--border)', color: 'var(--text-main)' }}
              >
                Quitter directement
              </button>
              
              <button 
                onClick={() => setShowExitModal(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-subtle)', 
                  fontSize: '0.85rem', 
                  fontWeight: 600, 
                  cursor: 'pointer', 
                  marginTop: '0.5rem',
                  textDecoration: 'underline'
                }}
              >
                Continuer à réviser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
