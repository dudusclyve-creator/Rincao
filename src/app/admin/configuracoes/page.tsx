'use client';
import { useEffect, useState } from 'react';
import { Settings, Save, Clock, MapPin, Phone, Printer, QrCode, Truck, Store, Globe, Power } from 'lucide-react';

const DAYS = [
  { key: 'dom', label: 'Dom' }, { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' }, { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' },
];

export default function Config() {
  const [r, setR] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetch('/api/settings').then((x) => x.json()).then(setR); }, []);

  const set = (k: string, v: any) => setR({ ...r, [k]: v });

  const parseHours = () => {
    try { return JSON.parse(r.hoursJson || '{}'); } catch { return {}; }
  };

  const setHour = (day: string, ranges: string[]) => {
    const h = parseHours();
    h[day] = ranges;
    set('hoursJson', JSON.stringify(h));
  };

  const addRange = (day: string) => {
    const h = parseHours();
    const cur = h[day] || [];
    h[day] = [...cur, '09:00-12:00'];
    set('hoursJson', JSON.stringify(h));
  };

  const removeRange = (day: string, idx: number) => {
    const h = parseHours();
    h[day] = (h[day] || []).filter((_: string, i: number) => i !== idx);
    set('hoursJson', JSON.stringify(h));
  };

  const updateRange = (day: string, idx: number, val: string) => {
    const h = parseHours();
    h[day] = (h[day] || []).map((r: string, i: number) => i === idx ? val : r);
    set('hoursJson', JSON.stringify(h));
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  if (!r) return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520' }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}><Settings size={18} className="text-white" /></div>
        <div><h1 className="text-lg font-black text-white">Configurações</h1><p className="text-[10px] text-gray-500">Carregando...</p></div>
      </div>
    </div>
  );

  const hours = parseHours();

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <Settings size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Configurações</h1>
            <p className="text-[10px] text-gray-500">Dados do restaurante e preferências</p>
          </div>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200 disabled:opacity-50"
          style={{ background: saved ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg, #e11d48, #be123c)', color: saved ? '#22c55e' : '#fff', boxShadow: saved ? 'none' : '0 4px 16px rgba(225,29,72,0.3)' }}>
          {saving ? 'Salvando...' : saved ? '✓ Salvo!' : <><Save size={14} /> Salvar</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dados do Restaurante */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Store size={14} className="text-rose-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400/60">Restaurante</p>
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Nome</label>
            <input className="input w-full" value={r.name || ''} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">WhatsApp</label>
              <input className="input w-full" value={r.whatsapp || ''} onChange={(e) => set('whatsapp', e.target.value)} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Telefone</label>
              <input className="input w-full" value={r.phone || ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Endereço</label>
            <input className="input w-full" value={r.address || ''} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Chave Pix</label>
            <input className="input w-full" value={r.pixKey || ''} onChange={(e) => set('pixKey', e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Banner URL</label>
            <input className="input w-full" value={r.bannerUrl || ''} onChange={(e) => set('bannerUrl', e.target.value)} />
          </div>
        </div>

        {/* Delivery & Pedido */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Truck size={14} className="text-green-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-green-400/60">Delivery & Pedido</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Taxa de entrega (R$)</label>
              <input className="input w-full" type="number" step="0.50" value={r.deliveryFee || ''} onChange={(e) => set('deliveryFee', Number(e.target.value))} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Pedido mínimo (R$)</label>
              <input className="input w-full" type="number" step="0.50" value={r.minOrder || ''} onChange={(e) => set('minOrder', Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Tempo de preparo (min)</label>
            <input className="input w-full" type="number" value={r.prepTimeMin || ''} onChange={(e) => set('prepTimeMin', Number(e.target.value))} />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Status manual</label>
            <div className="flex gap-1">
              {[
                { v: '', label: 'Automático', icon: '⏰' },
                { v: 'true', label: 'Aberto', icon: '🟢' },
                { v: 'false', label: 'Fechado', icon: '🔴' },
              ].map(({ v, label, icon }) => (
                <button key={v} onClick={() => set('isOpenManual', v === '' ? null : v === 'true')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition-all"
                  style={{
                    background: (r.isOpenManual === null ? v === '' : String(r.isOpenManual) === v) ? 'rgba(225,29,72,0.12)' : 'rgba(255,255,255,0.03)',
                    color: (r.isOpenManual === null ? v === '' : String(r.isOpenManual) === v) ? '#f0e8e0' : '#6b7280',
                    border: (r.isOpenManual === null ? v === '' : String(r.isOpenManual) === v) ? '1px solid rgba(225,29,72,0.2)' : '1px solid transparent',
                  }}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Horário de Funcionamento */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-blue-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/60">Horário de Funcionamento</p>
          </div>
          {DAYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400 w-8">{label}</span>
              <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                {(hours[key] || []).map((range: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input className="input py-1 w-20 text-center text-[10px]" value={range.split('-')[0] || ''}
                      onChange={(e) => updateRange(key, idx, `${e.target.value}-${range.split('-')[1] || ''}`)} placeholder="09:00" />
                    <span className="text-[10px] text-gray-600">-</span>
                    <input className="input py-1 w-20 text-center text-[10px]" value={range.split('-')[1] || ''}
                      onChange={(e) => updateRange(key, idx, `${range.split('-')[0] || ''}-${e.target.value}`)} placeholder="18:00" />
                    <button onClick={() => removeRange(key, idx)} className="text-[10px] text-red-500 hover:text-red-400 px-0.5">✕</button>
                  </div>
                ))}
                <button onClick={() => addRange(key)} className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)' }}>+</button>
              </div>
            </div>
          ))}
          <p className="text-[9px] text-gray-600 mt-2">Deixe vazio para dia sem funcionamento. Horários que cruzam a meia-noite funcionam (ex: 22:00-02:00).</p>
        </div>

        {/* Impressora */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Printer size={14} className="text-purple-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400/60">Impressora</p>
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Nome da impressora</label>
            <input className="input w-full" value={r.printerName || ''} onChange={(e) => set('printerName', e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Largura</label>
            <div className="flex gap-1">
              {['58mm', '80mm'].map((w) => (
                <button key={w} onClick={() => set('printerWidth', w)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-bold transition-all"
                  style={{
                    background: r.printerWidth === w ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
                    color: r.printerWidth === w ? '#a855f7' : '#6b7280',
                    border: r.printerWidth === w ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
                  }}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!r.printerAuto} onChange={(e) => set('printerAuto', e.target.checked)}
              className="w-4 h-4 rounded" style={{ accentColor: '#e11d48' }} />
            <span className="text-[11px] text-gray-400">Impressão automática ao receber pedido</span>
          </label>
        </div>
      </div>

      {/* QR Code */}
      <div className="rounded-xl p-4 mt-4 flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.12)' }}>
          <QrCode size={18} className="text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-bold text-white">QR Code do Cardápio</p>
          <p className="text-[10px] text-gray-500">{typeof window !== 'undefined' ? `${location.origin}/cardapio` : '/cardapio'}</p>
        </div>
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(typeof window !== 'undefined' ? `${location.origin}/cardapio` : '')}`} alt="QR" className="rounded-lg" />
      </div>
    </div>
  );
}
