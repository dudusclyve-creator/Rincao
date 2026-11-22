// PIX "copia e cola" gerado no proprio sistema (BR Code / EMV).
// Nao passa pelo Mercado Pago: o dinheiro cai direto na chave da loja, sem taxa
// de recebimento e sem confirmacao automatica — quem confere o pagamento e o
// operador, no painel.

function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  if (len.length > 2) throw new Error('Campo PIX muito longo');
  return `${id}${len}${value}`;
}

// CRC16-CCITT-FALSE, exigido pelo padrao do Banco Central
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// tira acentos e deixa so o que o padrao aceita
export function pixText(raw: any, max: number): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .toUpperCase();
}

// Chave Pix: CNPJ/CPF (so numeros), telefone (formato (DDD) 9....), e-mail ou
// chave aleatoria. Telefone vira +55DDDNUMERO, como o banco espera.
export function normalizePixKey(raw: any): string {
  const key = String(raw || '').trim();
  if (!key) return '';
  if (key.includes('@')) return key.toLowerCase();
  const digits = key.replace(/\D/g, '');
  // CPF/CNPJ formatados (com ponto, barra e traco) NAO sao telefone
  if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(key)) return digits;
  if (/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(key)) return digits;
  const looksPhone = /[()\-\s+]/.test(key) && /^[\d()\-\s+]+$/.test(key);
  if (looksPhone && digits.length >= 10 && digits.length <= 13) {
    const national = digits.length >= 12 ? digits.slice(-11) : digits;
    return `+55${national}`;
  }
  if (/^\d{11}$/.test(digits) || /^\d{14}$/.test(digits)) return digits;
  // chave aleatoria (EVP) ou qualquer outro formato: usa como veio
  return key;
}

function cityFromAddress(address: any): string {
  const addr = String(address || '');
  const m = addr.match(/([^,()]+?)\s*\/\s*[A-Z]{2}\b/);
  const raw = pixText(m?.[1] || 'SANTA MARIA', 60);
  if (raw.length <= 15) return raw;
  // cidade grande demais para o campo (15): usa a ultima palavra
  const last = raw.split(' ').filter(Boolean).pop() || 'BRASIL';
  return last.slice(0, 15);
}

export function staticPixPayload(o: {
  key: string;
  amount: number;
  merchant: string;
  city?: string;
  txid?: string;
}): string {
  const key = normalizePixKey(o.key);
  if (!key) throw new Error('Chave PIX nao configurada');
  const amount = Math.round(Math.max(0, Number(o.amount) || 0) * 100) / 100;
  if (!(amount > 0)) throw new Error('Valor do PIX invalido');

  const merchant = pixText(o.merchant || 'RINCAO LANCHES', 25) || 'RINCAO LANCHES';
  const city = cityFromAddress(o.city);
  const txid = String(o.txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  const merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', key);

  let payload = '';
  payload += tlv('00', '01'); // versao do payload
  payload += tlv('26', merchantAccount);
  payload += tlv('52', '0000'); // categoria do comerciante
  payload += tlv('53', '986'); // moeda: BRL
  payload += tlv('54', amount.toFixed(2));
  payload += tlv('58', 'BR');
  payload += tlv('59', merchant);
  payload += tlv('60', city);
  payload += tlv('62', tlv('05', txid));
  payload += '6304';
  return payload + crc16(payload);
}
