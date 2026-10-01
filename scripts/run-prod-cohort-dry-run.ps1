[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$OutputDirectory = (Join-Path $env:LOCALAPPDATA 'AFUCOA\prod-cohort')
)

$ErrorActionPreference = 'Stop'
$projectRef = 'rywdochyzhgfaymrmxek'
$repoRoot = Split-Path -Parent $PSScriptRoot
$bundledPnpm = 'C:\Users\Jorge\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$pnpmExecutable = if ($pnpmCommand) { $pnpmCommand.Source } elseif (Test-Path -LiteralPath $bundledPnpm) { $bundledPnpm } else { $null }
if (-not $pnpmExecutable) { throw 'No se encontro pnpm.' }

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$previous = @{
  SUPABASE_URL = $env:SUPABASE_URL
  SUPABASE_SECRET_KEY = $env:SUPABASE_SECRET_KEY
}
$apiKeys = $null
$secretKey = $null
$rawKeys = $null

try {
  if ((git -C $repoRoot branch --show-current) -ne 'afucoa-v2') { throw 'La rama activa no es afucoa-v2.' }

  # La sesion autenticada de Supabase CLI entrega la Secret API Key solo a
  # memoria de este proceso. No se imprime, persiste ni expone a Vite/GitHub.
  $rawKeys = & $pnpmExecutable dlx 'supabase@2.116.0' projects api-keys `
    --project-ref $projectRef --reveal --output json --log-level error
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible leer las API keys con la sesion Supabase CLI autenticada.' }
  $apiKeys = $rawKeys | ConvertFrom-Json
  $keyList = if ($apiKeys -is [array]) { $apiKeys } elseif ($apiKeys.keys) { $apiKeys.keys } else { @($apiKeys) }
  $secretKey = ($keyList | Where-Object { $_.type -eq 'secret' -and $_.disabled -ne $true } | Select-Object -First 1).api_key
  if ($secretKey -notmatch '^sb_secret_[A-Za-z0-9_-]+$') { throw 'No se encontro una Secret API Key PROD activa.' }

  $env:SUPABASE_URL = "https://$projectRef.supabase.co"
  $env:SUPABASE_SECRET_KEY = $secretKey

  New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
  Push-Location -LiteralPath $repoRoot
  try {
    & $pnpmExecutable exec node scripts/prod-cohort-dry-run.mjs `
      --input $resolvedInput `
      --output-dir $OutputDirectory `
      --confirm-project $projectRef
    if ($LASTEXITCODE -ne 0) { throw 'El dry-run PROD fallo o detecto rechazos/conflictos.' }
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
}
