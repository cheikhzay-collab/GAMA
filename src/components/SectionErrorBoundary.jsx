import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logError } from '../services/logger';

export default class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[SectionErrorBoundary:${this.props.title || 'Section'}]`, error, errorInfo);
    logError(error, {
      section: this.props.title || 'UnknownSection',
      componentStack: errorInfo?.componentStack
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      try {
        this.props.onRetry();
      } catch (e) {
        console.warn('Retry callback failed:', e);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function' 
          ? this.props.fallback({ error: this.state.error, retry: this.handleRetry })
          : this.props.fallback;
      }

      return (
        <div className="p-6 my-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white text-base mb-1">
                {this.props.title || "Erreur d'affichage de cette section"}
              </h4>
              <p className="text-sm text-slate-300 mb-3">
                {this.state.error?.message || "Une erreur inattendue est survenue lors du rendu de cette composante."}
              </p>
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-lg text-xs font-medium transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Réessayer
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
