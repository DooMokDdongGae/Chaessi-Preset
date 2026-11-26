param([Parameter(Mandatory)][ValidateSet('Protect','Unprotect')][string]$Operation,
      [Parameter(Mandatory)][ValidateSet('root','release')][string]$Role)
$ErrorActionPreference='Stop'
$incomingBytes=$null; $outgoingBytes=$null; $memory=$null; $entropyBytes=$null
try {
  # Windows PowerShell 5.1 exposes ProtectedData through System.Security.
  # The current host invokes that supported provider explicitly.
  Add-Type -AssemblyName System.Security
  $memory=[IO.MemoryStream]::new()
  [Console]::OpenStandardInput().CopyTo($memory)
  $incomingBytes=$memory.ToArray()
  if($incomingBytes.Length -lt 16 -or $incomingBytes.Length -gt 16384){throw 'Invalid provider input'}
  $entropyBytes=[Text.Encoding]::UTF8.GetBytes('chaessi-studio:public-release-key:v1:'+ $Role)
  if($Operation -eq 'Protect'){
    $outgoingBytes=[Security.Cryptography.ProtectedData]::Protect($incomingBytes,$entropyBytes,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  }else{
    $outgoingBytes=[Security.Cryptography.ProtectedData]::Unprotect($incomingBytes,$entropyBytes,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  }
  $stream=[Console]::OpenStandardOutput()
  $stream.Write($outgoingBytes,0,$outgoingBytes.Length)
  $stream.Flush()
}catch{
  [Console]::Error.WriteLine('DPAPI provider failed; no key material is logged.')
  exit 1
}finally{
  foreach($buffer in @($incomingBytes,$outgoingBytes,$entropyBytes)){if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)}}
  if($null -ne $memory){$buffer=$memory.GetBuffer();[Array]::Clear($buffer,0,$buffer.Length);$memory.Dispose()}
}
