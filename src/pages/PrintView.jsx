import { useEffect, useState } from 'react';
import { neonGet } from '../lib/neon';
import { generateSubjectHTML, generateCorrectionHTML } from '../utils/generateExamPDF';

export default function PrintView() {
  const [status, setStatus] = useState('Génération de votre document PDF en cours...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    const type = urlParams.get('type') || 'sujet';
    const userName = decodeURIComponent(urlParams.get('userName') || '');
    const userEmail = decodeURIComponent(urlParams.get('userEmail') || '');

    const triggerPrint = async (html) => {
      // ── Modern, secure rewrite of the document content ──
      // Replaces the entire HTML/body, bypassing document.write security restrictions on HTTPS.
      document.documentElement.innerHTML = html;
      
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn('Font loading check skipped/failed:', e);
      }
      await new Promise(r => setTimeout(r, 1000));
      const hint = document.getElementById('printHint');
      if (hint) hint.style.display = 'none';
      window.print();
      if (hint) hint.style.display = 'flex';
    };

    const checkAndPrintLocal = () => {
      try {
        const html = localStorage.getItem('print_html');
        if (html) {
          localStorage.removeItem('print_html');
          triggerPrint(html);
          return true;
        }
      } catch (err) {
        console.error('Error reading print HTML:', err);
      }
      return false;
    };

    const fetchAndPrintRemote = async () => {
      try {
        setStatus('Connexion à la base de données...');
        setStatus('Téléchargement des données de l\'examen...');
        let examData = null;
        try {
          const res = await neonGet('exams', examId, 'id');
          if (res.data) examData = res.data;
        } catch (_) {}


        if (!examData) {
          throw new Error('Examen introuvable');
        }
        const data = examData;

        setStatus('Compilation du document PDF...');
        
        let html = '';
        if (type === 'corrige') {
          html = generateCorrectionHTML(data.name, data.school, data.year, data.questions || [], { examId: data.id, userName, userEmail });
        } else {
          html = await generateSubjectHTML(data.name, data.school, data.year, data.questions || [], { examId: data.id, userName, userEmail });
        }

        triggerPrint(html);
      } catch (err) {
        console.error('Failed to fetch and print remote:', err);
        setError(err.message);
        setTimeout(() => {
          window.location.href = '/';
        }, 5000);
      }
    };

    let fallbackTimeoutId = null;
    let intervalId = null;
    let timeoutId = null;
    let statusTimer = null;

    const cleanup = () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
      if (statusTimer) clearTimeout(statusTimer);
      window.removeEventListener('storage', handleStorage);
    };

    const handleStorage = (e) => {
      if (e.key === 'print_html' && e.newValue) {
        if (checkAndPrintLocal()) {
          cleanup();
        }
      }
    };

    // Orchestrate flow control
    // 1. Immediately check if it's already in localStorage
    if (checkAndPrintLocal()) {
      return;
    }

    // 2. Set up interval and storage listener to wait for local compilation
    statusTimer = setTimeout(() => {
      setStatus('Attente du document...');
    }, 0);
    
    intervalId = setInterval(() => {
      if (checkAndPrintLocal()) {
        cleanup();
      }
    }, 150);
    window.addEventListener('storage', handleStorage);

    // 3. Fallback logic:
    if (examId) {
      // If we have an examId, wait up to 1.5 seconds for the parent page to write to localStorage.
      // If it doesn't write in time, fall back to remote fetch.
      fallbackTimeoutId = setTimeout(() => {
        cleanup();
        fetchAndPrintRemote();
      }, 1500);
    } else {
      // If no examId, time out and close/redirect after 15 seconds.
      timeoutId = setTimeout(() => {
        cleanup();
        try {
          window.close();
        } catch {
          window.location.href = '/';
        }
      }, 15000);
    }

    return () => {
      cleanup();
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0D1117',
      color: '#fff',
      fontFamily: 'sans-serif',
      textAlign: 'center',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      {error ? (
        <>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#ef4444' }}>Erreur de chargement</h3>
          <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>{error}</p>
          <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '0.75rem' }}>Redirection dans quelques secondes...</p>
        </>
      ) : (
        <>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid rgba(82, 84, 240, 0.15)',
            borderTop: '3px solid #5254F0',
            animation: 'spinPrint 1s linear infinite',
            margin: '0 auto'
          }} />
          <h3 style={{ margin: '20px 0 0 0', fontSize: '1.1rem', fontWeight: 700 }}>L'CONQ</h3>
          <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '0.85rem', maxWidth: '300px', lineHeight: '1.4' }}>{status}</p>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes spinPrint { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          ` }} />
        </>
      )}
    </div>
  );
}
