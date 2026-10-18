# Rincão Painel — versão portátil

Aplicativo de desktop (Electron) que abre o **painel de administração** do
Rincão Lanches numa janela própria, sem navegador.

## Como usar

1. Copie a **pasta inteira** (`win-unpacked`) para o PC desejado.
2. Abra **`Rincao Lanches.exe`**.
3. O app conecta no banco do Supabase e abre direto a tela de login do painel.

> A pasta pode ficar em qualquer lugar (Área de Trabalho, pendrive, etc.).
> Não precisa instalar nada.

## Requisitos

- **Windows 10/11 (64 bits)**
- **Internet** — o banco de dados é o Supabase compartilhado com o site.
  Sem conexão o painel não carrega os dados.

## Login

Use os usuários cadastrados no banco, por exemplo:

- `admin@rincao.com`
- `caixa@rincao.com`
- `cozinha@rincao.com`
- `entregador@rincao.com`

## Trocar as credenciais / configurações do banco

O app usa um arquivo **`.env`** com a string de conexão do banco.

- Ao lado do `.exe` você pode colocar um arquivo `.env` **próprio** (tem prioridade).
- Se não existir, o app usa o `.env` que vem embutido nos recursos.

Formato:

```env
DATABASE_URL="postgresql://usuario:senha@host:porta/postgres?sslmode=require"
JWT_SECRET="uma-chave-qualquer"
RESTAURANT_WHATSAPP="5555984375004"
NEXT_PUBLIC_WHATSAPP="5555984375004"
```

## Impressão

Os cupons (PDV, caixa, pedidos) saem **direto na impressora**, sem nenhum
diálogo e **sem desperdício de papel**: o app envia os comandos ESC/POS
diretamente para a impressora térmica, então o papel é puxado exatamente do
tamanho do cupom, com corte automático.

Para ajustar, coloque no `.env` (ao lado do `.exe`):

```env
PRINT_DEVICE="EPSON TM-T20X Receipt"   # vazio = impressora padrão do Windows
PRINT_FONTE="2x1"                      # 2x1 (padrão) | 2x2 (maior) | 1x1 (menor)
PRINT_ESPACO="56"                      # espaço entre as linhas (padrão 56)
PRINT_LARGURA_DOTS="576"               # 576 = papel 80mm | 384 = papel 58mm
```

- `PRINT_DEVICE` precisa ser exatamente o nome da impressora no Windows
  (Configurações → Bluetooth e dispositivos → Impressoras e scanners).
- `PRINT_FONTE`: `2x1` = letra larga, parecida com o cupom antigo (padrão);
  `2x2` = letra grande (usa mais papel); `1x1` = letra pequena e econômica.
- `PRINT_ESPACO`: altura de cada linha, em pontos (1 mm ≈ 8 pontos). Quanto
  maior, mais separadas as linhas. Padrão `56` (≈ 7 mm).
- `PRINT_LARGURA_DOTS`: 576 para papel de 80 mm, 384 para papel de 58 mm.

> Precisa ser uma **impressora térmica compatível com ESC/POS** (EPSON, Elgin,
> Bematech, Daruma, Tanca...). Impressora comum de folha A4 não entende esses
> comandos.

> As telas de **Relatórios** imprimem a página inteira e continuam usando o
> diálogo normal do Windows (é um relatório, não um cupom de 80mm).

## Observações

- O `.exe` não é assinado digitalmente — o Windows pode exibir o aviso
  "editor desconhecido" na primeira execução (basta escolher "Executar assim mesmo").
- Fechar a janela encerra também o servidor interno.
