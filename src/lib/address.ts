// Parser tolerante de endereços do Rincão (Brasil/Uruguai).
// O cardápio monta "Rua, 123 - Compl - Bairro, Cidade", mas o cliente também
// digita endereços soltos ("professor César Ávila ,363 ! Parque do sol").
// Quando a lista de bairros conhecidos é informada, ela manda: achamos o bairro
// (e a cidade) no meio do texto, independente da pontuação usada.

export type AddressZone = { name: string; city?: string };

export type ParsedAddress = {
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
};

/** minúsculas, sem acento e com espaços normalizados (mantém o mesmo tamanho do original) */
const norm = (s: any) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const limpar = (s: any) =>
  String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;!.:\-–—]+/, '')
    .replace(/[\s,;!.:\-–—]+$/, '')
    .trim();

const VAZIO: ParsedAddress = { street: '', number: '', complement: '', district: '', city: '' };

const JUNK = /^(retirada|consumo no local|consumo|balcao|balcão|pdv|mesa)\b/i;

export const isPickupAddress = (text: any) => !String(text || '').trim() || JUNK.test(String(text).trim());

/** procura um bairro conhecido dentro do texto (palavra inteira, sem acento) */
function acharZona(texto: string, zones: AddressZone[] | undefined, cidadePreferida?: string) {
  if (!texto || !zones || zones.length === 0) return null;
  const alvo = norm(texto);
  let melhor: { zone: AddressZone; start: number; len: number; prioridade: number } | null = null;
  for (const z of zones) {
    const n = norm(z.name);
    if (!n) continue;
    const re = new RegExp(`(^|[^a-z0-9])${esc(n)}(?=[^a-z0-9]|$)`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(alvo))) {
      const start = m.index + m[1].length;
      const prioridade = cidadePreferida && z.city === cidadePreferida ? 2 : 1;
      if (!melhor || n.length > melhor.len || (n.length === melhor.len && prioridade > melhor.prioridade) || (n.length === melhor.len && prioridade === melhor.prioridade && start < melhor.start)) {
        melhor = { zone: z, start, len: n.length, prioridade };
      }
      break;
    }
  }
  return melhor;
}

export function parseAddress(text: any, zones?: AddressZone[]): ParsedAddress {
  const out: ParsedAddress = { ...VAZIO };
  let resto = String(text || '').replace(/\s+/g, ' ').trim();
  if (isPickupAddress(resto)) return out;

  // 1) cidade no fim do texto (ex.: ", Santana do Livramento" / ", Rivera")
  const cidades = Array.from(new Set((zones || []).map((z) => z.city).filter(Boolean))) as string[];
  const alvo = norm(resto);
  for (const cid of cidades.sort((a, b) => b.length - a.length)) {
    const n = norm(cid);
    if (!n || n.length < 3) continue;
    const i = alvo.lastIndexOf(n);
    if (i < 0) continue;
    const fim = i + n.length;
    const antesOk = i === 0 || /[^a-z0-9]/.test(alvo[i - 1]);
    const depoisOk = fim === alvo.length; // cidade no fim
    if (antesOk && depoisOk) {
      out.city = cid;
      resto = (resto.slice(0, i).replace(/[\s,;!.:\-–—]+$/, '') + ' ' + resto.slice(fim)).trim();
      break;
    }
  }

  // 2) bairro conhecido (mais confiável que adivinhar pelo formato)
  const achado = acharZona(resto, zones, out.city || undefined);
  if (achado) {
    out.district = achado.zone.name;
    if (!out.city && achado.zone.city) out.city = achado.zone.city;
    resto = resto.slice(0, achado.start) + ' ' + resto.slice(achado.start + achado.len);
    resto = resto.replace(/\s+/g, ' ').trim();
  }

  resto = limpar(resto);

  // 3) rua + número (aceita "Rua X, 123", "Rua X ,363", "Rua X 123", "Rua X nº 123")
  let m = resto.match(/^(.+?)\s*[,!;]\s*(?:n[ºo°.]?\s*)?(\d+[A-Za-z]?)\b\s*(.*)$/i);
  if (!m) m = resto.match(/^(.+?)\s+(?:n[ºo°.]?\s*)?(\d+[A-Za-z]?)\b\s*(.*)$/i);
  if (m) {
    out.street = limpar(m[1]);
    out.number = limpar(m[2]);
    out.complement = limpar(m[3]);
  } else {
    out.street = limpar(resto);
  }

  // sobrou só o bairro no texto (ex.: " - Prado, Santana do Livramento")
  if (!out.street && out.district) out.street = '';
  return out;
}

/** lista achatada de bairros a partir do formato { Cidade: [{name, fee}] } */
export function flattenZones(zones: Record<string, { name: string; fee?: number }[]> | undefined): AddressZone[] {
  const out: AddressZone[] = [];
  for (const [city, list] of Object.entries(zones || {})) {
    for (const z of list || []) if (z?.name) out.push({ name: z.name, city });
  }
  return out;
}
