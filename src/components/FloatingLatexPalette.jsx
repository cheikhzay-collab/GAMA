import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Search, Minimize2, Maximize2, Sparkles, 
  Check
} from 'lucide-react';

const LATEX_CATEGORIES = [
  {
    id: 'analysis',
    titleFr: 'Analyse & Limites',
    titleAr: 'تحليل ونهايات',
    items: [
      { label: 'lim x→0', latex: '\\lim_{x \\to 0} f(x)', title: 'Limite en 0' },
      { label: 'lim x→+∞', latex: '\\lim_{x \\to +\\infty} f(x)', title: 'Limite en +infini' },
      { label: 'lim x→-∞', latex: '\\lim_{x \\to -\\infty} f(x)', title: 'Limite en -infini' },
      { label: 'lim x→a', latex: '\\lim_{x \\to a} f(x)', title: 'Limite en un point a' },
      { label: 'lim x→0⁺', latex: '\\lim_{\\substack{x \\to 0 \\\\ x > 0}} f(x)', title: 'Limite à droite en 0' },
      { label: 'lim x→0⁻', latex: '\\lim_{\\substack{x \\to 0 \\\\ x < 0}} f(x)', title: 'Limite à gauche en 0' },
      { label: 'lim x→a⁺', latex: '\\lim_{\\substack{x \\to a \\\\ x > a}} f(x)', title: 'Limite à droite en a' },
      { label: 'Taux var', latex: '\\lim_{x \\to x_0} \\frac{f(x) - f(x_0)}{x - x_0}', title: 'Dérivabilité en un point' },
      { label: 'a/b', latex: '\\frac{a}{b}', title: 'Fraction' },
      { label: '√x', latex: '\\sqrt{x}', title: 'Racine carrée' },
      { label: 'ⁿ√x', latex: '\\sqrt[n]{x}', title: 'Racine n-ième' },
      { label: 'xⁿ', latex: 'x^{n}', title: 'Puissance' },
      { label: 'f\'(x)', latex: 'f\'(x)', title: 'Dérivée première' },
      { label: 'f\'\'(x)', latex: 'f\'\'(x)', title: 'Dérivée seconde' },
      { label: 'ln(x)', latex: '\\ln(x)', title: 'Logarithme népérien' },
      { label: 'eˣ', latex: 'e^{x}', title: 'Exponentielle' },
      { label: 'E(x)', latex: 'E(x)', title: 'Partie entière' },
      { label: 'sin(x)', latex: '\\sin(x)', title: 'Sinus' },
      { label: 'cos(x)', latex: '\\cos(x)', title: 'Cosinus' },
      { label: 'tan(x)', latex: '\\tan(x)', title: 'Tangente' },
      { label: 'arctan', latex: '\\arctan(x)', title: 'Arctangente' },
      { label: 'lim atop >', latex: '\\lim_{x \\to 0 \\atop x > 0} f(x)', title: 'Limite avec atop x>0' },
      { label: 'lim atop <', latex: '\\lim_{x \\to 0 \\atop x < 0} f(x)', title: 'Limite avec atop x<0' },
      { label: 'π', latex: '\\pi', title: 'Pi' },
      { label: '(a/b)', latex: '\\left(\\frac{a}{b}\\right)', title: 'Parenthèses proportionnelles' },
      { label: '|x|', latex: '|x|', title: 'Valeur absolue' },
      { label: '+∞', latex: '+\\infty', title: 'Plus l\'infini' },
      { label: '-∞', latex: '-\\infty', title: 'Moins l\'infini' }
    ]
  },
  {
    id: 'integrals',
    titleFr: 'Intégrales & Sommes',
    titleAr: 'تكامل ومجموع',
    items: [
      { label: '∫ a→b', latex: '\\int_{a}^{b} f(x) \\, dx', title: 'Intégrale définie' },
      { label: '∫ f(x)dx', latex: '\\int f(x) \\, dx', title: 'Intégrale indéfinie' },
      { label: '[F(x)]_a^b', latex: '\\left[ F(x) \\right]_{a}^{b}', title: 'Crochet de primitive' },
      { label: '∑ k=0→n', latex: '\\sum_{k=0}^{n} u_k', title: 'Somme finie' },
      { label: '∑ k=1→n', latex: '\\sum_{k=1}^{n} k', title: 'Somme d\'entiers' },
      { label: '∑ 1→+∞', latex: '\\sum_{n=1}^{+\\infty} u_n', title: 'Série numérique' },
      { label: '∏ i=1→n', latex: '\\prod_{i=1}^{n} x_i', title: 'Produit' },
      { label: 'IPP', latex: '\\int_{a}^{b} u\'(x)v(x)dx = [u(x)v(x)]_{a}^{b} - \\int_{a}^{b} u(x)v\'(x)dx', title: 'Intégration par parties' }
    ]
  },
  {
    id: 'logic_sets',
    titleFr: 'Logique & Ensembles',
    titleAr: 'منطق ومجموعات',
    items: [
      { label: '⇔', latex: '\\Leftrightarrow', title: 'Équivalent à' },
      { label: '⇒', latex: '\\Rightarrow', title: 'Implique' },
      { label: '∀', latex: '\\forall', title: 'Pour tout' },
      { label: '∃', latex: '\\exists', title: 'Il existe' },
      { label: '∃!', latex: '\\exists!', title: 'Il existe un unique' },
      { label: '∈', latex: '\\in', title: 'Appartient à' },
      { label: '∉', latex: '\\notin', title: 'N\'appartient pas à' },
      { label: '⊂', latex: '\\subset', title: 'Inclus dans' },
      { label: '∪', latex: '\\cup', title: 'Union' },
      { label: '∩', latex: '\\cap', title: 'Intersection' },
      { label: '∅', latex: '\\emptyset', title: 'Ensemble vide' },
      { label: 'ℝ', latex: '\\mathbb{R}', title: 'Ensemble R' },
      { label: 'ℝ*', latex: '\\mathbb{R}^*', title: 'Ensemble R*' },
      { label: 'ℝ⁺', latex: '\\mathbb{R}^+', title: 'Ensemble R+' },
      { label: 'ℕ', latex: '\\mathbb{N}', title: 'Ensemble N' },
      { label: 'ℤ', latex: '\\mathbb{Z}', title: 'Ensemble Z' },
      { label: 'ℚ', latex: '\\mathbb{Q}', title: 'Ensemble Q' },
      { label: 'ℂ', latex: '\\mathbb{C}', title: 'Ensemble C' },
      { label: '≤', latex: '\\le', title: 'Inférieur ou égal' },
      { label: '≥', latex: '\\ge', title: 'Supérieur ou égal' },
      { label: '≠', latex: '\\neq', title: 'Différent' },
      { label: '±', latex: '\\pm', title: 'Plus ou moins' },
      { label: '≈', latex: '\\approx', title: 'Environ égal' },
      { label: '≡', latex: '\\equiv', title: 'Congru à' }
    ]
  },
  {
    id: 'structures',
    titleFr: 'Systèmes & Matrices',
    titleAr: 'نظم ومصفوفات',
    items: [
      { 
        label: 'Système 2 eq', 
        latex: '\\begin{cases} ax + by = c \\\\ a\'x + b\'y = c\' \\end{cases}', 
        title: 'Système de 2 équations' 
      },
      { 
        label: 'Système 3 eq', 
        latex: '\\begin{cases} x + y + z = d_1 \\\\ 2x - y + z = d_2 \\\\ x + 2y - z = d_3 \\end{cases}', 
        title: 'Système de 3 équations' 
      },
      { 
        label: 'Fonction morceaux', 
        latex: 'f(x) = \\begin{cases} f_1(x) & \\text{si } x \\ge 0 \\\\ f_2(x) & \\text{si } x < 0 \\end{cases}', 
        title: 'Fonction par morceaux' 
      },
      { 
        label: 'Matrice 2x2', 
        latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', 
        title: 'Matrice 2x2' 
      },
      { 
        label: 'Matrice 3x3', 
        latex: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}', 
        title: 'Matrice 3x3' 
      },
      { 
        label: 'Déterminant', 
        latex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', 
        title: 'Déterminant 2x2' 
      }
    ]
  },
  {
    id: 'vectors',
    titleFr: 'Vecteurs & Géométrie',
    titleAr: 'متجهات وهندسة',
    items: [
      { label: 'u⃗', latex: '\\vec{u}', title: 'Vecteur u' },
      { label: 'v⃗', latex: '\\vec{v}', title: 'Vecteur v' },
      { label: 'AB⃗', latex: '\\vec{AB}', title: 'Vecteur AB' },
      { label: '||u⃗||', latex: '\\|\\vec{u}\\|', title: 'Norme d\'un vecteur' },
      { label: 'u⃗·v⃗', latex: '\\vec{u} \\cdot \\vec{v}', title: 'Produit scalaire' },
      { label: 'u⃗∧v⃗', latex: '\\vec{u} \\wedge \\vec{v}', title: 'Produit vectoriel' },
      { label: 'det(u⃗,v⃗)', latex: '\\det(\\vec{u}, \\vec{v})', title: 'Déterminant de deux vecteurs' },
      { label: 'Repère 2D', latex: '(O; \\vec{i}, \\vec{j})', title: 'Repère orthonormé 2D' },
      { label: 'Repère 3D', latex: '(O; \\vec{i}, \\vec{j}, \\vec{k})', title: 'Repère orthonormé 3D' },
      { label: '⊥', latex: '\\perp', title: 'Perpendiculaire' },
      { label: '∥', latex: '\\parallel', title: 'Parallèle' },
      { label: 'Angle ABC^', latex: '\\widehat{ABC}', title: 'Angle de vecteurs' }
    ]
  },
  {
    id: 'sequences_proba',
    titleFr: 'Suites & Proba',
    titleAr: 'متتاليات واحتمالات',
    items: [
      { label: 'uₙ', latex: 'u_n', title: 'Terme général suite u_n' },
      { label: 'uₙ₊₁', latex: 'u_{n+1}', title: 'Terme suivant u_{n+1}' },
      { label: '(uₙ)', latex: '(u_n)_{n \\in \\mathbb{N}}', title: 'Suite numérique' },
      { label: 'uₙ₊₁ = auₙ+b', latex: 'u_{n+1} = a u_n + b', title: 'Suite arithmético-géométrique' },
      { label: 'C_n^k', latex: 'C_n^k = \\binom{n}{k}', title: 'Combinaison C_n^k' },
      { label: 'A_n^k', latex: 'A_n^k = \\frac{n!}{(n-k)!}', title: 'Arrangement A_n^k' },
      { label: 'n!', latex: 'n!', title: 'Factorielle n' },
      { label: 'P(A)', latex: 'P(A)', title: 'Probabilité d\'un événement' },
      { label: 'P(A∩B)', latex: 'P(A \\cap B)', title: 'Intersection en probabilités' },
      { label: 'P(A∪B)', latex: 'P(A \\cup B)', title: 'Union en probabilités' },
      { label: 'P_B(A)', latex: 'P_B(A) = \\frac{P(A \\cap B)}{P(B)}', title: 'Probabilité conditionnelle' },
      { label: 'E(X)', latex: 'E(X)', title: 'Espérance mathématique' },
      { label: 'V(X)', latex: 'V(X)', title: 'Variance' },
      { label: 'σ(X)', latex: '\\sigma(X)', title: 'Écart-type' }
    ]
  },
  {
    id: 'greek',
    titleFr: 'Lettres Grecques',
    titleAr: 'حروف إغريقية',
    items: [
      { label: 'α', latex: '\\alpha', title: 'Alpha' },
      { label: 'β', latex: '\\beta', title: 'Beta' },
      { label: 'γ', latex: '\\gamma', title: 'Gamma' },
      { label: 'δ', latex: '\\delta', title: 'Delta' },
      { label: 'Δ', latex: '\\Delta', title: 'Delta majuscule (Discriminant)' },
      { label: 'ε', latex: '\\varepsilon', title: 'Epsilon' },
      { label: 'θ', latex: '\\theta', title: 'Thêta' },
      { label: 'λ', latex: '\\lambda', title: 'Lambda' },
      { label: 'μ', latex: '\\mu', title: 'Mu' },
      { label: 'π', latex: '\\pi', title: 'Pi' },
      { label: 'σ', latex: '\\sigma', title: 'Sigma' },
      { label: 'Σ', latex: '\\Sigma', title: 'Sigma majuscule' },
      { label: 'Ω', latex: '\\Omega', title: 'Univers Oméga' },
      { label: 'ω', latex: '\\omega', title: 'Oméga minuscule' }
    ]
  }
];

