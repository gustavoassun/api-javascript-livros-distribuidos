$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$LogPath = Join-Path $ProjectRoot "diagnostico.txt"

Start-Transcript -Path $LogPath -Append | Out-Null

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Stop-WithHelp([string]$Message) {
    Write-Host "`nERRO: $Message" -ForegroundColor Red
    Write-Host "O diagnostico foi salvo em: $LogPath" -ForegroundColor Yellow
    Write-Host "Envie o arquivo diagnostico.txt ou um print desta tela para o Chat." -ForegroundColor Yellow
    try { Stop-Transcript | Out-Null } catch {}
    exit 1
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
    return Invoke-RestMethod @arguments
}

trap {
    Stop-WithHelp "Falha inesperada: $($_.Exception.Message)"
}

Write-Host "API JavaScript - Inicializacao e teste automatico" -ForegroundColor Green
Write-Host "Inicio: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray

Write-Step "Verificando o Docker"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Stop-WithHelp "Docker nao foi encontrado. E necessario instalar o Docker Desktop para Windows, reiniciar o computador quando solicitado e abrir o programa antes de tentar novamente."
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Stop-WithHelp "Docker Desktop esta instalado, mas nao esta iniciado. Abra o Docker Desktop, espere aparecer 'Engine running' e execute este arquivo novamente."
}

docker compose version
if ($LASTEXITCODE -ne 0) {
    Stop-WithHelp "O comando 'docker compose' nao esta disponivel nesta instalacao. Atualize o Docker Desktop."
}

Write-Step "Construindo e iniciando API, PostgreSQL e MySQL"
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
    docker compose logs --tail 100
    Stop-WithHelp "Nao foi possivel iniciar os containers. Os logs foram exibidos acima."
}

Write-Step "Aguardando a API ficar pronta"
$health = $null
$ready = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
    try {
        $health = Invoke-ApiJson -Method "GET" -Path "/health"
        if ($health.status -eq "ok") {
            $ready = $true
            break
        }
    }
    catch {
    }
    Start-Sleep -Seconds 2
}

if (-not $ready) {
    docker compose ps
    docker compose logs --tail 150 api-javascript postgres mysql
    if ($null -ne $health -and $health.status -eq "degradado") {
        Stop-WithHelp "A API iniciou, mas o MySQL nao ficou pronto para a escrita dupla dentro do tempo esperado."
    }
    Stop-WithHelp "A API nao ficou pronta em http://localhost:3001/health dentro do tempo esperado."
}

Write-Host "API respondeu com status: $($health.status)" -ForegroundColor Green

Write-Step "Testando cadastro, consulta, atualizacao e exclusao"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
$isbn = "TESTE-$suffix"
if ($isbn.Length -gt 20) { $isbn = $isbn.Substring(0, 20) }

$created = Invoke-ApiJson -Method "POST" -Path "/livros" -Body @{
    titulo = "Livro de teste"
    isbn = $isbn
    autor = "Equipe JavaScript"
    editora = "UNDB"
}

$id = $created.id_livro
if (-not $id) { Stop-WithHelp "O cadastro nao retornou id_livro." }
Write-Host "Livro cadastrado com ID $id" -ForegroundColor Green

$found = Invoke-ApiJson -Method "GET" -Path "/livros/$id"
if ($found.id_livro -ne $id) { Stop-WithHelp "A consulta nao encontrou o livro cadastrado." }

$updated = Invoke-ApiJson -Method "PUT" -Path "/livros/$id" -Body @{
    titulo = "Livro de teste atualizado"
    isbn = $isbn
    autor = "Equipe JavaScript"
    editora = "UNDB"
}
if ($updated.titulo -ne "Livro de teste atualizado") {
    Stop-WithHelp "A atualizacao nao foi confirmada."
}

Write-Step "Confirmando escrita nos dois bancos"
$postgresCount = docker compose exec -T postgres psql -U livros -d livros_db -tAc "SELECT COUNT(*) FROM livros WHERE id_livro = $id;"
if ($LASTEXITCODE -ne 0 -or "$postgresCount".Trim() -ne "1") {
    Stop-WithHelp "O livro nao foi confirmado no PostgreSQL."
}

$mysqlCount = docker compose exec -T -e MYSQL_PWD=livros_dev mysql mysql -N -u livros livros_db -e "SELECT COUNT(*) FROM livros WHERE id_livro = $id;"
if ($LASTEXITCODE -ne 0 -or "$mysqlCount".Trim() -ne "1") {
    docker compose logs --tail 100 api-javascript mysql
    Stop-WithHelp "O livro nao foi confirmado no MySQL. Confira os logs exibidos acima."
}

Invoke-WebRequest -Method Delete -Uri "http://localhost:3001/livros/$id" -TimeoutSec 10 -UseBasicParsing | Out-Null

Start-Sleep -Seconds 2
$postgresCount = docker compose exec -T postgres psql -U livros -d livros_db -tAc "SELECT COUNT(*) FROM livros WHERE id_livro = $id;"
if ($LASTEXITCODE -ne 0 -or "$postgresCount".Trim() -ne "0") {
    Stop-WithHelp "A exclusao nao foi confirmada no PostgreSQL."
}

$mysqlCount = docker compose exec -T -e MYSQL_PWD=livros_dev mysql mysql -N -u livros livros_db -e "SELECT COUNT(*) FROM livros WHERE id_livro = $id;"
if ($LASTEXITCODE -ne 0 -or "$mysqlCount".Trim() -ne "0") {
    Stop-WithHelp "A exclusao nao foi confirmada no MySQL."
}

Write-Host "`nSUCESSO!" -ForegroundColor Green
Write-Host "API, PostgreSQL, MySQL, CRUD e escrita dupla estao funcionando." -ForegroundColor Green
Write-Host "Endereco da API: http://localhost:3001" -ForegroundColor White
Write-Host "Health-check: http://localhost:3001/health" -ForegroundColor White
Write-Host "Para encerrar depois, execute PARAR_PROJETO.bat." -ForegroundColor White
Stop-Transcript | Out-Null
