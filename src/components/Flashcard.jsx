import { useState, useRef, useEffect } from 'react';
import { renderWithMath } from '../utils/mathRenderer';
import { Lightbulb, CheckCircle2, XCircle, Frown, Meh, Smile, BrainCircuit, Zap, Clock } from 'lucide-react';
import { playCorrectSound, playIncorrectSound } from '../utils/audio';

export default function Flashcard({ card, onNext }) {
  // ── Card display settings (Read once on mount via lazy initializers) ──
  const [cardRevealMode] = useState(() => localStorage.getItem('card_reveal_mode') || 'flip');
  const [cardFlipEnabled] = useState(() => localStorage.getItem('card_flip_animation') !== 'false');
  const [cardSwipeEnabled] = useState(() => localStorage.getItem('card_swipe_gesture') !== 'false');
  const [cardSoundEnabled] = useState(() => localStorage.getItem('card_sound_effects') !== 'false');
  const [cardFontFamily] = useState(() => localStorage.getItem('card_font_family') || 'Computer Modern Serif');
  const [cardFontSize] = useState(() => localStorage.getItem('card_font_size') || '1rem');
  const [cardQuestionWeight] = useState(() => localStorage.getItem('card_question_weight') || '400');
  const [cardAstuceWeight] = useState(() => localStorage.getItem('card_astuce_weight') || '400');
  const [cardOptionsWeight] = useState(() => localStorage.getItem('card_options_weight') || '500');

  const isFlipMode    = cardRevealMode === 'flip' && cardFlipEnabled;
  const isInstantMode = cardRevealMode === 'instant';

  const [selectedOption, setSelectedOption] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isShowingBack, setIsShowingBack] = useState(false);
  const [astuceTab, setAstuceTab] = useState('rule');
  const [swipeClass, setSwipeClass] = useState('');

  // Drag-to-swipe states
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(0);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const isHorizontalSwipe = useRef(null); // null = undecided, true = horizontal swipe, false = vertical scroll

  // Timeout refs to prevent memory leaks / state updates on unmounted component
  const revealTimeoutRef = useRef(null);
  const exitTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    };
  }, []);

  const revealCard = (optionId) => {
    if (selectedOption !== null && selectedOption !== undefined) return;
    setSelectedOption(optionId);

    if (cardSoundEnabled && optionId !== 'skipped') {
      const isOptionCorrect = optionId && card.correct_answer && optionId.toLowerCase() === card.correct_answer.toLowerCase();
      if (isOptionCorrect) {
        playCorrectSound();
      } else {
        playIncorrectSound();
      }
    }

    if (cardFlipEnabled && cardRevealMode === 'flip') {
      // 3D flip — switch content midway (220ms into the 600ms flip)
      setIsFlipped(true);
      revealTimeoutRef.current = setTimeout(() => setIsShowingBack(true), 220);
    } else if (cardRevealMode === 'fade') {
      // Fade — no rotation, instant content swap with CSS opacity
      setIsShowingBack(true);
    } else {
      // Instant — no animation at all
      setIsShowingBack(true);
    }
  };

  const handleOptionClick = (optionId) => revealCard(optionId);
  const handleReveal      = ()         => revealCard('skipped');

  const isCorrect = selectedOption && card.correct_answer && selectedOption.toLowerCase() === card.correct_answer.toLowerCase();

  // renderWithMath and renderOptionText are now from '../utils/mathRenderer'
  const renderOptionText = (text) => renderWithMath(text);

  const handleEvaluation = (quality) => {
    const finalQuality = isCorrect && selectedOption !== 'skipped' ? quality : 0;
    const swipeDir = finalQuality === 0 ? 'swipe-left' : 'swipe-right';
    
    setSwipeClass(swipeDir);
    
    // Call the callback after exit animation completes
    exitTimeoutRef.current = setTimeout(() => {
      onNext(card.id, finalQuality);
    }, 300);
  };

  // ── Drag Gestures handlers ──
  const handleMouseDown = (e) => {
    if (!cardSwipeEnabled) return;      // swipe disabled in settings
    if (isInstantMode) return;          // calm mode: no drag
    if (!isShowingBack) return; // Only allow drag-to-rate on the back/review side
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('img')) return;
    setIsDragging(true);
    dragStart.current = e.clientX;
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const diffX = e.clientX - dragStart.current;
    setDragX(diffX);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragX > 140) {
      handleEvaluation(5); // Swipe right -> Easy / Correct
    } else if (dragX < -140) {
      handleEvaluation(0); // Swipe left -> Hard / Wrong
    } else {
      setDragX(0); // Spring back
    }
  };

  const handleTouchStart = (e) => {
    if (!cardSwipeEnabled) return;
    if (isInstantMode) return;  // calm mode: no drag
    if (!isShowingBack) return;
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('img')) return;
    setIsDragging(true);
    dragStart.current = e.touches[0].clientX;
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isHorizontalSwipe.current = null;
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    if (isHorizontalSwipe.current === false) return; // If scrolling vertically, do not swipe

    const diffX = e.touches[0].clientX - touchStartPos.current.x;
    const diffY = e.touches[0].clientY - touchStartPos.current.y;

    if (isHorizontalSwipe.current === null) {
      const absX = Math.abs(diffX);
      const absY = Math.abs(diffY);
      // Wait for a clear move in one direction (threshold: 8px)
      if (absX > 8 || absY > 8) {
        if (absX > absY) {
          isHorizontalSwipe.current = true;
        } else {
          isHorizontalSwipe.current = false;
          setIsDragging(false);
          setDragX(0);
          return;
        }
      } else {
        return;
      }
    }

    setDragX(diffX);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (isHorizontalSwipe.current === true) {
      if (dragX > 140) {
        handleEvaluation(5);
      } else if (dragX < -140) {
        handleEvaluation(0);
      } else {
        setDragX(0);
      }
    } else {
      setDragX(0);
    }
  };

  // Whether we are running in 3D flip mode
  // (isFlipMode already defined at the top)

  const cardStyle = (() => {
    // Shared base
    const base = {
      transformStyle: isFlipMode ? 'preserve-3d' : 'flat',
      cursor: isShowingBack && cardSwipeEnabled ? (isDragging ? 'grabbing' : 'grab') : 'default',
      '--card-font-family': cardFontFamily === 'Inter' ? "'Inter', sans-serif" : cardFontFamily === 'STIX Two Text' ? "'STIX Two Text', serif" : cardFontFamily === 'Times New Roman' ? "'Times New Roman', serif" : "'Computer Modern Serif', Georgia, serif",
      '--card-font-size': cardFontSize,
      '--card-question-weight': cardQuestionWeight,
      '--card-astuce-weight': cardAstuceWeight,
      '--card-options-weight': cardOptionsWeight,
    };

    // ── Swipe-exit animation (inline for non-flip modes to bypass CSS !important) ──
    if (!isFlipMode && swipeClass === 'swipe-right') {
      return { ...base, transform: 'translateX(48px) scale(0.93)', opacity: 0, transition: 'transform 0.28s ease, opacity 0.22s ease' };
    }
    if (!isFlipMode && swipeClass === 'swipe-left') {
      return { ...base, transform: 'translateX(-48px) scale(0.93)', opacity: 0, transition: 'transform 0.28s ease, opacity 0.22s ease' };
    }

    if (isFlipMode) {
      // Standard 3D flip: CSS classes handle is-flipped & swipe-right/left
      return {
        ...base,
        transform: isDragging
          ? `translateX(${dragX}px) rotate(${dragX * 0.04}deg) ${isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'}`
          : `translateX(0px) rotate(0deg) ${isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'}`,
        transition: isDragging
          ? 'none'
          : 'transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease',
      };
    }

    // Fade / Instant: no rotation at all
    return {
      ...base,
      // Instantané = zero drag transforms, completely still
      transform: (!isInstantMode && isDragging && cardSwipeEnabled)
        ? `translateX(${dragX}px) rotate(${dragX * 0.025}deg)`
        : 'none',
      transition: 'none',
      opacity: 1,
    };
  })();

  return (
    <div 
      className="flashcard-wrapper flashcard-enter"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className={`flashcard-3d
          ${card.context ? 'has-context' : ''}
          ${isFlipMode && isFlipped ? 'is-flipped' : ''}
          ${!isFlipMode && isShowingBack ? 'no-flip-revealed' : ''}
          ${isFlipMode ? swipeClass : ''}
        `}
        style={cardStyle}
      >
        {/* Swipe Rating Overlay Indicators — not shown in instant mode */}
        {isShowingBack && dragX !== 0 && !isInstantMode && (
          <div style={{
            position: 'absolute',
            top: '2rem',
            left: dragX < 0 ? '2rem' : 'auto',
            right: dragX > 0 ? '2rem' : 'auto',
            zIndex: 100,
            background: dragX > 0 ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            color: '#fff',
            padding: '0.6rem 1.4rem',
            borderRadius: '2rem',
            fontWeight: 900,
            fontSize: '0.95rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            transform: dragX > 0 ? 'rotate(-8deg) rotateY(180deg)' : 'rotate(8deg) rotateY(180deg)', // Cancel out the mirrored card rotation
            opacity: Math.min(Math.abs(dragX) / 120, 1),
            pointerEvents: 'none',
            boxShadow: dragX > 0 ? 'var(--shadow-glow-emerald)' : '0 4px 15px rgba(239,68,68,0.4)',
            border: '2px solid #fff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            {dragX > 0 ? (
              <>
                <Smile size={18} />
                <span>Facile ✓</span>
              </>
            ) : (
              <>
                <Frown size={18} />
                <span>À Revoir ✗</span>
              </>
            )}
          </div>
        )}

        {/* FRONT SIDE */}
        {!isShowingBack ? (
          <div className={`glass-card flashcard-card flashcard-main-layout ${card.context ? 'has-context-layout' : 'no-context-layout'}`}>
            {/* Left Context Pane (only if context exists) */}
            {card.context && (
              <div className="flashcard-context-pane">
                <div className="flashcard-context-title">
                  <Lightbulb size={14} />
                  Données
                </div>
                
                <div className="flashcard-context-text">
                  {renderWithMath(card.context)}
                </div>
              </div>
            )}

            {/* Right Pane (Question & Options) */}
            <div className="flashcard-content-pane">
              <div className="flashcard-badge-row">
                <div className="topic-badge" style={{ margin: 0, padding: '0.35rem 0.75rem', fontSize: '0.7rem', background: 'var(--violet-soft)', color: 'var(--violet)', fontWeight: 800 }}>
                  <BrainCircuit size={14} style={{ marginRight: '0.5rem' }} />
                  {card.topic || 'Analyse'}
                </div>
              </div>
              
              <div className="flashcard-question-box">
                 {renderWithMath(card.question)}
              </div>

              <div className="options-grid" style={{ marginBottom: '1.25rem' }}>
                 {card.options.map((opt, optIdx) => (
                   <button 
                     key={`${opt.id}-${optIdx}`}
                     className="option-btn"
                     onClick={() => handleOptionClick(opt.id)}
                   >
                     <div className="option-letter">
                       {opt.id}
                     </div>
                     <div style={{ flex: 1, minWidth: 0 }}>
                       {renderOptionText(opt.text)}
                     </div>
                   </button>
                 ))}
              </div>

              <button 
                className="flashcard-reveal-btn" 
                onClick={handleReveal}
              >
                <Lightbulb size={15} />
                Révéler la réponse (Je ne sais pas)
              </button>
            </div>
          </div>
        ) : (
          /* BACK SIDE */
          <div className={`glass-card flashcard-card flashcard-main-layout ${card.context ? 'has-context-layout' : 'no-context-layout'}`} style={{
            // Counter-rotate only in flip mode; in fade/instant just show normally
            transform: isFlipMode ? 'rotateY(180deg)' : 'none',
            animation: cardRevealMode === 'fade' ? 'fadeReveal 0.3s ease forwards' : 'none',
          }}>
            {/* Left Context Pane (Persisted for continuity) */}
            {card.context && (
              <div className="flashcard-context-pane">
                <div className="flashcard-context-title">
                  <Lightbulb size={14} />
                  Données
                </div>
                
                <div className="flashcard-context-text">
                  {renderWithMath(card.context)}
                </div>
              </div>
            )}

            {/* Right Pane (Evaluation & Explanation) */}
            <div className="flashcard-content-pane">
              {/* Correctness validation banner */}
              <div className={`flashcard-banner ${isCorrect ? 'correct' : selectedOption === 'skipped' ? 'skipped' : 'wrong'}`}>
                {isCorrect ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Bravo ! C'est la bonne réponse ✨</span>
                  </>
                ) : selectedOption === 'skipped' ? (
                  <>
                    <Lightbulb size={18} />
                    <span>Réponse révélée (Réponse attendue : {card.correct_answer})</span>
                  </>
                ) : (
                  <>
                    <XCircle size={18} />
                    <span>Incorrect ! Réponse attendue : {card.correct_answer}</span>
                  </>
                )}
              </div>

              {/* Minimal question reference */}
              <div className="flashcard-question-ref">
                {renderWithMath(card.question)}
              </div>

              {/* Disabled options list showing correct vs chosen answer */}
              <div className="options-grid" style={{ marginBottom: '0.8rem' }}>
                 {card.options.map((opt, optIdx) => {
                   const isOptCorrect = opt.id && card.correct_answer && opt.id.toLowerCase() === card.correct_answer.toLowerCase();
                   const isOptSelected = opt.id && selectedOption && opt.id.toLowerCase() === selectedOption.toLowerCase();

                   let btnClass = "option-btn";
                   if (isOptCorrect) btnClass += " correct";
                   else if (isOptSelected) btnClass += " wrong";

                   return (
                     <button 
                       key={`${opt.id}-${optIdx}`}
                       className={btnClass}
                       disabled
                     >
                       <div className="option-letter">
                         {opt.id}
                       </div>
                       <div style={{ flex: 1, minWidth: 0 }}>
                         {renderOptionText(opt.text)}
                       </div>
                       {isOptCorrect && <CheckCircle2 size={16} color="#10b981" />}
                       {isOptSelected && !isOptCorrect && <XCircle size={16} color="#f87171" />}
                     </button>
                   );
                 })}
              </div>

              {/* Astuce panel */}
              <div className="astuce-match-box" style={{ marginBottom: '1.25rem', marginTop: 0 }}>
                <div className="astuce-match-header">
                  <div className="astuce-match-title">
                    <div className="astuce-zap-icon">
                      <Zap size={14} fill="currentColor" />
                    </div>
                    <span>L'Astuce</span>
                    <span style={{ opacity: 0.7 }}>⚡</span>
                  </div>

                  <div className="astuce-tabs">
                    <button
                      className={`astuce-tab ${astuceTab === 'rule' ? 'active' : ''}`}
                      onClick={() => setAstuceTab('rule')}
                    >
                      <BrainCircuit size={11} />
                      <span>Règle</span>
                    </button>
                    <button
                      className={`astuce-tab ${astuceTab === 'trick' ? 'active' : ''} ${!card.trick ? 'disabled' : ''}`}
                      onClick={() => card.trick && setAstuceTab('trick')}
                      disabled={!card.trick}
                      title={!card.trick ? 'Bientôt disponible' : 'Astuce du temps'}
                    >
                      <Clock size={11} />
                      <span>Astuce</span>
                    </button>
                  </div>
                </div>

                <div className="astuce-match-content" key={astuceTab}>
                  {astuceTab === 'rule' ? (
                    <div style={{ margin: 0, color: 'var(--text-main)' }}>
                      {renderWithMath(card.astuce)}
                    </div>
                  ) : (
                    <div style={{ margin: 0, color: 'var(--text-main)', opacity: 0.6, fontStyle: 'italic' }}>
                      {card.trick ? renderWithMath(card.trick) : 'Astuce du temps — bientôt disponible ✨'}
                    </div>
                  )}
                </div>
              </div>

              {/* SRS Rating Actions */}
              <div className="flashcard-actions-row">
                {selectedOption === 'skipped' || !isCorrect ? (
                  <button className="btn" style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem' }} onClick={() => handleEvaluation(0)}>
                    J'ai compris ✓
                  </button>
                ) : (
                  <>
                    <button className="eval-btn eval-hard" onClick={() => handleEvaluation(3)}>
                      <Frown size={16} /> <span>Dur</span>
                    </button>
                    <button className="eval-btn eval-medium" onClick={() => handleEvaluation(4)}>
                      <Meh size={16} /> <span>Moyen</span>
                    </button>
                    <button className="eval-btn eval-easy" onClick={() => handleEvaluation(5)}>
                      <Smile size={16} /> <span>Facile</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