export default function FloatingLatexPalette({
  isOpen,
  onClose,
  onInsert,
  activeTargetLabel = 'Énoncé / Corrigé',
  isArMode = false
}) {
  const [activeTab, setActiveTab] = useState('analysis');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [lastInserted, setLastInserted] = useState(null);

  // Position state (Draggable)
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  // Filter items by search query across all categories
  const filteredItems = searchQuery.trim()
    ? LATEX_CATEGORIES.flatMap(cat => 
        cat.items.filter(it => 
          it.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          it.latex.toLowerCase().includes(searchQuery.toLowerCase()) ||
          it.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : (LATEX_CATEGORIES.find(c => c.id === activeTab)?.items || []);

  const handleDragMouseDown = (e) => {
    // Only drag when clicking the header bar
    if (e.target.closest('button') || e.target.closest('input')) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleSymbolClick = (latex) => {
    onInsert(latex);
    setLastInserted(latex);
    setTimeout(() => setLastInserted(null), 1200);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2.5rem',
        right: '2.5rem',
        transform: `translate(${position.x}px, ${position.y}px)`,
        zIndex: 99999,
        width: isMinimized ? '280px' : '480px',
        maxWidth: '92vw',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1.5px solid #005086',
        boxShadow: '0 16px 40px rgba(0, 80, 134, 0.22), 0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease'
      }}
    >
      {/* ── DRAGGABLE HEADER ── */}
      <div
        onMouseDown={handleDragMouseDown}
        style={{
          background: 'linear-gradient(135deg, #005086, #0284c7)',
          color: '#ffffff',
          padding: '0.6rem 0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'move',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Sparkles size={15} style={{ color: '#fef08a' }} />
          <span style={{ fontWeight: 900, fontSize: '0.82rem', letterSpacing: '0.02em' }}>
            {isArMode ? 'رموز وصيغ لاتك (LaTeX)' : 'Symboles & Formules LaTeX'}
          </span>
          <span style={{
            background: 'rgba(255,255,255,0.2)',
            color: '#ffffff',
            padding: '0.1rem 0.45rem',
            borderRadius: '12px',
            fontSize: '0.68rem',
            fontWeight: 700
          }}>
            {activeTargetLabel}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <button
            type="button"
            onClick={() => setIsMinimized(prev => !prev)}
            title={isMinimized ? 'Agrandir' : 'Réduire'}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '0.2rem',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Fermer la palette"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '4px',
              cursor: 'pointer',
              padding: '0.2rem',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── EXPANDED BODY ── */}
      {!isMinimized && (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '420px', background: '#f8fafc' }}>
          
          {/* Quick Search & Instruction Bar */}
          <div style={{ padding: '0.5rem 0.75rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <Search size={13} style={{ position: 'absolute', left: '0.55rem', color: '#94a3b8' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isArMode ? 'بحث عن رمز (مثال: lim, frac, sqrt, R)...' : 'Rechercher un symbole (ex: lim, frac, sqrt, R)...'}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.5rem 0.35rem 1.75rem',
                  fontSize: '0.78rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  outline: 'none',
                  color: '#1e293b'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '0.4rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {lastInserted && (
              <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap' }}>
                <Check size={12} /> Inséré !
              </span>
            )}
          </div>

          {/* Category Tabs (When not searching) */}
          {!searchQuery.trim() && (
            <div style={{
              display: 'flex',
              overflowX: 'auto',
              background: '#f1f5f9',
              borderBottom: '1px solid #cbd5e1',
              padding: '0.25rem 0.4rem',
              gap: '0.25rem',
              scrollbarWidth: 'none'
            }}>
              {LATEX_CATEGORIES.map(cat => {
                const isCurrent = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setActiveTab(cat.id)}
                    style={{
                      background: isCurrent ? '#005086' : '#ffffff',
                      color: isCurrent ? '#ffffff' : '#334155',
                      border: isCurrent ? '1px solid #005086' : '1px solid #cbd5e1',
                      borderRadius: '5px',
                      padding: '0.25rem 0.55rem',
                      fontSize: '0.72rem',
                      fontWeight: isCurrent ? 800 : 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s'
                    }}
                  >
                    {isArMode ? cat.titleAr : cat.titleFr}
                  </button>
                );
              })}
            </div>
          )}

          {/* Symbol Buttons Grid */}
          <div style={{
            padding: '0.65rem 0.75rem',
            overflowY: 'auto',
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))',
            gap: '0.45rem',
            maxHeight: '300px'
          }}>
            {filteredItems.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1.5rem 0', color: '#64748b', fontSize: '0.8rem' }}>
                Aucun symbole ne correspond à "{searchQuery}"
              </div>
            ) : (
              filteredItems.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSymbolClick(item.latex)}
                  title={`${item.title} — Cliquer pour insérer (${item.latex})`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0.45rem 0.35rem',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '44px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.12s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#005086';
                    e.currentTarget.style.background = '#f0f9ff';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <span style={{ fontWeight: 800, color: '#005086', fontSize: '0.82rem', pointerEvents: 'none' }}>
                    {item.label}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Quick Tip Footer */}
          <div style={{
            padding: '0.4rem 0.75rem',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            fontSize: '0.68rem',
            color: '#64748b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>💡 {isArMode ? 'انقر على أي رمز لإدراجه مباشرة في موضع المؤشر' : 'Cliquer pour insérer directement à la position du curseur'}</span>
            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Auto $...$</span>
          </div>

        </div>
      )}
    </div>
  );
}
