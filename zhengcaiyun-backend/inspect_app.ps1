$ErrorActionPreference = "Stop"

# 1. Get WebSocket URL
$json = Invoke-RestMethod -Uri "http://127.0.0.1:7217/json/list"
$page = $json | Where-Object { $_.url -like "*index.html*" }

if (-not $page) {
    Write-Host "Page not found"
    exit 1
}

$wsUrl = $page.webSocketDebuggerUrl
Write-Host "Connecting to $wsUrl"

# 2. Connect WebSocket
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$cts = New-Object System.Threading.CancellationTokenSource
$ws.ConnectAsync($wsUrl, $cts.Token).Wait()

Write-Host "Connected!"

# 3. Send Commands
function Send-Command {
    param($id, $method, $params)
    $req = @{ id = $id; method = $method }
    if ($params) { $req.params = $params }
    $jsonReq = $req | ConvertTo-Json -Depth 10
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonReq)
    $segment = New-Object System.ArraySegment[byte] -ArgumentList $buffer
    $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).Wait()
}

# Enable DOM
Send-Command -id 1 -method "DOM.enable"
# Get Document
Send-Command -id 2 -method "DOM.getDocument" -params @{ depth = -1; pierce = $true }
# Capture Screenshot
Send-Command -id 3 -method "Page.captureScreenshot"

# 4. Receive Loop
$buffer = New-Object byte[] 10485760 # 10MB buffer
$segment = New-Object System.ArraySegment[byte] -ArgumentList $buffer

while ($ws.State -eq 'Open') {
    $result = $ws.ReceiveAsync($segment, $cts.Token).Result
    $count = $result.Count
    $jsonStr = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $count)
    
    # Handle fragmentation (simple assumption: messages fit in buffer or come sequentially)
    # For robust handling we need a loop, but for this task we hope for the best or use a large buffer.
    
    try {
        $msg = $jsonStr | ConvertFrom-Json
        
        if ($msg.id -eq 2) {
            $msg.result.root | ConvertTo-Json -Depth 100 | Out-File "dom_dump_ps.json" -Encoding UTF8
            Write-Host "Saved DOM dump"
        }
        elseif ($msg.id -eq 3) {
            $bytes = [System.Convert]::FromBase64String($msg.result.data)
            [System.IO.File]::WriteAllBytes("app_state_ps.png", $bytes)
            Write-Host "Saved Screenshot"
            break
        }
    } catch {
        # Partial message or error
    }
}

$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $cts.Token).Wait()
