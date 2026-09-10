[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Read-SecretText {
  param([Parameter(Mandatory = $true)][string]$Prompt)

  $secureValue = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

$env:BREVO_API_KEY = Read-SecretText 'Pega ahora la Brevo API Key PROD y presiona Enter'

if ([string]::IsNullOrWhiteSpace($env:BREVO_API_KEY)) {
  throw 'BREVO_API_KEY no quedo cargada.'
}

Write-Output 'BREVO_API_KEY cargada de forma segura; el valor no fue mostrado.'
