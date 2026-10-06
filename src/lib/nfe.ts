import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { createHash } from 'crypto';
import https from 'https';
import { SEFAZ_CA } from './sefazChain';

const NS = 'http://www.portalfiscal.inf.br/nfe';

export const EMIT = {
  cnpj: '42462389000137',
  ie: '1060172256',
  crt: '1', // Simples Nacional
  xNome: 'SANDRA REGINA DE MENEZES PIRES',
  xFant: 'RINCAO LANCHES',
  xLgr: 'AVENIDA DOM PEDRO II',
  nro: '1694',
  xBairro: 'UMBU',
  xMun: 'SANTANA DO LIVRAMENTO',
  uf: 'RS',
  cMun: '4317103', // IBGE Sant'Ana do Livramento/RS
  cUF: '43',
  cep: '97577372',
  fone: '5555984375004',
  cnae: '5611201',
};

// consulta QR Code v2 - RS (ajustar aqui se a SEFAZ rejeitar o padrao)
// Tabelas SEFAZ-RS sao separadas: QR (rejeicao 395) = ENCAT nfce.encat.org/desenvolvedor/qrcode/
// (mesmo endereco em homolog e prod); urlChave (rejeicao 878) exige http://.../nfce/consulta.
const QR_BASE = 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx';
const URL_CHAVE = 'http://www.sefaz.rs.gov.br/nfce/consulta';

export function amb(): 1 | 2 {
  return Number(process.env.NFE_AMBIENTE || '2') === 1 ? 1 : 2;
}

function wsBase() {
  return amb() === 1
    ? 'https://nfce.sefazrs.rs.gov.br/ws'
    : 'https://nfce-homologacao.sefazrs.rs.gov.br/ws';
}

const WS = {
  autorizacao: () => `${wsBase()}/NfeAutorizacao/NFeAutorizacao4.asmx`,
  retAutorizacao: () => `${wsBase()}/NfeRetAutorizacao/NFeRetAutorizacao4.asmx`,
  consulta: () => `${wsBase()}/NfeConsulta/NfeConsulta4.asmx`,
  status: () => `${wsBase()}/NfeStatusServico/NfeStatusServico4.asmx`,
  evento: () => `${wsBase()}/recepcaoevento/recepcaoevento4.asmx`,
};

const NSWS = {
  autorizacao: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4',
  retAutorizacao: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4',
  consulta: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4',
  status: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4',
  evento: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4',
};

// ---------- helpers ----------
const esc = (s: any) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// TString do XSD so aceita U+0021..U+00FF (sem controles/emoji/tracoes longas)
const cleanTxt = (s: any, max = 500) =>
  String(s ?? '')
    .replace(/[^!-ÿ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'N/I';
const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const f2 = (n: number) => money(n).toFixed(2);
const f4 = (n: number) => {
  const v = Math.round((Number(n) || 0) * 10000) / 10000;
  return String(v);
};
const f10 = (n: number) => (Math.round((Number(n) || 0) * 1e10) / 1e10).toFixed(10);

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`));
  return m ? m[1].trim() : '';
}

function firstTag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>[\\s\\S]*?</(?:\\w+:)?${name}>`));
  return m ? m[0] : '';
}

// data/hora no formato NF-e (America/Sao_Paulo, sem DST)
function isoBRT(): string {
  const t = new Date(Date.now() - 3 * 3600 * 1000);
  return t.toISOString().replace('Z', '').replace(/\.\d+/, '') + '-03:00';
}

// digito verificador mod 11 (chave de acesso NF-e)
function mod11(chave43: string): string {
  const w = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  for (let i = chave43.length - 1, k = 0; i >= 0; i--, k++) {
    sum += Number(chave43[i]) * w[k % 8];
  }
  const r = 11 - (sum % 11);
  return String(r >= 10 ? 0 : r);
}

function sha1hex(s: string): string {
  return createHash('sha1').update(s, 'utf8').digest('hex').toUpperCase();
}

function csc(): { id: string; token: string } {
  const id = (process.env.NFE_CSC_ID || '1').replace(/^0+/, '');
  const token = amb() === 1 ? process.env.NFE_CSC_TOKEN_PROD : process.env.NFE_CSC_TOKEN_HOMOL;
  if (!token) throw new Error(`CSC do ambiente ${amb() === 1 ? 'produção' : 'homologação'} não configurado (NFE_CSC_TOKEN_*)`);
  return { id, token };
}

