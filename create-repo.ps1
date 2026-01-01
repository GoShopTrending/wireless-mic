$envContent = Get-Content 'C:\Users\cisra\CentralMarketPRO\.env'
$tokenLine = $envContent | Select-String 'GITHUB_TOKEN'
$token = $tokenLine.ToString().Split('=')[1]

$headers = @{
    Authorization = "token $token"
    Accept = 'application/vnd.github.v3+json'
}

$body = @{
    name = 'wireless-mic'
    description = 'Wireless Microphone PWA - Turn any phone into a wireless microphone'
    private = $false
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Method Post -Headers $headers -Body $body -ContentType 'application/json'
    Write-Host "Repository created successfully!"
    Write-Host "URL: $($response.html_url)"
    Write-Host "Clone URL: $($response.clone_url)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody"
    }
}
