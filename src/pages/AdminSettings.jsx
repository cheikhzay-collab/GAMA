import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Settings, School, KeyRound, Eye, EyeOff, CheckCircle2, Sparkles, Image, RefreshCw, Layers, MousePointerClick, Crown, Download, Sliders, FileText, Camera, MessageCircle, Volume2, BookOpen, Calendar, Palmtree } from 'lucide-react';
import { getLandingArConfig, saveLandingArConfig } from '../services/schoolService';
import { uploadAsset } from '../services/storageService';

export default function AdminSettings() {
  const { 
    schools, addSchool, removeSchool, 
    plans, addPlan, removePlan, updatePlan, 
    activationCodes, generateActivationCodes,
    profName: initialProfName,
    profPhone: initialProfPhone,
    profSite: initialProfSite,
    bankName: initialBankName,
    bankRIB: initialBankRIB,
    bankBeneficiary: initialBankBeneficiary,
    facebookPixelId: initialFacebookPixelId,
    updateBrandingConfig,
    updateFlashcardSettingsConfig,
    updatePdfSettingsConfig,
    updateOmrScannerSettingsConfig,
    whatsappSettings,
    updateWhatsAppSettingsConfig
  } = useAuth();
  const [newSchool, setNewSchool] = useState('');
  const [activeTab, setActiveTab] = useState('general');

  // Voucher states
  const [voucherPlanId, setVoucherPlanId] = useState(() => (plans && plans.length > 0) ? plans[0].id : '');
  const [voucherCount, setVoucherCount] = useState('10');
  const [voucherBatchName, setVoucherBatchName] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const [voucherFilter, setVoucherFilter] = useState('all');

  // Subscription plan states
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [newPlanDuration, setNewPlanDuration] = useState('365');
  const [newPlanSchools, setNewPlanSchools] = useState([]);
  const [newPlanDescription, setNewPlanDescription] = useState('');
  const [newPlanIsRecommended, setNewPlanIsRecommended] = useState(false);
  const [newPlanFeatures, setNewPlanFeatures] = useState('');

  // Claude API Key
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('claudeApiKey') || '');
  const [showKey, setShowKey] = useState(false);
  const [proxyUrl, setProxyUrl] = useState(() => localStorage.getItem('claudeProxyUrl') || '');
  const [keySaved, setKeySaved] = useState(false);

  // Gemini API Key
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);

  // DeepSeek API Key
  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem('deepseekApiKey') || '');
  const [deepseekUrl, setDeepseekUrl] = useState(() => localStorage.getItem('deepseekApiUrl') || 'https://api.deepseek.com');
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const [deepseekKeySaved, setDeepseekKeySaved] = useState(false);

  const saveGeminiKey = () => {
    localStorage.setItem('geminiApiKey', geminiKey.trim());
    setGeminiKeySaved(true);
    setTimeout(() => setGeminiKeySaved(false), 2500);
  };

  const saveDeepseekKey = () => {
    localStorage.setItem('deepseekApiKey', deepseekKey.trim());
    localStorage.setItem('deepseekApiUrl', deepseekUrl.trim() || 'https://api.deepseek.com');
    setDeepseekKeySaved(true);
    setTimeout(() => setDeepseekKeySaved(false), 2500);
  };



  // ── Card Display Settings ──────────────────────────────────────────────────
  const [cardFlip,   setCardFlip]   = useState(() => localStorage.getItem('card_flip_animation') !== 'false');
  const [cardReveal, setCardReveal] = useState(() => localStorage.getItem('card_reveal_mode') || 'flip');
  const [cardSwipe,  setCardSwipe]  = useState(() => localStorage.getItem('card_swipe_gesture') !== 'false');
  const [cardSound,  setCardSound]  = useState(() => localStorage.getItem('card_sound_effects') !== 'false');
  const [cardFontFamily, setCardFontFamily] = useState(() => localStorage.getItem('card_font_family') || 'Computer Modern Serif');
  const [cardFontSize, setCardFontSize] = useState(() => localStorage.getItem('card_font_size') || '1rem');
  const [cardQuestionWeight, setCardQuestionWeight] = useState(() => localStorage.getItem('card_question_weight') || '400');
  const [cardAstuceWeight, setCardAstuceWeight] = useState(() => localStorage.getItem('card_astuce_weight') || '400');
  const [cardOptionsWeight, setCardOptionsWeight] = useState(() => localStorage.getItem('card_options_weight') || '400');
  const [cardSaved,  setCardSaved]  = useState(false);

  const saveCardSettings = async () => {
    await updateFlashcardSettingsConfig({
      cardRevealMode: cardReveal,
      cardFlipEnabled: cardFlip,
      cardSwipeEnabled: cardSwipe,
      cardSoundEnabled: cardSound,
      cardFontFamily,
      cardFontSize,
      cardQuestionWeight,
      cardAstuceWeight,
      cardOptionsWeight
    });
    setCardSaved(true);
    setTimeout(() => setCardSaved(false), 2500);
  };

  // Branding / Identity
  const [profName, setProfName] = useState(initialProfName || '');
  const [profPhone, setProfPhone] = useState(initialProfPhone || '');
  const [profSite, setProfSite] = useState(initialProfSite || 'www.lconq.ma');
  const [bankName, setBankName] = useState(initialBankName || 'CIH Bank (Maroc)');
  const [bankRIB, setBankRIB] = useState(initialBankRIB || '230 780 4567890123 0001 89');
  const [bankBeneficiary, setBankBeneficiary] = useState(initialBankBeneficiary || "L'CONQ SARL");
  const [fbPixelId, setFbPixelId] = useState(initialFacebookPixelId || '');
  const [brandSaved, setBrandSaved] = useState(false);

  // OMR Scanner Settings
  const [scannerDirectCapture, setScannerDirectCapture] = useState(() => localStorage.getItem('scanner_direct_capture_enabled') !== 'false');
  const [scannerSaved, setScannerSaved] = useState(false);

  // WhatsApp Floating Button Settings
  const [waEnabled, setWaEnabled] = useState(true);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waPosition, setWaPosition] = useState('right');
  const [waTooltip, setWaTooltip] = useState('');
  const [waSaved, setWaSaved] = useState(false);

  React.useEffect(() => {
    if (whatsappSettings) {
      setWaEnabled(!!whatsappSettings.enabled);
      setWaPhone(whatsappSettings.phoneNumber || '');
      setWaMessage(whatsappSettings.message || '');
      setWaPosition(whatsappSettings.position || 'right');
      setWaTooltip(whatsappSettings.tooltipText || '');
    }
  }, [whatsappSettings]);

  const saveWhatsAppSettings = async () => {
    await updateWhatsAppSettingsConfig({
      enabled: waEnabled,
      phoneNumber: waPhone.trim(),
      message: waMessage.trim(),
      position: waPosition,
      tooltipText: waTooltip.trim()
    });
    setWaSaved(true);
    setTimeout(() => setWaSaved(false), 2500);
  };

  React.useEffect(() => {
    Promise.resolve().then(() => {
      if (initialProfName !== undefined) setProfName(initialProfName);
      if (initialProfPhone !== undefined) setProfPhone(initialProfPhone);
      if (initialProfSite !== undefined) setProfSite(initialProfSite);
      if (initialBankName !== undefined) setBankName(initialBankName);
      if (initialBankRIB !== undefined) setBankRIB(initialBankRIB);
      if (initialBankBeneficiary !== undefined) setBankBeneficiary(initialBankBeneficiary);
      if (initialFacebookPixelId !== undefined) setFbPixelId(initialFacebookPixelId);
    });
  }, [initialProfName, initialProfPhone, initialProfSite, initialBankName, initialBankRIB, initialBankBeneficiary, initialFacebookPixelId]);

  const saveBranding = async () => {
    await updateBrandingConfig({
      profName: profName.trim(),
      profPhone: profPhone.trim(),
      profSite: profSite.trim() || 'www.lconq.ma',
      bankName: bankName.trim(),
      bankRIB: bankRIB.trim(),
      bankBeneficiary: bankBeneficiary.trim(),
      fbPixelId: fbPixelId.trim()
    });
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 2500);
  };

  // ── PDF Styling Settings ───────────────────────────────────────────────────
  const [pdfPageMargins, setPdfPageMargins] = useState(() => localStorage.getItem('pdf_page_margins') || 'standard');
  const [pdfFontSize, setPdfFontSize] = useState(() => localStorage.getItem('pdf_font_size') || '11pt');
  const [pdfFontFamily, setPdfFontFamily] = useState(() => localStorage.getItem('pdf_font_family') || 'Computer Modern Serif');
  const [pdfTemplateStyle, setPdfTemplateStyle] = useState(() => localStorage.getItem('pdf_template_style') || 'classic_latex');
  const [pdfAvoidPageBreaks, setPdfAvoidPageBreaks] = useState(() => localStorage.getItem('pdf_avoid_page_breaks') !== 'false');
  const [pdfForcePrintColors, setPdfForcePrintColors] = useState(() => localStorage.getItem('pdf_force_print_colors') !== 'false');
  const [pdfShowSidebar, setPdfShowSidebar] = useState(() => localStorage.getItem('pdf_show_sidebar') !== 'false');
  const [pdfSaved, setPdfSaved] = useState(false);

  const savePdfSettings = async () => {
    await updatePdfSettingsConfig({
      pdfPageMargins,
      pdfFontSize,
      pdfFontFamily,
      pdfTemplateStyle,
      pdfAvoidPageBreaks,
      pdfForcePrintColors,
      pdfShowSidebar
    });
    setPdfSaved(true);
    setTimeout(() => setPdfSaved(false), 2500);
  };

  // States and load/save logic for Landing Page AR Editor
  const [heroBadgeAr, setHeroBadgeAr] = useState("مدعوم بالذكاء الاصطناعي ⚡");
  const [heroTitlePart1Ar, setHeroTitlePart1Ar] = useState("حضّر لكونكور كليات النخبة بذكاء،");
  const [heroTitlePart2Ar, setHeroTitlePart2Ar] = useState("واضمن بلاصتك مع L'CONQ.");
  const [heroSubtitleAr, setHeroSubtitleAr] = useState("Médecine · ENSA · ENSAM. حوّل الامتحانات السابقة إلى حصص تفاعلية ذكية مع حلول سريعة (Cheat Codes) وخوارزمية تكرار متباعد تتكيف مع مستوى الحفظ ديالك.");
  
  const [featuresAr, setFeaturesAr] = useState([
    {
      title: "خوارزمية المراجعة الذكية (SRS)",
      desc: "نظام علمي متكامل يعيد جدولة الأسئلة الصعبة بناءً على إجاباتك. راجع فقط ما تحتاجه وفي الوقت المناسب تماماً لمنع النسيان.",
      image: "/study_mockup.png",
      url: "lconq.ma/study-srs",
      ctaText: "ابدأ المراجعة الذكية مجاناً"
    },
    {
      title: "شروحات وحلول سريعة بالذكاء الاصطناعي (Cheat Codes)",
      desc: "بلاش تضييع الوقت في الحلول التقليدية الطويلة. زر 'Astuce IA' يعطيك أسرار الحل السريع لحل المسائل المعقدة في أقل من دقيقة.",
      image: "/dashboard_mockup.png",
      url: "lconq.ma/ai-tutor",
      ctaText: "جرب حلول الذكاء الاصطناعي مجاناً"
    },
    {
      title: "المحاكاة والترتيب الوطني المباشر",
      desc: "تدرب في ظروف حقيقية مع عداد تنازلي، وقارن مستواك فوراً مع آلاف المترشحين على الصعيد الوطني لتعرف أين تقف بدقة.",
      image: "/ranking_mockup.png",
      url: "lconq.ma/leaderboard",
      ctaText: "دوز امتحان تجريبي واعرف ترتيبك"
    }
  ]);
  
  const [landingSaved, setLandingSaved] = useState(false);

  const [showPainPoints, setShowPainPoints] = useState(true);
  const [showPayments, setShowPayments] = useState(true);
  const [showPricing, setShowPricing] = useState(true);
  const [showFaqs, setShowFaqs] = useState(true);
  const [showTestimonials, setShowTestimonials] = useState(true);

  useEffect(() => {
    const loadLandingConfig = async () => {
      try {
        const cfg = await getLandingArConfig();
        if (cfg) {
          if (cfg.heroBadgeAr) setHeroBadgeAr(cfg.heroBadgeAr);
          if (cfg.heroTitlePart1Ar) setHeroTitlePart1Ar(cfg.heroTitlePart1Ar);
          if (cfg.heroTitlePart2Ar) setHeroTitlePart2Ar(cfg.heroTitlePart2Ar);
          if (cfg.heroSubtitleAr) setHeroSubtitleAr(cfg.heroSubtitleAr);
          if (cfg.featuresAr) setFeaturesAr(cfg.featuresAr);
          if (cfg.showPainPoints !== undefined) setShowPainPoints(cfg.showPainPoints);
          if (cfg.showPayments !== undefined) setShowPayments(cfg.showPayments);
          if (cfg.showPricing !== undefined) setShowPricing(cfg.showPricing);
          if (cfg.showFaqs !== undefined) setShowFaqs(cfg.showFaqs);
          if (cfg.showTestimonials !== undefined) setShowTestimonials(cfg.showTestimonials);
        }
      } catch (err) {
        console.warn("Failed to load landing page config:", err);
      }
    };
    loadLandingConfig();
  }, []);

  const saveLandingConfig = async () => {
    try {
      await saveLandingArConfig({
        heroBadgeAr,
        heroTitlePart1Ar,
        heroTitlePart2Ar,
        heroSubtitleAr,
        featuresAr,
        showPainPoints,
        showPayments,
        showPricing,
        showFaqs,
        showTestimonials
      });
      setLandingSaved(true);
      setTimeout(() => setLandingSaved(false), 2500);
    } catch (err) {
      console.error("Error saving landing page config:", err);
      alert("Error saving config: " + err.message);
    }
  };

  const [uploadingFeat, setUploadingFeat] = useState({});

  const handleImageUpload = async (e, index) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFeat(prev => ({ ...prev, [index]: true }));
    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const path = `landing-ar/${Date.now()}_${sanitizedName}`;
      const url = await uploadAsset(file, path);
      
      const newArr = [...featuresAr];
      newArr[index].image = url;
      setFeaturesAr(newArr);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error uploading image: " + err.message);
    } finally {
      setUploadingFeat(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (newSchool.trim()) { addSchool(newSchool.trim()); setNewSchool(''); }
  };

  const saveApiKey = () => {
    localStorage.setItem('claudeApiKey', apiKey.trim());
    localStorage.setItem('claudeProxyUrl', proxyUrl.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
  };

  // ── Logbook / Timetable / Holidays Settings ──────────────────────────────────
  const WEEKDAYS = [
    { id: 1, label: 'Lundi' },
    { id: 2, label: 'Mardi' },
    { id: 3, label: 'Mercredi' },
    { id: 4, label: 'Jeudi' },
    { id: 5, label: 'Vendredi' },
    { id: 6, label: 'Samedi' },
  ];

  const TIME_SLOTS = [
    '08:00 - 10:00', '10:00 - 12:00', '12:00 - 14:00',
    '14:00 - 16:00', '16:00 - 18:00'
  ];

  const [logbookSchedule, setLogbookSchedule] = useState(() => {
    try { return JSON.parse(localStorage.getItem('teacher_schedule_current') || '{}'); }
    catch { return {}; }
  });

  const [logbookHolidays, setLogbookHolidays] = useState(() => {
    try { return JSON.parse(localStorage.getItem('school_holidays') || '[]'); }
    catch { return []; }
  });

  const [logbookArFont, setLogbookArFont] = useState(() => localStorage.getItem('logbook_ar_font') || 'UKIJ Merdane');
  const [logbookFrFont, setLogbookFrFont] = useState(() => localStorage.getItem('logbook_fr_font') || 'Outfit');
  const [logbookFontSize, setLogbookFontSize] = useState(() => localStorage.getItem('logbook_font_size') || '0.8rem');
  const [logbookLineHeight, setLogbookLineHeight] = useState(() => parseInt(localStorage.getItem('logbook_line_height') || '20', 10));
  const [logbookColorInk, setLogbookColorInk] = useState(() => localStorage.getItem('logbook_color_ink') || '#334155');
  const [logbookColorChapter, setLogbookColorChapter] = useState(() => localStorage.getItem('logbook_color_chapter') || '#0f172a');
  const [logbookColorAxis, setLogbookColorAxis] = useState(() => localStorage.getItem('logbook_color_axis') || '#2563eb');
  const [logbookColorExercise, setLogbookColorExercise] = useState(() => localStorage.getItem('logbook_color_exercise') || '#d97706');

  // Holiday form
  const [newHolLabel, setNewHolLabel] = useState('');
  const [newHolStart, setNewHolStart] = useState('');
  const [newHolEnd, setNewHolEnd] = useState('');

  const [logbookSaved, setLogbookSaved] = useState(false);
  const [logbookSubTab, setLogbookSubTab] = useState('timetable'); // 'timetable' | 'holidays' | 'style'

  const handleLogbookScheduleChange = (slotKey, field, value) => {
    setLogbookSchedule(prev => ({
      ...prev,
      [slotKey]: { ...(prev[slotKey] || {}), [field]: value }
    }));
  };

  const addHoliday = () => {
    if (!newHolLabel || !newHolStart || !newHolEnd) return;
    const hol = { id: `hol-${Date.now()}`, label: newHolLabel, startDate: newHolStart, endDate: newHolEnd };
    setLogbookHolidays(prev => [...prev, hol]);
    setNewHolLabel(''); setNewHolStart(''); setNewHolEnd('');
  };

  const removeHoliday = (id) => setLogbookHolidays(prev => prev.filter(h => h.id !== id));

  const saveLogbookSettings = () => {
    localStorage.setItem('teacher_schedule_current', JSON.stringify(logbookSchedule));
    localStorage.setItem('school_holidays', JSON.stringify(logbookHolidays));
    localStorage.setItem('logbook_ar_font', logbookArFont);
    localStorage.setItem('logbook_fr_font', logbookFrFont);
    localStorage.setItem('logbook_font_size', logbookFontSize);
    localStorage.setItem('logbook_line_height', String(logbookLineHeight));
    localStorage.setItem('logbook_color_ink', logbookColorInk);
    localStorage.setItem('logbook_color_chapter', logbookColorChapter);
    localStorage.setItem('logbook_color_axis', logbookColorAxis);
    localStorage.setItem('logbook_color_exercise', logbookColorExercise);
    setLogbookSaved(true);
    setTimeout(() => setLogbookSaved(false), 2500);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      <style>{`
         /* ═══ 2026 DESIGN SYSTEM ═══ */
         .settings-aurora-bg {
           position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden;
         }
         .settings-aurora-bg::before, .settings-aurora-bg::after {
           content: ''; position: absolute; border-radius: 50%; filter: blur(140px);
           opacity: 0.25; animation: auroraDrift 22s ease-in-out infinite;
         }
         .settings-aurora-bg::before {
           width: 600px; height: 600px; top: -200px; left: -150px;
           background: radial-gradient(circle, var(--violet) 0%, transparent 70%);
         }
         .settings-aurora-bg::after {
           width: 500px; height: 500px; bottom: -150px; right: -120px;
           background: radial-gradient(circle, var(--emerald) 0%, transparent 70%);
           animation-delay: -11s; animation-direction: reverse;
         }
         @keyframes auroraDrift {
           0%, 100% { transform: translate(0,0) scale(1); }
           33%      { transform: translate(50px, -40px) scale(1.15); }
           66%      { transform: translate(-30px, 45px) scale(0.9); }
         }

         .settings-container {
           display: grid;
           grid-template-columns: 260px 1fr;
           gap: 2rem;
           align-items: start;
         }

         .settings-tabs {
           display: flex;
           flex-direction: column;
           gap: 0.3rem;
           position: sticky;
           top: 1rem;
           padding: 1.25rem;
           background: var(--bg-card);
           backdrop-filter: blur(24px);
           border: 1px solid var(--border);
           border-radius: 20px;
           box-shadow: var(--shadow-card);
         }
         .settings-tab-btn {
           display: flex;
           align-items: center;
           gap: 0.75rem;
           padding: 0.65rem 0.85rem;
           border-radius: 10px;
           border: 1px solid transparent;
           cursor: pointer;
           background: transparent;
           text-align: left;
           transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
           width: 100%;
           position: relative;
           font-family: inherit;
         }
         .settings-tab-btn:hover { background: var(--bg-hover); }
         .settings-tab-btn.active {
           background: linear-gradient(135deg, var(--violet-soft) 0%, var(--emerald-soft) 100%);
           border-color: var(--border-hover);
           box-shadow: inset 0 0 0 1px rgba(99,102,241,0.1);
         }
         .settings-tab-btn.active::before {
           content: '';
           position: absolute;
           left: -1.25rem; top: 50%;
           transform: translateY(-50%);
           width: 3px; height: 55%;
           background: linear-gradient(180deg, var(--violet), var(--emerald));
           border-radius: 0 3px 3px 0;
           box-shadow: 0 0 8px rgba(99,102,241,0.4);
         }
         .settings-tab-icon {
           width: 32px; height: 32px;
           border-radius: 8px;
           display: flex; align-items: center; justify-content: center;
           background: var(--bg-glass);
           border: 1px solid var(--border);
           color: var(--text-muted);
           transition: all 0.2s ease;
           flex-shrink: 0;
         }
         .settings-tab-btn:hover .settings-tab-icon {
           color: var(--violet);
           border-color: var(--border-hover);
         }
         .settings-tab-btn.active .settings-tab-icon {
           background: linear-gradient(135deg, var(--violet), #818cf8);
           color: #fff;
           border-color: transparent;
           box-shadow: 0 4px 12px rgba(99,102,241,0.3);
         }
         .settings-tab-title {
           font-weight: 700; font-size: 0.85rem;
           color: var(--text-muted); transition: color 0.2s;
         }
         .settings-tab-btn.active .settings-tab-title { color: var(--text-main); }
         .settings-tab-desc {
           font-size: 0.67rem; color: var(--text-subtle);
           margin-top: 1px; transition: color 0.2s;
         }
         .settings-tab-btn.active .settings-tab-desc { color: var(--violet); }

         .settings-hero {
           position: relative; margin-bottom: 2rem; padding: 1.5rem 2rem;
           border-radius: 20px; background: var(--bg-card);
           backdrop-filter: blur(24px);
           border: 1px solid var(--border); box-shadow: var(--shadow-card);
           overflow: hidden;
         }
         .settings-hero::before {
           content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
           background: linear-gradient(90deg, transparent, rgba(113,109,242,0.4), rgba(16,185,129,0.4), transparent);
         }
         .settings-hero::after {
           content: ''; position: absolute; top: -50%; right: -10%;
           width: 380px; height: 380px;
           background: radial-gradient(circle, var(--violet-glow) 0%, transparent 60%);
           filter: blur(40px); pointer-events: none;
         }
         .settings-hero-icon {
           width: 52px; height: 52px; border-radius: 14px;
           background: linear-gradient(135deg, var(--violet), var(--emerald));
           display: flex; align-items: center; justify-content: center;
           box-shadow: 0 10px 28px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
           flex-shrink: 0;
         }
         .settings-hero-title {
           font-size: 1.75rem; font-weight: 800;
           letter-spacing: -0.025em; margin: 0;
         }
         .settings-hero-subtitle {
           color: var(--text-muted); font-size: 0.92rem; margin: 0.25rem 0 0;
         }
         .settings-hero-stat {
           display: flex; flex-direction: column; padding: 0.7rem 1.1rem;
           background: var(--bg-glass); border: 1px solid var(--border);
           border-radius: 12px; min-width: 90px;
         }
         .settings-hero-stat-value {
           font-size: 1.2rem; font-weight: 800; letter-spacing: -0.02em;
         }
         .settings-hero-stat-label {
           font-size: 0.68rem; color: var(--text-subtle);
           font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
         }

         .glass-panel.col-span-12[style*="display: block"] {
           animation: panelSlideIn 0.45s cubic-bezier(0.22,1,0.36,1) both;
         }
         @keyframes panelSlideIn {
           from { opacity: 0; transform: translateY(12px); }
           to   { opacity: 1; transform: translateY(0); }
         }

         @media (max-width: 768px) {
           .settings-container {
             grid-template-columns: 1fr !important;
             gap: 1.25rem !important;
           }
           .settings-tabs {
             position: static !important;
             flex-direction: row !important;
             overflow-x: auto;
             gap: 0.5rem;
           }
           .settings-tabs .settings-tab-btn {
             flex-shrink: 0;
             min-width: 170px;
           }
           .settings-tab-btn.active::before { display: none; }
           .settings-hero { padding: 1.2rem; }
           .settings-hero-title { font-size: 1.4rem; }
         }
       `}</style>

       <div className="settings-aurora-bg" aria-hidden="true" />

       <div className="settings-hero" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '1.15rem', position: 'relative', zIndex: 1 }}>
           <div className="settings-hero-icon">
             <Settings size={26} color="#fff" />
           </div>
           <div>
             <h1 className="settings-hero-title">Paramètres</h1>
             <p className="settings-hero-subtitle">Gérez les options globales de la plateforme.</p>
           </div>
         </div>
         <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
           <div className="settings-hero-stat">
             <span className="settings-hero-stat-value">{(plans || []).length}</span>
             <span className="settings-hero-stat-label">Plans</span>
           </div>
           <div className="settings-hero-stat">
             <span className="settings-hero-stat-value">{(activationCodes || []).length}</span>
             <span className="settings-hero-stat-label">Codes</span>
           </div>
           <div className="settings-hero-stat">
             <span className="settings-hero-stat-value">{(schools || []).length}</span>
             <span className="settings-hero-stat-label">Écoles</span>
           </div>
         </div>
       </div>

       <div className="settings-container">
         <div className="settings-tabs">
           {[
             { id: 'general', label: 'Général & Branding', icon: Sliders, desc: 'Identité PDF & Écoles' },
             { id: 'whatsapp', label: 'Support WhatsApp', icon: MessageCircle, desc: 'Bouton flottant & message' },
             { id: 'pdf', label: 'Design & Impression PDF', icon: FileText, desc: 'Marges, polices & sauts' },
             { id: 'flashcards', label: 'Méthode Flashcards', icon: Layers, desc: 'Animations & Révélation' },
             { id: 'apis', label: 'Clés API & IA', icon: KeyRound, desc: 'Claude, Gemini' },
             { id: 'landing_editor', label: 'Page de vente (AR)', icon: Image, desc: 'Modifier images & sections' },
             { id: 'subscriptions', label: 'Baqat & Vouchers', icon: Crown, desc: 'Tarifs & Activation' },
             { id: 'logbook', label: 'دفتر النصوص', icon: BookOpen, desc: 'جدول الحصص، العطل والتصميم' },
           ].map(tab => {
             const isActive = activeTab === tab.id;
             return (
               <button
                 key={tab.id}
                 type="button"
                 onClick={() => setActiveTab(tab.id)}
                 className={`settings-tab-btn ${isActive ? 'active' : ''}`}
               >
                 <tab.icon size={16} className="settings-tab-icon" />
                 <div>
                   <div className="settings-tab-title">{tab.label}</div>
                   <div className="settings-tab-desc">{tab.desc}</div>
                 </div>
               </button>
             );
           })}
         </div>

        {/* Right Content Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', minWidth: 0 }}>

        {/* ── WhatsApp Floating Button Settings ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'whatsapp' ? 'block' : 'none' }}>
          <h3 style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageCircle size={20} style={{ color: '#25D366' }} /> Paramètres du Bouton Flottant WhatsApp
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
            Activez et configurez un bouton WhatsApp flottant pour permettre aux élèves de vous contacter directement pour du support ou des questions.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Toggle Switch */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <MessageCircle size={18} style={{ color: '#25D366' }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', margin: 0 }}>Afficher le bouton WhatsApp</p>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-subtle)', margin: 0 }}>Rendre le bouton flottant visible sur le tableau de bord et la page d'accueil</p>
                </div>
              </div>
              <button
                onClick={() => setWaEnabled(v => !v)}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: waEnabled ? '#25D366' : 'var(--bg-card)',
                  position: 'relative', transition: 'background 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, transition: 'left 0.2s',
                  left: waEnabled ? 25 : 3,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>

            {/* Inputs Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', opacity: waEnabled ? 1 : 0.5, transition: 'opacity 0.2s' }}>
              
              {/* Phone number */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Numéro de Téléphone WhatsApp
                </label>
                <input
                  type="text"
                  disabled={!waEnabled}
                  className="input-control"
                  placeholder={profPhone ? `${profPhone} (Téléphone général)` : "+212 600-000000"}
                  value={waPhone}
                  onChange={e => setWaPhone(e.target.value)}
                />
                <p style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-subtle)', lineHeight: 1.3 }}>
                  Laissez vide pour utiliser par défaut le numéro de téléphone général de l'identité : <strong>{profPhone || 'Non configuré'}</strong>.
                </p>
              </div>

              {/* Tooltip Text */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Texte de l'infobulle (Tooltip)
                </label>
                <input
                  type="text"
                  disabled={!waEnabled}
                  className="input-control"
                  placeholder="Besoin d'aide ?"
                  value={waTooltip}
                  onChange={e => setWaTooltip(e.target.value)}
                />
                <p style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-subtle)', lineHeight: 1.3 }}>
                  Le message court affiché à côté du bouton au survol (ex: "Besoin d'aide ?", "Support client").
                </p>
              </div>

              {/* Position */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Position sur l'écran
                </label>
                <select
                  disabled={!waEnabled}
                  value={waPosition}
                  onChange={e => setWaPosition(e.target.value)}
                  className="input-control"
                >
                  <option value="right">En bas à Droite (Recommandé)</option>
                  <option value="left">En bas à Gauche</option>
                </select>
                <p style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-subtle)', lineHeight: 1.3 }}>
                  Choisissez de quel côté le bouton flottant s'affichera à l'écran.
                </p>
              </div>

            </div>

            {/* Default pre-filled message */}
            <div style={{ opacity: waEnabled ? 1 : 0.5, transition: 'opacity 0.2s' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Message prédéfini par défaut
              </label>
              <textarea
                disabled={!waEnabled}
                className="input-control"
                placeholder="Bonjour, j'ai une question concernant la plateforme Gima."
                rows={3}
                value={waMessage}
                onChange={e => setWaMessage(e.target.value)}
                style={{ fontFamily: 'inherit', resize: 'vertical' }}
              />
              <p style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-subtle)', lineHeight: 1.3 }}>
                Le texte qui sera pré-rempli dans l'application WhatsApp de l'utilisateur lorsqu'il clique sur le bouton.
              </p>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button
              onClick={saveWhatsAppSettings}
              className="btn"
              style={{
                padding: '0.75rem 2rem',
                background: waSaved ? 'linear-gradient(135deg,var(--emerald),#34d399)' : undefined,
                boxShadow: waSaved ? '0 4px 16px rgba(16,185,129,0.35)' : undefined,
                transition: 'all 0.3s'
              }}
            >
              {waSaved ? <><CheckCircle2 size={16} /> Enregistré !</> : 'Enregistrer les paramètres'}
            </button>
          </div>
        </div>

        {/* ── PDF Page Layout Settings ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'pdf' ? 'block' : 'none' }}>
          <h3 style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} /> Paramètres de Mise en Page & Design PDF
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
            Configurez l&apos;affichage de vos documents PDF générés (Sujets, Corrigés, E-Books) pour un rendu professionnel.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Margins & Font Size & Font Family Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', flexWrap: 'wrap' }}>
              
              {/* Page Margins */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Marges de page (Marges intérieures)
                </label>
                <select
                  value={pdfPageMargins}
                  onChange={e => setPdfPageMargins(e.target.value)}
                  className="input-control"
                  style={{ fontSize: '0.85rem' }}
                >
                  <option value="standard">Standard (Marge équilibrée - A4 classique)</option>
                  <option value="compact">Compacte (Marge étroite pour économiser des pages)</option>
                  <option value="wide">Large (Rendu très aéré de type livre d&apos;art)</option>
                </select>
              </div>

              {/* Font Size */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Taille de la police de base
                </label>
                <select
                  value={pdfFontSize}
                  onChange={e => setPdfFontSize(e.target.value)}
                  className="input-control"
                  style={{ fontSize: '0.85rem' }}
                >
                  <option value="10pt">Petit (10pt)</option>
                  <option value="11pt">Normal (11pt - recommandé)</option>
                  <option value="12pt">Grand (12pt)</option>
                </select>
              </div>

              {/* Font Family */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Police typographique
                </label>
                <select
                  value={pdfFontFamily}
                  onChange={e => setPdfFontFamily(e.target.value)}
                  className="input-control"
                  style={{ fontSize: '0.85rem' }}
                >
                  <option value="Computer Modern Serif">Computer Modern Serif (Scientifique & académique)</option>
                  <option value="STIX Two Text">STIX Two Text (Littéraire avec empattement)</option>
                  <option value="Times New Roman">Times New Roman (Classique d&apos;examen national)</option>
                  <option value="Inter">Inter (Moderne, épurée et sans empattement)</option>
                </select>
              </div>

              {/* Layout Template Style */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Modèle de mise en page (Template)
                </label>
                <select
                  value={pdfTemplateStyle}
                  onChange={e => setPdfTemplateStyle(e.target.value)}
                  className="input-control"
                  style={{ fontSize: '0.85rem' }}
                >
                  <option value="classic_latex">Classique LaTeX (Éléments structurés, sobres et académiques)</option>
                  <option value="modern_minimalist">Moderne épuré (Design frais, aéré avec touches de couleur)</option>
                  <option value="premium_royal">Royal Institutionnel (En-tête officiel, luxueux avec rubans)</option>
                  <option value="compact_eco">Économique & Compact (Sans page de garde, ultra compact pour impression)</option>
                </select>
              </div>

            </div>

            {/* Avoid page breaks inside cards */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <FileText size={18} style={{ color: 'var(--violet)' }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', margin: 0 }}>Sauts de page intelligents</p>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-subtle)', margin: 0 }}>Éviter de couper les énoncés et options d&apos;une question sur deux pages différentes</p>
                </div>
              </div>
              <button
                onClick={() => setPdfAvoidPageBreaks(v => !v)}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: pdfAvoidPageBreaks ? 'var(--violet)' : 'var(--bg-card)',
                  position: 'relative', transition: 'background 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, transition: 'left 0.2s',
                  left: pdfAvoidPageBreaks ? 25 : 3,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>

            {/* Preserve background colors */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Sparkles size={18} style={{ color: 'var(--emerald)' }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', margin: 0 }}>Impression couleur & arrière-plans</p>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-subtle)', margin: 0 }}>Forcer la préservation des couleurs de fond, des badges et des bulles OMR lors de la génération</p>
                </div>
              </div>
              <button
                onClick={() => setPdfForcePrintColors(v => !v)}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: pdfForcePrintColors ? 'var(--emerald)' : 'var(--bg-card)',
                  position: 'relative', transition: 'background 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, transition: 'left 0.2s',
                  left: pdfForcePrintColors ? 25 : 3,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>

            {/* Show/Hide Sidebar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <FileText size={18} style={{ color: 'var(--violet)' }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', margin: 0 }}>Bandeau latéral (Sidebar)</p>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-subtle)', margin: 0 }}>Afficher la barre latérale verticale des écoles sur les fichiers PDF générés</p>
                </div>
              </div>
              <button
                onClick={() => setPdfShowSidebar(v => !v)}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: pdfShowSidebar ? 'var(--violet)' : 'var(--bg-card)',
                  position: 'relative', transition: 'background 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, transition: 'left 0.2s',
                  left: pdfShowSidebar ? 25 : 3,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button
              onClick={savePdfSettings}
              className="btn"
              style={{
                padding: '0.75rem 2rem',
                background: pdfSaved ? 'linear-gradient(135deg,var(--emerald),#34d399)' : undefined,
                boxShadow: pdfSaved ? '0 4px 16px rgba(16,185,129,0.35)' : undefined,
                transition: 'all 0.3s'
              }}
            >
              {pdfSaved ? <><CheckCircle2 size={16} /> Enregistré !</> : 'Enregistrer le style PDF'}
            </button>
          </div>
        </div>

        {/* ── Flashcard Review Settings ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'flashcards' ? 'block' : 'none' }}>
          <h3 style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={20} /> Paramètres des Flashcards
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
            Personnalisez l&apos;animation, le mode de révélation et les gestes des cartes de révision.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

            {/* Reveal Mode */}
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Layers size={14} /> Mode de révélation de la réponse
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'flip',    icon: '🔄', label: 'Retournement 3D',  desc: 'Animation de rotation (défaut)' },
                  { id: 'fade',    icon: '✨', label: 'Fondu enchaîné',   desc: 'Transition douce sans rotation' },
                  { id: 'instant', icon: '⚡', label: 'Instantané',       desc: 'Mode calme — boutons uniquement, sans glissement' },
                ].map(({ id, icon, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => { setCardReveal(id); if (id !== 'flip') setCardFlip(false); else setCardFlip(true); }}
                    style={{
                      flex: '1 1 170px',
                      padding: '0.8rem 1rem',
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: cardReveal === id ? 'rgba(99,102,241,0.1)' : 'var(--bg-glass)',
                      border: `2px solid ${cardReveal === id ? 'var(--violet)' : 'var(--border)'}`,
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      boxShadow: cardReveal === id ? '0 4px 16px rgba(99,102,241,0.15)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>{icon}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: cardReveal === id ? 'var(--violet)' : 'var(--text-main)', marginBottom: '0.15rem' }}>{label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Flip Animation toggle (only relevant for flip mode) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border)', opacity: cardReveal === 'flip' ? 1 : 0.4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <RefreshCw size={18} style={{ color: 'var(--violet)' }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', margin: 0 }}>Animation de rotation 3D</p>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-subtle)', margin: 0 }}>Actif uniquement en mode « Retournement »</p>
                </div>
              </div>
              <button
                disabled={cardReveal !== 'flip'}
                onClick={() => setCardFlip(v => !v)}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: cardReveal !== 'flip' ? 'not-allowed' : 'pointer',
                  background: cardFlip && cardReveal === 'flip' ? 'var(--violet)' : 'var(--bg-card)',
                  position: 'relative', transition: 'background 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, transition: 'left 0.2s',
                  left: cardFlip && cardReveal === 'flip' ? 25 : 3,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>

            {/* Swipe gesture toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <MousePointerClick size={18} style={{ color: 'var(--emerald)' }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', margin: 0 }}>Geste de glissement (Swipe)</p>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-subtle)', margin: 0 }}>Glisser à droite = Facile, à gauche = À revoir</p>
                </div>
              </div>
              <button
                onClick={() => setCardSwipe(v => !v)}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: cardSwipe ? 'var(--emerald)' : 'var(--bg-card)',
                  position: 'relative', transition: 'background 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, transition: 'left 0.2s',
                  left: cardSwipe ? 25 : 3,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>

            {/* Sound effects toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Volume2 size={18} style={{ color: 'var(--violet)' }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', margin: 0 }}>Effets sonores (Sons)</p>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-subtle)', margin: 0 }}>Jouer un son court lors de la validation d'une réponse (correcte / incorrecte)</p>
                </div>
              </div>
              <button
                onClick={() => setCardSound(v => !v)}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: cardSound ? 'var(--violet)' : 'var(--bg-card)',
                  position: 'relative', transition: 'background 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, transition: 'left 0.2s',
                  left: cardSound ? 25 : 3,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>

            {/* Card Typography Configurations */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sliders size={15} /> Personnalisation de la typographie des cartes
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {/* Font Family */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                    Police typographique des cartes
                  </label>
                  <select
                    value={cardFontFamily}
                    onChange={e => setCardFontFamily(e.target.value)}
                    className="input-control"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="Computer Modern Serif">Computer Modern Serif (Scientifique)</option>
                    <option value="STIX Two Text">STIX Two Text (Littéraire Serif)</option>
                    <option value="Times New Roman">Times New Roman (Classique)</option>
                    <option value="Inter">Inter (Moderne Sans-Serif)</option>
                  </select>
                </div>

                {/* Font Size */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                    Taille de la police
                  </label>
                  <select
                    value={cardFontSize}
                    onChange={e => setCardFontSize(e.target.value)}
                    className="input-control"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="0.82rem">Petite (0.82rem)</option>
                    <option value="0.9rem">Compacte (0.9rem)</option>
                    <option value="1rem">Normale (1rem — défaut)</option>
                    <option value="1.08rem">Grande (1.08rem)</option>
                    <option value="1.18rem">Très grande (1.18rem)</option>
                  </select>
                </div>

                {/* Question Weight */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                    Épaisseur du texte des Questions
                  </label>
                  <select
                    value={cardQuestionWeight}
                    onChange={e => setCardQuestionWeight(e.target.value)}
                    className="input-control"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="400">Normal (400)</option>
                    <option value="500">Moyen (500)</option>
                    <option value="600">Demi-gras (600)</option>
                    <option value="700">Gras (700)</option>
                  </select>
                </div>

                {/* Options Weight */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                    Épaisseur du texte des Options
                  </label>
                  <select
                    value={cardOptionsWeight}
                    onChange={e => setCardOptionsWeight(e.target.value)}
                    className="input-control"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="400">Normal (400)</option>
                    <option value="500">Moyen (500)</option>
                    <option value="600">Demi-gras (600)</option>
                    <option value="700">Gras (700)</option>
                  </select>
                </div>

                {/* Astuce Weight */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                    Épaisseur du texte des Astuces / Solutions
                  </label>
                  <select
                    value={cardAstuceWeight}
                    onChange={e => setCardAstuceWeight(e.target.value)}
                    className="input-control"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="400">Normal (400)</option>
                    <option value="500">Moyen (500)</option>
                    <option value="600">Demi-gras (600)</option>
                    <option value="700">Gras (700)</option>
                  </select>
                </div>

              </div>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button
              onClick={saveCardSettings}
              className="btn"
              style={{
                padding: '0.75rem 2rem',
                background: cardSaved ? 'linear-gradient(135deg,var(--emerald),#34d399)' : undefined,
                boxShadow: cardSaved ? '0 4px 16px rgba(16,185,129,0.35)' : undefined,
                transition: 'all 0.3s'
              }}
            >
              {cardSaved ? <><CheckCircle2 size={16} /> Sauvegardé !</> : 'Enregistrer les paramètres'}
            </button>
          </div>
        </div>

        {/* ── Claude API Key ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'apis' ? 'block' : 'none' }}>
          <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <KeyRound size={20} /> Clé API Claude (Anthropic)
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Utilisée pour l'import IA automatique de PDF. Obtenez votre clé sur{' '}
            <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-violet">console.anthropic.com</a>.
            Elle est stockée uniquement dans ce navigateur.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                className="input-control"
                placeholder="sk-ant-api03-..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ paddingRight: '3rem', fontFamily: apiKey && !showKey ? 'monospace' : 'inherit' }}
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              onClick={saveApiKey}
              className="btn"
              style={{
                padding: '0.75rem 1.5rem', whiteSpace: 'nowrap',
                background: keySaved ? 'linear-gradient(135deg,var(--emerald),#34d399)' : undefined,
                boxShadow: keySaved ? '0 4px 16px rgba(16,185,129,0.35)' : undefined,
                transition: 'all 0.3s'
              }}
            >
              {keySaved ? <><CheckCircle2 size={16} /> Sauvegardé !</> : 'Sauvegarder'}
            </button>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              URL du Proxy Serveur (Optionnel - Pour la production)
            </label>
            <input
              type="text"
              className="input-control"
              placeholder="https://votre-proxy.workers.dev/api/v1/messages"
              value={proxyUrl}
              onChange={e => setProxyUrl(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
            <p style={{ marginTop: '0.4rem', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
              💡 Si configurée, les requêtes d'importation IA transiteront par ce serveur pour masquer votre clé API en production.
            </p>
          </div>

          {apiKey && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--emerald)' }}>
              ✓ Clé configurée — {apiKey.slice(0, 14)}...
            </p>
          )}
        </div>

        {/* ── Gemini API Key ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'apis' ? 'block' : 'none', borderColor: 'rgba(66,133,244,0.25)', background: 'linear-gradient(135deg, rgba(66,133,244,0.04) 0%, rgba(234,67,53,0.02) 100%)' }}>
          <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: '8px', background: 'linear-gradient(135deg,#4285F4,#EA4335,#FBBC05,#34A853)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image size={14} color="#fff" />
            </div>
            Clé API Google Gemini <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '99px', background: 'rgba(66,133,244,0.12)', color: '#4285F4', marginLeft: '0.25rem' }}>Imagen 3 — Génération d'images</span>
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Utilisée pour générer des visuels marketing avec <strong>Google Imagen 3</strong>. Obtenez votre clé gratuitement sur{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#4285F4', fontWeight: 600 }}>aistudio.google.com</a>.
            Elle est stockée uniquement dans ce navigateur.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type={showGeminiKey ? 'text' : 'password'}
                className="input-control"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                style={{ paddingRight: '3rem', fontFamily: geminiKey && !showGeminiKey ? 'monospace' : 'inherit', borderColor: geminiKey ? 'rgba(52,168,83,0.4)' : undefined }}
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(v => !v)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                {showGeminiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              onClick={saveGeminiKey}
              className="btn"
              style={{
                padding: '0.75rem 1.5rem', whiteSpace: 'nowrap',
                background: geminiKeySaved ? 'linear-gradient(135deg,var(--emerald),#34d399)' : 'linear-gradient(135deg,#4285F4,#0F9D58)',
                boxShadow: geminiKeySaved ? '0 4px 16px rgba(16,185,129,0.35)' : '0 4px 16px rgba(66,133,244,0.3)',
                transition: 'all 0.3s'
              }}
            >
              {geminiKeySaved ? <><CheckCircle2 size={16} /> Sauvegardé !</> : 'Sauvegarder'}
            </button>
          </div>

          {geminiKey && (
            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#34A853' }}>✓ Clé Gemini configurée — {geminiKey.slice(0, 10)}...</span>
              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '99px', background: 'rgba(52,168,83,0.12)', color: '#34A853', fontWeight: 600 }}>Imagen 3 activé ✨</span>
            </div>
          )}
        </div>

        {/* ── DeepSeek API Key ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'apis' ? 'block' : 'none', borderColor: 'rgba(0,186,124,0.25)', background: 'linear-gradient(135deg, rgba(0,186,124,0.04) 0%, rgba(99,102,241,0.02) 100%)', marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <KeyRound size={20} style={{ color: '#00BA7C' }} /> Clé API DeepSeek (Modèle Chinois Économique)
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Utilisée pour l'import IA à coût minime (DeepSeek-V3) ou avec réflexion scientifique avancée (DeepSeek-R1). 
            Obtenez votre clé sur{' '}
            <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" style={{ color: '#00BA7C', fontWeight: 600 }}>platform.deepseek.com</a> ou utilisez un fournisseur compatible OpenAI (ex: SiliconFlow).
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type={showDeepseekKey ? 'text' : 'password'}
                className="input-control"
                placeholder="sk-..."
                value={deepseekKey}
                onChange={e => setDeepseekKey(e.target.value)}
                style={{ paddingRight: '3rem', fontFamily: deepseekKey && !showDeepseekKey ? 'monospace' : 'inherit', borderColor: deepseekKey ? 'rgba(0,186,124,0.4)' : undefined }}
              />
              <button
                type="button"
                onClick={() => setShowDeepseekKey(v => !v)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                {showDeepseekKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              onClick={saveDeepseekKey}
              className="btn"
              style={{
                padding: '0.75rem 1.5rem', whiteSpace: 'nowrap',
                background: deepseekKeySaved ? 'linear-gradient(135deg,var(--emerald),#34d399)' : 'linear-gradient(135deg,#00BA7C,#4f46e5)',
                boxShadow: deepseekKeySaved ? '0 4px 16px rgba(16,185,129,0.35)' : '0 4px 16px rgba(0,186,124,0.3)',
                transition: 'all 0.3s'
              }}
            >
              {deepseekKeySaved ? <><CheckCircle2 size={16} /> Sauvegardé !</> : 'Sauvegarder'}
            </button>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              URL de l'API DeepSeek (Endpoint)
            </label>
            <input
              type="text"
              className="input-control"
              placeholder="https://api.deepseek.com"
              value={deepseekUrl}
              onChange={e => setDeepseekUrl(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
            <p style={{ marginTop: '0.4rem', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
              💡 Par défaut : <code>https://api.deepseek.com</code>. Vous pouvez la remplacer par celle de SiliconFlow (<code>https://api.siliconflow.cn</code>) pour profiter de l'offre gratuite.
            </p>
          </div>

          {deepseekKey && (
            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#00BA7C' }}>✓ Clé DeepSeek configurée — {deepseekKey.slice(0, 10)}...</span>
              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '99px', background: 'rgba(0,186,124,0.12)', color: '#00BA7C', fontWeight: 600 }}>DeepSeek disponible 🚀</span>
            </div>
          )}
        </div>



        {/* ── Branding / Identity ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'general' ? 'block' : 'none' }}>
          <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🎨 Identité, Branding & Facebook Pixel
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Ces informations configurent l'identité visuelle de votre plateforme, de vos exports PDF et le Pixel de suivi publicitaire.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Nom du Professeur</label>
              <input className="input-control" placeholder="Prof. Ahmed Benali" value={profName} onChange={e => setProfName(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Téléphone / WhatsApp</label>
              <input className="input-control" placeholder="+212 6XX XXX XXX" value={profPhone} onChange={e => setProfPhone(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Site web / URL QR</label>
              <input className="input-control" placeholder="www.lconq.ma" value={profSite} onChange={e => setProfSite(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: '1rem', borderTop: '1px dashed var(--border)', paddingTop: '1rem', marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>ID du Pixel Facebook (Facebook Pixel ID)</label>
            <input 
              type="text" 
              className="input-control" 
              placeholder="Ex: 123456789012345" 
              value={fbPixelId} 
              onChange={e => setFbPixelId(e.target.value)} 
              style={{ fontFamily: 'monospace', maxWidth: '380px' }}
            />
            <p style={{ marginTop: '0.35rem', fontSize: '0.73rem', color: 'var(--text-subtle)', lineHeight: 1.3 }}>
              💡 Permet de suivre les visites et les conversions de vos étudiants (ex: le trafic d'inscription) pour optimiser vos campagnes publicitaires Facebook Ads.
            </p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem', marginTop: '1rem', borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Banque (Virement/Cash)</label>
              <input className="input-control" placeholder="CIH Bank (Maroc)" value={bankName} onChange={e => setBankName(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>RIB du Compte</label>
              <input className="input-control" placeholder="230 780 ..." value={bankRIB} onChange={e => setBankRIB(e.target.value)} style={{ fontFamily: 'monospace' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Bénéficiaire</label>
              <input className="input-control" placeholder="L'CONQ SARL" value={bankBeneficiary} onChange={e => setBankBeneficiary(e.target.value)} />
            </div>
          </div>
          <button onClick={saveBranding} className="btn"
            style={{ background: brandSaved ? 'linear-gradient(135deg,var(--emerald),#34d399)' : undefined, boxShadow: brandSaved ? '0 4px 16px rgba(16,185,129,0.35)' : undefined, transition: 'all 0.3s' }}>
            {brandSaved ? <><CheckCircle2 size={16} /> Sauvegardé !</> : 'Sauvegarder l\'identité'}
          </button>
        </div>

        {/* ── OMR Scanner Settings ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'general' ? 'block' : 'none' }}>
          <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={20} /> Paramètres du Scanner OMR
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Configurez le comportement du scanner de feuilles de réponses OMR.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Camera size={18} style={{ color: 'var(--violet)' }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', margin: 0 }}>Tir direct par caméra (Tansouir Mobachir)</p>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-subtle)', margin: 0 }}>Activer l'option de capture en direct avec la caméra pour scanner les feuilles de réponses</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const newVal = !scannerDirectCapture;
                  setScannerDirectCapture(newVal);
                  await updateOmrScannerSettingsConfig({ scannerDirectCapture: newVal });
                  setScannerSaved(true);
                  setTimeout(() => setScannerSaved(false), 2000);
                }}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: scannerDirectCapture ? 'var(--violet)' : 'var(--bg-card)',
                  position: 'relative', transition: 'background 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, transition: 'left 0.2s',
                  left: scannerDirectCapture ? 25 : 3,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
            
            {scannerSaved && (
              <p style={{ fontSize: '0.78rem', color: 'var(--emerald)', margin: '0.2rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 size={14} /> Modifications enregistrées avec succès !
              </p>
            )}
          </div>
        </div>

        {/* ── Landing Page Editor ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'landing_editor' ? 'block' : 'none', direction: 'rtl', textAlign: 'right' }}>
          <h3 style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Image size={20} /> تعديل الصفحة المبيعية باللغة العربية (Sales Page Editor)
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
            يمكنك هنا تعديل محتويات الصفحة المبيعية باللغة العربية، تغيير النصوص والروابط وإضافة أو حذف الخصائص.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Hero Inputs */}
            <div style={{ background: 'var(--bg-glass)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontWeight: 800, color: 'var(--violet)' }}>قسم العنوان الرئيسي (Hero Section)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>شارة الإعلان (Hero Badge)</label>
                  <input type="text" className="input-control" value={heroBadgeAr} onChange={e => setHeroBadgeAr(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>العنوان الجزء 1</label>
                    <input type="text" className="input-control" value={heroTitlePart1Ar} onChange={e => setHeroTitlePart1Ar(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>العنوان الجزء 2 (ملون)</label>
                    <input type="text" className="input-control" value={heroTitlePart2Ar} onChange={e => setHeroTitlePart2Ar(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>الوصف الفرعي (Subtitle)</label>
                  <textarea className="input-control" rows={3} value={heroSubtitleAr} onChange={e => setHeroSubtitleAr(e.target.value)} style={{ fontFamily: 'inherit', resize: 'vertical' }} />
                </div>
              </div>
            </div>

            {/* Features List Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--violet)' }}>خصائص المنصة (Features & Screenshots)</h4>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setFeaturesAr([...featuresAr, { title: "خاصية جديدة", desc: "وصف الخاصية الجديدة هنا بالتفصيل...", image: "/study_mockup.png", url: "lconq.ma/new-route", ctaText: "سجل وجرب الآن" }])}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> إضافة خاصية
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {featuresAr.map((feat, index) => (
                  <div key={index} style={{ background: 'var(--bg-glass)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border)', position: 'relative' }}>
                    
                    {/* Delete & Reorder Buttons */}
                    <div style={{ position: 'absolute', top: '1rem', left: '1rem', display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (index > 0) {
                            const newArr = [...featuresAr];
                            const temp = newArr[index - 1];
                            newArr[index - 1] = newArr[index];
                            newArr[index] = temp;
                            setFeaturesAr(newArr);
                          }
                        }}
                        disabled={index === 0}
                        style={{ background: 'transparent', border: '1px solid var(--border)', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-main)', opacity: index === 0 ? 0.3 : 1 }}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (index < featuresAr.length - 1) {
                            const newArr = [...featuresAr];
                            const temp = newArr[index + 1];
                            newArr[index + 1] = newArr[index];
                            newArr[index] = temp;
                            setFeaturesAr(newArr);
                          }
                        }}
                        disabled={index === featuresAr.length - 1}
                        style={{ background: 'transparent', border: '1px solid var(--border)', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-main)', opacity: index === featuresAr.length - 1 ? 0.3 : 1 }}
                        title="Move Down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newArr = featuresAr.filter((_, i) => i !== index);
                          setFeaturesAr(newArr);
                        }}
                        style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', color: 'var(--rose)' }}
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <h5 style={{ margin: '0 0 1rem 0', fontWeight: 800 }}>الخاصية #{index + 1}: {feat.title}</h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>عنوان الخاصية</label>
                          <input type="text" className="input-control" value={feat.title} onChange={e => {
                            const newArr = [...featuresAr];
                            newArr[index].title = e.target.value;
                            setFeaturesAr(newArr);
                          }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>نص زر التسجيل المرافق</label>
                          <input type="text" className="input-control" value={feat.ctaText} onChange={e => {
                            const newArr = [...featuresAr];
                            newArr[index].ctaText = e.target.value;
                            setFeaturesAr(newArr);
                          }} />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>الوصف</label>
                        <textarea className="input-control" rows={2} value={feat.desc} onChange={e => {
                          const newArr = [...featuresAr];
                          newArr[index].desc = e.target.value;
                          setFeaturesAr(newArr);
                        }} style={{ fontFamily: 'inherit', resize: 'vertical' }} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>رابط المحاكاة (URL)</label>
                          <input type="text" className="input-control" value={feat.url || ''} onChange={e => {
                            const newArr = [...featuresAr];
                            newArr[index].url = e.target.value;
                            setFeaturesAr(newArr);
                          }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>صورة المعاينة (Screenshot URL)</label>
                          <input type="text" className="input-control" value={feat.image} onChange={e => {
                            const newArr = [...featuresAr];
                            newArr[index].image = e.target.value;
                            setFeaturesAr(newArr);
                          }} />
                          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
                            <span onClick={() => {
                              const newArr = [...featuresAr];
                              newArr[index].image = "/study_mockup.png";
                              setFeaturesAr(newArr);
                            }} style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-main)' }}>SRS Card</span>
                            <span onClick={() => {
                              const newArr = [...featuresAr];
                              newArr[index].image = "/dashboard_mockup.png";
                              setFeaturesAr(newArr);
                            }} style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-main)' }}>Dashboard</span>
                            <span onClick={() => {
                              const newArr = [...featuresAr];
                              newArr[index].image = "/ranking_mockup.png";
                              setFeaturesAr(newArr);
                            }} style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-main)' }}>Leaderboard</span>
                          </div>

                          {/* Custom File Upload Uploader */}
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={e => handleImageUpload(e, index)} 
                              style={{ display: 'none' }} 
                              id={`file-upload-${index}`}
                            />
                            <label 
                              htmlFor={`file-upload-${index}`} 
                              className="btn-outline" 
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '0.72rem', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                cursor: 'pointer',
                                margin: 0
                              }}
                            >
                              <Camera size={12} />
                              {uploadingFeat[index] ? 'جاري الرفع...' : 'رفع صورة مخصصة'}
                            </label>
                            {uploadingFeat[index] && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--violet)' }}>جاري الرفع...</span>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>
                ))}
              </div>
            </div>

            {/* Section Visibility toggles */}
            <div style={{ background: 'var(--bg-glass)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontWeight: 800, color: 'var(--violet)' }}>إعدادات ظهور أقسام الصفحة (Section Visibility Settings)</h4>
              <p style={{ color: 'var(--text-subtle)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                قم بتنشيط أو إخفاء الأقسام الثانوية في الصفحة المبيعية باللغة العربية للتحكم الكامل في طول الصفحة وتوجيه تركيز الزوار:
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.88rem' }}>مقارنة الباك والكونكور</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>قسم المقارنة والـ Pain Points</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={showPainPoints} 
                    onChange={e => setShowPainPoints(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--violet)' }} 
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.88rem' }}>طرق الدفع المحلية</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>معلومات الحسابات البنكية والواتساب</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={showPayments} 
                    onChange={e => setShowPayments(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--violet)' }} 
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.88rem' }}>باقات الاشتراك والأسعار</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>جدول الباقات والاشتراكات</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={showPricing} 
                    onChange={e => setShowPricing(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--violet)' }} 
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.88rem' }}>آراء وقصص نجاح الطلبة</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>آراء المقبولين في كليات النخبة</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={showTestimonials} 
                    onChange={e => setShowTestimonials(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--violet)' }} 
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.88rem' }}>الأسئلة الشائعة (FAQ)</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>الأسئلة المطروحة بشكل متكرر</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={showFaqs} 
                    onChange={e => setShowFaqs(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--violet)' }} 
                  />
                </div>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button
              onClick={saveLandingConfig}
              className="btn"
              style={{
                padding: '0.75rem 2rem',
                background: landingSaved ? 'linear-gradient(135deg,var(--emerald),#34d399)' : undefined,
                boxShadow: landingSaved ? '0 4px 16px rgba(16,185,129,0.35)' : undefined,
                transition: 'all 0.3s'
              }}
            >
              {landingSaved ? <><CheckCircle2 size={16} /> تم الحفظ بنجاح !</> : 'حفظ التعديلات'}
            </button>
          </div>
        </div>


        {/* ── Subscription Plans Configuration ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'subscriptions' ? 'block' : 'none' }}>
          <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Crown size={20} color="var(--warning)" /> Configuration des Offres d'Abonnement (Baqat)
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Gérez les offres d'abonnement disponibles pour les élèves, configurez leurs tarifs, durées et les écoles associées.
          </p>

          {/* List of existing plans */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
            {plans.map(plan => {
              return (
                <div key={plan.id} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Name, Price & Expiration row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <input 
                        type="text" 
                        value={plan.name} 
                        onChange={e => updatePlan(plan.id, { name: e.target.value })}
                        style={{ background: 'transparent', border: 'none', borderBottom: '1px dashed var(--border)', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 800, width: '100%', outline: 'none', paddingBottom: '2px' }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.02)', padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <input 
                          type="number" 
                          value={plan.price} 
                          onChange={e => updatePlan(plan.id, { price: parseFloat(e.target.value) || 0 })}
                          style={{ background: 'transparent', border: 'none', color: 'var(--emerald)', fontSize: '0.85rem', fontWeight: 700, width: '60px', outline: 'none', textAlign: 'right' }}
                        />
                        <span style={{ fontSize: '0.85rem', color: 'var(--emerald)', fontWeight: 700 }}>DH</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.02)', padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <input 
                          type="number" 
                          value={plan.durationDays} 
                          onChange={e => updatePlan(plan.id, { durationDays: parseInt(e.target.value) || 365 })}
                          style={{ background: 'transparent', border: 'none', color: 'var(--violet)', fontSize: '0.85rem', fontWeight: 700, width: '50px', outline: 'none', textAlign: 'right' }}
                        />
                        <span style={{ fontSize: '0.85rem', color: 'var(--violet)', fontWeight: 700 }}>Jours</span>
                      </div>

                      <button 
                        onClick={() => removePlan(plan.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.35rem', borderRadius: '6px', display: 'flex' }}
                        title="Supprimer la baque"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Description & Recommended row */}
                  <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Description de l'offre
                      </label>
                      <input 
                        type="text" 
                        className="input-control"
                        placeholder="Ex: Le pack complet pour la réussite."
                        value={plan.description || ''}
                        onChange={e => updatePlan(plan.id, { description: e.target.value })}
                        style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
                      <input 
                        type="checkbox"
                        id={`recom-${plan.id}`}
                        checked={!!plan.isRecommended}
                        onChange={e => updatePlan(plan.id, { isRecommended: e.target.checked })}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <label htmlFor={`recom-${plan.id}`} style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--warning)', cursor: 'pointer' }}>
                        ✦ Recommandé
                      </label>
                    </div>
                  </div>

                  {/* Features Textarea */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Fonctionnalités incluses (une par ligne) :
                    </label>
                    <textarea 
                      className="input-control"
                      placeholder="Ex: Accès à toutes les archives&#10;Astuces IA exclusives pour chaque QCM"
                      rows={3}
                      value={plan.features ? plan.features.join('\n') : ''}
                      onChange={e => updatePlan(plan.id, { features: e.target.value.split('\n').filter(Boolean) })}
                      style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </div>

                  {/* Allowed schools selector */}
                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                      Écoles et Facultés autorisées :
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {schools.map(school => {
                        const isAllowed = plan.allowedSchools.includes(school);
                        return (
                          <button
                            key={school}
                            type="button"
                            onClick={() => {
                              const updatedSchools = isAllowed
                                ? plan.allowedSchools.filter(s => s !== school)
                                : [...plan.allowedSchools, school];
                              updatePlan(plan.id, { allowedSchools: updatedSchools });
                            }}
                            style={{
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              border: `1px solid ${isAllowed ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                              background: isAllowed ? 'rgba(99,102,241,0.1)' : 'transparent',
                              color: isAllowed ? 'var(--violet)' : 'var(--text-muted)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            {isAllowed ? '✓ ' : '+ '} {school}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Add Plan Form */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontWeight: 800, fontSize: '0.95rem' }}>Ajouter une nouvelle offre</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>Nom de l'offre</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Pack Spécial ENSA & ENSAM" 
                    className="input-control"
                    value={newPlanName}
                    onChange={e => setNewPlanName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>Tarif (DH)</label>
                  <input 
                    type="number" 
                    placeholder="299" 
                    className="input-control"
                    value={newPlanPrice}
                    onChange={e => setNewPlanPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>Durée (Jours)</label>
                  <input 
                    type="number" 
                    placeholder="365" 
                    className="input-control"
                    value={newPlanDuration}
                    onChange={e => setNewPlanDuration(e.target.value)}
                  />
                </div>
              </div>

              {/* Description & Recommended row for Add Form */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>Description</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Le pack complet pour la réussite." 
                    className="input-control"
                    value={newPlanDescription}
                    onChange={e => setNewPlanDescription(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
                  <input 
                    type="checkbox"
                    id="newPlanIsRecommended"
                    checked={newPlanIsRecommended}
                    onChange={e => setNewPlanIsRecommended(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="newPlanIsRecommended" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--warning)', cursor: 'pointer' }}>
                    ✦ Recommandé par défaut
                  </label>
                </div>
              </div>

              {/* Features List for Add Form */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Fonctionnalités incluses (une par ligne) :
                </label>
                <textarea 
                  placeholder="Ex: Accès à toutes les archives (2010–2025)&#10;Astuces IA exclusives pour chaque QCM&#10;Simulateur de concours chronométré" 
                  className="input-control"
                  rows={3}
                  value={newPlanFeatures}
                  onChange={e => setNewPlanFeatures(e.target.value)}
                  style={{ fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Autoriser l'accès aux écoles suivantes :
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {schools.map(school => {
                    const isSelected = newPlanSchools.includes(school);
                    return (
                      <button
                        key={school}
                        type="button"
                        onClick={() => {
                          const updated = isSelected
                            ? newPlanSchools.filter(s => s !== school)
                            : [...newPlanSchools, school];
                          setNewPlanSchools(updated);
                        }}
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          border: `1px solid ${isSelected ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
                          background: isSelected ? 'rgba(16,185,129,0.1)' : 'transparent',
                          color: isSelected ? 'var(--emerald)' : 'var(--text-muted)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '} {school}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => {
                  if (newPlanName.trim()) {
                    const featuresArray = newPlanFeatures.split('\n').map(f => f.trim()).filter(Boolean);
                    addPlan(
                      newPlanName.trim(), 
                      newPlanPrice, 
                      newPlanDuration, 
                      newPlanSchools, 
                      newPlanDescription.trim(), 
                      newPlanIsRecommended, 
                      featuresArray
                    );
                    setNewPlanName('');
                    setNewPlanPrice('');
                    setNewPlanDuration('365');
                    setNewPlanSchools([]);
                    setNewPlanDescription('');
                    setNewPlanIsRecommended(false);
                    setNewPlanFeatures('');
                  }
                }}
                className="btn"
                style={{ width: 'fit-content', padding: '0.65rem 1.5rem', alignSelf: 'flex-end' }}
              >
                <Plus size={16} /> Ajouter l'offre d'abonnement
              </button>
            </div>

          </div>

        </div>

        {/* ── Schools ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'general' ? 'block' : 'none' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <School size={20} /> Gestion des Écoles Cibles
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
            Ces écoles apparaîtront dans le menu déroulant lors de l'upload d'un nouveau concours.
          </p>

          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <input
              type="text"
              className="input-control"
              placeholder="Nom de l'école (ex: ISCAE)"
              value={newSchool}
              onChange={e => setNewSchool(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn" style={{ padding: '0.75rem 2rem' }}>
              <Plus size={20} /> Ajouter
            </button>
          </form>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {schools.map(school => (
              <div key={school} className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-glass)', borderRadius: '1rem' }}>
                <span style={{ fontWeight: 600 }}>{school}</span>
                <button onClick={() => removeSchool(school)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.4rem', borderRadius: '0.5rem', transition: 'background 0.2s' }} title="Supprimer">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Activation Codes (Vouchers) ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'subscriptions' ? 'block' : 'none' }}>
          <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <KeyRound size={20} color="var(--violet)" /> Gestion des Codes d'Activation (Vouchers)
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Générez des codes uniques pour vos baquettes d'abonnement. Exportez-les en CSV pour les distribuer aux librairies ou étudiants.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            {/* Generate form */}
            <div style={{ borderRight: '1px solid var(--border)', paddingRight: '2rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontWeight: 800, fontSize: '0.95rem' }}>Générer de nouveaux codes</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Sélectionner l'offre associée
                  </label>
                  <select 
                    value={voucherPlanId} 
                    onChange={e => setVoucherPlanId(e.target.value)}
                    style={{ 
                      width: '100%', padding: '0.65rem 0.75rem', borderRadius: '10px', 
                      border: '1px solid var(--border)', background: 'var(--bg-glass)', 
                      color: 'var(--text-main)', fontSize: '0.85rem' 
                    }}
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.price} DH)</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Quantité
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      max="100"
                      className="input-control"
                      value={voucherCount}
                      onChange={e => setVoucherCount(e.target.value)}
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Nom du lot (Optionnel)
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Librairie Al-Amal"
                      className="input-control"
                      value={voucherBatchName}
                      onChange={e => setVoucherBatchName(e.target.value)}
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    if (voucherPlanId && voucherCount) {
                      generateActivationCodes(voucherPlanId, parseInt(voucherCount), voucherBatchName.trim());
                      setVoucherBatchName('');
                    }
                  }}
                  className="btn"
                  style={{ width: 'fit-content', padding: '0.65rem 1.5rem', alignSelf: 'flex-end', marginTop: '0.5rem' }}
                >
                  <Sparkles size={16} /> Générer les codes
                </button>
              </div>
            </div>

            {/* List and Actions */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem' }}>Codes Existants</h4>
                <button 
                  onClick={() => {
                    const header = "Code,Plan,Lot,Statut,Utilise Par,Date Utilisation,Date Creation\n";
                    const rows = activationCodes.map(c => {
                      const plan = plans.find(p => p.id === c.planId);
                      const statusStr = c.isUsed ? "Utilise" : "Actif";
                      const dateUsed = c.usedAt ? new Date(c.usedAt).toLocaleDateString('fr-FR') : "";
                      const dateCreated = c.createdDate ? new Date(c.createdDate).toLocaleDateString('fr-FR') : "";
                      return `"${c.code}","${plan?.name || 'Inconnu'}","${c.batchName}","${statusStr}","${c.usedBy || ''}","${dateUsed}","${dateCreated}"`;
                    }).join("\n");
                    
                    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", `vouchers_lconq_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="btn-outline"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Download size={13} /> Exporter CSV
                </button>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
                {['all', 'active', 'used'].map(f => (
                  <button
                    key={f}
                    onClick={() => setVoucherFilter(f)}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: voucherFilter === f ? 'rgba(99,102,241,0.1)' : 'transparent',
                      color: voucherFilter === f ? 'var(--violet)' : 'var(--text-muted)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : 'Utilisés'}
                  </button>
                ))}
              </div>

              {/* List */}
              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px', background: 'rgba(255,255,255,0.01)' }}>
                {activationCodes
                  .filter(c => {
                    if (voucherFilter === 'active') return !c.isUsed;
                    if (voucherFilter === 'used') return c.isUsed;
                    return true;
                  })
                  .map(c => {
                    const plan = plans.find(p => p.id === c.planId);
                    return (
                      <div 
                        key={c.code} 
                        style={{ 
                          padding: '0.75rem 1rem', 
                          borderBottom: '1px solid var(--border)', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          fontSize: '0.85rem'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span 
                              style={{ 
                                fontFamily: 'monospace', 
                                fontWeight: 800, 
                                color: copiedCode === c.code ? 'var(--emerald)' : 'var(--text-main)',
                                cursor: 'pointer' 
                              }}
                              onClick={() => {
                                navigator.clipboard.writeText(c.code);
                                setCopiedCode(c.code);
                                setTimeout(() => setCopiedCode(''), 1500);
                              }}
                              title="Cliquer pour copier"
                            >
                              {c.code}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                              ({plan?.name || 'Plan inconnu'})
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            Lot: {c.batchName} · {new Date(c.createdDate).toLocaleDateString('fr-FR')}
                          </div>
                        </div>

                        <div>
                          {c.isUsed ? (
                            <span 
                              style={{ color: 'var(--danger)', fontSize: '0.72rem', fontWeight: 800 }}
                              title={`Utilisé par ${c.usedBy} le ${new Date(c.usedAt).toLocaleDateString('fr-FR')}`}
                            >
                              UTILISÉ
                            </span>
                          ) : (
                            <span style={{ color: 'var(--emerald)', fontSize: '0.72rem', fontWeight: 800 }}>
                              ACTIF
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {activationCodes.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Aucun code d'activation disponible
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ── Logbook / Timetable / Holidays Settings ── */}
        <div className="col-span-12 glass-panel" style={{ display: activeTab === 'logbook' ? 'block' : 'none' }}>
          <h3 style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={20} style={{ color: 'var(--violet)' }} /> إعدادات دفتر النصوص
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
            قم بإعداد جدول الحصص الأسبوعي، أيام العطل، وأسلوب طباعة دفتر النصوص PDF.
          </p>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { id: 'timetable', label: 'جدول الحصص', icon: '🗓️' },
              { id: 'holidays',  label: 'العطل المدرسية', icon: '🌴' },
              { id: 'style',    label: 'تصميم الطباعة', icon: '🎨' },
            ].map(st => (
              <button
                key={st.id}
                type="button"
                onClick={() => setLogbookSubTab(st.id)}
                style={{
                  padding: '0.5rem 1.1rem', borderRadius: 10, border: '1px solid',
                  borderColor: logbookSubTab === st.id ? 'var(--violet)' : 'var(--border)',
                  background: logbookSubTab === st.id ? 'var(--violet-soft)' : 'var(--bg-glass)',
                  color: logbookSubTab === st.id ? 'var(--violet)' : 'var(--text-muted)',
                  fontWeight: logbookSubTab === st.id ? 700 : 500,
                  fontSize: '0.83rem', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: '0.4rem'
                }}
              >
                <span>{st.icon}</span> {st.label}
              </button>
            ))}
          </div>

          {/* ── TIMETABLE TAB ── */}
          {logbookSubTab === 'timetable' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-subtle)', marginBottom: '0.5rem' }}>
                حدد مادة دراسية ووقت الحصة لكل يوم في الأسبوع. سيتم استخدام هذا الجدول لاقتراح الإدخالات التلقائية في دفتر النصوص.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 700, borderBottom: '1px solid var(--border)', width: 100 }}>الوقت</th>
                      {WEEKDAYS.map(d => (
                        <th key={d.id} style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: 'var(--violet)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{d.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map(slot => (
                      <tr key={slot}>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-subtle)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)' }}>{slot}</td>
                        {WEEKDAYS.map(d => {
                          const key = `${d.id}_${slot}`;
                          const cell = logbookSchedule[key] || {};
                          return (
                            <td key={d.id} style={{ padding: '0.35rem', borderBottom: '1px solid var(--border)', minWidth: 130 }}>
                              <input
                                type="text"
                                className="input-control"
                                placeholder="مادة..."
                                value={cell.subject || ''}
                                onChange={e => handleLogbookScheduleChange(key, 'subject', e.target.value)}
                                style={{ fontSize: '0.78rem', padding: '0.35rem 0.55rem', marginBottom: '0.25rem' }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── HOLIDAYS TAB ── */}
          {logbookSubTab === 'holidays' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-subtle)' }}>
                أضف أيام العطل الرسمية والأعياد. ستُستثنى هذه الفترات تلقائياً من حساب الحصص الفائتة.
              </p>

              {/* Add holiday form */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.75rem', alignItems: 'flex-end', background: 'var(--bg-glass)', padding: '1rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>اسم العطلة</label>
                  <input type="text" className="input-control" placeholder="مثال: عطلة نصف الفصل" value={newHolLabel} onChange={e => setNewHolLabel(e.target.value)} style={{ fontSize: '0.82rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>من</label>
                  <input type="date" className="input-control" value={newHolStart} onChange={e => setNewHolStart(e.target.value)} style={{ fontSize: '0.82rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>إلى</label>
                  <input type="date" className="input-control" value={newHolEnd} onChange={e => setNewHolEnd(e.target.value)} style={{ fontSize: '0.82rem' }} />
                </div>
                <button
                  onClick={addHoliday}
                  className="btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Plus size={15} /> إضافة
                </button>
              </div>

              {/* Holiday list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {logbookHolidays.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-subtle)', fontSize: '0.85rem' }}>
                    🌴 لا توجد عطل مضافة بعد
                  </div>
                )}
                {logbookHolidays.map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', borderRadius: 10, background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>🌴</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem' }}>{h.label}</p>
                        <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-subtle)' }}>{h.startDate} → {h.endDate}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeHoliday(h.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STYLE TAB ── */}
          {logbookSubTab === 'style' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-subtle)' }}>
                خصّص مظهر طباعة دفتر النصوص PDF: الخطوط، أحجام الكتابة، والألوان.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                {/* Arabic Font */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>خط العربية</label>
                  <select className="input-control" value={logbookArFont} onChange={e => setLogbookArFont(e.target.value)} style={{ fontSize: '0.85rem' }}>
                    <option value="UKIJ Merdane">UKIJ Merdane (كلاسيكي)</option>
                    <option value="Noto Naskh Arabic">Noto Naskh Arabic</option>
                    <option value="Amiri">Amiri (رسمي)</option>
                    <option value="Tajawal">Tajawal (عصري)</option>
                    <option value="Cairo">Cairo</option>
                  </select>
                </div>

                {/* French Font */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>خط الفرنسية</label>
                  <select className="input-control" value={logbookFrFont} onChange={e => setLogbookFrFont(e.target.value)} style={{ fontSize: '0.85rem' }}>
                    <option value="Outfit">Outfit (عصري)</option>
                    <option value="Inter">Inter (واضح)</option>
                    <option value="Computer Modern Serif">Computer Modern Serif (أكاديمي)</option>
                    <option value="Times New Roman">Times New Roman (كلاسيكي)</option>
                  </select>
                </div>

                {/* Font Size */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>حجم الخط الأساسي</label>
                  <select className="input-control" value={logbookFontSize} onChange={e => setLogbookFontSize(e.target.value)} style={{ fontSize: '0.85rem' }}>
                    <option value="0.7rem">صغير (0.7rem)</option>
                    <option value="0.8rem">عادي (0.8rem)</option>
                    <option value="0.9rem">كبير (0.9rem)</option>
                    <option value="1rem">كبير جداً (1rem)</option>
                  </select>
                </div>

                {/* Line Height */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>ارتفاع السطر (بالـ px)</label>
                  <input
                    type="number" min={12} max={40}
                    className="input-control"
                    value={logbookLineHeight}
                    onChange={e => setLogbookLineHeight(parseInt(e.target.value, 10) || 20)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Color pickers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {[
                  { label: 'لون النص الرئيسي', value: logbookColorInk, setter: setLogbookColorInk },
                  { label: 'لون عنوان الفصل', value: logbookColorChapter, setter: setLogbookColorChapter },
                  { label: 'لون عنوان المحور', value: logbookColorAxis, setter: setLogbookColorAxis },
                  { label: 'لون التمارين', value: logbookColorExercise, setter: setLogbookColorExercise },
                ].map(({ label, value, setter }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.9rem', background: 'var(--bg-glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <input
                      type="color"
                      value={value}
                      onChange={e => setter(e.target.value)}
                      style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6 }}
                    />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700 }}>{label}</p>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-subtle)', fontFamily: 'monospace' }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.75rem' }}>
            <button
              onClick={saveLogbookSettings}
              className="btn"
              style={{
                padding: '0.75rem 2rem',
                background: logbookSaved ? 'linear-gradient(135deg,var(--emerald),#34d399)' : undefined,
                boxShadow: logbookSaved ? '0 4px 16px rgba(16,185,129,0.35)' : undefined,
                transition: 'all 0.3s'
              }}
            >
              {logbookSaved ? <><CheckCircle2 size={16} /> تم الحفظ!</> : 'حفظ إعدادات دفتر النصوص'}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
