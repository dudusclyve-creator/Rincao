<#
  Envia o cupom DIRETO para a impressora termica (comandos ESC/POS), sem passar
  pelo driver grafico do Windows.

  Por que: o driver da EPSON monta uma "folha" fixa de 80 x 297 mm. Quando o
  Chromium imprime por ele, a impressora puxa os 30 cm inteiros (e as vezes muito
  mais) por cupom. Mandando os comandos ESC/POS crus, o papel sai exatamente do
  tamanho do cupom, com corte, sem dialogo nenhum.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File rawprint.ps1 `
      -TextFile cupom.txt [-LogoFile logo.png] [-Printer "Nome da impressora"] `
      [-Fonte 2x2] [-Feed 4] [-LarguraDots 576] [-SemCorte] `
      [-QrTexto "https://..."] [-QrFile qr.png]

  O arquivo de texto deve estar em UTF-8. Vários cupons podem ir no mesmo
  arquivo, separados por form feed (0x0C): cada um vira um cupom com corte.

  QR Code: uma linha do texto contendo exatamente [[QR]] é trocada pelo código.
  Se -QrTexto vier preenchido, o QR é gerado pela própria impressora (comando
  nativo GS ( k), sai perfeito). Se não, -QrFile (uma imagem PNG) é convertido
  em bitmap e impresso no lugar. Sem nenhum dos dois, sai um aviso em texto.
#>
param(
  [Parameter(Mandatory = $true)][string]$TextFile,
  [string]$Printer = "",
  [string]$LogoFile = "",
  [string]$Fonte = "2x1",
  [int]$Feed = 4,
  [int]$LarguraDots = 576,
  [int]$Espaco = 0,
  [string]$QrTexto = "",
  [string]$QrFile = "",
  [int]$QrDots = 460,
  [int]$QrModulo = 8,
  [switch]$SemCorte,
  [string]$SaidaArquivo = ""
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------- impressora --
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RincaoRawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static int SendBytes(string printer, byte[] bytes) {
        IntPtr hPrinter = IntPtr.Zero;
        if (!OpenPrinter(printer, out hPrinter, IntPtr.Zero)) return -1;
        try {
            DOCINFOA di = new DOCINFOA();
            di.pDocName = "Rincao Lanches";
            di.pDataType = "RAW";
            di.pOutputFile = null;
            if (!StartDocPrinter(hPrinter, 1, di)) return -2;
            try {
                if (!StartPagePrinter(hPrinter)) return -3;
                IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
                Marshal.Copy(bytes, 0, p, bytes.Length);
                int written;
                bool ok = WritePrinter(hPrinter, p, bytes.Length, out written);
                Marshal.FreeCoTaskMem(p);
                if (!ok) return -4;
                EndPagePrinter(hPrinter);
                return written;
            } finally { EndDocPrinter(hPrinter); }
        } finally { ClosePrinter(hPrinter); }
    }
}
"@

if ([string]::IsNullOrWhiteSpace($Printer)) {
  $def = Get-CimInstance Win32_Printer -Filter "Default = TRUE" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($def) { $Printer = $def.Name }
}
if ([string]::IsNullOrWhiteSpace($Printer)) {
  Write-Output "FALHOU: nenhuma impressora informada e o Windows nao tem impressora padrao."
  exit 2
}

# --------------------------------------------------------------------- fonte --
$Fonte = ($Fonte -replace '\s', '').ToLower()
if ($Fonte -notmatch '^[12]x[12]$') { $Fonte = '2x1' }
$dobraLargura = $Fonte.StartsWith('2')
$dobraAltura = $Fonte.EndsWith('2')

# -------------------------------------------- imagem (logo / QR em bitmap) ---
function Get-ImagemEscPos([string]$arquivo, [int]$larguraDots, [double]$fracLargura = 0.72, [double]$fracAltura = 0.30) {
  if ([string]::IsNullOrWhiteSpace($arquivo) -or -not (Test-Path -LiteralPath $arquivo)) { return $null }

  Add-Type -AssemblyName System.Drawing | Out-Null

  $src = $null
  $canvas = $null
  try {
    $src = [System.Drawing.Image]::FromFile($arquivo)

    # nao passa de uma fracao da largura/altura, e sai centralizada
    $maxL = [int][Math]::Round($larguraDots * $fracLargura)
    $maxA = [int][Math]::Round($larguraDots * $fracAltura)
    $escala = [Math]::Min($maxL / $src.Width, $maxA / $src.Height)
    if ($escala -gt 1) { $escala = 1.0 }
    $l = [Math]::Max(1, [int][Math]::Round($src.Width * $escala))
    $a = [Math]::Max(1, [int][Math]::Round($src.Height * $escala))

    $canvas = New-Object System.Drawing.Bitmap($larguraDots, $a, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear([System.Drawing.Color]::White)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, [int](($larguraDots - $l) / 2), 0, $l, $a)
    $g.Dispose()

    $rect = New-Object System.Drawing.Rectangle(0, 0, $larguraDots, $a)
    $data = $canvas.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $stride = $data.Stride
    $bruto = New-Object byte[] ($stride * $a)
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bruto, 0, $bruto.Length)
    $canvas.UnlockBits($data)

    $bytesPorLinha = [int]($larguraDots / 8)
    $saida = New-Object 'System.Collections.Generic.List[byte]'
    # GS v 0 m xL xH yL yH
    $saida.Add([byte]0x1D); $saida.Add([byte]0x76); $saida.Add([byte]0x30); $saida.Add([byte]0x00)
    $saida.Add([byte]($bytesPorLinha -band 0xFF)); $saida.Add([byte](($bytesPorLinha -shr 8) -band 0xFF))
    $saida.Add([byte]($a -band 0xFF)); $saida.Add([byte](($a -shr 8) -band 0xFF))

    for ($y = 0; $y -lt $a; $y++) {
      for ($b = 0; $b -lt $bytesPorLinha; $b++) {
        $valor = 0
        for ($k = 0; $k -lt 8; $k++) {
          $x = ($b * 8) + $k
          $i = ($y * $stride) + ($x * 3)   # Format24bppRgb = B,G,R
          $lum = ($bruto[$i + 2] * 0.299) + ($bruto[$i + 1] * 0.587) + ($bruto[$i] * 0.114)
          if ($lum -lt 150) { $valor = $valor -bor ([byte](0x80) -shr $k) }
        }
        $saida.Add([byte]$valor)
      }
    }
    return ,$saida.ToArray()
  } catch {
    [Console]::Error.WriteLine("AVISO imagem ignorada: " + $_.Exception.Message)
    return
  } finally {
    if ($canvas) { $canvas.Dispose() }
    if ($src) { $src.Dispose() }
  }
}

# ---------------------------------------------------------------- montagem ---
$texto = [System.IO.File]::ReadAllText($TextFile, [System.Text.Encoding]::UTF8)
$texto = $texto -replace "`r`n", "`n" -replace "`r", "`n"
$paginas = @($texto -split [char]12)

