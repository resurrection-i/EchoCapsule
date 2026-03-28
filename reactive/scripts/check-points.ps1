$ErrorActionPreference = "Stop"

function Require-Env($name) {
  $v = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($v)) {
    throw "Missing env var: $name"
  }
  return $v
}

$destRpc = Require-Env "DESTINATION_RPC"
$destAddr = Require-Env "DESTINATION_CALLBACK_ADDR"
$fan = Require-Env "FAN_ADDR"

Write-Host "Reading points for fan $fan on contract $destAddr"
cast call $destAddr "points(address)(uint256)" $fan --rpc-url $destRpc

