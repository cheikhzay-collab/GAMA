// src/components/TranslateModal.jsx
// مودال الترجمة بالذكاء الاصطناعي — يدعم Gemini و DeepSeek مع العربية (RTL)

import { useState } from 'react';
import { X, Globe, CheckCircle, AlertCircle, Languages, ChevronRight } from 'lucide-react';
import { translateLesson, SUPPORTED_LANGUAGES, TRANSLATION_PROVIDERS } from '../services/translationService';
import { getLessonById, addLesson } from '../services/lessonService';

export default function TranslateModal({ lesson, onClose, onSuccess }) {
  const [selectedLang, setSelectedLang]       = useState('ar');
  const [selectedProvider, setSelectedProvider] = useState(() => {
    // افتراضياً: استخدم المزود الذي لديه مفتاح
    const hasDeepseek = !!localStorage.getItem('deepseekApiKey');
    const hasGemini   = !!localStorage.getItem('geminiApiKey');
    if (hasDeepseek && !hasGemini) return 'deepseek';
    return 'gemini';
  });
  const [step, setStep]                 = useState('select'); // 'select'|'translating'|'preview'|'done'|'error'
  const [translatedLesson, setTranslatedLesson] = useState(null);
  const [errorMsg, setErrorMsg]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [progress, setProgress]         = useState(0);

  const selectedLangInfo     = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang);
  const selectedProviderInfo = TRANSLATION_PROVIDERS.find(p => p.id === selectedProvider);
  const isRTL                = selectedLangInfo?.dir === 'rtl';

  // تحقق من وجود المفاتيح
  const geminiKey   = localStorage.getItem('geminiApiKey')   || '';
  const deepseekKey = localStorage.getItem('deepseekApiKey') || '';
  const hasGemini   = !!geminiKey;
  const hasDeepseek = !!deepseekKey;

  const handleTranslate = async () => {
    setStep('translating');
    setErrorMsg('');
    setProgress(0);

    try {
      const fullLesson = await getLessonById(lesson.id);
      if (!fullLesson) throw new Error('Fiche de cours introuvable.');

      const result = await translateLesson(fullLesson, selectedLang, {
        provider: selectedProvider,
        onProgress: (pct) => setProgress(pct)
      });

      setTranslatedLesson(result);
      setStep('preview');
    } catch (err) {
      console.error('[TranslateModal]', err);
      setErrorMsg(err.message || 'Une erreur est survenue lors de la traduction.');
      setStep('error');
    }
  };

  const handleSave = async () => {
    if (!translatedLesson) return;
    setSaving(true);
    try {
      await addLesson(translatedLesson);
      setStep('done');
      onSuccess?.();
    } catch (err) {
      setErrorMsg('Échec de l\'enregistrement de la fiche traduite : ' + (err.message || ''));
      setStep('error');
    } finally {
      setSaving(false);
    }
  };

  const previewTitle        = translatedLesson?.title || '';
  const previewFirstSection = translatedLesson?.content?.sections?.[0];
  const previewSectionTitle = previewFirstSection?.title || '';
  const previewText         = previewFirstSection?.items?.[0]?.text || previewFirstSection?.content || '';

  const providerColor = selectedProviderInfo?.color || '#4285F4';

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)', zIndex: 9998,
      }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999, width: '100%', maxWidth: '580px',
        maxHeight: '92vh', overflowY: 'auto', padding: '1rem',
      }}>
        <div className="glass-panel" style={{
          padding: '2rem', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '12px',
                background: `linear-gradient(135deg, ${providerColor}, #0F9D58)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 6px 20px ${providerColor}40`,
              }}>
                <Languages size={22} color="#fff" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Traduction par IA
                </h2>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {lesson.title?.length > 42 ? lesson.title.substring(0, 42) + '…' : lesson.title}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          </div>

          {step === 'select' && (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Fournisseur d'IA
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  {TRANSLATION_PROVIDERS.map(prov => {
                    const hasKey = prov.id === 'gemini' ? hasGemini : hasDeepseek;
                    const isActive = selectedProvider === prov.id;
                    return (
                      <button key={prov.id} onClick={() => hasKey && setSelectedProvider(prov.id)} disabled={!hasKey} style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderRadius: '12px', cursor: hasKey ? 'pointer' : 'not-allowed',
                        border: isActive ? `2px solid ${prov.color}` : '1px solid var(--border)', background: isActive ? `${prov.color}12` : 'rgba(255,255,255,0.02)', opacity: hasKey ? 1 : 0.45,
                      }}>
                        <span style={{ width: 32, height: 32, borderRadius: '8px', background: isActive ? `${prov.color}20` : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? prov.color : 'var(--text-muted)' }}>{prov.icon}</span>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: isActive ? prov.color : 'var(--text-main)' }}>{prov.label}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{hasKey ? '✓ Clé disponible' : '✗ Aucune clé'}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!hasGemini && !hasDeepseek && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={14} color="var(--danger)" />
                    Aucune clé API configurée. Ajoutez Gemini ou DeepSeek dans <a href="/admin/settings" style={{ color: '#4285F4' }}>les Paramètres</a>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Langue cible</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {SUPPORTED_LANGUAGES.map(lang => {
                    const isActive = selectedLang === lang.code;
                    return (
                      <button key={lang.code} onClick={() => setSelectedLang(lang.code)} style={{
                        display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1.1rem', borderRadius: '12px', cursor: 'pointer',
                        border: isActive ? `2px solid ${providerColor}` : '1px solid var(--border)', background: isActive ? `${providerColor}08` : 'rgba(255,255,255,0.02)', textAlign: 'left'
                      }}>
                        <span style={{ fontSize: '1.7rem' }}>{lang.flag}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, color: isActive ? providerColor : 'var(--text-main)' }}>{lang.label}</div>
                          {lang.code === 'ar' && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Terminologie marocaine + RTL</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button onClick={handleTranslate} disabled={!hasGemini && !hasDeepseek} style={{ width: '100%', padding: '0.95rem', background: `linear-gradient(135deg, ${providerColor}, #0F9D58)`, border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                Traduire avec {selectedProviderInfo?.name} → {selectedLangInfo?.label}
              </button>
            </>
          )}

          {step === 'translating' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: `${providerColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <Globe size={36} color={providerColor} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: '1.15rem' }}>{selectedProviderInfo?.name} traduit la fiche...</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', lineHeight: 1.6 }}>Préservation du LaTeX et terminologie officielle.</p>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden', margin: '1rem auto', maxWidth: '340px' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${providerColor}, #0F9D58)`, transition: 'width 0.5s' }} />
              </div>
            </div>
          )}

          {step === 'preview' && translatedLesson && (
            <>
              <div style={{ background: 'rgba(15,157,88,0.08)', borderRadius: '10px', padding: '0.85rem', marginBottom: '1.25rem' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>Traduction terminée — Vérifiez l'aperçu avant d'enregistrer</p>
              </div>
              <div dir={isRTL ? 'rtl' : 'ltr'} style={{ background: 'rgba(255,255,255,0.02)', padding: '1.1rem', borderRadius: '12px', marginBottom: '1.4rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.97rem' }}>{previewTitle}</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{previewText.substring(0, 150)}...</p>
              </div>
              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button onClick={() => setStep('select')} style={{ flex: 1, padding: '0.7rem' }}>Modifier</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '0.75rem', background: '#0F9D58', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
                  {saving ? 'Enregistrement...' : 'Enregistrer la version traduite'}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <CheckCircle size={40} color="#0F9D58" />
              <h3 style={{ fontWeight: 800 }}>Enregistrement réussi ✅</h3>
              <button onClick={onClose} style={{ width: '100%', padding: '0.85rem', background: providerColor, border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer' }}>Fermer</button>
            </div>
          )}

          {step === 'error' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <AlertCircle size={36} color="var(--danger)" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontWeight: 800, color: 'var(--danger)', margin: '0 0 0.5rem' }}>Échec de la traduction</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '0 0 1.25rem' }}>{errorMsg}</p>
              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button onClick={onClose} style={{ flex: 1, padding: '0.7rem' }}>Annuler</button>
                <button
                  onClick={() => setStep('select')}
                  style={{
                    flex: 1, padding: '0.7rem',
                    background: `linear-gradient(135deg, ${providerColor}, #0F9D58)`,
                    border: 'none', borderRadius: '10px', color: '#fff',
                    fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  Réessayer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
