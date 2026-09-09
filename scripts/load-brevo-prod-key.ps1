[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$env:BREVO_API_KEY = Read-Host 'Pega ahora la Brevo API Key PROD y presiona Enter' -MaskInput

if ([string]::IsNullOrWhiteSpace($env:BREVO_API_KEY)) {
  throw 'BREVO_API_KEY no quedo cargada.'
}

Write-Output 'BREVO_API_KEY cargada de forma segura; el valor no fue mostrado.'
