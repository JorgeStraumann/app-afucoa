[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRef = 'rywdochyzhgfaymrmxek'
$repoRoot = Split-Path -Parent $PSScriptRoot
$bundledPnpm = 'C:\Users\Jorge\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$pnpmExecutable = if ($pnpmCommand) { $pnpmCommand.Source } elseif (Test-Path -LiteralPath $bundledPnpm) { $bundledPnpm } else { $null }
if (-not $pnpmExecutable) { throw 'No se encontro pnpm.' }

$previous = @{
  SUPABASE_URL = $env:SUPABASE_URL
  SUPABASE_SECRET_KEY = $env:SUPABASE_SECRET_KEY
  AFUCOA_PROD_PUBLISHABLE_KEY = $env:AFUCOA_PROD_PUBLISHABLE_KEY
  AFUCOA_PROD_SYNTHETIC_CONFIRM = $env:AFUCOA_PROD_SYNTHETIC_CONFIRM
}
$apiKeys = $null
$secretKey = $null
$publishableKey = $null

try {
  if ((git -C $repoRoot branch --show-current) -ne 'afucoa-v2') { throw 'La rama activa no es afucoa-v2.' }

  # Supabase CLI devuelve las claves a esta variable de proceso. Nunca se
  # imprimen, persisten ni pasan a Vite/GitHub; se eliminan en finally.
  $rawKeys = & $pnpmExecutable dlx 'supabase@2.116.0' projects api-keys `
    --project-ref $projectRef --reveal --output json --log-level error
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible leer las API keys con la sesion Supabase CLI autenticada.' }
  $apiKeys = $rawKeys | ConvertFrom-Json
  $keyList = if ($apiKeys -is [array]) { $apiKeys } elseif ($apiKeys.keys) { $apiKeys.keys } else { @($apiKeys) }
  $secretKey = ($keyList | Where-Object { $_.type -eq 'secret' -and $_.disabled -ne $true } | Select-Object -First 1).api_key
  $publishableKey = ($keyList | Where-Object { $_.type -eq 'publishable' -and $_.disabled -ne $true } | Select-Object -First 1).api_key
  if ($secretKey -notmatch '^sb_secret_[A-Za-z0-9_-]+$') { throw 'No se encontro una Secret API Key PROD activa.' }
  if ($publishableKey -notmatch '^sb_publishable_[A-Za-z0-9_-]+$') { throw 'No se encontro una publishable key PROD activa.' }

  $env:SUPABASE_URL = "https://$projectRef.supabase.co"
  $env:SUPABASE_SECRET_KEY = $secretKey
  $env:AFUCOA_PROD_PUBLISHABLE_KEY = $publishableKey
  $env:AFUCOA_PROD_SYNTHETIC_CONFIRM = $projectRef

  Push-Location -LiteralPath $repoRoot
  try {
    & $pnpmExecutable test:prod-readiness-live
    if ($LASTEXITCODE -ne 0) { throw 'La suite sintética PROD falló; revise el resumen público y el cleanup.' }
  } finally {
    Pop-Location
  }
} finally {
  foreach ($name in $previous.Keys) {
    $value = $previous[$name]
    if ($null -eq $value) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
    else { Set-Item "Env:$name" $value }
  }
  $rawKeys = $null
  $apiKeys = $null
  $secretKey = $null
  $publishableKey = $null
}

