// src/components/ExamVariantModal.jsx
// Modal interactif pour la génération de Modèles Parallèles & Équivalents Anti-Triche (Modèle A / Modèle B)
// Spécifiquement calibré pour les devoirs surveillés et examens du système éducatif marocain.

import React, { useState } from 'react';
import {
  Shuffle, Sparkles, Printer, Layers, CheckCircle2,
  X, Loader2, Eye, Settings2, Save, Download,
  ArrowLeftRight, AlertCircle, FileText, Check
} from 'lucide-react';
import { renderWithMath } from '../utils/mathRenderer';
import { generateSmartShuffleVariant, generateIsomorphicAiVariant } from '../utils/aiVariantGenerator';
import { generateSubjectHTML, generateCorrectionHTML, openPrintWindow } from '../utils/generateExamPDF';
import { addExam } from '../services/examService';

export default function ExamVariantModal({
  isOpen,
  onClose,
  exam,
  questions = [],
  onApplyVariant = null
}) {
  const [generationMode, setGenerationMode] = useState('shuffle'); // 'shuffle' | 'ai'
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleChoices, setShuffleChoices] = useState(true);
  const [preserveContextGrouping, setPreserveContextGrouping] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [generatedVariant, setGeneratedVariant] = useState(null);
  const [selectedPreviewIdx, setSelectedPreviewIdx] = useState(0);
  const [activeTab, setActiveTab] = useState('compare'); // 'compare' | 'keys'
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setSaveSuccess(false);
    try {
      if (generationMode === 'shuffle') {
        setProgressStatus('Génération de la permutation intelligente...');
        // Délai léger pour fluidité de l'UI
        await new Promise(r => setTimeout(r, 200));
        const res = generateSmartShuffleVariant(questions, exam, {
          shuffleQuestions,
          shuffleChoices,
          preserveContextGrouping
        });
        setGeneratedVariant(res);
      } else {
        const res = await generateIsomorphicAiVariant(
          questions,
          exam,
          (prog) => setProgressStatus(prog.message || 'Génération en cours...')
        );
        setGeneratedVariant(res);
      }
    } catch (err) {
      alert('Erreur lors de la génération du Modèle B : ' + (err.message || err));
    } finally {
      setIsGenerating(false);
      setProgressStatus('');
    }
  };

  const handlePrintSubject = async (variantLetter) => {
    try {
      const qList = variantLetter === 'A' ? questions : (generatedVariant?.questions || []);
      if (!qList || qList.length === 0) {
        alert('Aucune question à imprimer.');
        return;
      }
      const title = `${exam?.name || 'Devoir Surveillé'} (Modèle ${variantLetter})`;
      const html = await generateSubjectHTML(title, exam?.school, exam?.year, qList, {
        examId: `${exam?.id || 'EXAM'}_MOD_${variantLetter}`,
        variantBadge: `MODÈLE ${variantLetter}`,
        showCover: true
      });
      openPrintWindow(html, `Sujet_Modele_${variantLetter}`);
    } catch (err) {
      alert("Erreur lors de l'impression : " + err.message);
    }
  };

  const handlePrintCorrection = (variantLetter) => {
    try {
      const qList = variantLetter === 'A' ? questions : (generatedVariant?.questions || []);
      if (!qList || qList.length === 0) {
        alert('Aucune question à imprimer.');
        return;
      }
      const title = `${exam?.name || 'Devoir Surveillé'} (Modèle ${variantLetter})`;
      const html = generateCorrectionHTML(title, exam?.school, exam?.year, qList, {
        variantBadge: `MODÈLE ${variantLetter}`,
        showCover: true
      });
      openPrintWindow(html, `Corrige_Modele_${variantLetter}`);
    } catch (err) {
      alert("Erreur lors de l'impression du corrigé : " + err.message);
    }
  };

  const handleSaveAsNewExam = async () => {
    if (!generatedVariant || !generatedVariant.questions) return;
    setIsSaving(true);
    try {
      const newExamData = {
        name: `${exam?.name || 'Épreuve'} (Modèle B - Anti-Triche)`,
        school: exam?.school || '',
        level: exam?.level || '',
        year: exam?.year || new Date().getFullYear().toString(),
        tier: exam?.tier || 'freemium',
        questions: generatedVariant.questions,
        dateAdded: new Date().toISOString()
      };
      await addExam(newExamData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert("Erreur lors de l'enregistrement du Modèle B : " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const currentQA = questions[selectedPreviewIdx];
  const currentQB = generatedVariant?.questions?.[selectedPreviewIdx];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.2rem', overflowY: 'auto'
    }}>
      <div style={{
        background: 'var(--bg-card, #18181b)',
        border: '1px solid var(--border, rgba(255,255,255,0.12))',
        borderRadius: 20, width: '100%', maxWidth: 1100,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.6rem',
          borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(59,130,246,0.05) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', boxShadow: '0 4px 14px rgba(139,92,246,0.4)'
            }}>
              <Shuffle size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                Générateur de Modèles Équivalents Anti-Triche (Modèle A / Modèle B)
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #a1a1aa)' }}>
                {exam?.name} · Conforme aux Orientations Pédagogiques Officielles Marocaines
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted, #a1a1aa)',
              cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content body */}
        <div style={{ padding: '1.4rem 1.6rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* Generation mode selection card */}
          <div style={{
            background: 'var(--bg-glass, rgba(255,255,255,0.03))',
            border: '1px solid var(--border, rgba(255,255,255,0.08))',
            borderRadius: 14, padding: '1.1rem'
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--violet, #a78bfa)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Settings2 size={14} /> 1. Mode de Conception Pédagogique
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem' }}>
              {/* Option 1: Smart Shuffle */}
              <div
                onClick={() => setGenerationMode('shuffle')}
                style={{
                  padding: '1rem', borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${generationMode === 'shuffle' ? 'var(--violet, #8b5cf6)' : 'var(--border, rgba(255,255,255,0.08))'}`,
                  background: generationMode === 'shuffle' ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main, #fff)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shuffle size={16} style={{ color: '#8b5cf6' }} /> Permutation Intelligente
                  </span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#10b981', color: '#fff' }}>
                    ⚡ Instantané & OMR Fiable
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #a1a1aa)', lineHeight: 1.45 }}>
                  Conserve scrupuleusement les énoncés et figures originaux. Mélange l’ordre des choix (A, B, C, D) et/ou des questions avec <strong>recalcul automatique des clés de correction OMR</strong>.
                </p>
              </div>

              {/* Option 2: Isomorphic AI */}
              <div
                onClick={() => setGenerationMode('ai')}
                style={{
                  padding: '1rem', borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${generationMode === 'ai' ? 'var(--violet, #8b5cf6)' : 'var(--border, rgba(255,255,255,0.08))'}`,
                  background: generationMode === 'ai' ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main, #fff)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={16} style={{ color: '#ec4899' }} /> Isomorphisme Mathématique IA
                  </span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#fff' }}>
                    🧠 Deep AI Variant
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #a1a1aa)', lineHeight: 1.45 }}>
                  L’IA génère des variations mathématiques équivalentes (équations, paramètres et fonctions modifiés) en conservant exactement les <strong>mêmes compétences et barème</strong>.
                </p>
              </div>
            </div>

            {/* Sub-options for shuffle */}
            {generationMode === 'shuffle' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.2rem', marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px dashed var(--border, rgba(255,255,255,0.1))' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-main, #fff)' }}>
                  <input
                    type="checkbox"
                    checked={shuffleChoices}
                    onChange={e => setShuffleChoices(e.target.checked)}
                    style={{ accentColor: '#8b5cf6', width: 16, height: 16 }}
                  />
                  Mélanger l'ordre des options de réponse (A, B, C, D, E)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-main, #fff)' }}>
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={e => setShuffleQuestions(e.target.checked)}
                    style={{ accentColor: '#8b5cf6', width: 16, height: 16 }}
                  />
                  Mélanger l'ordre des questions
                </label>
                {shuffleQuestions && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-muted, #a1a1aa)' }}>
                    <input
                      type="checkbox"
                      checked={preserveContextGrouping}
                      onChange={e => setPreserveContextGrouping(e.target.checked)}
                      style={{ accentColor: '#8b5cf6', width: 16, height: 16 }}
                    />
                    Garder groupées les questions liées à un même contexte
                  </label>
                )}
              </div>
            )}

            {/* Launch generate button */}
            <div style={{ marginTop: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || questions.length === 0}
                style={{
                  padding: '0.65rem 1.6rem', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                  color: '#fff', fontWeight: 800, fontSize: '0.88rem', cursor: isGenerating ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
                  opacity: isGenerating ? 0.7 : 1
                }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Génération en cours...</span>
                  </>
                ) : (
                  <>
                    <Shuffle size={16} />
                    <span>{generatedVariant ? 'Régénérer le Modèle B' : 'Générer le Modèle B maintenant'}</span>
                  </>
                )}
              </button>

              {isGenerating && progressStatus && (
                <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>
                  {progressStatus}
                </span>
              )}

              {generatedVariant && !isGenerating && (
                <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle2 size={16} /> Modèle B généré avec succès ({generatedVariant.questions.length} questions)
                </span>
              )}
            </div>
          </div>

          {/* Results section */}
          {generatedVariant && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '1rem',
              background: 'rgba(255,255,255,0.02)', borderRadius: 14,
              border: '1px solid var(--border, rgba(255,255,255,0.08))', padding: '1rem'
            }}>
              {/* Tab navigation & Print Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.8rem' }}>
                <div style={{ display: 'flex', gap: 6, background: 'var(--bg-glass, rgba(255,255,255,0.04))', padding: 4, borderRadius: 10 }}>
                  <button
                    onClick={() => setActiveTab('compare')}
                    style={{
                      padding: '0.45rem 0.9rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: activeTab === 'compare' ? 'var(--violet, #8b5cf6)' : 'transparent',
                      color: activeTab === 'compare' ? '#fff' : 'var(--text-muted, #a1a1aa)',
                      fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <ArrowLeftRight size={14} /> Comparaison Recto-Verso (A vs B)
                  </button>
                  <button
                    onClick={() => setActiveTab('keys')}
                    style={{
                      padding: '0.45rem 0.9rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: activeTab === 'keys' ? 'var(--violet, #8b5cf6)' : 'transparent',
                      color: activeTab === 'keys' ? '#fff' : 'var(--text-muted, #a1a1aa)',
                      fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <Layers size={14} /> Clés de Correction & Grille OMR
                  </button>
                </div>

                {/* Print Buttons Bar */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handlePrintSubject('A')}
                    title="Imprimer l'épreuve avec badge MODÈLE A"
                    style={{
                      padding: '0.45rem 0.85rem', borderRadius: 8, border: '1px solid #0284c7',
                      background: 'rgba(2,132,199,0.12)', color: '#38bdf8', fontWeight: 700,
                      fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
                    }}
                  >
                    <Printer size={13} /> Imprimer Sujet A
                  </button>
                  <button
                    onClick={() => handlePrintSubject('B')}
                    title="Imprimer l'épreuve avec badge MODÈLE B"
                    style={{
                      padding: '0.45rem 0.85rem', borderRadius: 8, border: '1px solid #f59e0b',
                      background: 'rgba(245,158,11,0.12)', color: '#fbbf24', fontWeight: 700,
                      fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
                    }}
                  >
                    <Printer size={13} /> Imprimer Sujet B
                  </button>
                  <button
                    onClick={() => handlePrintCorrection('B')}
                    title="Imprimer le corrigé officiel du Modèle B"
                    style={{
                      padding: '0.45rem 0.85rem', borderRadius: 8, border: '1px solid #10b981',
                      background: 'rgba(16,185,129,0.12)', color: '#34d399', fontWeight: 700,
                      fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
                    }}
                  >
                    <FileText size={13} /> Corrigé B
                  </button>
                  <button
                    onClick={handleSaveAsNewExam}
                    disabled={isSaving}
                    style={{
                      padding: '0.45rem 0.95rem', borderRadius: 8, border: 'none',
                      background: '#10b981', color: '#fff', fontWeight: 800,
                      fontSize: '0.78rem', cursor: isSaving ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5
                    }}
                  >
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : saveSuccess ? <Check size={13} /> : <Save size={13} />}
                    {saveSuccess ? 'Enregistré !' : 'Sauvegarder Modèle B'}
                  </button>
                </div>
              </div>

              {/* Tab 1: Side by Side Comparison */}
              {activeTab === 'compare' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {/* Question selector pills */}
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
                    {questions.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedPreviewIdx(idx)}
                        style={{
                          padding: '0.35rem 0.75rem', borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.1))',
                          background: selectedPreviewIdx === idx ? 'var(--violet, #8b5cf6)' : 'rgba(255,255,255,0.03)',
                          color: selectedPreviewIdx === idx ? '#fff' : 'var(--text-muted, #a1a1aa)',
                          fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0
                        }}
                      >
                        Q{idx + 1}
                      </button>
                    ))}
                  </div>

                  {/* Side-by-side cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                    {/* Modèle A Card */}
                    <div style={{
                      background: 'rgba(2,132,199,0.04)',
                      border: '1px solid rgba(2,132,199,0.25)',
                      borderRadius: 14, padding: '1rem', display: 'flex', flexDirection: 'column'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: '#0284c7', color: '#fff' }}>
                          MODÈLE A (Question {selectedPreviewIdx + 1})
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #a1a1aa)' }}>
                          {currentQA?.topic || 'Général'}
                        </span>
                      </div>
                      {currentQA?.context && (
                        <div style={{ padding: '0.5rem 0.7rem', background: 'rgba(0,0,0,0.2)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-muted, #a1a1aa)', marginBottom: '0.7rem' }}>
                          {renderWithMath(currentQA.context)}
                        </div>
                      )}
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main, #fff)', marginBottom: '0.8rem', lineHeight: 1.5 }}>
                        {renderWithMath(currentQA?.question || '')}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
                        {(currentQA?.options || []).map((opt, oi) => {
                          const id = typeof opt === 'string' ? String.fromCharCode(65 + oi) : opt.id;
                          const text = typeof opt === 'string' ? opt : opt.text;
                          const isCorr = (currentQA.correct_answer || 'A').toUpperCase() === id;
                          return (
                            <div key={id} style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0.6rem', borderRadius: 6,
                              background: isCorr ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${isCorr ? '#10b981' : 'rgba(255,255,255,0.06)'}`,
                              fontSize: '0.78rem'
                            }}>
                              <strong style={{ color: isCorr ? '#10b981' : 'inherit' }}>{id}.</strong>
                              <span style={{ flex: 1 }}>{renderWithMath(text)}</span>
                              {isCorr && <CheckCircle2 size={13} style={{ color: '#10b981' }} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Modèle B Card */}
                    <div style={{
                      background: 'rgba(245,158,11,0.04)',
                      border: '1px solid rgba(245,158,11,0.25)',
                      borderRadius: 14, padding: '1rem', display: 'flex', flexDirection: 'column'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: '#f59e0b', color: '#000' }}>
                          MODÈLE B (Question {selectedPreviewIdx + 1})
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>
                          {currentQB?._sourceQuestionIdx ? `Origine Q${currentQB._sourceQuestionIdx}` : 'Isomorphe'}
                        </span>
                      </div>
                      {currentQB?.context && (
                        <div style={{ padding: '0.5rem 0.7rem', background: 'rgba(0,0,0,0.2)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-muted, #a1a1aa)', marginBottom: '0.7rem' }}>
                          {renderWithMath(currentQB.context)}
                        </div>
                      )}
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main, #fff)', marginBottom: '0.8rem', lineHeight: 1.5 }}>
                        {renderWithMath(currentQB?.question || '')}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
                        {(currentQB?.options || []).map((opt, oi) => {
                          const id = typeof opt === 'string' ? String.fromCharCode(65 + oi) : opt.id;
                          const text = typeof opt === 'string' ? opt : opt.text;
                          const isCorr = (currentQB.correct_answer || 'A').toUpperCase() === id;
                          return (
                            <div key={id} style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0.6rem', borderRadius: 6,
                              background: isCorr ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${isCorr ? '#f59e0b' : 'rgba(255,255,255,0.06)'}`,
                              fontSize: '0.78rem'
                            }}>
                              <strong style={{ color: isCorr ? '#f59e0b' : 'inherit' }}>{id}.</strong>
                              <span style={{ flex: 1 }}>{renderWithMath(text)}</span>
                              {isCorr && <CheckCircle2 size={13} style={{ color: '#f59e0b' }} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: OMR Answer Keys Comparison Grid */}
              {activeTab === 'keys' && (
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #a1a1aa)', marginBottom: '0.8rem' }}>
                    Tableau synoptique des réponses correctes pour vérification rapide ou étalonnage de la grille optique OMR :
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: '0.6rem', maxHeight: 340, overflowY: 'auto'
                  }}>
                    {questions.map((qA, i) => {
                      const qB = generatedVariant.questions[i];
                      const ansA = (qA.correct_answer || qA.expected_answer || 'A').toUpperCase();
                      const ansB = (qB?.correct_answer || qB?.expected_answer || '—').toUpperCase();
                      const isPermuted = ansA !== ansB;
                      return (
                        <div key={i} style={{
                          padding: '0.6rem', borderRadius: 8,
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isPermuted ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
                        }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted, #a1a1aa)' }}>Q{i + 1}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 800 }}>
                            <span style={{ color: '#38bdf8', background: 'rgba(2,132,199,0.2)', padding: '2px 6px', borderRadius: 4 }}>A: {ansA}</span>
                            <span style={{ color: 'var(--text-muted, #a1a1aa)' }}>→</span>
                            <span style={{ color: '#fbbf24', background: 'rgba(245,158,11,0.2)', padding: '2px 6px', borderRadius: 4 }}>B: {ansB}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.6rem',
          borderTop: '1px solid var(--border, rgba(255,255,255,0.1))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #a1a1aa)' }}>
            L'CONQ Anti-Cheat Engine · Clés OMR synchronisées
          </span>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: '0.5rem 1.2rem', borderRadius: 8, fontSize: '0.82rem' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
