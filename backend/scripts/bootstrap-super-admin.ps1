param([Parameter(Mandatory=$true)][string]$ProjectId,[Parameter(Mandatory=$true)][string]$Uid)
$ErrorActionPreference='Stop'
if (!$env:GOOGLE_APPLICATION_CREDENTIALS) { throw 'Set GOOGLE_APPLICATION_CREDENTIALS to a private service-account JSON file path.' }
$repo=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$project=Join-Path $repo 'backend/services/user-service'
$local=Join-Path $repo '.local'
New-Item -ItemType Directory -Path $local -Force | Out-Null
$classpath=Join-Path $local 'firebase-bootstrap-classpath.txt'
& mvn -B -ntp "-Dmaven.repo.local=$repo/.m2/repository" -f "$project/pom.xml" compile dependency:build-classpath "-Dmdep.outputFile=$classpath"
if ($LASTEXITCODE -ne 0) { throw 'Could not compile Firebase administration tool' }
& java -cp "$project/target/classes;$([System.IO.File]::ReadAllText($classpath).Trim())" com.acme.commerce.user.infrastructure.BootstrapSuperAdmin $ProjectId $Uid
if ($LASTEXITCODE -ne 0) { throw 'Super Admin bootstrap failed' }
