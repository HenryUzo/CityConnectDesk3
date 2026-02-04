$ErrorActionPreference = "Continue"
cd "c:\Users\Admin\OneDrive\Documents\CityConnectDesk new\CityConnectDesk"
node scripts/find_company_violators.mjs | Tee-Object -FilePath "violators_output.txt"
Write-Host "Scan complete. Output saved to violators_output.txt"