// ---------- certificado .p12 ----------
let certCache: { key: string; cert: string } | null = null;

export function loadCert(): { key: string; cert: string } {
  if (certCache) return certCache;
  const b64 = process.env.NFE_CERT_PFX_B64;
  const pass = process.env.NFE_CERT_PASSWORD || '';
  if (!b64) throw new Error('NFE_CERT_PFX_B64 não configurada no .env');
  const der = forge.util.createBuffer(Buffer.from(b64.trim(), 'base64').toString('binary'), 'binary');
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, pass);
  const oids = forge.pki.oids;
  let keyBags = p12.getBags({ bagType: oids.pkcs8ShroudedKeybag })[oids.pkcs8ShroudedKeybag];
  if (!keyBags || !keyBags.length) keyBags = p12.getBags({ bagType: oids.keybag })[oids.keybag];
  if (!keyBags || !keyBags.length) throw new Error('Chave privada não encontrada no .p12 (senha errada?)');
  const key = forge.pki.privateKeyToPem(keyBags[0].key as any);
  const certBags = (p12.getBags({ bagType: oids.certBag })[oids.certBag] || []) as any[];
  if (!certBags.length) throw new Error('Certificado não encontrado no .p12');
  let leaf = certBags[0].cert;
  const withCnpj = certBags.find((b) => {
    const cn = b.cert?.subject?.getField('CN');
    const arr = Array.isArray(cn) ? cn : cn ? [cn] : [];
    return arr.some((f: any) => String(f.value).includes(EMIT.cnpj));
  });
  if (withCnpj) leaf = withCnpj.cert;
  certCache = { key, cert: forge.pki.certificateToPem(leaf) };
  return certCache;
}

// ---------- assinatura digital ----------
function signTag(xml: string, localName: string, id: string): string {
  const { key, cert } = loadCert();
  const sig = new SignedXml({
    privateKey: key,
    publicCert: cert,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });
  sig.addReference({
    xpath: `//*[local-name(.)='${localName}']`,
    uri: `#${id}`,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  });
  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='${localName}Supl']`, action: 'after' },
  });
  return sig.getSignedXml();
}

// assinatura de evento (cancelamento): sem infNFeSupl, vai logo apos infEvento
function signEvent(xml: string, id: string): string {
  const { key, cert } = loadCert();
  const sig = new SignedXml({
    privateKey: key,
    publicCert: cert,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });
  sig.addReference({
    xpath: "//*[local-name(.)='infEvento']",
    uri: `#${id}`,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  });
  sig.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='infEvento']", action: 'after' },
  });
  return sig.getSignedXml();
}

