# Test vector search API
$Headers = @{
    "Content-Type" = "application/json"
}
$Body = @{
    query = "杜甫的诗"
    scope = "person"
    topK = 5
} | ConvertTo-Json

Write-Host "Testing vector search API..."
Write-Host "Request: $Body"
Write-Host ""

try {
    $Response = Invoke-RestMethod -Uri "http://localhost:9011/api/v1/vector/test" -Method Post -Headers $Headers -Body $Body
    Write-Host "Response:"
    $Response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $_"
    Write-Host $_.Exception.Response.StatusCode.value__
}
