$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $ProjectRoot ".env.integracao-evandro"
$ComposeBase = Join-Path $ProjectRoot "docker-compose.yml"
$ComposeIntegration = Join-Path $ProjectRoot "docker-compose.integracao-evandro.yml"

function Stop-WithHelp([string]$Message) {
    Write-Host "`nERRO: $Message" -ForegroundColor Red
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
    Invoke-RestMethod @arguments
}

Write-Host "Teste da API JavaScript com o MySQL da equipe do Evandro" -ForegroundColor Green

if (-not (Test-Path $EnvFile)) {
    Stop-WithHelp "Copie .env.integracao-evandro.example para .env.integracao-evandro e confirme usuario e senha com o Evandro."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Stop-WithHelp "Docker Desktop nao foi encontrado."
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Stop-WithHelp "Abra o Docker Desktop e aguarde aparecer Engine running."
}

Write-Host "`n==> Parando apenas o MySQL local da nossa prova isolada" -ForegroundColor Cyan
docker compose -f $ComposeBase stop mysql 2>$null

Write-Host "`n==> Iniciando API JavaScript e PostgreSQL" -ForegroundColor Cyan
docker compose --env-file $EnvFile -f $ComposeBase -f $ComposeIntegration up --build -d api-javascript postgres
if ($LASTEXITCODE -ne 0) {
    Stop-WithHelp "Nao foi possivel iniciar a API e o PostgreSQL."
}

Write-Host "`n==> Aguardando conexao com o MySQL externo" -ForegroundColor Cyan
$health = $null
for ($attempt = 1; $attempt -le 45; $attempt++) {
    try {
        $health = Invoke-ApiJson -Method "GET" -Path "/health"
        if ($health.status -eq "ok") { break }
    } catch {}
    Start-Sleep -Seconds 2
}

if ($null -eq $health -or $health.status -ne "ok") {
    docker compose --env-file $EnvFile -f $ComposeBase -f $ComposeIntegration logs --tail 120 api-javascript
    Stop-WithHelp "A API nao conseguiu acessar o MySQL externo. Confirme se o container do Evandro esta ligado e se endereco, porta e credenciais estao corretos."
}

$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
$isbn = "INT-$suffix"
if ($isbn.Length -gt 20) { $isbn = $isbn.Substring(0, 20) }

Write-Host "`n==> Executando CRUD e escrita dupla" -ForegroundColor Cyan
$created = Invoke-ApiJson -Method "POST" -Path "/livros" -Body @{
    titulo = "Teste de integracao entre equipes"
    isbn = $isbn
    autor = "Grupo 1 JavaScript"
    editora = "UNDB"
}

$id = $created.id_livro
if (-not $id) { Stop-WithHelp "O cadastro nao retornou id_livro." }

$found = Invoke-ApiJson -Method "GET" -Path "/livros/$id"
if ($found.id_livro -ne $id) { Stop-WithHelp "A leitura do livro cadastrado falhou." }

$updated = Invoke-ApiJson -Method "PUT" -Path "/livros/$id" -Body @{
    titulo = "Teste de integracao atualizado"
    isbn = $isbn
    autor = "Grupo 1 JavaScript"
    editora = "UNDB"
}
if ($updated.titulo -ne "Teste de integracao atualizado") {
    Stop-WithHelp "A atualizacao do livro falhou."
}

Start-Sleep -Seconds 2
$health = Invoke-ApiJson -Method "GET" -Path "/health"
if ($health.status -ne "ok") {
    Stop-WithHelp "O CRUD funcionou no PostgreSQL, mas a replicacao para o MySQL ficou pendente."
}

Invoke-WebRequest -Method Delete -Uri "http://localhost:3001/livros/$id" -TimeoutSec 10 -UseBasicParsing | Out-Null

try {
    Invoke-ApiJson -Method "GET" -Path "/livros/$id" | Out-Null
    Stop-WithHelp "O livro continuou disponivel depois da exclusao."
} catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw }
}

Start-Sleep -Seconds 2
$health = Invoke-ApiJson -Method "GET" -Path "/health"
if ($health.status -ne "ok") {
    Stop-WithHelp "A exclusao funcionou no PostgreSQL, mas ficou pendente no MySQL."
}

Write-Host "`nSUCESSO: API JavaScript, PostgreSQL e MySQL externo integrados." -ForegroundColor Green
Write-Host "Livro temporario usado no teste: ID $id" -ForegroundColor White