// ---------- SOAP ----------
// A SEFAZ-RS exige autenticacao mutua TLS (cert e-CNPJ no handshake) e usa
// cadeia ICP-Brasil fora da trust store padrao do Node: por isso https.request
// com cert/key/ca em vez de fetch.
async function soap(url: string, ns: string, op: string, msg: string): Promise<string> {
  const body =
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Header/><soap:Body><nfeDadosMsg xmlns="${ns}">${msg}</nfeDadosMsg></soap:Body></soap:Envelope>`;
  const { key, cert } = loadCert();
  const u = new URL(url);
  const { status, text } = await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=utf-8',
          SOAPAction: `"${ns}/${op}"`,
          'Content-Length': Buffer.byteLength(body),
        },
        cert,
        key,
        ca: [SEFAZ_CA],
        timeout: 9000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('Timeout ao consultar a SEFAZ')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  const bodyM = text.match(/<(?:\w+:)?Body[^>]*>([\s\S]*?)<\/(?:\w+:)?Body>/);
  let inner = bodyM ? bodyM[1].trim() : text;
  if (/<(?:\w+:)?Fault\b/.test(inner)) {
    const fault = tag(inner, 'faultstring') || firstTag(inner, 'Text').replace(/<[^>]+>/g, '');
    throw new Error(`SEFAZ retornou falha: ${fault || 'erro desconhecido'}`);
  }
  if (status >= 400 && !inner.match(/<ret|<prot/)) throw new Error(`SEFAZ HTTP ${status}`);
  // remove o wrapper unico (ex.: nfeResultMsg)
  const unw = inner.match(/^\s*<([\w:]+)[^>]*>([\s\S]*)<\/[\w:]+>\s*$/);
  if (unw && !/^ret|^prot/i.test(unw[1].replace(/^.*:/, ''))) inner = unw[2].trim();
  return inner;
}

// ---------- montagem da NFC-e ----------
export interface BuildNfce {
  xml: string;
  chave: string;
  qrUrl: string;
  numero: number;
}

export function buildNfce(order: any, fiscal: any, numero: number): BuildNfce {
  const ncm = fiscal.ncmPadrao || '21069090';
  const cfop = fiscal.cfopPadrao || '5102';
  const natOp = fiscal.naturezaOperacao || 'VENDA DE MERCADORIA';
  const tpAmb = amb();
  const { id: cscId, token: cscToken } = csc();

  // itens
  const items: any[] = (order.items || []).map((it: any, i: number) => {
    const addons = JSON.parse(it.addonsJson || '[]');
    const addonUnit = addons.reduce((s: number, a: any) => s + (a.price || 0) * (a.qty || 1), 0);
    const gross = money(it.qty * ((it.unitPrice || 0) + addonUnit));
    const descricao = cleanTxt([it.name, ...addons.map((a: any) => a.name)].join(' + '), 100);
    return {
      codigo: `P${i + 1}`,
      descricao,
      quantidade: it.qty,
      valorUnitario: money(gross / (it.qty || 1)),
      valorTotal: gross,
      desconto: 0,
    };
  });
  if ((order.deliveryFee || 0) > 0) {
    items.push({
      codigo: 'TAXA',
      descricao: 'Taxa de entrega',
      quantidade: 1,
      valorUnitario: money(order.deliveryFee),
      valorTotal: money(order.deliveryFee),
      desconto: 0,
    });
  }
  if (!items.length) throw new Error('Pedido sem itens');
  // soma dos itens = total + desconto
  const wantGross = money((order.total || 0) + (order.discount || 0));
  const sum = money(items.reduce((s, i) => s + i.valorTotal, 0));
  const diff = money(wantGross - sum);
  if (diff !== 0 && items[0].valorTotal + diff > 0) {
    items[0].valorTotal = money(items[0].valorTotal + diff);
    items[0].valorUnitario = money(items[0].valorTotal / items[0].quantidade);
  }
  let rest = money(order.discount || 0);
  for (const it of items) {
    if (rest <= 0) break;
    const d = Math.min(rest, it.valorTotal);
    it.desconto = money(d);
    rest = money(rest - d);
  }
  const vProd = money(items.reduce((s, i) => s + i.valorTotal, 0));
  const vDesc = money(items.reduce((s, i) => s + i.desconto, 0));
  const vNF = money(order.total || 0);

  // pagamento
  const payMap: Record<string, string> = { dinheiro: '01', pix: '17', debito: '04', credito: '03', cartao: '03' };
  const pags: any[] = [];
  if ((order.payment || '').includes(',')) {
    order.payment.split(',').forEach((p: string) => {
      const [m, v] = p.split(':');
      const amount = money(Number(v) || 0);
      if (amount > 0) pags.push({ t: payMap[m] || '99', desc: m, v: amount });
    });
  } else {
    const m = order.payment;
    let amount = vNF;
    if (m === 'dinheiro' && order.changeFor && order.changeFor > 0) amount = money(order.changeFor);
    pags.push({ t: payMap[m] || '99', desc: m, v: amount });
  }
  if (!pags.length) pags.push({ t: '99', desc: 'NAO INFORMADO', v: vNF });
  const ps = money(pags.reduce((s, p) => s + p.v, 0));
  if (ps !== vNF) pags[pags.length - 1].v = Math.max(0, money(pags[pags.length - 1].v + (vNF - ps)));
  const troco = money(ps - vNF);

  const isRealDelivery =
    order.type === 'entrega' &&
    !(order.addressText || '').toUpperCase().includes('RETIRADA') &&
    !(order.addressText || '').toUpperCase().includes('CONSUMO NO LOCAL');
  // NFC-e so aceita indPres 1 ou 4 (rej 717): entrega=4 exige CPF do destinatario (rej 787), demais=1
  const destCpf = String(order.customer?.cpf || '').replace(/\D/g, '');
  const indPres = isRealDelivery ? 4 : 1;
  let destXml = '';
  if (isRealDelivery && destCpf.length === 11) {
    const cust: any = order.customer || {};
    const at = String(order.addressText || '');
    const m = at.match(/^(.+?),\s*(\S+?)(?:\s*-\s*(.+?))?\s*-\s*(.+)$/);
    const cityName = ((m && m[4]) || at).split(',').pop()!.trim().toUpperCase();
    const destLiv = /LIVRAMENTO/.test(cityName); // zonas: Livramento (Rivera/exterior ja bloqueado na rota)
    const dStreet = cleanTxt(String(cust.street || (m && m[1]) || ''), 60) || 'NAO INFORMADO';
    const dNro = cleanTxt(String(cust.number || (m && m[2]) || ''), 60) || 'S/N';
    const dComp = cleanTxt(String(cust.complement || ''), 60);
    const dBairro = cleanTxt(String(cust.district || ''), 60) || 'NAO INFORMADO';
    const destNome = tpAmb === 2 ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : cleanTxt(String(order.customerName || cust.name || 'CONSUMIDOR'), 60);
    destXml =
      `<dest><CPF>${destCpf}</CPF><xNome>${esc(destNome)}</xNome>` +
      `<enderDest><xLgr>${esc(dStreet)}</xLgr><nro>${esc(dNro)}</nro>` +
      (dComp ? `<xCpl>${esc(dComp)}</xCpl>` : '') +
      `<xBairro>${esc(dBairro)}</xBairro>` +
      `<cMun>${destLiv ? '4317103' : EMIT.cMun}</cMun><xMun>${destLiv ? 'SANTANA DO LIVRAMENTO' : esc(EMIT.xMun)}</xMun>` +
      `<UF>${EMIT.uf}</UF></enderDest>` +
      `<indIEDest>9</indIEDest></dest>`;
  }

  // datas e chave
  const dhEmi = isoBRT();
  const aamm = dhEmi.slice(2, 4) + dhEmi.slice(5, 7);
  const cNF = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const nNF = String(numero).padStart(9, '0'); // 9 digitos apenas na chave de acesso
  const chave43 = EMIT.cUF + aamm + EMIT.cnpj + '65' + '001' + nNF + '1' + cNF;
  const chave = chave43 + mod11(chave43);
  const id = `NFe${chave}`;

  // QR Code v2 (online): chave|2|tpAmb|cscId + token -> SHA1
  const hash = sha1hex(`${chave}|2|${tpAmb}|${cscId}${cscToken}`);
  const qrUrl = `${QR_BASE}?p=${chave}|2|${tpAmb}|${cscId}|${hash}`;
  const urlChave = URL_CHAVE; // XSD: max 85 chars, sem query

  // Homologacao: 1o item deve trazer a literal oficial (rejeicao 373)
  if (tpAmb === 2 && items.length) {
    items[0].descricao = 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
  }

  const detXml = items
    .map(
      (it, i) =>
        `<det nItem="${i + 1}">` +
        `<prod><cProd>${esc(it.codigo)}</cProd><cEAN>SEM GTIN</cEAN><xProd>${esc(it.descricao)}</xProd>` +
        `<NCM>${ncm}</NCM><CFOP>${cfop}</CFOP><uCom>UN</uCom>` +
        `<qCom>${f4(it.quantidade)}</qCom><vUnCom>${f10(it.valorUnitario)}</vUnCom>` +
        `<vProd>${f2(it.valorTotal)}</vProd>` +
        `<cEANTrib>SEM GTIN</cEANTrib><uTrib>UN</uTrib>` +
        `<qTrib>${f4(it.quantidade)}</qTrib><vUnTrib>${f10(it.valorUnitario)}</vUnTrib>` +
        (it.desconto > 0 ? `<vDesc>${f2(it.desconto)}</vDesc>` : '') +
        `<indTot>1</indTot></prod>` +
        `<imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>` +
        // Simples Nacional: CST 99 em PISOutr/COFINSOutr (NT Simples Nacional)
        `<PIS><PISOutr><CST>99</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>` +
        `<COFINS><COFINSOutr><CST>99</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS></imposto>` +
        `</det>`
    )
    .join('');

  const pagXml =
    '<pag>' +
    pags
      .map(
        (p) =>
          `<detPag><tPag>${p.t}</tPag>` +
          (p.t === '99' ? `<xPag>${esc(cleanTxt(String(p.desc || 'OUTROS').toUpperCase(), 50))}</xPag>` : '') +
          `<vPag>${f2(p.v)}</vPag>` +
          (p.t === '03' || p.t === '04' || p.t === '17' ? `<card><tpIntegra>2</tpIntegra></card>` : '') +
          `</detPag>`
      )
      .join('') +
    (troco > 0 ? `<vTroco>${f2(troco)}</vTroco>` : '') +
    '</pag>';

  const infCpl = cleanTxt(
    `Pedido #${order.number} - Rincao Lanches${isRealDelivery && order.addressText ? ` - Entrega: ${String(order.addressText)}` : ''}`,
    500
  );

  const infNFe =
    `<infNFe versao="4.00" Id="${id}">` +
    `<ide><cUF>${EMIT.cUF}</cUF><cNF>${cNF}</cNF><natOp>${esc(natOp)}</natOp>` +
    `<mod>65</mod><serie>1</serie><nNF>${numero}</nNF><dhEmi>${dhEmi}</dhEmi>` +
    `<tpNF>1</tpNF><idDest>1</idDest><cMunFG>${EMIT.cMun}</cMunFG>` +
    `<tpImp>4</tpImp><tpEmis>1</tpEmis><cDV>${mod11(chave43)}</cDV>` +
    `<tpAmb>${tpAmb}</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>${indPres}</indPres>` +
    // NT2020.006: indPres 2/3/4/9 exige indIntermed (rej 434); demais valores proibem (rej 435)
    ([2, 3, 4, 9].includes(indPres) ? '<indIntermed>0</indIntermed>' : '') +
    `<procEmi>0</procEmi><verProc>RincaoLanches1.0</verProc></ide>` +
    `<emit><CNPJ>${EMIT.cnpj}</CNPJ><xNome>${esc(EMIT.xNome)}</xNome><xFant>${esc(EMIT.xFant)}</xFant>` +
    `<enderEmit><xLgr>${esc(EMIT.xLgr)}</xLgr><nro>${EMIT.nro}</nro><xBairro>${esc(EMIT.xBairro)}</xBairro>` +
    `<cMun>${EMIT.cMun}</cMun><xMun>${esc(EMIT.xMun)}</xMun><UF>${EMIT.uf}</UF>` +
    `<CEP>${EMIT.cep}</CEP><cPais>1058</cPais><xPais>BRASIL</xPais><fone>${EMIT.fone}</fone></enderEmit>` +
    `<IE>${EMIT.ie}</IE><CRT>${EMIT.crt}</CRT></emit>` +
    destXml +
    detXml +
    `<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson>` +
    `<vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>` +
    `<vProd>${f2(vProd)}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>${f2(vDesc)}</vDesc>` +
    `<vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS>` +
    `<vOutro>0.00</vOutro><vNF>${f2(vNF)}</vNF></ICMSTot></total>` +
    `<transp><modFrete>9</modFrete></transp>` +
    pagXml +
    `<infAdic><infCpl>${esc(infCpl.slice(0, 500))}</infCpl></infAdic>` +
    `</infNFe>`;

  const supl =
    `<infNFeSupl><qrCode>${esc(qrUrl)}</qrCode><urlChave>${esc(urlChave)}</urlChave></infNFeSupl>`;

  const unsigned = `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="${NS}">${infNFe}${supl}</NFe>`;
  const signed = signTag(unsigned, 'infNFe', id);
  return { xml: signed, chave, qrUrl, numero };
}

