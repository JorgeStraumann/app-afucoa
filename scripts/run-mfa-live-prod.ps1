$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($env:AFUCOA_PROD_SECRET_KEY)) {
  throw 'AFUCOA_PROD_SECRET_KEY no está disponible en esta sesión.'
}

$previousUrl = $env:SUPABASE_URL
$previousSecretKey = $env:SUPABASE_SECRET_KEY
$previousProjectRef = $env:AFUCOA_MFA_LIVE_PROJECT_REF
$previousConfirmation = $env:AFUCOA_MFA_LIVE_CONFIRM
$repoRoot = Split-Path -Parent $PSScriptRoot
$bundledPnpm = 'C:\Users\Jorge\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$pnpmExecutable = if ($pnpmCommand) { $pnpmCommand.Source } elseif (Test-Path -LiteralPath $bundledPnpm) { $bundledPnpm } else { $null }

if (-not $pnpmExecutable) {
  throw 'No se encontró pnpm en PATH ni en el runtime local de Codex.'
}

try {
  $env:SUPABASE_URL = 'https://rywdochyzhgfaymrmxek.supabase.co'
  $env:SUPABASE_SECRET_KEY = $env:AFUCOA_PROD_SECRET_KEY
  $env:AFUCOA_MFA_LIVE_PROJECT_REF = 'rywdochyzhgfaymrmxek'
  $env:AFUCOA_MFA_LIVE_CONFIRM = 'rywdochyzhgfaymrmxek'

  Push-Location -LiteralPath $repoRoot
  try {
    & $pnpmExecutable test:mfa-live
    if ($LASTEXITCODE -ne 0) { throw 'La validación MFA LIVE PROD falló.' }
  } finally {
    Pop-Location
  }
} finally {
  if ($null -eq $previousUrl) { Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue }
  else { $env:SUPABASE_URL = $previousUrl }

  if ($null -eq $previousSecretKey) { Remove-Item Env:SUPABASE_SECRET_KEY -ErrorAction SilentlyContinue }
  else { $env:SUPABASE_SECRET_KEY = $previousSecretKey }

  if ($null -eq $previousProjectRef) { Remove-Item Env:AFUCOA_MFA_LIVE_PROJECT_REF -ErrorAction SilentlyContinue }
  else { $env:AFUCOA_MFA_LIVE_PROJECT_REF = $previousProjectRef }

  if ($null -eq $previousConfirmation) { Remove-Item Env:AFUCOA_MFA_LIVE_CONFIRM -ErrorAction SilentlyContinue }
  else { $env:AFUCOA_MFA_LIVE_CONFIRM = $previousConfirmation }
}
