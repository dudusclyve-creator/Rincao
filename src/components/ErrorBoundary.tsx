'use client';
import React from 'react';

type Props = { children: React.ReactNode; fallback?: React.ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-[200px] rounded-xl p-6 text-center" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <p className="text-sm font-bold" style={{ color: '#ef4444' }}>Algo deu errado</p>
          <p className="text-[11px] text-gray-500 mt-1">{this.state.error?.message || 'Erro desconhecido'}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="mt-3 px-4 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
