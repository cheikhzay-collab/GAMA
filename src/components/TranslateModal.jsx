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

    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 12, 85));
    }, 700);

    try {
      const fullLesson = await getLessonById(lesson.id);
      if (!fullLesson) throw new Error('لم يتم العثور على الدرس.');

      const translated = await translateLesson(fullLesson, selectedLang, {
        provider: selectedProvider,
      });

      clearInterval(progressInterval);
      setProgress(100);
      setTranslatedLesson(translated);
      setTimeout(() => setStep('preview'), 400);
    } catch (err) {
      clearInterval(progressInterval);
      console.error('[TranslateModal]', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء الترجمة.');
      setStep('error');
    }
  };

  const handleSave = async () => {
    if (!translatedLesson) return;
    setSaving(true);
    try {
      const newId = await addLesson(translatedLesson);
      setStep('done');
      onSuccess?.({ newId, language: selectedLang });
    } catch (err) {
      setErrorMsg('فشل حفظ الدرس المترجم: ' + (err.message || ''));
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
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)', zIndex: 9998,
      }} />

      {/* Modal */}
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

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '12px',
                background: `linear-gradient(135deg, ${providerColor}, #0F9D58)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 6px 20px ${providerColor}40`,
                transition: 'all 0.3s',
              }}>
                <Languages size={22} color="#fff" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  ترجمة بالذكاء الاصطناعي
                </h2>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {lesson.title?.length > 42 ? lesson.title.substring(0, 42) + '…' : lesson.title}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '0.4rem', borderRadius: '8px',
            }}>
              <X size={20} />
            </button>
          </div>

          {/* ══════════════ STEP: SELECT ══════════════ */}
          {step === 'select' && (
            <>
              {/* ── اختيار المزود ── */}
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                  المزود
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  {TRANSLATION_PROVIDERS.map(prov => {
                    const hasKey = prov.id === 'gemini' ? hasGemini : hasDeepseek;
                    const isActive = selectedProvider === prov.id;
                    return (
                      <button
                        key={prov.id}
                        onClick={() => hasKey && setSelectedProvider(prov.id)}
                        disabled={!hasKey}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.85rem 1rem', borderRadius: '12px', cursor: hasKey ? 'pointer' : 'not-allowed',
                          border: isActive ? `2px solid ${prov.color}` : '1px solid var(--border)',
                          background: isActive ? `${prov.color}12` : 'rgba(255,255,255,0.02)',
                          opacity: hasKey ? 1 : 0.45,
                          transition: 'all 0.2s', textAlign: 'left',
                        }}
                      >
                        <span style={{
                          width: 32, height: 32, borderRadius: '8px',
                          background: isActive ? `${prov.color}20` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isActive ? prov.color : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.1rem', color: isActive ? prov.color : 'var(--text-muted)',
                          fontWeight: 900, flexShrink: 0,
                        }}>
                          {prov.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 800, fontSize: '0.88rem',
                            color: isActive ? prov.color : 'var(--text-main)',
                          }}>
                            {prov.label}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                            {hasKey
                              ? <span style={{ color: '#0F9D58' }}>✓ مفتاح متوفر</span>
                              : <span style={{ color: 'var(--danger)' }}>✗ لا يوجد مفتاح</span>}
                          </div>
                        </div>
                        {isActive && <CheckCircle size={15} color={prov.color} />}
                      </button>
                    );
                  })}
                </div>

                {/* رابط إعدادات إذا لا يوجد مفتاح */}
                {!hasGemini && !hasDeepseek && (
                  <div style={{
                    marginTop: '0.75rem', padding: '0.75rem 1rem',
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                  }}>
                    <AlertCircle size={14} color="var(--danger)" />
                    لا يوجد مفتاح API. أضف Gemini أو DeepSeek في{' '}
                    <a href="/admin/settings" style={{ color: '#4285F4', fontWeight: 700 }}>
                      صفحة الإعدادات <ChevronRight size={12} style={{ display: 'inline' }} />
                    </a>
                  </div>
                )}
              </div>

              {/* ── فاصل ── */}
              <div style={{ borderTop: '1px solid var(--border)', margin: '0 0 1.25rem' }} />

              {/* ── اختيار اللغة ── */}
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                  اللغة المستهدفة
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {SUPPORTED_LANGUAGES.map(lang => {
                    const isActive = selectedLang === lang.code;
                    return (
                      <button
                        key={lang.code}
                        onClick={() => setSelectedLang(lang.code)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.85rem',
                          padding: '0.85rem 1.1rem', borderRadius: '12px', cursor: 'pointer',
                          border: isActive ? `2px solid ${providerColor}` : '1px solid var(--border)',
                          background: isActive ? `${providerColor}08` : 'rgba(255,255,255,0.02)',
                          transition: 'all 0.2s', textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '1.7rem', lineHeight: 1 }}>{lang.flag}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontWeight: 800, fontSize: '0.95rem',
                            color: isActive ? providerColor : 'var(--text-main)',
                            direction: lang.dir, textAlign: lang.dir === 'rtl' ? 'right' : 'left',
                          }}>
                            {lang.label}
                          </div>
                          {lang.code === 'ar' && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                              مصطلحات الرياضيات المغربية + RTL
                            </div>
                          )}
                        </div>
                        {isActive && <CheckCircle size={16} color={providerColor} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── زر الترجمة ── */}
              <button
                onClick={handleTranslate}
                disabled={!hasGemini && !hasDeepseek}
                style={{
                  width: '100%', padding: '0.95rem',
                  background: (!hasGemini && !hasDeepseek)
                    ? 'rgba(255,255,255,0.05)'
                    : `linear-gradient(135deg, ${providerColor}, #0F9D58)`,
                  border: 'none', borderRadius: '12px', color: '#fff',
                  fontWeight: 800, fontSize: '1rem', cursor: (!hasGemini && !hasDeepseek) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                  boxShadow: (!hasGemini && !hasDeepseek) ? 'none' : `0 8px 24px ${providerColor}35`,
                  transition: 'all 0.2s',
                }}
              >
                <Languages size={18} />
                ترجمة بـ {selectedProviderInfo?.name} → {selectedLangInfo?.label}
              </button>
            </>
          )}

          {/* ══════════════ STEP: TRANSLATING ══════════════ */}
          {step === 'translating' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <style>{`
                @keyframes tPulse { 0%,100%{box-shadow:0 0 0 0 ${providerColor}33} 50%{box-shadow:0 0 0 14px ${providerColor}00} }
                @keyframes tSpin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
              `}</style>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: `${providerColor}15`,
                border: `3px solid ${providerColor}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem',
                animation: 'tPulse 2s ease-in-out infinite',
              }}>
                <Globe size={36} color={providerColor} style={{ animation: 'tSpin 3s linear infinite' }} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: '1.15rem', margin: '0 0 0.4rem' }}>
                {selectedProviderInfo?.name} يُترجم الدرس...
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                يحافظ على المعادلات الرياضية LaTeX<br />
                ويستخدم مصطلحات الأستاذ المغربي الدقيقة
              </p>
              <div style={{
                height: '8px', background: 'rgba(255,255,255,0.05)',
                borderRadius: '99px', overflow: 'hidden', margin: '0 auto', maxWidth: '340px',
              }}>
                <div style={{
                  height: '100%', width: `${progress}%`,
                  background: `linear-gradient(90deg, ${providerColor}, #0F9D58)`,
                  borderRadius: '99px', transition: 'width 0.5s ease',
                }} />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.65rem' }}>
                {Math.round(progress)}%
              </p>
            </div>
          )}

          {/* ══════════════ STEP: PREVIEW ══════════════ */}
          {step === 'preview' && translatedLesson && (
            <>
              <div style={{
                background: 'rgba(15,157,88,0.08)', border: '1px solid rgba(15,157,88,0.25)',
                borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem',
                display: 'flex', gap: '0.6rem', alignItems: 'center',
              }}>
                <CheckCircle size={17} color="#0F9D58" />
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 700 }}>
                  تمت الترجمة بـ {selectedProviderInfo?.name} ✓ — راجع المعاينة قبل الحفظ
                </p>
              </div>

              {/* بادج المزود */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                <span style={{
                  padding: '0.2rem 0.65rem', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700,
                  background: `${providerColor}15`, color: providerColor,
                  border: `1px solid ${providerColor}30`,
                }}>
                  {selectedProviderInfo?.icon} {selectedProviderInfo?.label}
                </span>
                <span style={{
                  padding: '0.2rem 0.65rem', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700,
                  background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}>
                  {selectedLangInfo?.flag} {selectedLangInfo?.label}
                </span>
              </div>

              {/* معاينة */}
              <div dir={isRTL ? 'rtl' : 'ltr'} style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '1.1rem', marginBottom: '1.4rem',
                textAlign: isRTL ? 'right' : 'left',
              }}>
                <div style={{
                  fontSize: '0.7rem', fontWeight: 700, color: providerColor,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem',
                }}>
                  معاينة الترجمة
                </div>
                <div style={{
                  fontWeight: 800, fontSize: '0.97rem', color: 'var(--text-main)',
                  marginBottom: '0.5rem', lineHeight: 1.4,
                  fontFamily: isRTL ? "'Cairo', Arial, sans-serif" : 'inherit',
                }}>
                  {previewTitle}
                </div>
                {previewSectionTitle && (
                  <div style={{
                    fontSize: '0.8rem', color: providerColor, fontWeight: 700,
                    margin: '0.6rem 0 0.35rem',
                    fontFamily: isRTL ? "'Cairo', Arial, sans-serif" : 'inherit',
                  }}>
                    {previewSectionTitle}
                  </div>
                )}
                {previewText && (
                  <p style={{
                    fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0,
                    maxHeight: '72px', overflow: 'hidden',
                    fontFamily: isRTL ? "'Cairo', Arial, sans-serif" : 'inherit',
                  }}>
                    {previewText.substring(0, 180)}{previewText.length > 180 ? '…' : ''}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button onClick={() => setStep('select')} className="btn-outline" style={{ flex: 1, padding: '0.7rem', fontSize: '0.85rem' }}>
                  تغيير الخيارات
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 2, padding: '0.75rem',
                    background: saving ? 'rgba(15,157,88,0.4)' : 'linear-gradient(135deg, #0F9D58, #34A853)',
                    border: 'none', borderRadius: '10px', color: '#fff',
                    fontWeight: 800, fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  }}
                >
                  {saving
                    ? <><Globe size={15} style={{ animation: 'tSpin 1s linear infinite' }} /> جاري الحفظ...</>
                    : <><CheckCircle size={15} /> حفظ النسخة المترجمة</>}
                </button>
              </div>
            </>
          )}

          {/* ══════════════ STEP: DONE ══════════════ */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(15,157,88,0.12)', border: '3px solid rgba(15,157,88,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem',
              }}>
                <CheckCircle size={40} color="#0F9D58" />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: '1.2rem', margin: '0 0 0.5rem' }}>تم الحفظ بنجاح ✅</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
                تم إنشاء النسخة بـ {selectedProviderInfo?.name} وحفظها كمسودة.<br />
                يمكنك تفعيلها ومراجعتها من قائمة الدروس.
              </p>
              <button onClick={onClose} style={{
                width: '100%', padding: '0.85rem',
                background: `linear-gradient(135deg, ${providerColor}, #0F9D58)`,
                border: 'none', borderRadius: '12px', color: '#fff',
                fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem',
              }}>
                إغلاق
              </button>
            </div>
          )}

          {/* ══════════════ STEP: ERROR ══════════════ */}
          {step === 'error' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: 70, height: 70, borderRadius: '50%',
                background: 'rgba(239,68,68,0.08)', border: '2px solid rgba(239,68,68,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}>
                <AlertCircle size={34} color="var(--danger)" />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.5rem', color: 'var(--danger)' }}>
                فشلت الترجمة
              </h3>
              <p style={{
                color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.6, marginBottom: '1.5rem',
                background: 'rgba(239,68,68,0.04)', padding: '0.75rem 1rem', borderRadius: '8px',
                border: '1px solid rgba(239,68,68,0.1)', direction: 'rtl', textAlign: 'right',
              }}>
                {errorMsg}
              </p>
              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button onClick={onClose} className="btn-outline" style={{ flex: 1, padding: '0.7rem' }}>إلغاء</button>
                <button
                  onClick={() => setStep('select')}
                  style={{
                    flex: 1, padding: '0.7rem',
                    background: `linear-gradient(135deg, ${providerColor}, #0F9D58)`,
                    border: 'none', borderRadius: '10px', color: '#fff',
                    fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  إعادة المحاولة
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
