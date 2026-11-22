# Windows PowerShell 5.1, called with a data-only absolute path in the environment.
$ErrorActionPreference = 'Stop'
$rootPath = [System.IO.Path]::GetFullPath($env:CHAESSI_TRANSFER_ACL_PATH)
if ($rootPath -notmatch '^[A-Za-z]:\\' -or $rootPath -eq [System.IO.Path]::GetPathRoot($rootPath)) { throw 'Unsafe registry root.' }
$sidType = [System.Security.Principal.SecurityIdentifier]
$userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$trusted = @($userSid.Value, 'S-1-5-18', 'S-1-5-32-544')
$cursor = [System.IO.DirectoryInfo]::new($rootPath)
while ($null -ne $cursor) {
    if ($cursor.Exists -and ($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Reparse point.' }
    $cursor = $cursor.Parent
}

function Assert-PrivateAcl([string]$itemPath) {
    if ([IO.Directory]::Exists($itemPath)) { $item = [IO.DirectoryInfo]::new($itemPath) }
    else { $item = [IO.FileInfo]::new($itemPath) }
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point.' }
    $acl = $item.GetAccessControl()
    if ($trusted -notcontains $acl.GetOwner($sidType).Value) { throw 'Unexpected owner.' }
    $rules = @($acl.GetAccessRules($true, $true, $sidType))
    if ($rules.Count -eq 0) { throw 'Unexpected ACL.' }
    foreach ($rule in $rules) {
        if ($rule.AccessControlType -eq 'Allow' -and $trusted -notcontains $rule.IdentityReference.Value) { throw 'Unexpected access.' }
    }
}

$instances = Join-Path $rootPath 'instances'
$null = [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($rootPath))
foreach ($dir in @($rootPath, $instances)) {
    if (-not [IO.Directory]::Exists($dir)) {
        $acl = [System.Security.AccessControl.DirectorySecurity]::new()
        $acl.SetAccessRuleProtection($true, $false)
        $acl.SetOwner($userSid)
        foreach ($sid in $trusted) {
            $identity = [System.Security.Principal.SecurityIdentifier]::new($sid)
            $rule = [System.Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
            $acl.AddAccessRule($rule)
        }
        $null = [IO.Directory]::CreateDirectory($dir, $acl)
    }
    Assert-PrivateAcl $dir
}