$enc = [System.Text.Encoding]::GetEncoding(850)   # PC850: acentos em portugues
$larguraChar = if ($dobraLargura) { 24 } else { 12 }
$maxCols = [int][Math]::Floor($LarguraDots / $larguraChar)

# se alguma linha nao couber na fonte escolhida, cai para a fonte normal
$linhasTodas = @()
foreach ($p in $paginas) { $linhasTodas += ($p -split "`n") }
$maior = 0
foreach ($l in $linhasTodas) { if ($l.Length -gt $maior) { $maior = $l.Length } }
if ($maior -gt $maxCols) {
  $Fonte = '1x1'; $dobraLargura = $false; $dobraAltura = $false
  $larguraChar = 12
  Write-Output ("AVISO: linha de " + $maior + " colunas nao cabe na fonte dobrada; usando fonte normal.")
}

# adiciona bytes numa lista, sem depender de conversoes do PowerShell
function Add-Bytes([System.Collections.Generic.List[byte]]$lista, $valores) {
  foreach ($v in $valores) { [void]$lista.Add([byte]([int]$v)) }
}

$logo = Get-ImagemEscPos $LogoFile $LarguraDots
if ($logo -isnot [byte[]]) { $logo = $null }

# --------------------------------------------------------------- QR Code -----
# 1) nativo: quem desenha o QR e a propria impressora (comando GS ( k do
#    ESC/POS). Sai com os quadradinhos perfeitos, sem depender de imagem.
function Get-QrNativo([string]$texto, [int]$modulo = 8) {
  if ([string]::IsNullOrWhiteSpace($texto)) { return $null }
  if ($modulo -lt 1) { $modulo = 1 }
  if ($modulo -gt 16) { $modulo = 16 }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($texto)
  $out = New-Object 'System.Collections.Generic.List[byte]'
  Add-Bytes $out @(0x1B, 0x61, 0x01)                                          # ESC a 1  centraliza
  Add-Bytes $out @(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)      # modelo 2
  Add-Bytes $out @(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, $modulo)        # tamanho do modulo
  Add-Bytes $out @(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31)           # correcao nivel M
  $len = $bytes.Length + 3
  Add-Bytes $out @(0x1D, 0x28, 0x6B, ($len -band 0xFF), (($len -shr 8) -band 0xFF), 0x31, 0x50, 0x30)
  Add-Bytes $out $bytes
  Add-Bytes $out @(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30)           # imprime o QR
  Add-Bytes $out @(0x1B, 0x61, 0x00, 0x0A)                                   # ESC a 0  volta a esquerda
  return ,$out.ToArray()
}