// ---------- servico SEFAZ ----------
export async function statusServico(): Promise<{ cStat: string; xMotivo: string; ambiente: 1 | 2 }> {
  const msg = `<consStatServ versao="4.00" xmlns="${NS}"><tpAmb>${amb()}</tpAmb><cUF>${EMIT.cUF}</cUF><xServ>STATUS</xServ></consStatServ>`;
  const ret = await soap(WS.status(), NSWS.status, 'nfeStatusServicoNF', msg);
  return { cStat: tag(ret, 'cStat'), xMotivo: tag(ret, 'xMotivo'), ambiente: amb() };
}

export interface EmitResult {
  ok: boolean;
  chave?: string;
  nProt?: string;
  dh?: string;
  xml?: string;
  qrUrl?: string;
  numero?: number;
  cStat?: string;
  erro?: string;
}

function protResult(protXml: string, base: { chave: string; xml: string; qrUrl: string; numero: number }): EmitResult {
  const pStat = tag(protXml, 'cStat');
  if (pStat === '100') {
    return {
      ok: true,
      chave: tag(protXml, 'chNFe') || base.chave,
      nProt: tag(protXml, 'nProt'),
      dh: tag(protXml, 'dhRecbto'),
      xml: base.xml,
      qrUrl: base.qrUrl,
      numero: base.numero,
      cStat: pStat,
    };
  }
  return { ok: false, cStat: pStat, erro: `${pStat} — ${tag(protXml, 'xMotivo') || 'rejeição da SEFAZ'}`, chave: base.chave };
}

