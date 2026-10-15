# 動作確認用の簡易サーバー（PowerShell だけで動く）
# 使い方: powershell -ExecutionPolicy Bypass -File tools\serve.ps1
# 同じWi-Fiのスマホから http://<PCのIPアドレス>:8000 で開ける

param([int]$Port = 8000)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.svg'  = 'image/svg+xml'
  '.webmanifest' = 'application/manifest+json'
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$listener.Start()

Write-Host "サーバー起動: http://localhost:$Port"
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  ForEach-Object { Write-Host "スマホからは: http://$($_.IPAddress):$Port" }
Write-Host "止めるときは Ctrl+C"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      # ブラウザは予備の接続を開いたまま何も送らないことがあるので、待ちすぎないようにする
      $stream.ReadTimeout = 2000
      $reader = [System.IO.StreamReader]::new($stream)
      $requestLine = $reader.ReadLine()
      while (($line = $reader.ReadLine()) -ne $null -and $line -ne '') { }
      if (-not $requestLine) { continue }

      $path = [Uri]::UnescapeDataString(($requestLine -split ' ')[1].Split('?')[0])
      if ($path.EndsWith('/')) { $path += 'index.html' }
      $file = [System.IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/')))

      if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
        $body = [System.IO.File]::ReadAllBytes($file)
        $type = $types[[System.IO.Path]::GetExtension($file).ToLower()]
        if (-not $type) { $type = 'application/octet-stream' }
        $status = '200 OK'
      } else {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        $type = 'text/plain; charset=utf-8'
        $status = '404 Not Found'
      }

      # Date は期間限定ガチャの時刻あわせに使う（GitHub Pages も返す）
      $date = [DateTime]::UtcNow.ToString('r')
      $header = "HTTP/1.1 $status`r`nDate: $date`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
      Write-Host "$status $path"
    } catch {
      Write-Host "エラー: $_"
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
