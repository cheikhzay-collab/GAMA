import React from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';
import { logError } from '../services/logger';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught runtime error:', error, errorInfo);
    
    // Log application error
    logError(error, { componentStack: errorInfo?.componentStack });
    
    // Tentative de récupération automatique en cas d'erreur de chargement de chunk (déploiements récents)
    const errorStr = error?.toString() || '';
    const isChunkError = 
      errorStr.includes('ChunkLoadError') || 
      errorStr.includes('Failed to fetch dynamically imported module') ||
      errorStr.includes('TypeError: Failed to fetch');
      
    if (isChunkError) {
      const hasReloaded = sessionStorage.getItem('chunk_load_retry_failed') === '1';
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_load_retry_failed', '1');
        console.warn('[ErrorBoundary] Chunk loading error detected. Auto-reloading page...');
        window.location.reload();
        return;
      } else {
        // En cas d'échec persistant, on nettoie le drapeau et on affiche l'écran d'erreur standard
        sessionStorage.removeItem('chunk_load_retry_failed');
      }
    }
    
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at center, #18181B 0%, #09090B 100%)',
          padding: '2rem',
          fontFamily: "'Inter', sans-serif",
          color: '#F4F4F5',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: 'rgba(30, 30, 36, 0.6)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '3rem 2rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}>
            {/* Error Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.15)'
            }}>
              <AlertOctagon size={36} />
            </div>

            {/* Error Message */}
            <h2 style={{
              fontWeight: 800,
              fontSize: '1.75rem',
              marginBottom: '1rem',
              color: '#FFFFFF',
              letterSpacing: '-0.02em'
            }}>
              Oups ! Quelque chose s'est mal passé
            </h2>
            <p style={{
              color: '#A1A1AA',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              marginBottom: '2rem'
            }}>
              Une erreur inattendue est survenue lors de l'affichage de cette page. Notre équipe a été notifiée et travaille à sa résolution.
            </p>

            {/* Error Details */}
            {this.state.error && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '1rem',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                color: '#F87171',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '2rem',
                maxHeight: '200px'
              }}>
                <strong>Error:</strong> {this.state.error.toString()}
                {this.state.errorInfo?.componentStack && (
                  <pre style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              flexDirection: 'column',
              width: '100%'
            }}>
              <button
                onClick={this.handleReset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.85rem 1.5rem',
                  background: 'linear-gradient(135deg, var(--violet, #6366F1), #818CF8)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                  transition: 'transform 0.15s, opacity 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.opacity = '0.95';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <RefreshCw size={16} /> Réessayer la page
              </button>

              <button
                onClick={this.handleGoHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.85rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#F4F4F5',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}
              >
                <Home size={16} /> Tableau de Bord
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
