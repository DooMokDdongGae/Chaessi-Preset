param([Parameter(Mandatory)][string]$Primary,[Parameter(Mandatory)][string]$Backup,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
function Assert-NoReparse([string]$Target){
  $cursor=[IO.Path]::GetFullPath($Target)
  while($cursor){
    if(Test-Path -LiteralPath $cursor){if((Get-Item -Force -LiteralPath $cursor).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse path is not a vault'}}
    $next=[IO.Path]::GetDirectoryName($cursor)
    if($next -eq $cursor){break};$cursor=$next
  }
}
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$roots=@([IO.Path]::GetFullPath($Primary),[IO.Path]::GetFullPath($Backup))
if($roots[0] -eq $roots[1]){throw 'Separate vault and backup required'}
foreach($root in $roots){
  Assert-NoReparse $root
  if([IO.DriveInfo]::new([IO.Path]::GetPathRoot($root)).DriveType -ne [IO.DriveType]::Fixed){throw 'Local fixed volume required'}
  if(!(Test-Path -LiteralPath $root)){
    if($CheckOnly){throw 'Vault directory absent'}
    [IO.Directory]::CreateDirectory($root) | Out-Null
    $acl=[Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true,$false)
    $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,
      [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit',[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $root -AclObject $acl
  }
  $current=Get-Acl -LiteralPath $root
  if(!$current.AreAccessRulesProtected -or $current.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value){throw 'Vault ownership or inheritance mismatch'}
  $rules=@($current.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
  if($rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $sid.Value -or
    $rules[0].AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or
    $rules[0].FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl -or $rules[0].IsInherited){throw 'Vault ACL is not current-user only'}
  foreach($item in @(Get-ChildItem -LiteralPath $root -Force)){
    if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Vault contains a reparse entry'}
    $fileAcl=Get-Acl -LiteralPath $item.FullName
    if($fileAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value){throw 'Vault file owner mismatch'}
    foreach($entry in $fileAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
      if($entry.IdentityReference.Value -ne $sid.Value -or $entry.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow){throw 'Vault file access mismatch'}
    }
  }
}
[pscustomobject]@{currentUserOnly=$true;inheritanceBlocked=$true;localFixedVolumes=$true;reparseFree=$true;existingAclModified=$false} | ConvertTo-Json -Compress
