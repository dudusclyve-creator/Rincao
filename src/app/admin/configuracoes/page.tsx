'use client';
import { useEffect, useState } from 'react';
export default function Config() {
  const [r, setR] = useState<any>(null);
  useEffect(() => { fetch('/api/settings').then((x) => x.json()).then(setR); }, []);
  if (!r) return <p>Carregando…</p>;
  const set = (k: string, v: any) => setR({ ...r, [k]: v });
  const save = async () => {
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
    alert('Configurações salvas!');
  };
  return (
    <div className="max-w-3xl"><h1 className="text-2xl font-black">Configurações</h1>
      <div className="card p-4 mt-3 grid md:grid-cols-2 gap-2">
        <label className="text-xs">Nome<input className="input" value={r.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="text-xs">WhatsApp<input className="input" value={r.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></label>
        <label className="text-xs md:col-span-2">Endereço<input className="input" value={r.address} onChange={(e) => set('address', e.target.value)} /></label>
        <label className="text-xs">Telefone<input className="input" value={r.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        <label className="text-xs">Chave Pix<input className="input" value={r.pixKey} onChange={(e) => set('pixKey', e.target.value)} /></label>
        <label className="text-xs">Taxa de entrega<input className="input" type="number" value={r.deliveryFee} onChange={(e) => set('deliveryFee', Number(e.target.value))} /></label>
        <label className="text-xs">Pedido mínimo<input className="input" type="number" value={r.minOrder} onChange={(e) => set('minOrder', Number(e.target.value))} /></label>
        <label className="text-xs">Tempo preparo (min)<input className="input" type="number" value={r.prepTimeMin} onChange={(e) => set('prepTimeMin', Number(e.target.value))} /></label>
        <label className="text-xs">Banner URL<input className="input" value={r.bannerUrl || ''} onChange={(e) => set('bannerUrl', e.target.value)} /></label>
        <label className="text-xs">Abertura manual<select className="input" value={r.isOpenManual === null ? '' : String(r.isOpenManual)} onChange={(e) => set('isOpenManual', e.target.value === '' ? null : e.target.value === 'true')}><option value="">Automático (horário)</option><option value="true">Aberto manual</option><option value="false">Fechado temporariamente</option></select></label>
        <label className="text-xs">Impressora padrão<input className="input" value={r.printerName || ''} onChange={(e) => set('printerName', e.target.value)} /></label>
        <label className="text-xs">Largura<select className="input" value={r.printerWidth} onChange={(e) => set('printerWidth', e.target.value)}><option value="58mm">58mm</option><option value="80mm">80mm</option></select></label>
        <label className="text-xs flex items-center gap-2 mt-5"><input type="checkbox" checked={!!r.printerAuto} onChange={(e) => set('printerAuto', e.target.checked)} /> Impressão automática ao receber pedido</label>
      </div>
      <button className="btn-primary mt-3" onClick={save}>Salvar tudo</button>
      <div className="card p-4 mt-3 text-sm">
        <b>QR Code do cardápio</b>
        <p className="text-xs text-stone-500">Aponte para: {typeof window !== 'undefined' ? `${location.origin}/cardapio` : '/cardapio'}</p>
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(typeof window !== 'undefined' ? `${location.origin}/cardapio` : '')}`} alt="QR" className="mt-2" />
        <button className="btn-ghost mt-2" onClick={() => window.print()}>Baixar / Imprimir QR</button>
      </div>
    </div>
  );
}
