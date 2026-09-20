import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Delivery areas stored in Setting table as JSON
// Format: { areas: [{ id, city, name, fee, active }] }

const DEFAULT_AREAS = [
  { id: 'liv-centro', city: 'Santana do Livramento', name: 'Centro', fee: 5, active: true },
  { id: 'liv-boavista', city: 'Santana do Livramento', name: 'Boa Vista', fee: 5, active: true },
  { id: 'liv-saojose', city: 'Santana do Livramento', name: 'Sao Jose', fee: 6, active: true },
  { id: 'liv-cidadealta', city: 'Santana do Livramento', name: 'Cidade Alta', fee: 6, active: true },
  { id: 'liv-liberdade', city: 'Santana do Livramento', name: 'Liberdade', fee: 7, active: true },
  { id: 'liv-jardimdosol', city: 'Santana do Livramento', name: 'Jardim do Sol', fee: 7, active: true },
  { id: 'liv-parqueindustrial', city: 'Santana do Livramento', name: 'Parque Industrial', fee: 8, active: true },
  { id: 'liv-vilanova', city: 'Santana do Livramento', name: 'Vila Nova', fee: 8, active: true },
  { id: 'liv-belavista', city: 'Santana do Livramento', name: 'Bela Vista', fee: 9, active: true },
  { id: 'liv-floresta', city: 'Santana do Livramento', name: 'Floresta', fee: 9, active: true },
  { id: 'liv-santoantonio', city: 'Santana do Livramento', name: 'Santo Antonio', fee: 10, active: true },
  { id: 'riv-centro', city: 'Rivera', name: 'Centro', fee: 8, active: true },
  { id: 'riv-paz', city: 'Rivera', name: 'Paz', fee: 8, active: true },
  { id: 'riv-santacruz', city: 'Rivera', name: 'Santa Cruz', fee: 9, active: true },
  { id: 'riv-monaco', city: 'Rivera', name: 'Monaco', fee: 10, active: true },
  { id: 'riv-mariaclara', city: 'Rivera', name: 'Maria Clara', fee: 10, active: true },
  { id: 'riv-floresta', city: 'Rivera', name: 'Floresta', fee: 12, active: true },
  { id: 'riv-interlagos', city: 'Rivera', name: 'Interlagos', fee: 12, active: true },
  { id: 'riv-saojorge', city: 'Rivera', name: 'Sao Jorge', fee: 14, active: true },
];

export async function GET() {
  let setting = await prisma.setting.findUnique({ where: { key: 'deliveryAreas' } });
  if (!setting) {
    await prisma.setting.create({ data: { key: 'deliveryAreas', value: JSON.stringify({ areas: DEFAULT_AREAS }) } });
    return NextResponse.json(DEFAULT_AREAS, { headers: { 'Cache-Control': 'no-store' } });
  }
  const data = JSON.parse(setting.value);
  return NextResponse.json(data.areas || [], { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const b = await req.json();
  const setting = await prisma.setting.findUnique({ where: { key: 'deliveryAreas' } });
  const data = setting ? JSON.parse(setting.value) : { areas: [] };
  const areas = data.areas || [];

  if (b.action === 'create') {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    areas.push({ id, city: b.city, name: b.name, fee: Number(b.fee || 0), active: true });
  } else if (b.action === 'update') {
    const idx = areas.findIndex((a: any) => a.id === b.id);
    if (idx >= 0) {
      areas[idx] = { ...areas[idx], city: b.city ?? areas[idx].city, name: b.name ?? areas[idx].name, fee: b.fee !== undefined ? Number(b.fee) : areas[idx].fee, active: b.active !== undefined ? b.active : areas[idx].active };
    }
  } else if (b.action === 'delete') {
    const idx = areas.findIndex((a: any) => a.id === b.id);
    if (idx >= 0) areas.splice(idx, 1);
  }

  await prisma.setting.upsert({ where: { key: 'deliveryAreas' }, update: { value: JSON.stringify({ areas }) }, create: { key: 'deliveryAreas', value: JSON.stringify({ areas }) } });
  return NextResponse.json(areas);
}