export async function emitir(order: any, fiscal: any, numero: number): Promise<EmitResult> {
  const base = buildNfce(order, fiscal, numero);
  const envi =
    `<enviNFe versao="4.00" xmlns="${NS}"><idLote>1</idLote><indSinc>1</indSinc>` +
    base.xml.replace(/^\s*<\?xml[^?]*\?>\s*/, '') +
    `</enviNFe>`;
  const ret = await soap(WS.autorizacao(), NSWS.autorizacao, 'nfeAutorizacaoLote', envi);
  const cS = tag(ret, 'cStat');

  if (cS === '104') {
    const prot = firstTag(ret, 'protNFe');
    if (!prot) return { ok: false, cStat: cS, erro: `${cS} — lote processado sem protocolo`, ...pick(base) };
    return protResult(prot, base);
  }
  if (cS === '103') {
    // lote recebido (assincrono): consulta retorno
    const nRec = tag(ret, 'nRec');
    await new Promise((r) => setTimeout(r, 700));
    const msg = `<consReciNFe versao="4.00" xmlns="${NS}"><tpAmb>${amb()}</tpAmb><nRec>${nRec}</nRec></consReciNFe>`;
    const ret2 = await soap(WS.retAutorizacao(), NSWS.retAutorizacao, 'nfeRetAutorizacaoLote', msg);
    const prot = firstTag(ret2, 'protNFe');
    if (prot) return protResult(prot, base);
    return { ok: false, cStat: tag(ret2, 'cStat'), erro: `${tag(ret2, 'cStat')} — ${tag(ret2, 'xMotivo') || 'ainda processando, tente novamente'}`, ...pick(base) };
  }
  if (cS === '204') {
    // duplicidade: a chave ja foi enviada antes -> consulta e adota o protocolo
    const msg = `<consSitNFe versao="4.00" xmlns="${NS}"><tpAmb>${amb()}</tpAmb><chNFe>${base.chave}</chNFe></consSitNFe>`;
    const ret2 = await soap(WS.consulta(), NSWS.consulta, 'nfeConsultaNF', msg);
    const prot = firstTag(ret2, 'protNFe');
    if (prot) return protResult(prot, base);
    return { ok: false, cStat: '204', erro: '204 — chave já utilizada e nota não encontrada na SEFAZ', ...pick(base) };
  }
  return { ok: false, cStat: cS, erro: `${cS} — ${tag(ret, 'xMotivo') || 'rejeição da SEFAZ'}`, ...pick(base), xml: base.xml };
}

