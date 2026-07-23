import React, { useState } from 'react';
import { BrainCircuit, AlertCircle } from 'lucide-react';
import { sanitizeInputString, validatePhoneNumber } from '../../utils/security';

import { getLevelDisplayName } from '../../utils/levelHelpers';

const MOROCCAN_CITIES = [
  "Casablanca", "Rabat", "Marrakech", "Fès", "Tanger", "Salé", "Meknès", "Agadir", 
  "Oujda", "Kénitra", "Tétouan", "Safi", "Témara", "Mohammédia", "El Jadida", 
  "Nador", "Taza", "Settat", "Khouribga", "Béni Mellal", "Khemisset", "Larache", 
  "Guelmim", "Berrechid", "Ouarzazate", "Al Hoceima", "Errachidia", "Taroudant",
  "Autre"
];

const SCHOOLS_LIST = [
  "common_core_sci",
  "common_core_arts",
  "1bac_sci",
  "1bac_arts",
  "2bac_sm",
  "2bac_pc_svt",
  "2bac_arts"
];

const OnboardingModal = React.memo(({ initialPhone = '', initialCity = '', initialSchool = '', onSubmit }) => {
  const [phone, setPhone] = useState(initialPhone);
  const [city, setCity] = useState(initialCity);
  const [school, setSchool] = useState(initialSchool);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const phoneClean = phone.trim();
    const cityClean = city.trim();

    if (!phoneClean) {
      setError('Veuillez saisir votre numéro de téléphone.');
      setLoading(false);
      return;
    }
    
    // Security format validation for phone number
    if (!validatePhoneNumber(phoneClean)) {
      setError('Le format du numéro de téléphone est invalide. Utilisez uniquement des chiffres, espaces, - ou +.');
      setLoading(false);
      return;
    }

    if (!cityClean) {
      setError('Veuillez sélectionner votre ville.');
      setLoading(false);
      return;
    }

    // Security validation against city tampering
    if (!MOROCCAN_CITIES.includes(cityClean)) {
      setError('Sélection de ville invalide.');
      setLoading(false);
      return;
    }

    const schoolClean = school.trim();
    if (!schoolClean) {
      setError('Veuillez sélectionner votre école cible.');
      setLoading(false);
      return;
    }

    if (!SCHOOLS_LIST.includes(schoolClean)) {
      setError('Sélection d\'école cible invalide.');
      setLoading(false);
      return;
    }

    // Sanitize values to prevent XSS/injection before propagation
    const sanitizedPhone = sanitizeInputString(phoneClean);
    const sanitizedCity = sanitizeInputString(cityClean);
    const sanitizedSchool = sanitizeInputString(schoolClean);

    try {
      await onSubmit({ phone: sanitizedPhone, city: sanitizedCity, school: sanitizedSchool });
    } catch (err) {
      console.error('[Onboarding] Error:', err);
      setError(err.message || "Impossible de sauvegarder votre profil. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(9, 9, 11, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div className="glass-panel animate-fade-in" style={{
        maxWidth: '460px',
        width: '100%',
        padding: '2.25rem 2rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        borderRadius: '1.25rem',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '16px',
          background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
          boxShadow: '0 8px 20px rgba(113, 109, 242, 0.25)',
        }}>
          <BrainCircuit size={26} color="#fff" />
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
          Finalisez votre profil 🎯
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.75rem' }}>
          Pour personnaliser vos révisions et vous intégrer dans le **classement national**, veuillez saisir vos coordonnées :
        </p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            color: 'var(--danger)',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.25rem',
            textAlign: 'left',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
              Numéro de téléphone
            </label>
            <input
              type="tel"
              placeholder="06 XX XX XX XX ou +212..."
              className="input-control"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              disabled={loading}
              required
              style={{ width: '100%', borderRadius: '10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
              Votre ville
            </label>
            <select
              className="input-control"
              value={city}
              onChange={e => setCity(e.target.value)}
              disabled={loading}
              required
              style={{ width: '100%', borderRadius: '10px', background: 'var(--bg-card)', color: 'var(--text-main)' }}
            >
              <option value="">Sélectionnez votre ville...</option>
              {MOROCCAN_CITIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
              Votre niveau d'études
            </label>
            <select
              className="input-control"
              value={school}
              onChange={e => setSchool(e.target.value)}
              disabled={loading}
              required
              style={{ width: '100%', borderRadius: '10px', background: 'var(--bg-card)', color: 'var(--text-main)' }}
            >
              <option value="">Sélectionnez votre niveau d'études...</option>
              {SCHOOLS_LIST.map(s => (
                <option key={s} value={s}>{getLevelDisplayName(s)}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '0.85rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              marginTop: '0.5rem',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--violet), #4f46e5)',
            }}
          >
            {loading ? 'Enregistrement...' : 'Valider et commencer'}
          </button>
        </form>
      </div>
    </div>
  );
});

OnboardingModal.displayName = 'OnboardingModal';

export default OnboardingModal;
