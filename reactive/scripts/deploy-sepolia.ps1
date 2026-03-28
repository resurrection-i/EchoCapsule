$ErrorActionPreference = "Stop"

function Require-Env($name) {
  $v = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($v)) {
    throw "Missing env var: $name"
  }
  return $v
}

Write-Host "== Reactive Hackathon deploy (Sepolia destination) =="

$originRpc = Require-Env "ORIGIN_RPC"
$destRpc = Require-Env "DESTINATION_RPC"
$reactiveRpc = Require-Env "REACTIVE_RPC"

$originChainId = Require-Env "ORIGIN_CHAIN_ID"
$destChainId = Require-Env "DESTINATION_CHAIN_ID"
$reactiveChainId = Require-Env "REACTIVE_CHAIN_ID"

$originAddr = Require-Env "ORIGIN_ADDR"
$destCallbackProxy = Require-Env "DESTINATION_CALLBACK_PROXY_ADDR"

$destPriv = Require-Env "DESTINATION_PRIVATE_KEY"
$reactivePriv = Require-Env "REACTIVE_PRIVATE_KEY"

Write-Host ""
Write-Host "Origin chain id:        $originChainId"
Write-Host "Destination chain id:   $destChainId"
Write-Host "Reactive chain id:      $reactiveChainId"
Write-Host "Origin CapsuleNFT:      $originAddr"
Write-Host "Destination cb proxy:   $destCallbackProxy"
Write-Host ""

Push-Location $PSScriptRoot\..

if (-not (Test-Path ".\lib\reactive-lib")) {
  Write-Host "Installing reactive-lib..."
  forge install Reactive-Network/reactive-lib --no-commit
}

Write-Host ""
Write-Host "1) Deploying Destination contract on Sepolia..."
$destOut = forge create `
  --rpc-url $destRpc `
  --private-key $destPriv `
  src/ComfortPointsCallback.sol:ComfortPointsCallback `
  --constructor-args $destCallbackProxy `
  --value 0.02ether

Write-Host $destOut

$destAddr = ($destOut | Select-String -Pattern "Deployed to:\s*(0x[a-fA-F0-9]{40})").Matches.Groups[1].Value
if ([string]::IsNullOrWhiteSpace($destAddr)) {
  throw "Failed to parse DESTINATION_CALLBACK_ADDR from forge output."
}

Write-Host ""
Write-Host "Destination ComfortPointsCallback: $destAddr"

Write-Host ""
Write-Host "2) Computing topic0 for SuperComfortSent..."
$topic0 = cast keccak "SuperComfortSent(address,string,uint256)"
Write-Host "SUPERCOMFORT_TOPIC0: $topic0"

Write-Host ""
Write-Host "3) Deploying Reactive contract on Lasna..."
$reactiveOut = forge create `
  --rpc-url $reactiveRpc `
  --private-key $reactivePriv `
  --chain-id $reactiveChainId `
  src/SuperComfortReactive.sol:SuperComfortReactive `
  --value 0.1ether `
  --constructor-args `
    $originChainId `
    $destChainId `
    $originAddr `
    $topic0 `
    $destAddr

Write-Host $reactiveOut

$reactiveAddr = ($reactiveOut | Select-String -Pattern "Deployed to:\s*(0x[a-fA-F0-9]{40})").Matches.Groups[1].Value
if ([string]::IsNullOrWhiteSpace($reactiveAddr)) {
  throw "Failed to parse REACTIVE_ADDR from forge output."
}

Write-Host ""
Write-Host "Reactive SuperComfortReactive: $reactiveAddr"
Write-Host ""
Write-Host "Next: trigger an origin tx on Sepolia by calling CapsuleNFT.superComfort(message) from your frontend/wallet."
Write-Host "Then watch for Reactive + Destination txs and update README.md (Verified workflow section)."

Pop-Location

