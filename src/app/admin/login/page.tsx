'use client';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then((x) => x.json());
      if (r.ok) location.href = '/admin';
      else setErr(r.error || 'Credenciais inválidas');
    } catch { setErr('Erro de conexão'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f0c14' }}>
      <form onSubmit={handleSubmit} className="w-full max-w-sm" style={{ animation: 'slideUp 0.5s ease' }}>
        <div className="rounded-2xl p-8" style={{ background: '#1a1520', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
              <span className="text-white text-lg font-black">R</span>
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Rincão <span style={{ color: '#e11d48' }}>Gestor</span></h1>
              <p className="text-[10px] text-gray-500">Acesso administrativo</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">E-mail</label>
              <input
                className="input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                type="email"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Senha</label>
              <input
                className="input w-full"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
              />
            </div>
          </div>

          {err && (
            <div className="mt-3 px-3 py-2 rounded-lg text-[11px] font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all duration-200 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', boxShadow: '0 4px 16px rgba(225,29,72,0.3)' }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
