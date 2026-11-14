<#
.SYNOPSIS
  Lists recent Code Integrity block events (Smart App Control / App Control for Business) from the
  Microsoft-Windows-CodeIntegrity/Operational log. Read only.

.DESCRIPTION
  For the Phase 1 build check: the self-built 1.146.0 stopped at start with "An Application Control
  policy has blocked this file" for a node-gyp built *.node (2026-11-14). This shows which policy
  blocked which files.
  Events: 3033 / 3034 (image did not meet signing level), 3076 / 3077 (audit / enforced block by an
  App Control policy; the policy name tells Smart App Control "VerifiedAndReputableDesktop" apart).
  Output: JSON { readable, error, since, count, events: [{ time, id, file, process, policy, message }] }.
  -Filter keeps only events whose message contains the text (for example C:\b\).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-ci-events.ps1 -Minutes 30 -Filter 'C:\b\'

  NOTE: ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [int]$Minutes = 60,
    [string]$Filter,
    [int]$Max = 50,
    [string]$OutFile
)

$ErrorActionPreference = 'Stop'
$since = (Get-Date).AddMinutes(-$Minutes)
$out = [ordered]@{ readable = $false; error = $null; since = $since.ToString('o'); count = 0; events = @() }
try {
    $ev = @(Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-CodeIntegrity/Operational'; StartTime = $since; Id = 3033, 3034, 3076, 3077 } -ErrorAction Stop)
    $out.readable = $true
    $rows = @()
    foreach ($e in $ev) {
        $msg = [string]$e.Message
        if ($Filter -and $msg.IndexOf($Filter, [StringComparison]::OrdinalIgnoreCase) -lt 0) { continue }
        $xml = [xml]$e.ToXml()
        $data = @{}
        foreach ($d in @($xml.Event.EventData.Data)) { if ($d.Name) { $data[$d.Name] = [string]$d.'#text' } }
        $rows += [ordered]@{
            time    = $e.TimeCreated.ToString('o')
            id      = $e.Id
            file    = $data['File Name']
            process = $data['Process Name']
            policy  = $(if ($data.ContainsKey('PolicyName')) { $data['PolicyName'] } else { $null })
            message = $(if ($msg.Length -gt 400) { $msg.Substring(0, 400) } else { $msg })
        }
        if ($rows.Count -ge $Max) { break }
    }
    $out.events = $rows
    $out.count = $rows.Count
} catch {
    # No events: Get-WinEvent throws with FullyQualifiedErrorId "NoMatchingEventsFound,Microsoft.PowerShell.Commands.GetWinEventCommand".
    # Match the id, not the message (the message is localized, e.g. Japanese Windows).
    if ([string]$_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') { $out.readable = $true } else { $out.error = $_.Exception.Message }
}
$json = ConvertTo-Json -InputObject $out -Depth 6
if ($OutFile) { [IO.File]::WriteAllText([IO.Path]::GetFullPath($OutFile), $json + "`r`n", (New-Object System.Text.UTF8Encoding($false))) }
Write-Output $json