# 2) reserva: transforma a imagem do QR em bitmap (mesma tecnica da logo)
$qr = $null
$qrOrigem = 'nao'
if (-not [string]::IsNullOrWhiteSpace($QrTexto)) {
  $qr = Get-QrNativo $QrTexto $QrModulo
  if ($qr -isnot [byte[]]) { $qr = $null } else { $qrOrigem = 'nativo' }
}
if (-not $qr -and -not [string]::IsNullOrWhiteSpace($QrFile)) {
  $fracao = [Math]::Min(0.92, $QrDots / [double]$LarguraDots)
  $tmp = Get-ImagemEscPos $QrFile $LarguraDots $fracao $fracao
  if ($tmp -isnot [byte[]]) { $tmp = $null }
  if ($tmp) { $qr = $tmp; $qrOrigem = 'imagem' }
}

$dados = New-Object 'System.Collections.Generic.List[byte]'
$primeira = $true
foreach ($pagina in $paginas) {
  if ([string]::IsNullOrWhiteSpace($pagina)) { continue }

  Add-Bytes $dados @(0x1B, 0x40)          # ESC @    inicializa
  Add-Bytes $dados @(0x1B, 0x74, 0x02)    # ESC t 2  tabela PC850 (acentos)
  Add-Bytes $dados @(0x1B, 0x20, 0x00)    # ESC SP 0 espacamento normal

  $n = 0x00
  if ($dobraLargura) { $n = $n -bor 0x20 }
  if ($dobraAltura) { $n = $n -bor 0x10 }
  Add-Bytes $dados @(0x1B, 0x21, $n)                       # ESC ! n  tamanho da fonte

  # altura entre linhas: sobra uma folga boa embaixo das letras (nao fica colado)
  $alturaLinha = 56
  if ($dobraAltura) { $alturaLinha = 80 }
  if (-not $dobraLargura -and -not $dobraAltura) { $alturaLinha = 48 }
  if ($Espaco -gt 0) { $alturaLinha = $Espaco }
  Add-Bytes $dados @(0x1B, 0x33, $alturaLinha)             # ESC 3 n  espaco entre linhas

  if ($primeira -and $logo) { Add-Bytes $dados $logo; Add-Bytes $dados @(0x0A, 0x0A) }

  # numero do pedido no rodape: a ULTIMA linha do cupom ("PEDIDO #123") sai em
  # letra grande e centralizada, logo abaixo do "obrigado pela preferencia".
  $linhasPagina = @($pagina -split "`n")
  $idxGrande = -1
  $textoGrande = ''
  for ($i = $linhasPagina.Count - 1; $i -ge 0; $i--) {
    $t = $linhasPagina[$i].Trim()
    if ($t.Length -eq 0) { continue }
    $mp = [regex]::Match($t, '^PEDIDO\s*#?\s*(\d+)$')
    if ($mp.Success) { $idxGrande = $i; $textoGrande = 'PEDIDO #' + $mp.Groups[1].Value }
    break
  }

  for ($i = 0; $i -lt $linhasPagina.Count; $i++) {
    $linha = $linhasPagina[$i]
    if ($linha.Trim() -eq '[[QR]]') {
      if ($qr) { Add-Bytes $dados $qr }
      else {
        Add-Bytes $dados $enc.GetBytes('(QR Code indisponivel)')
        Add-Bytes $dados @(0x0A)
      }
      continue
    }
    if ($i -eq $idxGrande) {
      # destaque do numero: 2x na largura e 2x na altura (o resto do cupom e 2x1)
      $escalaW = 2
      $escalaH = 2
      # so diminui a largura se o numero for comprido demais para o papel
      while ($escalaW -gt 1 -and (12 * $escalaW * $textoGrande.Length) -gt $LarguraDots) { $escalaW-- }
      $nGrande = (($escalaH - 1) * 16) + ($escalaW - 1)
      Add-Bytes $dados @(0x1B, 0x61, 0x01)                    # ESC a 1  centraliza
      Add-Bytes $dados @(0x1B, 0x33, (24 * $escalaH + 16))    # ESC 3 n  espaco da linha grande
      Add-Bytes $dados @(0x1B, 0x45, 0x01)                    # ESC E 1  negrito
      Add-Bytes $dados @(0x1D, 0x21, $nGrande)                # GS ! n   letra grande
      Add-Bytes $dados $enc.GetBytes($textoGrande)
      Add-Bytes $dados @(0x0A)
      Add-Bytes $dados @(0x1D, 0x21, 0x00)                    # GS ! 0   volta ao normal
      Add-Bytes $dados @(0x1B, 0x45, 0x00)                    # ESC E 0  sem negrito
      Add-Bytes $dados @(0x1B, 0x33, $alturaLinha)            # volta o espaco normal
      Add-Bytes $dados @(0x1B, 0x61, 0x00)                    # ESC a 0  volta a esquerda
      continue
    }
    if ($linha.Length -gt 0) { Add-Bytes $dados $enc.GetBytes($linha) }
    Add-Bytes $dados @(0x0A)
  }

  Add-Bytes $dados @(0x1B, 0x21, 0x00)                     # ESC ! 0  tamanho normal
  Add-Bytes $dados @(0x1B, 0x64, $Feed)                    # ESC d n  avanca n linhas
  if (-not $SemCorte) { Add-Bytes $dados @(0x1D, 0x56, 0x42, 0x00) }  # GS V B 0 corta
  $primeira = $false
}

if ($dados.Count -eq 0) {
  Write-Output "FALHOU: cupom vazio."
  exit 3
}

if (-not [string]::IsNullOrWhiteSpace($SaidaArquivo)) {
  [System.IO.File]::WriteAllBytes($SaidaArquivo, $dados.ToArray())
  Write-Output ("OK gravado " + $dados.Count + " bytes em " + $SaidaArquivo + " (fonte " + $Fonte + ", logo " + $(if ($logo) { "sim" } else { "nao" }) + ", qr " + $qrOrigem + ")")
  exit 0
}

$enviados = [RincaoRawPrinter]::SendBytes($Printer, $dados.ToArray())
if ($enviados -lt 0) {
  $codigo = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Write-Output ("FALHOU: impressora [" + $Printer + "] recusou (etapa " + $enviados + ", win32 " + $codigo + ").")
  exit 4
}

Write-Output ("OK " + $enviados + " bytes -> " + $Printer + " (fonte " + $Fonte + ", qr " + $qrOrigem + ")")
exit 0
