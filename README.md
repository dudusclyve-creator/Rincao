# Sistema Restaurante — Cardápio Digital + Pedidos + PDV + Caixa + Gestão

Single-restaurant, Next.js 14 + Prisma. **DEV local usa SQLite** (arquivo `prisma/dev.db`, zero-config).
**PRODUÇÃO usa PostgreSQL** (mesmo schema — basta trocar provider + DATABASE_URL).

## Rodar (Windows PowerShell)
```powershell
cd C:\Users\R&L\Documents\server\restaurante
Copy-Item .env.example .env
npm install
npm run setup     # generate + db push + seed
npm run dev       # http://localhost:3000/cardapio  |  http://localhost:3000/admin
```
Login demo: `admin@cantina.com / admin123` (cozinha/caixa/entregador: `123456`).

## PostgreSQL em produção
```powershell
docker compose up -d db
# .env: DATABASE_URL="postgresql://restaurante:restaurante123@localhost:5432/restaurante?schema=public"
# prisma/schema.prisma: provider = "postgresql"  →  npx prisma db push
```

## Fluxos testados
Criar categoria/produto/adicional → montar cardápio → pedido mobile + adicionais → checkout → WhatsApp (wa.me com mensagem formatada + pedido salvo) → kanban tempo real com som → status → impressão 58/80mm (window.print + POST /api/print + print-service/ bridge USB/rede) → PDV + movimento de caixa → abrir mesa → fechar mesa → sangria → fechar caixa com diferença → relatório CSV/PDF → avaliações → entregas → estoque baixo → QR Code.

## Impressão térmica real
- Navegador: recibo 58/80mm via `window.print()` (CSS print).
- Rede: `print-service/` envia ESC/POS via TCP porta 9100.
- USB: adaptar `print-service/index.js` com `escpos-usb`.
- Auto-impressão: flag `printerAuto` em Configurações.
