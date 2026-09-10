[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRef = 'rywdochyzhgfaymrmxek'
$repoRoot = Split-Path -Parent $PSScriptRoot
$bundledPnpm = 'C:\Users\Jorge\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$pnpmExecutable = if ($pnpmCommand) { $pnpmCommand.Source } elseif (Test-Path -LiteralPath $bundledPnpm) { $bundledPnpm } else { $null }

if (-not $pnpmExecutable) { throw 'No se encontro pnpm en PATH ni en el runtime local de Codex.' }
if ([string]::IsNullOrWhiteSpace($env:BREVO_API_KEY)) { throw 'BREVO_API_KEY no esta cargada en esta terminal.' }
if ([string]::IsNullOrWhiteSpace($env:AFUCOA_PROD_SECRET_KEY)) { throw 'AFUCOA_PROD_SECRET_KEY no esta cargada en esta terminal.' }

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

$sender = Read-SecretText 'Pega el email del Sender verificado en Brevo y presiona Enter'
$recipient = Read-SecretText 'Pega el inbox real de prueba controlado y presiona Enter'
if ([string]::IsNullOrWhiteSpace($sender) -or [string]::IsNullOrWhiteSpace($recipient)) {
  throw 'Sender e inbox de prueba son obligatorios.'
}

$previous = @{
  SUPABASE_URL = $env:SUPABASE_URL
  SUPABASE_SECRET_KEY = $env:SUPABASE_SECRET_KEY
  RECOVERY_EMAIL_FROM = $env:RECOVERY_EMAIL_FROM
  RECOVERY_TEST_RECIPIENT = $env:RECOVERY_TEST_RECIPIENT
  AFUCOA_RECOVERY_PROD_LIVE_CONFIRM = $env:AFUCOA_RECOVERY_PROD_LIVE_CONFIRM
}

function Invoke-SupabaseCli {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & $pnpmExecutable dlx 'supabase@2.116.0' @Arguments
  if ($LASTEXITCODE -ne 0) { throw 'Supabase CLI fallo.' }
}

try {
  $env:SUPABASE_URL = "https://$projectRef.supabase.co"
  $env:SUPABASE_SECRET_KEY = $env:AFUCOA_PROD_SECRET_KEY
  $env:RECOVERY_EMAIL_FROM = $sender
  $env:RECOVERY_TEST_RECIPIENT = $recipient
  $env:AFUCOA_RECOVERY_PROD_LIVE_CONFIRM = $projectRef

  Push-Location -LiteralPath $repoRoot
  try {
    if ((git branch --show-current) -ne 'afucoa-v2') { throw 'La rama activa no es afucoa-v2.' }
    if (git status --porcelain) { throw 'El working tree debe estar limpio antes del deploy PROD.' }

    & $pnpmExecutable test:recovery-brevo-sandbox
    if ($LASTEXITCODE -ne 0) { throw 'La validacion Brevo sandbox/drop fallo.' }

    Invoke-SupabaseCli secrets set --project-ref $projectRef --yes --log-level error `
      "BREVO_API_KEY=$env:BREVO_API_KEY" `
      'RECOVERY_EMAIL_PROVIDER=brevo' `
      "RECOVERY_EMAIL_FROM=$sender" `
      'RECOVERY_EMAIL_SENDER_NAME=AFUCOA'
    Invoke-SupabaseCli secrets unset RECOVERY_EMAIL_SANDBOX --project-ref $projectRef --yes --log-level error

    Invoke-SupabaseCli functions deploy request-password-recovery confirm-password-recovery `
      --project-ref $projectRef --no-verify-jwt --use-api --yes --log-level error

    & $pnpmExecutable test:recovery-prod-live
    if ($LASTEXITCODE -ne 0) { throw 'Recovery PROD LIVE fallo.' }
  } finally {
    Pop-Location
  }
} finally {
  foreach ($name in $previous.Keys) {
    $value = $previous[$name]
    if ($null -eq $value) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
    else { Set-Item "Env:$name" $value }
  }
  Remove-Item Env:BREVO_API_KEY -ErrorAction SilentlyContinue
  $sender = $null
  $recipient = $null
}
