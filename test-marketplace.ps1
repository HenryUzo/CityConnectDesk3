#!/usr/bin/env pwsh
# Marketplace Order Flow Test Runner
# Runs the e2e test for marketplace order flow with detailed output

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  Marketplace Order Flow E2E Test" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "`nℹ️  Test Prerequisites:" -ForegroundColor Yellow
Write-Host "  • Backend server must be running (npm run dev)"
Write-Host "  • Test resident account: testresident@gmail.com"
Write-Host "  • Marketplace items should be available"
Write-Host "  • Database should be seeded with test data"

Write-Host "`n🔄 Starting Playwright test...`n" -ForegroundColor Blue

# Run the specific marketplace test
npx playwright test tests/e2e/marketplace-order-flow.spec.ts --reporter=list

$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "`n✅ All marketplace tests passed!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Some tests failed. Check the output above." -ForegroundColor Red
}

Write-Host "`n📊 To view detailed test report, run:" -ForegroundColor Cyan
Write-Host "   npx playwright show-report`n" -ForegroundColor White

exit $exitCode