function pick(base: { chave: string }) {
  return { chave: base.chave };
}

export interface CancelResult {
  ok: boolean;
  cStat?: string;
  erro?: string;
}

export async function cancelar(chave: string, nProt: string, motivo: string): Promise<CancelResult> {
  const tpAmb = amb();
  const dhEvento = isoBRT();
  const idEv = `ID110111${chave}01`; // XSD: ID[0-9]{12}[0-9A-Z]{12}[0-9]{28} — seq com 2 dig no Id; elemento nSeqEvento = 1
  const evento =
    `<evento versao="1.00" xmlns="${NS}"><infEvento Id="${idEv}">` +
    `<cOrgao>${EMIT.cUF}</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${EMIT.cnpj}</CNPJ>` +
    `<chNFe>${chave}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>110111</tpEvento>` +
    `<nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento>` +
    `<detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${nProt}</nProt><xJust>${esc(cleanTxt(motivo, 255))}</xJust></detEvento>` +
    `</infEvento></evento>`;
  const signed = signEvent(evento, idEv);
  const env = `<envEvento versao="1.00" xmlns="${NS}"><idLote>1</idLote>${signed.replace(/^\s*<\?xml[^?]*\?>\s*/, '')}</envEvento>`;
  const ret = await soap(WS.evento(), NSWS.evento, 'nfeRecepcaoEvento', env);
  const ev = firstTag(ret, 'retEvento');
  const evStat = ev ? tag(ev, 'cStat') : tag(ret, 'cStat');
  const stat = evStat || tag(ret, 'cStat');
  if (['135', '136'].includes(stat)) return { ok: true, cStat: stat };
  return { ok: false, cStat: stat, erro: `${stat} — ${tag(ev || ret, 'xMotivo') || 'falha no cancelamento'}` };
}
