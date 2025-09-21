param(
  [string]$BaseUrl = 'http://localhost:4000'
)

Write-Host '--- Matschema Auth Test ---' -ForegroundColor Cyan

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function ShowResult($title, $response) {
  Write-Host "`n[$title]" -ForegroundColor Yellow
  if ($null -eq $response) { Write-Host 'Ingen respons'; return }
  try {
    if ($response.Content) {
      $json = $response.Content | ConvertFrom-Json -ErrorAction Stop
      $json | ConvertTo-Json -Depth 6
    } elseif ($response -is [string]) {
      $response
    } else {
      $response | Out-String
    }
  } catch {
    Write-Host $response
  }
}

# 1. Register
$email = "testuser_$([int](Get-Random -Minimum 1000 -Maximum 9999))@example.com"
$password = 'Password123'
$name = 'ScriptUser'
$registerBody = @{ email = $email; password = $password; name = $name } | ConvertTo-Json
Write-Host "Registrerar: $email" -ForegroundColor Green
$registerResp = Invoke-WebRequest -Method Post -Uri "$BaseUrl/api/auth/register" -Body $registerBody -ContentType 'application/json' -WebSession $session -ErrorAction SilentlyContinue
ShowResult 'Register' $registerResp

if (-not $registerResp) { Write-Host 'Avbryter - register misslyckades'; exit 1 }
$registerJson = $registerResp.Content | ConvertFrom-Json
$accessToken = $registerJson.data.accessToken

Start-Sleep -Seconds 1

# 2. Login
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Method Post -Uri "$BaseUrl/api/auth/login" -Body $loginBody -ContentType 'application/json' -WebSession $session -ErrorAction SilentlyContinue
ShowResult 'Login' $loginResp
$loginJson = $loginResp.Content | ConvertFrom-Json
$accessToken = $loginJson.data.accessToken

# 3. Profile /me
$profileResp = Invoke-WebRequest -Uri "$BaseUrl/api/users/me" -Headers @{ Authorization = "Bearer $accessToken" } -WebSession $session -ErrorAction SilentlyContinue
ShowResult 'Profile' $profileResp

# 4. Validation error (short password)
$invalidReg = @{ email = 'bademail'; password = '123' } | ConvertTo-Json
$invResp = Invoke-WebRequest -Method Post -Uri "$BaseUrl/api/auth/register" -Body $invalidReg -ContentType 'application/json' -WebSession $session -ErrorAction SilentlyContinue
ShowResult 'Validation Error' $invResp

# 5. Invalid token
$badTokenResp = Invoke-WebRequest -Uri "$BaseUrl/api/users/me" -Headers @{ Authorization = 'Bearer abc.def.ghi' } -WebSession $session -ErrorAction SilentlyContinue
ShowResult 'Invalid Token' $badTokenResp

# 6. Refresh token
$refreshResp = Invoke-WebRequest -Method Post -Uri "$BaseUrl/api/auth/refresh" -WebSession $session -ErrorAction SilentlyContinue
ShowResult 'Refresh' $refreshResp
if ($refreshResp -and $refreshResp.Content) {
  $refreshJson = $refreshResp.Content | ConvertFrom-Json
  $accessToken = $refreshJson.data.accessToken
}

# 7. Logout
$logoutResp = Invoke-WebRequest -Method Post -Uri "$BaseUrl/api/auth/logout" -WebSession $session -ErrorAction SilentlyContinue
ShowResult 'Logout' $logoutResp

# 8. Profile after logout (old access token still may work until expiry, just show result)
$postLogoutProfile = Invoke-WebRequest -Uri "$BaseUrl/api/users/me" -Headers @{ Authorization = "Bearer $accessToken" } -WebSession $session -ErrorAction SilentlyContinue
ShowResult 'Profile (post logout, old access token)' $postLogoutProfile

Write-Host "`n--- Done ---" -ForegroundColor Cyan
