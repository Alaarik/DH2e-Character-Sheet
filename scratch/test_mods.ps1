$r = Invoke-WebRequest -Uri 'http://localhost:3001/api/gear/templates'
$j = $r.Content | ConvertFrom-Json
$mods = @($j | Where-Object { $_.category -eq 'Armor Mod' })
Write-Output "Armor Mod count: $($mods.Count)"
if ($mods.Count -gt 0) {
    $mods[0] | ConvertTo-Json -Depth 4
}
