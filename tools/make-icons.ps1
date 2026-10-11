# Generates the PNG app icons in icons/ (same design as icons/icon.svg)
# Usage: powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1

Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\icons'

function New-Icon([int]$size, [string]$path, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::Transparent)

  $orange = [System.Drawing.ColorTranslator]::FromHtml('#ff8a3d')
  $yellow = [System.Drawing.ColorTranslator]::FromHtml('#ffc531')
  $s = $size / 512.0

  if ($maskable) {
    # Maskable icons are cropped by the OS, so fill the whole square
    $g.Clear($orange)
    $scale = 0.8   # keep content inside the safe zone
  } else {
    $r = 112 * $s
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $gp.AddArc(0, 0, $d, $d, 180, 90)
    $gp.AddArc($size - $d, 0, $d, $d, 270, 90)
    $gp.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
    $gp.AddArc(0, $size - $d, $d, $d, 90, 90)
    $gp.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush $orange), $gp)
    $scale = 1.0
  }

  $c = $size / 2.0
  $g.TranslateTransform($c, $c)
  $g.ScaleTransform($scale, $scale)
  $g.TranslateTransform(-$c, -$c)

  $g.FillEllipse((New-Object System.Drawing.SolidBrush $yellow), (366 * $s), (86 * $s), (68 * $s), (68 * $s))

  $font = New-Object System.Drawing.Font 'Arial', (180 * $s), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'
  $fmt.LineAlignment = 'Center'
  $rect = New-Object System.Drawing.RectangleF 0, (30 * $s), $size, $size
  $g.DrawString('Aa', $font, [System.Drawing.Brushes]::White, $rect, $fmt)

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $path"
}

New-Icon 192 (Join-Path $outDir 'icon-192.png') $false
New-Icon 512 (Join-Path $outDir 'icon-512.png') $false
New-Icon 512 (Join-Path $outDir 'icon-maskable-512.png') $true
# iOS draws its own rounded corners, so use the full-bleed version
New-Icon 180 (Join-Path $outDir 'apple-touch-icon.png') $true
