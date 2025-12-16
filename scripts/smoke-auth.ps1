param(
  [string]$BaseUrl = "http://localhost:5000",
  [string]$Username,
  [string]$Password = "Passw0rd!",
  [switch]$VerboseOutput
)

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[ OK ] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERR ] $msg" -ForegroundColor Red }

try {
  $ProgressPreference = 'SilentlyContinue'

  if (-not $Username) {
    $ts = Get-Date -Format "yyyyMMddHHmmss"
    $Username = "smoke-$ts@example.com"
  }

  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

  Write-Info "BaseUrl: $BaseUrl"
  Write-Info "Username: $Username"

  # 1) Health check
  try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method GET -WebSession $session -TimeoutSec 10
    if ($health.status -ne 'ok') { throw "Unexpected health response" }
    Write-Ok "Health check passed (ts: $($health.ts))"
  } catch {
    Write-Err "Health check failed: $($_.Exception.Message)"
    exit 1
  }

  # 2) Try register
  $registerBody = @{ 
    username = $Username
    password = $Password
    name     = "Smoke Test User"
    email    = $Username
    phone    = "08000000000"
  } | ConvertTo-Json

  $registered = $false
  try {
    $resp = Invoke-RestMethod -Uri "$BaseUrl/api/register" -Method POST -ContentType 'application/json' -Body $registerBody -WebSession $session -TimeoutSec 20
    if ($VerboseOutput) { $resp | ConvertTo-Json -Depth 6 | Write-Host }
    Write-Ok "Registered new user"
    $registered = $true
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'Username already exists') {
      Write-Warn "User exists; will attempt login"
    } else {
      Write-Warn "Register failed (continuing to login): $($msg)"
    }
  }

  # 3) Login (works for both new and existing users)
  $loginBody = @{ username = $Username; password = $Password } | ConvertTo-Json
  try {
    $login = Invoke-RestMethod -Uri "$BaseUrl/api/login" -Method POST -ContentType 'application/json' -Body $loginBody -WebSession $session -TimeoutSec 20
    if ($VerboseOutput) { $login | ConvertTo-Json -Depth 6 | Write-Host }
    Write-Ok "Login successful"
  } catch {
    Write-Err "Login failed: $($_.ErrorDetails.Message)"
    exit 1
  }

  # 4) /api/user
  try {
    $me = Invoke-RestMethod -Uri "$BaseUrl/api/user" -Method GET -WebSession $session -TimeoutSec 10
    Write-Ok "Fetched session user: $($me.email)"
    if ($VerboseOutput) { $me | ConvertTo-Json -Depth 6 | Write-Host }
  } catch {
    Write-Err "/api/user failed: $($_.ErrorDetails.Message)"
    exit 1
  }

  # 5) /api/wallet (might be null if not created yet)
  try {
    $wallet = Invoke-RestMethod -Uri "$BaseUrl/api/wallet" -Method GET -WebSession $session -TimeoutSec 10
    if ($wallet) {
      Write-Ok "Fetched wallet: Id=$($wallet.id) Balance=$($wallet.balance)"
    } else {
      Write-Warn "No wallet returned (this can be normal for non-residents)"
    }
  } catch {
    Write-Warn "/api/wallet request failed: $($_.ErrorDetails.Message)"
  }

  Write-Host "\n=== Smoke Auth Summary ===" -ForegroundColor White
  Write-Host ("User: {0}\nBaseUrl: {1}\nRegistered: {2}" -f $Username, $BaseUrl, $registered) -ForegroundColor White
  exit 0
} catch {
  Write-Err "Unhandled error: $($_.Exception.Message)"
  if ($VerboseOutput) { Write-Host $_.Exception.ToString() -ForegroundColor DarkRed }
  exit 1
}
