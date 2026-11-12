# Stand-in "editor" for a trial of scripts\netaudit.ps1. Holds one TCP connection to example.com:443.
# The second call with -r (the "open files" step) exits at once, like a real CLI hand-off.
if ($args -contains '-r') { exit 0 }
$c = New-Object System.Net.Sockets.TcpClient
try { $c.Connect('example.com', 443) } catch { }
Start-Sleep -Seconds 40
$c.Close()
