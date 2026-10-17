# 単語データ（TSV）を JSON にまとめる
# 使い方: powershell -ExecutionPolicy Bypass -File tools\build-words.ps1 high 800
#   tools\src\<name>*.tsv を読み、data\words_<name>.json を作る
#   TSV の列: word / meaning / pos / example / example_ja / rank
#   中学の単語（data\words.json）と重なる語、同じセットの中で重なる語、英字以外を含む語は除く
#   [-Exclude] で除くセットを指定（例: 高校と重ならないように TOEIC を作るとき）

param([string]$Name, [int]$Limit = 0, [string[]]$Exclude = @('words'))

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$utf8 = [Text.UTF8Encoding]::new($false)
$skip = @{}
foreach ($ex in $Exclude) {
  $path = Join-Path $root "data\$ex.json"
  if (Test-Path $path) {
    foreach ($w in ([IO.File]::ReadAllText($path, $utf8) | ConvertFrom-Json)) { $skip[$w.word.ToLower()] = $ex }
  }
}

$seen = @{}
$items = New-Object System.Collections.ArrayList
$dropped = New-Object System.Collections.ArrayList
$files = Get-ChildItem (Join-Path $root 'tools\src') -Filter "$Name*.tsv" | Sort-Object { [int]($_.BaseName -replace '\D', '') }
foreach ($f in $files) {
  foreach ($line in [IO.File]::ReadAllLines($f.FullName, $utf8)) {
    if (-not $line.Trim()) { continue }
    $c = $line.Split("`t")
    if ($c.Count -ne 6) { [void]$dropped.Add("列の数がちがう: $line"); continue }
    $key = $c[0].Trim().ToLower()
    if ($key -notmatch '^[a-z][a-z \-]*$') { [void]$dropped.Add("英字以外: $($c[0])"); continue }
    if ($skip.ContainsKey($key)) { [void]$dropped.Add("$($skip[$key]) と重複: $($c[0])"); continue }
    if ($seen.ContainsKey($key)) { [void]$dropped.Add("セット内で重複: $($c[0])"); continue }
    $seen[$key] = $true
    [void]$items.Add([pscustomobject][ordered]@{ word = $c[0].Trim(); meaning = $c[1].Trim(); pos = $c[2].Trim(); example = $c[3].Trim(); example_ja = $c[4].Trim(); rank = $c[5].Trim() })
  }
}

# rank の順（A→B→C）に並べてから番号をふる
$sorted = @($items | Sort-Object { 'ABC'.IndexOf($_.rank) }, { $items.IndexOf($_) })
if ($Limit -gt 0 -and $sorted.Count -gt $Limit) { $sorted = $sorted[0..($Limit - 1)] }
$id = 0
$out = foreach ($it in $sorted) { $id++; $o = [ordered]@{ id = $id }; foreach ($pr in $it.PSObject.Properties) { $o[$pr.Name] = $pr.Value }; $o }

$json = '[' + "`n" + (($out | ForEach-Object { '  ' + ($_ | ConvertTo-Json -Compress) }) -join ",`n") + "`n]`n"
[IO.File]::WriteAllText((Join-Path $root "data\words_$Name.json"), $json, $utf8)

$dropped | ForEach-Object { Write-Host "除外: $_" }
$byRank = $sorted | Group-Object rank | ForEach-Object { "$($_.Name)=$($_.Count)" }
$byPos = $sorted | Group-Object pos | ForEach-Object { "$($_.Name)=$($_.Count)" }
Write-Host "候補 $($items.Count) 語 → $($sorted.Count) 語を書き出し（$($byRank -join ' ')）"
Write-Host "品詞: $($byPos -join ' ')"
