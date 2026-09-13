$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$MysqlStopped = $false

function Stop-WithHelp([string]$Message) {
    throw $Message
}

function Invoke-ApiJson {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [object]$Body = $null
    )

    $arguments = @{
        Method = $Method
        Uri = "http://localhost:3001$Path"
        TimeoutSec = 10
    }
    if ($null -ne $Body) {
        $arguments.ContentType = "application/json; charset=utf-8"
        $arguments.Body = $Body | ConvertTo-Json -Compress
    }
    Invoke-RestMethod @arguments
}

try {
    Write-Host "Teste de recuperacao da replicacao PostgreSQL para MySQL" -ForegroundColor Green

    docker info *> $null
    if ($LASTEXITCODE -ne 0) { Stop-WithHelp "Docker Desktop nao esta em execucao." }

    $initialHealth = Invoke-ApiJson -Method "GET" -Path "/health"
    if ($initialHealth.status -ne "ok") {
        Stop-WithHelp "O ambiente precisa iniciar com health igual a ok."
    }

    Write-Host "`n==> Desligando somente o MySQL" -ForegroundColor Cyan
    docker compose stop mysql
    if ($LASTEXITCODE -ne 0) { Stop-WithHelp "Nao foi possivel parar o MySQL." }
    $MysqlStopped = $true

    $suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
    $isbn = "FALHA-$suffix"
    if ($isbn.Length -gt 20) { $isbn = $isbn.Substring(0, 20) }

    Write-Host "`n==> Cadastrando com a replica indisponivel" -ForegroundColor Cyan
    $created = Invoke-ApiJson -Method "POST" -Path "/livros" -Body @{
        titulo = "Teste de recuperacao da replica"
        isbn = $isbn
        autor = "Grupo JavaScript"
        editora = "UNDB"
    }
    $id = $created.id_livro
    if (-not $id) { Stop-WithHelp "O cadastro nao retornou id_livro." }

    $degradedHealth = Invoke-ApiJson -Method "GET" -Path "/health"
    if ($degradedHealth.status -ne "degradado") {
        Stop-WithHelp "O health deveria estar degradado durante a queda do MySQL."
    }
    Write-Host "Livro $id salvo no principal e mantido na fila." -ForegroundColor Yellow

    Write-Host "`n==> Religando o MySQL e aguardando a sincronizacao" -ForegroundColor Cyan
    docker compose start mysql
    if ($LASTEXITCODE -ne 0) { Stop-WithHelp "Nao foi possivel iniciar o MySQL." }
    $MysqlStopped = $false

    $recovered = $false
    for ($attempt = 1; $attempt -le 60; $attempt++) {
        Start-Sleep -Seconds 2
        try {
            $health = Invoke-ApiJson -Method "GET" -Path "/health"
            if ($health.status -eq "ok") {
                $recovered = $true
                break
            }
        } catch {}
    }
    if (-not $recovered) { Stop-WithHelp "A replicacao nao voltou ao estado ok dentro do tempo esperado." }

    $mysqlCount = docker compose exec -T -e MYSQL_PWD=livros_dev mysql mysql -N -u livros livros_db -e "SELECT COUNT(*) FROM livros WHERE id_livro = $id;"
    if ($LASTEXITCODE -ne 0 -or "$mysqlCount".Trim() -ne "1") {
        Stop-WithHelp "O livro nao foi encontrado no MySQL depois da recuperacao."
    }

    Invoke-WebRequest -Method Delete -Uri "http://localhost:3001/livros/$id" -TimeoutSec 10 -UseBasicParsing | Out-Null
    Start-Sleep -Seconds 2

    $postgresCount = docker compose exec -T postgres psql -U livros -d livros_db -tAc "SELECT COUNT(*) FROM livros WHERE id_livro = $id;"
    $mysqlCount = docker compose exec -T -e MYSQL_PWD=livros_dev mysql mysql -N -u livros livros_db -e "SELECT COUNT(*) FROM livros WHERE id_livro = $id;"
    if ("$postgresCount".Trim() -ne "0" -or "$mysqlCount".Trim() -ne "0") {
        Stop-WithHelp "O registro temporario nao foi removido corretamente dos dois bancos."
    }

    Write-Host "`nSUCESSO! A fila sobreviveu a queda e sincronizou o MySQL quando ele voltou." -ForegroundColor Green
} catch {
    Write-Host "`nERRO: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Consulte os logs com: docker compose logs --tail 150 api-javascript mysql postgres" -ForegroundColor Yellow
    exit 1
} finally {
    if ($MysqlStopped) {
        docker compose start mysql | Out-Null
    }
}
