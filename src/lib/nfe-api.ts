import { prisma } from '@/lib/db';
import { cancelar, statusServico, amb } from '@/lib/nfe';
import { emitirPedido } from '@/lib/nfe-order';

// Logica unica da NFC-e (usada pelo /api/nfe e pelo /api/nfe-remote).
// O app portatil nao tem o certificado no .env: ele repassa a emissao para o
// site (que tem o certificado) e o resultado cai no mesmo banco.
export type NfeResult = { status: number; body: any };

export async function handleNfe(b: any): Promise<NfeResult> {
  try {
    const { action, orderId } = b || {};

    if (action === 'test') {
      try {
        const st = await statusServico();
        return { status: 200, body: st };
      } catch (e: any) {
        return { status: 502, body: { error: e?.message || 'Falha ao consultar a SEFAZ' } };
      }
    }

    if (!orderId) return { status: 400, body: { error: 'Pedido não informado' } };
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, customer: true } });
    if (!order) return { status: 404, body: { error: 'Pedido não encontrado' } };

    if (action === 'emit') {
      const r = await emitirPedido(orderId);
      if (r.ok) return { status: 200, body: { status: 'issued', numero: r.numero, chave: r.chave, nProt: r.nProt } };
      return { status: r.http || 502, body: { error: r.error } };
    }

    if (action === 'status') {
      return {
        status: 200,
        body: {
          status: order.nfeStatus,
          numero: order.nfeNumber,
          chave: order.nfeKey,
          error: order.nfeError,
          ambiente: amb(),
        },
      };
    }

    if (action === 'cancel') {
      if (order.nfeStatus !== 'issued') return { status: 400, body: { error: 'Só é possível cancelar nota já emitida' } };
      if (!order.nfeKey || !order.nfeProtocol) return { status: 400, body: { error: 'Nota sem chave/protocolo para cancelar' } };
      const motivo = String(b.motivo || '').trim();
      if (motivo.length < 15) return { status: 400, body: { error: 'Motivo precisa de ao menos 15 caracteres (exigência da SEFAZ)' } };
      let r;
      try {
        r = await cancelar(order.nfeKey, order.nfeProtocol, motivo);
      } catch (e: any) {
        return { status: 502, body: { error: e?.message || 'Falha ao cancelar na SEFAZ' } };
      }
      if (r.ok) {
        await prisma.order.update({
          where: { id: order.id },
          data: { nfeStatus: 'cancelled', nfeCancelledAt: new Date(), nfeError: motivo.slice(0, 500) },
        });
        return { status: 200, body: { status: 'cancelled' } };
      }
      return {
        status: 502,
        body: {
          error: r.erro
            ? `${r.erro}${/^\s*501\b/.test(r.erro) ? ' — A legislação permite cancelar NFC-e somente em até 30 minutos após a emissão.' : ''}`
            : 'Falha ao cancelar',
        },
      };
    }

    return { status: 400, body: { error: 'Ação inválida' } };
  } catch (e: any) {
    return { status: 500, body: { error: e?.message || 'Erro interno' } };
  }
}
