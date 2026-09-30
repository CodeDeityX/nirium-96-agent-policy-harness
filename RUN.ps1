$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$env:HARNESS_PS_VERSION = $PSVersionTable.PSVersion.ToString()
if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) {
    throw 'Use Windows PowerShell 5.1 as documented.'
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
& $node (Join-Path $PSScriptRoot 'scripts\run.cjs')
exit $LASTEXITCODE
