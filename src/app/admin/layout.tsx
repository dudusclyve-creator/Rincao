'use client';
import Link from 'next/link';
const MENU = [
  ['Dashboard','/admin','📊'],['Pedidos','/admin/pedidos','🧾'],['PDV','/admin/pdv','🛒'],
  ['Mesas','/admin/mesas','🍽'],['Cozinha','/admin/cozinha','👨‍🍳'],['Caixa','/admin/caixa','💰'],
  ['Cardápio/Produtos','/admin/produtos','🍔'],['Categorias','/admin/categorias','🗂'],
  ['Adicionais','/admin/adicionais','➕'],['Clientes','/admin/clientes','👥'],
  ['Entregas','/admin/entregas','🛵'],['Estoque','/admin/estoque','📦'],
  ['Relatórios','/admin/relatorios','📈'],['Promoções','/admin/promocoes','🔥'],
  ['Cupons','/admin/cupons','🎟'],['Avaliações','/admin/avaliacoes','⭐'],
  ['Equipe','/admin/equipe','👔'],['Configurações','/admin/configuracoes','⚙'],
];
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-stone-100">
      <aside className="w-60 bg-neutral-900 text-white p-4 hidden md:flex flex-col gap-1 no-print shrink-0">
        <h1 className="font-black text-lg px-2">Rincão <span className="text-red-500">Gestor</span></h1>
        <a href="/cardapio" className="text-xs text-stone-400 px-2 mb-2 underline">Ver cardápio do cliente →</a>
        {MENU.map(([label, href, icon]) => (
          <Link key={href} href={href} className="px-3 py-2 rounded-xl text-sm hover:bg-white/10 flex gap-2"><span>{icon}</span>{label}</Link>
        ))}
        <button className="mt-auto text-xs text-stone-400 px-2" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/admin/login'; }}>Sair</button>
      </aside>
      <div className="flex-1 min-w-0">
        <div className="md:hidden bg-neutral-900 text-white p-3 flex gap-2 overflow-x-auto no-print">
          {MENU.map(([label, href]) => <Link key={href} href={href} className="text-xs bg-white/10 rounded-lg px-2 py-1 whitespace-nowrap">{label}</Link>)}
        </div>
        <main className="p-4 md:p-6 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
