'use client';
import { useState } from 'react';
export default function Login() {
  const [email, setEmail] = useState('admin@rincao.com');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 p-4">
      <form className="bg-white rounded-3xl p-8 w-full max-w-sm" onSubmit={async (e) => {
        e.preventDefault();
        const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then((x) => x.json());
        if (r.ok) location.href = '/admin'; else setErr(r.error);
      }}>
        <h1 className="text-2xl font-black">Gestor <span className="text-rose-700">Admin</span></h1>
        <p className="text-xs text-stone-500">Rincão Lanches • acesso interno</p>
        <input className="input mt-4" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" />
        <input className="input mt-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" />
        {err && <p className="text-red-600 text-sm mt-2">{err}</p>}
        <button className="btn-primary w-full mt-4">Entrar</button>
        <p className="text-[11px] text-stone-400 mt-3">Demo: admin@rincao.com / admin123 • cozinha@ / caixa@ / entregador@ (123456)</p>
      </form>
    </div>
  );
}
