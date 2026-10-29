'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { playMenuClick, preloadSounds, receiptText, printReceiptText, cardFeePctFromOrder } from '@/lib/utils';
import { can, areaForPath } from '@/lib/roles';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const MENU: [string, string, string][] = [
  ['Dashboard','/admin','📊'],['Pedidos','/admin/pedidos','🧾'],['PDV','/admin/pdv','🛒'],
  ['Mesas','/admin/mesas','🍽'],['Cozinha','/admin/cozinha','👨‍🍳'],['Caixa','/admin/caixa','💰'],
  ['Notas','/admin/notas','📄'],
  ['Cardápio','/admin/produtos','🍔'],['Clientes','/admin/clientes','👥'],
  ['Entregas','/admin/entregas','🛵'],['Estoque','/admin/estoque','📦'],
  ['Compras','/admin/compras','🧺'],
  ['Relatórios','/admin/relatorios','📈'],['Promoções','/admin/promocoes','🔥'],
  ['Equipe','/admin/equipe','👔'],['Configurações','/admin/configuracoes','⚙'],
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const [notif, setNotif] = useState<any>(null);
  const [nfeAlert, setNfeAlert] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const timerRef = useRef<any>(null);
  const nfeTimerRef = useRef<any>(null);
  const seenNotifs = useRef<Set<string>>(new Set());
  // controle de pedidos novos (notificação + impressão automática)
  const seenOrders = useRef<Set<string>>(new Set());
  const ordersReady = useRef(false);
  const printingOrders = useRef<Set<string>>(new Set());
  const settingsRef = useRef<any>(null);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.role) setRole(d.role); }).catch(() => {});
  }, []);

  const visibleMenu = MENU.filter(([, href]) => !role || role === 'admin' || can(role, areaForPath(href)));

  const playNotifSound = useCallback(() => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.8;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  const showBrowserNotif = useCallback((order: any) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`🔔 Pedido #${order.number}`, {
        body: `${order.customerName} · ${order.type === 'entrega' ? '🛵 Entrega' : order.type === 'mesa' ? '🍽 Mesa' : '📋 Retirada'}`,
        icon: '/favicon.ico',
        tag: 'novo-pedido',
        requireInteraction: true,
      } as any);
    }
  }, []);

  // Impressão automática da comanda quando o pedido cai no sistema.
  // Só no app instalado: lá o Electron imprime em silêncio (2 vias). No
  // navegador isso abriria a janela de impressão, então deixamos pro botão.
  const autoPrintOrder = useCallback(async (order: any) => {
    if (!settingsRef.current?.printerAuto) return;
    if (!order || order.source === 'pdv') return;
    if (order.status === 'cancelado') return;
    if (Number(order.printCount || 0) > 0) return;
    if (printingOrders.current.has(order.id)) return;
    if (typeof window === 'undefined' || !(window as any).rincao) return;

    printingOrders.current.add(order.id);
    try {
      const met = String(order.payment || '').split(',')[0].split(':')[0];
      // percentual que realmente foi cobrado (a taxa pode ter sido editada na mão)
      const pctCobrado = cardFeePctFromOrder(order);
      const feePct = pctCobrado > 0
        ? pctCobrado
        : met === 'credito'
          ? Number(settingsRef.current?.cardFeeCredit ?? 3.9)
          : met === 'debito' ? Number(settingsRef.current?.cardFeeDebit ?? 1.9) : 0;
      const cardFeeLabel = feePct > 0 ? `Taxa cartao ${String(feePct).replace('.', ',')}%` : 'Taxa cartao';
      const base = {
        store: 'Rincão Lanches', number: order.number, date: new Date(order.createdAt).toLocaleString('pt-BR'),
        customerName: order.customerName, customerPhone: order.customerPhone,
        items: (order.items || []).map((it: any) => {
          let addons: any[] = [];
          try { addons = JSON.parse(it.addonsJson || '[]'); } catch {}
          return { qty: it.qty, name: it.name, unitPrice: it.unitPrice, addons, note: it.note };
        }),
        payment: order.payment, subtotal: order.subtotal, fee: order.deliveryFee, discount: order.discount, total: order.total,
        cardFee: order.cardFee, cardFeeLabel,
        addressText: order.addressText, type: order.type, driverName: order.driver?.name,
        motoboy: (order.note || '').match(/Motoboy:\s*([^|]+)/)?.[1]?.trim(), changeFor: order.changeFor,
        note: order.note || '', width: '80mm' as const,
      };
      const comanda = receiptText(base);
      const pages = [comanda, comanda];
      // marca antes de imprimir: se o próximo poll chegar antes do banco
      // atualizar, não imprime de novo
      order.printCount = (Number(order.printCount) || 0) + 1;
      await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, printed: true }) }).catch(() => {});
      for (const p of pages) {
        await fetch('/api/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: p, printer: 'Padrao' }) }).catch(() => {});
      }
      printReceiptText(pages);
    } catch {}
  }, []);

  useEffect(() => {
    preloadSounds();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const check = async () => {
      try {
        const [ordersRaw, notifs, settings] = await Promise.all([
          // lista leve: o XML da nota e os itens só são buscados na hora de imprimir
          fetch('/api/orders?limit=10&light=1').then(r => r.json()),
          fetch('/api/notifications').then(r => r.json()).catch(() => []),
          fetch('/api/settings').then(r => r.json()).catch(() => null),
        ]);
        if (settings && !settings.error) settingsRef.current = settings;

        const orders = Array.isArray(ordersRaw) ? ordersRaw : [];
        const fresh = orders.filter((o: any) => !seenOrders.current.has(o.id));
        orders.forEach((o: any) => seenOrders.current.add(o.id));

        if (!ordersReady.current) {
          ordersReady.current = true;
        } else if (fresh.length) {
          const newest = fresh[0];
          playNotifSound();
          showBrowserNotif(newest);
          setNotif(newest);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setNotif(null), 6000);
        }

        // impressão automática: qualquer pedido recente que ainda não foi impresso
        // (inclui os que chegaram segundos antes do painel abrir). A lista vem
        // leve, então busca o pedido completo só quando realmente vai imprimir.
        orders
          .filter(() => !!settingsRef.current?.printerAuto)
          .filter((o: any) => new Date(o.createdAt).getTime() >= mountedAt.current - 20000)
          .filter((o: any) => o.source !== 'pdv' && o.status !== 'cancelado' && !(Number(o.printCount || 0) > 0))
          .filter((o: any) => !printingOrders.current.has(o.id))
          .forEach((o: any) => {
            fetch(`/api/orders?id=${encodeURIComponent(o.id)}`)
              .then((r) => r.json())
              .then((full) => { if (full && full.id) autoPrintOrder(full); })
              .catch(() => {});
          });
        // alerta vermelho de erro de NFC-e (novo e ainda não lido)
        const erros = (Array.isArray(notifs) ? notifs : []).filter((n: any) => n.kind === 'nfe_erro' && !n.read && !seenNotifs.current.has(n.id));
        if (erros.length) {
          erros.forEach((n: any) => seenNotifs.current.add(n.id));
          const maisRecente = erros[erros.length - 1];
          playNotifSound();
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('⚠️ Erro na nota fiscal', { body: maisRecente.text, icon: '/favicon.ico', tag: 'nfe-erro', requireInteraction: true } as any);
          }
          setNfeAlert(maisRecente.text + (erros.length > 1 ? ` (+${erros.length - 1} outro(s) erro(s))` : ''));
          if (nfeTimerRef.current) clearTimeout(nfeTimerRef.current);
          nfeTimerRef.current = setTimeout(() => setNfeAlert(null), 12000);
          fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', ids: erros.map((n: any) => n.id) }) }).catch(() => {});
        }
      } catch {}
    };
    check();
    const t = setInterval(check, 5000);
    return () => { clearInterval(t); if (timerRef.current) clearTimeout(timerRef.current); if (nfeTimerRef.current) clearTimeout(nfeTimerRef.current); };
  }, [playNotifSound, showBrowserNotif, autoPrintOrder]);

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0f0c14' }}>
      {/* Notificação popup */}
      {notif && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-slideDown" style={{ width: 'min(400px, 90vw)' }}>
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#1a1520', border: '1px solid rgba(225,29,72,0.4)', boxShadow: '0 10px 40px rgba(225,29,72,0.2), 0 0 20px rgba(225,29,72,0.1)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(225,29,72,0.15)' }}>
              <span className="text-lg">🔔</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold" style={{ color: '#e11d48' }}>NOVO PEDIDO #{notif.number}</p>
              <p className="text-[13px] font-bold text-white truncate">{notif.customerName}</p>
              <p className="text-[10px]" style={{ color: '#8a7a6a' }}>{notif.type === 'entrega' ? '🛵 Entrega' : notif.type === 'mesa' ? '🍽 Mesa' : '📋 Retirada'} · {new Date(notif.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <button onClick={() => setNotif(null)} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>
              <X size={12} />
            </button>
          </div>
        </div>
      )}
      {/* Popup vermelho — erro de NFC-e */}
      {nfeAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] animate-slideDown" style={{ width: 'min(440px, 92vw)' }}>
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#241016', border: '2px solid #ef4444', boxShadow: '0 10px 40px rgba(239,68,68,0.4), 0 0 24px rgba(239,68,68,0.25)' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.2)' }}>
              <span className="text-xl">🚨</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black" style={{ color: '#ef4444' }}>ERRO NA NOTA FISCAL (NFC-e)</p>
              <p className="text-[12px] text-white font-bold leading-snug break-words">{nfeAlert}</p>
              <p className="text-[10px] mt-1" style={{ color: '#8a7a6a' }}>Abra Pedidos → botão da NFC-e para tentar de novo</p>
            </div>
            <button onClick={() => setNfeAlert(null)} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>
              <X size={12} />
            </button>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col no-print shrink-0 h-screen sticky top-0"
        style={{
          width: collapsed ? '68px' : '240px',
          background: 'linear-gradient(180deg, #141018 0%, #0f0c14 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          transition: 'width 0.25s ease',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 h-14 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-[15px] font-black tracking-tight">
                <span style={{ color: '#f0e8e0' }}>Rincão </span>
                <span style={{ color: '#e11d48' }}>Gestor</span>
              </h1>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#6b7280' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#f0e8e0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#6b7280'; }}
          >
            <svg className="w-4 h-4" style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Link cardápio */}
        {!collapsed && (
          <a href="/cardapio" target="_blank" onClick={() => playMenuClick()} className="mx-3 mt-3 px-3 py-2 rounded-xl text-[11px] font-medium flex items-center gap-1.5 transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.03)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#f0e8e0'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}>
            <span className="text-xs">🔗</span>Ver cardápio do cliente
            <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        )}

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
          {visibleMenu.map(([label, href, icon]) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-xl transition-all duration-200 group"
                onClick={() => playMenuClick()}
                style={{
                  padding: collapsed ? '10px 0' : '9px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: active ? 'rgba(225,29,72,0.12)' : 'transparent',
                  border: active ? '1px solid rgba(225,29,72,0.2)' : '1px solid transparent',
                  color: active ? '#f0e8e0' : '#6b7280',
                  fontWeight: active ? 700 : 400,
                }}
                title={collapsed ? label : undefined}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#f0e8e0'; }}}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}}
              >
                <span className="text-base shrink-0" style={{ filter: active ? 'none' : 'grayscale(0.3)' }}>{icon}</span>
                {!collapsed && <span className="text-[13px] truncate">{label}</span>}
                {active && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#e11d48', boxShadow: '0 0 6px rgba(225,29,72,0.5)' }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-2.5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {!collapsed ? (
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200"
              style={{ color: '#6b7280' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}
              onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/admin/login'; }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sair
            </button>
          ) : (
            <button
              className="w-full flex items-center justify-center py-2.5 rounded-xl transition-all duration-200"
              style={{ color: '#6b7280' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}
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
        <div className="md:hidden text-white p-3 flex gap-2 overflow-x-auto no-print" style={{ background: '#141018', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {visibleMenu.map(([label, href]) => (
            <Link key={href} href={href} onClick={() => playMenuClick()} className="text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap transition-all duration-200"
              style={isActive(href)
                ? { background: 'rgba(225,29,72,0.12)', color: '#f0e8e0', border: '1px solid rgba(225,29,72,0.2)' }
                : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid transparent' }}>
              {label}
            </Link>
          ))}
        </div>
        <main className="p-4 md:p-6"><ErrorBoundary>{children}</ErrorBoundary></main>
      </div>
    </div>
  );
}
