'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const MENU: [string, string, string][] = [
  ['Dashboard','/admin','📊'],['Pedidos','/admin/pedidos','🧾'],['PDV','/admin/pdv','🛒'],
  ['Mesas','/admin/mesas','🍽'],['Cozinha','/admin/cozinha','👨‍🍳'],['Caixa','/admin/caixa','💰'],
  ['Cardápio','/admin/produtos','🍔'],['Clientes','/admin/clientes','👥'],
  ['Entregas','/admin/entregas','🛵'],['Estoque','/admin/estoque','📦'],
  ['Relatórios','/admin/relatorios','📈'],['Promoções','/admin/promocoes','🔥'],
  ['Cupons','/admin/cupons','🎟'],['Avaliações','/admin/avaliacoes','⭐'],
  ['Equipe','/admin/equipe','👔'],['Configurações','/admin/configuracoes','⚙'],
];

const C = {
  bg: '#1a1210',
  bgHover: '#2a1f18',
  bgActive: '#3a2a1a',
  border: '#3a2a1a',
  text: '#c8b8a4',
  textMuted: '#7a6a5a',
  accent: '#d4a574',
  accentDark: '#b8864a',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#f5f0eb' }}>
      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col no-print shrink-0 h-screen sticky top-0"
        style={{
          width: collapsed ? '68px' : '240px',
          background: C.bg,
          borderRight: `1px solid ${C.border}`,
          transition: 'width 0.25s ease',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 h-14 shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-[15px] font-black tracking-tight" style={{ color: C.text }}>Rincão <span style={{ color: C.accent }}>Gestor</span></h1>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
            style={{ background: C.bgHover, color: C.textMuted }}
          >
            <svg className="w-4 h-4" style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Link cardápio */}
        {!collapsed && (
          <a href="/cardapio" target="_blank" className="mx-3 mt-3 px-3 py-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors" style={{ background: C.bgHover, color: C.textMuted, border: `1px solid ${C.border}` }}>
            <span className="text-xs">🔗</span>Ver cardápio do cliente
            <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        )}

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
          {MENU.map(([label, href, icon]) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-xl transition-all group"
                style={{
                  padding: collapsed ? '10px 0' : '9px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: active ? C.bgActive : 'transparent',
                  color: active ? C.accent : C.text,
                  fontWeight: active ? 600 : 400,
                }}
                title={collapsed ? label : undefined}
              >
                <span className="text-base shrink-0" style={{ filter: active ? 'none' : 'grayscale(0.3)' }}>{icon}</span>
                {!collapsed && <span className="text-[13px] truncate">{label}</span>}
                {active && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.accent }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-2.5 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
          {!collapsed ? (
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-colors"
              style={{ color: C.textMuted }}
              onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/admin/login'; }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sair
            </button>
          ) : (
            <button
              className="w-full flex items-center justify-center py-2.5 rounded-xl transition-colors"
              style={{ color: C.textMuted }}
              onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/admin/login'; }}
              title="Sair"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 min-w-0">
        <div className="md:hidden text-white p-3 flex gap-2 overflow-x-auto no-print" style={{ background: C.bg }}>
          {MENU.map(([label, href]) => (
            <Link key={href} href={href} className="text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap transition-colors" style={{ background: isActive(href) ? C.bgActive : C.bgHover, color: isActive(href) ? C.accent : C.textMuted }}>
              {label}
            </Link>
          ))}
        </div>
        <main className="p-4 md:p-6 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
