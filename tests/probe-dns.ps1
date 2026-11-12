# Diagnostic (not a test): what does Get-DnsClientCache return on this PC, and with which privileges?
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$admin = (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Host "admin: $admin"
try { $s = Get-Service Dnscache; Write-Host "Dnscache service: $($s.Status) / $($s.StartType)" } catch { Write-Host "service query failed: $_" }
try { [void][System.Net.Dns]::GetHostAddresses('example.com') } catch { Write-Host "resolve failed: $_" }
try { [void](Resolve-DnsName example.com -ErrorAction Stop); Write-Host 'Resolve-DnsName ok' } catch { Write-Host "Resolve-DnsName failed: $_" }
$disp = @(& ipconfig /displaydns)
Write-Host "ipconfig /displaydns lines: $($disp.Count)"
Write-Host ("ipconfig mentions example.com: " + [bool]($disp -match 'example\.com'))
try {
    $e = @(Get-DnsClientCache -ErrorAction Stop)
    Write-Host "entries: $($e.Count)"
    $e | Select-Object -First 5 | Format-List Entry, Name, Type, Data, TimeToLive | Out-String | Write-Host
    $x = @($e | Where-Object { $_.Entry -like '*example.com*' })
    Write-Host "example.com entries: $($x.Count)"
    $x | Format-List Entry, Name, Type, Data | Out-String | Write-Host
} catch { Write-Host "Get-DnsClientCache failed: $_" }
