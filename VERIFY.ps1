param([string]$Results)
$ErrorActionPreference = 'Stop'
$node = (Get-Command node.exe -ErrorAction Stop).Source
& $node (Join-Path $PSScriptRoot 'scripts\verify.cjs') $Results
exit $LASTEXITCODE
