[CmdletBinding()]
param(
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ExperienceUrl = 'http://127.0.0.1:1994/'
$ViteEntry = Join-Path $ProjectRoot 'node_modules\vite\bin\vite.js'
$LauncherMutex = $null
$HasLauncherLock = $false

function Test-ExperienceReady {
    $Response = $null
    $Reader = $null
    try {
        $Request = [System.Net.HttpWebRequest]::Create($ExperienceUrl)
        $Request.Proxy = $null
        $Request.Timeout = 1500
        $Request.ReadWriteTimeout = 1500
        $Request.AllowAutoRedirect = $false
        $Response = $Request.GetResponse()
        if ([int]$Response.StatusCode -ne 200) { return $false }
        $Reader = New-Object System.IO.StreamReader($Response.GetResponseStream())
        $Page = $Reader.ReadToEnd()
        return ($Page.Contains("<title>Summer '94</title>") -and ($Page -match 'src="/src/main\.js(?:\?[^\"]*)?"'))
    }
    catch { return $false }
    finally {
        if ($Reader) { $Reader.Dispose() }
        if ($Response) { $Response.Dispose() }
    }
}

function Test-ExperiencePortInUse {
    $Client = New-Object System.Net.Sockets.TcpClient
    $Connection = $null
    try {
        $Connection = $Client.BeginConnect('127.0.0.1', 1994, $null, $null)
        if (-not $Connection.AsyncWaitHandle.WaitOne(500)) { return $false }
        $Client.EndConnect($Connection)
        return $true
    }
    catch { return $false }
    finally {
        if ($Connection) { $Connection.AsyncWaitHandle.Close() }
        $Client.Dispose()
    }
}

try {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'package.json') -PathType Leaf)) {
        throw '找不到项目文件。请把启动文件与 scripts 文件夹保留在 i486 项目文件夹中。'
    }

    # Repeated double-clicks share one server, including while it is still starting.
    $LauncherMutex = New-Object System.Threading.Mutex($false, 'Local\SummerOf1994Launcher1994')
    try { $HasLauncherLock = $LauncherMutex.WaitOne(45000) }
    catch [System.Threading.AbandonedMutexException] { $HasLauncherLock = $true }
    if (-not $HasLauncherLock) {
        throw '另一个启动程序仍在准备，请稍等片刻后重试。'
    }

    if (-not (Test-ExperienceReady)) {
        if (Test-ExperiencePortInUse) {
            throw '端口 1994 已被其他程序占用，或现有服务尚未准备好。请先关闭占用该端口的程序后重试；启动器不会结束其他程序。'
        }

        $NodeCommand = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        $NodeExecutable = if ($NodeCommand) { $NodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs\node.exe' }
        if (-not (Test-Path -LiteralPath $NodeExecutable -PathType Leaf)) {
            throw '未找到 Node.js。请安装 Node.js 22 或更新的 LTS 版本，然后重新双击启动。'
        }

        if (-not (Test-Path -LiteralPath $ViteEntry -PathType Leaf)) {
            Write-Host '首次启动：正在安装项目依赖，请保持网络连接……'
            $NpmEntry = Join-Path (Split-Path -Parent $NodeExecutable) 'node_modules\npm\bin\npm-cli.js'
            if (-not (Test-Path -LiteralPath $NpmEntry -PathType Leaf)) {
                throw '未找到 Node.js 自带的 npm。请重新安装完整的 Node.js LTS 版本。'
            }
            Push-Location -LiteralPath $ProjectRoot
            try {
                $InstallCommand = if (Test-Path -LiteralPath (Join-Path $ProjectRoot 'package-lock.json')) { 'ci' } else { 'install' }
                & $NodeExecutable $NpmEntry $InstallCommand --no-audit --no-fund
                if ($LASTEXITCODE -ne 0) {
                    throw '依赖安装失败。请检查上方错误与网络连接后重试。'
                }
            }
            finally { Pop-Location }
        }

        $LogDirectory = Join-Path $ProjectRoot 'work'
        [System.IO.Directory]::CreateDirectory($LogDirectory) | Out-Null
        $StandardLog = Join-Path $LogDirectory 'launcher-vite.log'
        $ErrorLog = Join-Path $LogDirectory 'launcher-vite-error.log'
        # The executable and working directory are passed as native parameters.
        # A quoted argument keeps paths with spaces and Chinese characters intact.
        $ViteArguments = '"' + $ViteEntry + '" --host 127.0.0.1 --port 1994 --strictPort'
        $ServerProcess = Start-Process -FilePath $NodeExecutable -ArgumentList $ViteArguments -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput $StandardLog -RedirectStandardError $ErrorLog -PassThru
        Write-Host '正在打开 Summer ''94……'
        $StartupDeadline = [DateTime]::UtcNow.AddSeconds(30)
        $IsReady = $false
        while ([DateTime]::UtcNow -lt $StartupDeadline) {
            if (Test-ExperienceReady) { $IsReady = $true; break }
            $ServerProcess.Refresh()
            if ($ServerProcess.HasExited) {
                throw "服务启动失败。详细日志：$ErrorLog"
            }
            Start-Sleep -Milliseconds 250
        }
        if (-not $IsReady) {
            throw "启动准备超过 30 秒。可以稍后重试；详细日志：$StandardLog"
        }
    }

    Write-Host "已就绪：$ExperienceUrl"
    if (-not $NoBrowser) {
        Start-Process -FilePath $ExperienceUrl
    }
}
catch {
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
finally {
    if ($HasLauncherLock) { $LauncherMutex.ReleaseMutex() }
    if ($LauncherMutex) { $LauncherMutex.Dispose() }
}
