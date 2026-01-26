$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# Login first
Write-Host "Logging in..." -ForegroundColor Green
$loginResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"testuser@example.com","password":"TestPass123!"}' `
  -WebSession $session -ErrorAction SilentlyContinue

Write-Host "Login status: $($loginResponse.StatusCode)" -ForegroundColor Cyan

# Test GET /api/admin/orders
Write-Host "Testing GET /api/admin/orders..." -ForegroundColor Green
$ordersResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/admin/orders?page=1&limit=20" `
  -Method GET `
  -WebSession $session -ErrorAction SilentlyContinue

Write-Host "Orders endpoint status: $($ordersResponse.StatusCode)" -ForegroundColor Cyan
if ($ordersResponse.StatusCode -eq 200) {
  Write-Host "Orders endpoint working!" -ForegroundColor Green
  $ordersData = $ordersResponse.Content | ConvertFrom-Json
  Write-Host "Response: $($ordersData | ConvertTo-Json -Compress)" -ForegroundColor Yellow
} else {
  Write-Host "Failed with status: $($ordersResponse.StatusCode)" -ForegroundColor Red
}

# Test GET /api/admin/orders/analytics/stats
Write-Host "Testing GET /api/admin/orders/analytics/stats..." -ForegroundColor Green
$statsResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/admin/orders/analytics/stats" `
  -Method GET `
  -WebSession $session -ErrorAction SilentlyContinue

Write-Host "Stats endpoint status: $($statsResponse.StatusCode)" -ForegroundColor Cyan
if ($statsResponse.StatusCode -eq 200) {
  Write-Host "Stats endpoint working!" -ForegroundColor Green
  $statsData = $statsResponse.Content | ConvertFrom-Json
  Write-Host "Response: $($statsData | ConvertTo-Json)" -ForegroundColor Yellow
} else {
  Write-Host "Failed with status: $($statsResponse.StatusCode)" -ForegroundColor Red
}

Write-Host "Tests completed!" -ForegroundColor Green
