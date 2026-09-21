'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { BRL, cashReceiptText, playCashSound } from '@/lib/utils';
import {
  DollarSign, Lock, Unlock, ArrowDownCircle, ArrowUpCircle, History,
  Smartphone, Banknote, CreditCard, AlertTriangle, CheckCircle2, X,
  TrendingUp, TrendingDown, Wallet, Receipt, ChevronDown, ChevronUp,
  Minus, Plus, Calculator, XCircle
} from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'pix', label: 'PIX', icon: Smartphone, color: '#22c55e' },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: '#f59e0b' },
  { id: 'debito', label: 'Débito', icon: CreditCard, color: '#3b82f6' },
  { id: 'credito', label: 'Crédito', icon: CreditCard, color: '#8b5cf6' },
];

const MOVEMENT_TYPES = [
  { id: 'sangria', label: 'Sangria', icon: Minus, color: '#ef4444', desc: 'Retirada de dinheiro do caixa' },
  { id: 'suprimento', label: 'Suprimento', icon: Plus, color: '#22c55e', desc: 'Adição de dinheiro ao caixa' },
];

function StatCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded-2xl p-4 pdv-hover transition-all duration-300" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#6b7280' }}>{label}</p>
          <p className="text-lg font-black text-white truncate">{value}</p>
          {sub && <p className="text-[10px] font-bold" style={{ color }}>{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function MovementItem({ m }: { m: any }) {
  const isVenda = m.kind === 'venda';
  const isSaida = ['sangria', 'saida'].includes(m.kind);
  const color = isVenda ? '#22c55e' : isSaida ? '#ef4444' : '#3b82f6';
  const Icon = isVenda ? TrendingUp : isSaida ? TrendingDown : ArrowDownCircle;
  const method = PAYMENT_METHODS.find((p) => p.id === m.method);
  const MethodIcon = method?.icon || Banknote;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 pdv-hover" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-white truncate">
          {m.kind === 'venda' ? `Pedido ${m.reason || ''}` : m.reason || m.kind}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <MethodIcon size={9} style={{ color: method?.color || '#9ca3af' }} />
          <span className="text-[10px] font-bold" style={{ color: '#6b7280' }}>{m.method}</span>
          <span className="text-[10px]" style={{ color: '#4b5563' }}>•</span>
          <span className="text-[10px]" style={{ color: '#6b7280' }}>{new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <span className="text-xs font-black" style={{ color }}>{isSaida ? '-' : '+'}{BRL(m.amount)}</span>
    </div>
  );
}

function CloseModal({ data, driverTotal, onClose, onConfirm, onEndTurno }: { data: any; driverTotal: number; onClose: () => void; onConfirm: (informed: number) => void; onEndTurno: (informed: number) => void }) {
  const [informed, setInformed] = useState(0);

  const byMethod = useMemo(() => {
    const m: Record<string, number> = {};
    data.open.movements.filter((x: any) => x.kind === 'venda').forEach((x: any) => { m[x.method] = (m[x.method] || 0) + x.amount; });
    return m;
  }, [data]);

  const totals = useMemo(() => {
    const vendas = data.open.movements.filter((m: any) => m.kind === 'venda').reduce((s: number, m: any) => s + m.amount, 0);
    const entradas = data.open.movements.filter((m: any) => ['entrada', 'suprimento'].includes(m.kind)).reduce((s: number, m: any) => s + m.amount, 0);
    const saidas = data.open.movements.filter((m: any) => ['sangria', 'saida'].includes(m.kind)).reduce((s: number, m: any) => s + m.amount, 0);
    const expected = data.open.initial + entradas + vendas - saidas;
    return { vendas, entradas, saidas, expected };
  }, [data]);

  const diff = informed - totals.expected;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(225,29,72,0.15)' }}>
              <Lock size={14} className="text-rose-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Fechar Caixa</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"><X size={16} className="text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-2">Resumo do caixa</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-gray-400">Valor inicial</span><span className="text-white font-bold">{BRL(data.open.initial)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-400">Vendas</span><span className="text-green-400 font-bold">+{BRL(totals.vendas)}</span></div>
              {totals.entradas > 0 && <div className="flex justify-between text-xs"><span className="text-gray-400">Suprimentos</span><span className="text-blue-400 font-bold">+{BRL(totals.entradas)}</span></div>}
              {totals.saidas > 0 && <div className="flex justify-between text-xs"><span className="text-gray-400">Sangrias</span><span className="text-red-400 font-bold">-{BRL(totals.saidas)}</span></div>}
              {driverTotal > 0 && <div className="flex justify-between text-xs"><span className="text-gray-400">Motoboys (taxas entrega)</span><span className="text-amber-400 font-bold">-{BRL(driverTotal)}</span></div>}
              <div className="flex justify-between text-xs pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-gray-300 font-bold">Esperado</span><span className="text-white font-black">{BRL(totals.expected)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-2">Por forma de pagamento</p>
            <div className="space-y-1.5">
              {PAYMENT_METHODS.map((p) => {
                const Icon = p.icon;
                const val = byMethod[p.id] || 0;
                if (val === 0) return null;
                return (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={12} style={{ color: p.color }} />
                      <span className="text-xs text-gray-400">{p.label}</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: p.color }}>{BRL(val)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-2">Valor informado (dinheiro)</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">R$</span>
              <input type="number" value={informed || ''} onChange={(e) => setInformed(Number(e.target.value))}
                placeholder="0,00" className="w-full pl-10 pr-3 py-3 rounded-xl text-sm font-bold outline-none transition-all duration-200 focus:border-rose-500/50"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
            </div>
            {informed > 0 && (
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-xs text-gray-400">Diferença</span>
                <span className={`text-sm font-black ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {diff >= 0 ? '+' : ''}{BRL(diff)}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Cancelar</button>
            <button disabled={informed <= 0} onClick={() => onConfirm(informed)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white pdv-btn-hover disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', boxShadow: '0 4px 20px rgba(225,29,72,0.3)' }}>
              Fechar caixa
            </button>
            <button disabled={informed <= 0} onClick={() => onEndTurno(informed)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white pdv-btn-hover disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 20px rgba(245,158,11,0.3)' }}>
              🔄 Encerrar turno
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ expected, informed, diff, driverTotal, onClose, onPrint }: { expected: number; informed: number; diff: number; driverTotal: number; onClose: () => void; onPrint: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6 text-center" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: diff >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }}>
          {diff >= 0 ? <CheckCircle2 size={28} className="text-green-400" /> : <AlertTriangle size={28} className="text-red-400" />}
        </div>
        <h3 className="text-base font-black text-white mb-1">{diff >= 0 ? 'Caixa fechado!' : 'Caixa fechado com diferença'}</h3>
        <p className="text-xs text-gray-400 mb-4">{diff >= 0 ? 'Sobra de caixa' : 'Falta no caixa'} de <span className={`font-black ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>{BRL(Math.abs(diff))}</span></p>
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-xs px-2"><span className="text-gray-400">Esperado</span><span className="text-white font-bold">{BRL(expected)}</span></div>
          <div className="flex justify-between text-xs px-2"><span className="text-gray-400">Informado</span><span className="text-white font-bold">{BRL(informed)}</span></div>
          {driverTotal > 0 && <div className="flex justify-between text-xs px-2"><span className="text-gray-400">Motoboys</span><span className="text-amber-400 font-bold">-{BRL(driverTotal)}</span></div>}
        </div>
        <div className="flex gap-2">
          <button onClick={onPrint}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold pdv-btn-hover"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
            🖨 Imprimir
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default function Caixa() {
  const [data, setData] = useState<any>(null);
  const [op, setOp] = useState('');
  const [initial, setInitial] = useState(100);
  const [movType, setMovType] = useState('sangria');
  const [movMethod, setMovMethod] = useState('dinheiro');
  const [movAmount, setMovAmount] = useState(0);
  const [movReason, setMovReason] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeResult, setCloseResult] = useState<any>(null);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [driverTotal, setDriverTotal] = useState(0);
  const [driverBreakdown, setDriverBreakdown] = useState<{ id: string; name: string; total: number; paid: number; remaining: number; phone?: string }[]>([]);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [payingDriver, setPayingDriver] = useState<{ id: string; name: string; total: number } | null>(null);
  const [turnoOrderNumbers, setTurnoOrderNumbers] = useState<number[]>([]);

  const load = useCallback(async () => {
    const [d, orders, drivers] = await Promise.all([
      fetch('/api/cash').then((r) => r.json()),
      fetch('/api/orders?limit=500').then((r) => r.json()),
      fetch('/api/drivers').then((r) => r.json()),
    ]);
    setData(d);
    const turnoId = String(d.turno || '1');
    const turnoOrders = orders.filter((o: any) => (o.turnoId || '1') === turnoId);
    setTurnoOrderNumbers(turnoOrders.map((o: any) => o.number).sort((a: number, b: number) => a - b));
    const delivered = turnoOrders.filter((o: any) => o.type === 'entrega' && o.status === 'concluido' && o.driverId);
    const total = delivered.reduce((s: number, o: any) => s + (o.deliveryFee || 0), 0);
    setDriverTotal(total);
    const byDriver: Record<string, number> = {};
    delivered.forEach((o: any) => { byDriver[o.driverId] = (byDriver[o.driverId] || 0) + (o.deliveryFee || 0); });
    const paidDrivers: Record<string, number> = {};
    (d.open?.movements || []).filter((m: any) => m.kind === 'sangria' && m.reason?.startsWith('Pagamento motoboy')).forEach((m: any) => {
      const match = m.reason.match(/\((.+)\)/);
      if (match) paidDrivers[match[1]] = (paidDrivers[match[1]] || 0) + m.amount;
    });
    const breakdown = Object.entries(byDriver).map(([id, t]) => {
      const drv = (drivers as any[]).find((d: any) => d.id === id);
      const name = drv?.name || 'Desconhecido';
      const paid = paidDrivers[name] || 0;
      return { id, name, total: t, paid, remaining: Math.max(0, t - paid), phone: drv?.phone };
    });
    setDriverBreakdown(breakdown);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5 flex items-center justify-center" style={{ background: '#1a1520' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-gray-500">Carregando caixa...</p>
      </div>
    </div>
  );

  const byMethod: Record<string, number> = {};
  if (data.open) {
    data.open.movements.filter((x: any) => x.kind === 'venda').forEach((x: any) => {
      if (x.method?.includes(',')) {
        x.method.split(',').forEach((part: string) => {
          const [method, amount] = part.split(':');
          byMethod[method] = (byMethod[method] || 0) + Number(amount);
        });
      } else {
        byMethod[x.method] = (byMethod[x.method] || 0) + x.amount;
      }
    });
  }

  const totals = (() => {
    if (!data.open) return { vendas: 0, entradas: 0, saidas: 0, expected: 0 };
    const vendas = data.open.movements.filter((m: any) => m.kind === 'venda').reduce((s: number, m: any) => s + m.amount, 0);
    const entradas = data.open.movements.filter((m: any) => ['entrada', 'suprimento'].includes(m.kind)).reduce((s: number, m: any) => s + m.amount, 0);
    const saidas = data.open.movements.filter((m: any) => ['sangria', 'saida'].includes(m.kind)).reduce((s: number, m: any) => s + m.amount, 0);
    const expected = data.open.initial + entradas + vendas - saidas;
    return { vendas, entradas, saidas, expected };
  })();

  const printClose = (h: any) => {
    const vendas = h.movements.filter((m: any) => m.kind === 'venda').reduce((s: number, m: any) => s + m.amount, 0);
    const entradas = h.movements.filter((m: any) => ['entrada', 'suprimento'].includes(m.kind)).reduce((s: number, m: any) => s + m.amount, 0);
    const saidas = h.movements.filter((m: any) => ['sangria', 'saida'].includes(m.kind)).reduce((s: number, m: any) => s + m.amount, 0);
    const expected = (h.initial || 0) + entradas + vendas - saidas;
    const informed = h.informed || expected;
    const byMethod: Record<string, number> = {};
    h.movements.filter((x: any) => x.kind === 'venda').forEach((x: any) => {
      if (x.method?.includes(',')) {
        x.method.split(',').forEach((part: string) => {
          const [method, amount] = part.split(':');
          byMethod[method] = (byMethod[method] || 0) + Number(amount);
        });
      } else {
        byMethod[x.method] = (byMethod[x.method] || 0) + x.amount;
      }
    });
    const text = cashReceiptText({
      store: 'Rincão Lanches', operator: h.operator,
      openedAt: new Date(h.openedAt).toLocaleString('pt-BR'),
      closedAt: h.closedAt ? new Date(h.closedAt).toLocaleString('pt-BR') : '—',
      initial: h.initial || 0, vendas, entradas, saidas, expected, informed, diff: informed - expected,
      byMethod, width: '80mm', driverTotal: h.driverTotal || 0,
      orderNumbers: turnoOrderNumbers, driverBreakdown: driverBreakdown,
    });
    fetch('/api/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, printer: 'Padrao' }) });
    const w = window.open('', '_blank', 'width=320');
    w?.document.write(`<pre class="receipt">${text}</pre><script>window.print()</script>`);
  };

  const openCash = async () => {
    if (!op.trim()) return;
    await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', operator: op.trim(), initial }) });
    playCashSound();
    load();
  };

  const addMovement = async () => {
    if (movAmount <= 0) return;
    await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'movement', kind: movType, method: movMethod, amount: movAmount, reason: movReason }) });
    setMovAmount(0);
    setMovReason('');
    load();
  };

  const closeCash = async (informed: number) => {
    const openData = data.open;
    const currentDriverTotal = driverTotal;
    const r = await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close', informed }) }).then((x) => x.json());
    playCashSound();
    setShowCloseModal(false);
    setCloseResult({ ...openData, closedAt: new Date().toISOString(), expected: r.expected, informed: r.informed, diff: r.diff, driverTotal: currentDriverTotal });
    await load();
  };

  const endTurno = async (informed: number) => {
    const openData = data.open;
    const currentDriverTotal = driverTotal;
    await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close', informed }) });
    await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'new_turno' }) });
    playCashSound();
    setShowCloseModal(false);
    setDriverTotal(0);
    setDriverBreakdown([]);
    setCloseResult({ ...openData, closedAt: new Date().toISOString(), expected: 0, informed, diff: informed - (openData.initial || 0), driverTotal: currentDriverTotal });
    await load();
  };

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <Wallet size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Caixa</h1>
            <p className="text-[10px] text-gray-500">
              {data.open ? `Aberto por ${data.open.operator}` : 'Nenhum caixa aberto'}
            </p>
          </div>
        </div>
        {data.open && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-green-400">ABERTO</span>
          </div>
        )}
      </div>

      {!data.open ? (
        <div className="max-w-md mx-auto mt-8">
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(225,29,72,0.15), rgba(190,18,60,0.15))', border: '1px solid rgba(225,29,72,0.2)' }}>
                <Lock size={24} className="text-rose-400" />
              </div>
              <h2 className="text-sm font-bold text-white mb-1">Abertura de Caixa</h2>
              <p className="text-[11px] text-gray-500">Preencha os dados para abrir o caixa</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1 block">Operador</label>
                <input value={op} onChange={(e) => setOp(e.target.value)} placeholder="Nome do operador"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 hover:border-white/20 focus:border-rose-500/50"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1 block">Valor inicial (troco)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">R$</span>
                  <input type="number" value={initial} onChange={(e) => setInitial(Number(e.target.value))}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm font-bold outline-none transition-all duration-200 focus:border-rose-500/50"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
                </div>
              </div>
              <button disabled={!op.trim()} onClick={openCash}
                className="w-full py-3 rounded-xl text-sm font-bold text-white pdv-btn-hover disabled:opacity-30 mt-1"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}>
                Abrir caixa
              </button>
            </div>
          </div>

          {data.history.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <History size={14} className="text-gray-500" />
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Histórico</h2>
              </div>
              <div className="space-y-2">
                {data.history.map((h: any) => {
                  const isOpen = h.status === 'aberto';
                  const vendas = h.movements.filter((m: any) => m.kind === 'venda').reduce((s: number, m: any) => s + m.amount, 0);
                  const entradas = h.movements.filter((m: any) => ['entrada', 'suprimento'].includes(m.kind)).reduce((s: number, m: any) => s + m.amount, 0);
                  const saidas = h.movements.filter((m: any) => ['sangria', 'saida'].includes(m.kind)).reduce((s: number, m: any) => s + m.amount, 0);
                  const expected = (h.initial || 0) + entradas + vendas - saidas;
                  const informed = h.informed || expected;
                  const diff = informed - expected;
                  const isExpanded = historyOpen === h.id;
                  const byMethodH: Record<string, number> = {};
                  h.movements.filter((x: any) => x.kind === 'venda').forEach((x: any) => {
                    if (x.method?.includes(',')) {
                      x.method.split(',').forEach((part: string) => {
                        const [method, amount] = part.split(':');
                        byMethodH[method] = (byMethodH[method] || 0) + Number(amount);
                      });
                    } else {
                      byMethodH[x.method] = (byMethodH[x.method] || 0) + x.amount;
                    }
                  });

                  return (
                    <div key={h.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer pdv-hover" onClick={() => setHistoryOpen(isExpanded ? null : h.id)}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                          <span className="text-xs font-bold text-white">{h.operator}</span>
                          <span className="text-[10px] text-gray-500">• {new Date(h.openedAt).toLocaleString('pt-BR')}</span>
                          {!isOpen && h.closedAt && <span className="text-[10px] text-gray-600">→ {new Date(h.closedAt).toLocaleString('pt-BR')}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{BRL(vendas)}</span>
                          {isExpanded ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <div className="pt-2 grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                              <p className="text-gray-500 font-bold">Inicial</p><p className="text-white font-black">{BRL(h.initial || 0)}</p>
                            </div>
                            <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                              <p className="text-gray-500 font-bold">Vendas</p><p className="text-green-400 font-black">{BRL(vendas)}</p>
                            </div>
                            {entradas > 0 && <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                              <p className="text-gray-500 font-bold">Suprimentos</p><p className="text-blue-400 font-black">{BRL(entradas)}</p>
                            </div>}
                            {saidas > 0 && <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                              <p className="text-gray-500 font-bold">Sangrias</p><p className="text-red-400 font-black">{BRL(saidas)}</p>
                            </div>}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {PAYMENT_METHODS.map((p) => {
                              const val = byMethodH[p.id] || 0;
                              if (val === 0) return null;
                              const Icon = p.icon;
                              return (
                                <span key={p.id} className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${p.color}15`, color: p.color }}>
                                  <Icon size={8} />{p.label}: {BRL(val)}
                                </span>
                              );
                            })}
                          </div>
                          {!isOpen && (
                            <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className="text-gray-400">Esperado: <span className="text-white font-bold">{BRL(expected)}</span></span>
                                <span className="text-gray-400">Informado: <span className="text-white font-bold">{BRL(informed)}</span></span>
                                <span className={`font-bold ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>{diff >= 0 ? 'Sobra' : 'Falta'} {BRL(Math.abs(diff))}</span>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); printClose(h); }} className="px-2 py-1 rounded-lg text-[10px] font-bold pdv-hover" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
                                🖨 Imprimir
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatCard icon={Wallet} label="Saldo atual" value={BRL(totals.expected)} color="#22c55e" sub={`Inicial ${BRL(data.open.initial)}`} />
            <StatCard icon={TrendingUp} label="Vendas" value={BRL(totals.vendas)} color="#3b82f6" />
            <StatCard icon={ArrowDownCircle} label="Suprimentos" value={BRL(totals.entradas)} color="#8b5cf6" sub={`${data.open.movements.filter((m: any) => m.kind === 'suprimento').length} registro(s)`} />
            <StatCard icon={ArrowUpCircle} label="Sangrias" value={BRL(totals.saidas)} color="#ef4444" sub={`${data.open.movements.filter((m: any) => m.kind === 'sangria').length} registro(s)`} />
            {driverTotal > 0 && (
              <button onClick={() => setShowDriverModal(true)} className="text-left rounded-2xl p-4 pdv-hover transition-all duration-300" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f59e0b15', border: '1px solid #f59e0b30' }}>
                    <Receipt size={18} style={{ color: '#f59e0b' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#6b7280' }}>Motoboys</p>
                    <p className="text-lg font-black text-white truncate">{BRL(driverTotal)}</p>
                    <p className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>Toque para pagar</p>
                  </div>
                </div>
              </button>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-3 mb-5">
            <div className="lg:col-span-2 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-3">Vendas por pagamento</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {PAYMENT_METHODS.map((p) => {
                  const Icon = p.icon;
                  const val = byMethod[p.id] || 0;
                  return (
                    <div key={p.id} className="rounded-xl p-3 text-center" style={{ background: `${p.color}08`, border: `1px solid ${p.color}20` }}>
                      <Icon size={18} className="mx-auto mb-1.5" style={{ color: p.color }} />
                      <p className="text-[10px] font-bold text-gray-400">{p.label}</p>
                      <p className="text-sm font-black" style={{ color: p.color }}>{BRL(val)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-3">Registrar movimentação</p>
              <div className="flex gap-1.5 mb-3">
                {MOVEMENT_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} onClick={() => setMovType(t.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold pdv-btn-hover transition-all"
                      style={movType === t.id
                        ? { background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}40` }
                        : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Icon size={12} />{t.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1.5 mb-3">
                {PAYMENT_METHODS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button key={p.id} onClick={() => setMovMethod(p.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-bold pdv-btn-hover transition-all"
                      style={movMethod === p.id
                        ? { background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}30` }
                        : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Icon size={9} />{p.label}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">R$</span>
                  <input type="number" value={movAmount || ''} onChange={(e) => setMovAmount(Number(e.target.value))} placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold outline-none transition-all duration-200 focus:border-rose-500/50"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
                </div>
                <input value={movReason} onChange={(e) => setMovReason(e.target.value)} placeholder="Motivo"
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none transition-all duration-200 focus:border-rose-500/50"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
                <button disabled={movAmount <= 0} onClick={addMovement}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white pdv-btn-hover disabled:opacity-30"
                  style={{ background: movType === 'sangria' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                  {movType === 'sangria' ? 'Registrar sangria' : 'Registrar suprimento'}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Movimentações</p>
              <span className="text-[10px] font-bold text-gray-600">{data.open.movements.length} registro(s)</span>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-hide">
              {data.open.movements.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-6">Nenhuma movimentação ainda</p>
              )}
              {[...data.open.movements].reverse().map((m: any) => (
                <MovementItem key={m.id} m={m} />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={async () => {
              const now = new Date();
              const text = cashReceiptText({
                store: 'Rincão Lanches', operator: data.open.operator,
                openedAt: new Date(data.open.openedAt).toLocaleString('pt-BR'),
                closedAt: now.toLocaleString('pt-BR'),
                initial: data.open.initial, vendas: totals.vendas, entradas: totals.entradas,
                saidas: totals.saidas, expected: totals.expected, informed: totals.expected, diff: 0,
                byMethod, width: '80mm', orderNumbers: turnoOrderNumbers, driverBreakdown,
              });
              await fetch('/api/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, printer: 'Padrao' }) });
              const w = window.open('', '_blank', 'width=320');
              w?.document.write(`<pre class="receipt">${text}</pre><script>window.print()</script>`);
            }}
              className="flex-1 py-3 rounded-xl text-xs font-bold pdv-btn-hover"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
              🖨 Imprimir resumo
            </button>
            <button onClick={() => setShowCloseModal(true)}
              className="flex-1 py-3 rounded-xl text-xs font-bold text-white pdv-btn-hover"
              style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', boxShadow: '0 4px 20px rgba(225,29,72,0.3)' }}>
              Fechar caixa
            </button>
          </div>
        </>
      )}

      {showCloseModal && <CloseModal data={data} driverTotal={driverTotal} onClose={() => setShowCloseModal(false)} onConfirm={closeCash} onEndTurno={endTurno} />}
      {closeResult && <SuccessModal expected={closeResult.expected} informed={closeResult.informed} diff={closeResult.diff} driverTotal={driverTotal} onClose={() => setCloseResult(null)} onPrint={() => { printClose(closeResult); setCloseResult(null); }} />}

      {/* Modal Motoboys */}
      {showDriverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setShowDriverModal(false)}>
          <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: '#1a1520', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-base" style={{ color: '#f0e8e0' }}>🛵 Motoboys</h3>
                <p className="text-[11px] mt-0.5" style={{ color: '#8a7a6a' }}>Total a pagar: {BRL(driverTotal)}</p>
              </div>
              <button onClick={() => setShowDriverModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {driverBreakdown.length === 0 && (
                <p className="text-center text-[11px] py-4 text-gray-500">Nenhum motoboy com entregas</p>
              )}
              {driverBreakdown.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: '#f59e0b15', color: '#f59e0b' }}>{d.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-white">{d.name}</p>
                    {d.phone && <p className="text-[10px] text-gray-400">{d.phone}</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>{BRL(d.total)} total</span>
                      {d.paid > 0 && (
                        <span className="text-[10px] font-bold" style={{ color: '#22c55e' }}>· {BRL(d.paid)} pago</span>
                      )}
                      {d.remaining > 0 && d.paid > 0 && (
                        <span className="text-[10px] font-bold" style={{ color: '#ef4444' }}>· falta {BRL(d.remaining)}</span>
                      )}
                    </div>
                  </div>
                  {d.remaining > 0 ? (
                    <button onClick={() => setPayingDriver({ id: d.id, name: d.name, total: d.remaining })} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all hover:brightness-110 active:scale-95" style={{ background: '#ef4444' }}>
                      Pagar
                    </button>
                  ) : (
                    <div className="px-3 py-1.5 rounded-lg text-[10px] font-bold" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                      ✅ Pago
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setShowDriverModal(false)} className="w-full rounded-xl py-2.5 text-[11px] font-bold transition-all hover:scale-[1.02]" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>Fechar</button>
          </div>
        </div>
      )}

      {/* Modal Confirmar Pagamento Motoboy */}
      {payingDriver && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setPayingDriver(null)}>
          <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: '#1a1520', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }} onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <span className="text-2xl">🛵</span>
              </div>
              <h3 className="font-black text-lg text-white">Habilitar sangria</h3>
              <p className="text-[12px] mt-1" style={{ color: '#8a7a6a' }}>Pagar {payingDriver.name} — {BRL(payingDriver.total)}</p>
            </div>
            <div className="space-y-1.5 mb-5">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <span className="text-sm">💸</span>
                <span className="text-[11px] font-bold" style={{ color: '#ef4444' }}>Pagamento motoboy ({payingDriver.name})</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <span className="text-sm">💵</span>
                <span className="text-[11px] font-bold" style={{ color: '#f59e0b' }}>Sangria de {BRL(payingDriver.total)} em dinheiro</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPayingDriver(null)} className="flex-1 rounded-xl py-3 text-[12px] font-bold transition-all hover:scale-[1.02]" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>Cancelar</button>
              <button onClick={async () => {
                await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'movement', kind: 'sangria', method: 'dinheiro', amount: payingDriver.total, reason: `Pagamento motoboy (${payingDriver.name})` }) });
                setPayingDriver(null);
                setShowDriverModal(false);
                load();
              }} className="flex-1 rounded-xl py-3 text-[12px] font-bold text-white transition-all hover:brightness-110 active:scale-95" style={{ background: '#ef4444' }}>
                ✅ Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
