$p = Get-ChildItem 'C:\Mockaroo\Question Bank\economics' | Where-Object { $_.Name -like '04*' } | Select-Object -First 1 -ExpandProperty FullName
$content = Get-Content $p -Raw
$emdash = [char]0x2014
$bad = '- [[../06 - Monetary Policy]] ' + $emdash + ' RBI uses rates to control inflation]] ' + $emdash + ' RBI uses rates to control inflation]] ' + $emdash + ' RBI uses rates to control inflation'
$good = '- [[../06 - Monetary Policy ' + $emdash + ' Questions]] ' + $emdash + ' RBI uses rates to control inflation'
if ($content.Contains($bad)) {
  $content = $content.Replace($bad, $good)
  Set-Content -Path $p -Value $content -Encoding UTF8 -NoNewline
  Write-Host 'FIXED'
} else {
  Write-Host 'NOT FOUND'
}
