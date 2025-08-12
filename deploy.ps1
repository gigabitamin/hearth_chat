# 🚀 수동 배포 스크립트 (Render 무료 분량 절약) - PowerShell 버전
# 사용법: .\deploy.ps1 [environment] [force_rebuild]

param(
    [string]$Environment = "production",
    [bool]$ForceRebuild = $false
)

# 에러 발생 시 중단
$ErrorActionPreference = "Stop"

# 색상 정의
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$Cyan = "Cyan"

Write-Host "🚀 Hearth Chat 수동 배포 시작" -ForegroundColor $Blue
Write-Host "환경: $Environment" -ForegroundColor $Yellow
Write-Host "강제 재빌드: $ForceRebuild" -ForegroundColor $Yellow
Write-Host ""

# 1. 코드 상태 확인
Write-Host "📋 1. 코드 상태 확인 중..." -ForegroundColor $Blue
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "❌ 커밋되지 않은 변경사항이 있습니다." -ForegroundColor $Red
    git status --short
    Write-Host ""
    Write-Host "💡 다음 중 하나를 선택하세요:" -ForegroundColor $Yellow
    Write-Host "   1. git add . && git commit -m '배포 전 커밋'" -ForegroundColor $Cyan
    Write-Host "   2. git stash" -ForegroundColor $Cyan
    Write-Host "   3. 변경사항을 되돌리기" -ForegroundColor $Cyan
    exit 1
}
else {
    Write-Host "✅ 모든 변경사항이 커밋되었습니다." -ForegroundColor $Green
}

# 2. 최신 커밋 정보
Write-Host "📋 2. 최신 커밋 정보" -ForegroundColor $Blue
$currentBranch = git branch --show-current
$latestCommit = git log -1 --oneline
$commitHash = git rev-parse HEAD

Write-Host "현재 브랜치: $currentBranch" -ForegroundColor $Yellow
Write-Host "최신 커밋: $latestCommit" -ForegroundColor $Yellow
Write-Host "커밋 해시: $commitHash" -ForegroundColor $Yellow
Write-Host ""

# 3. 테스트 실행 (선택사항)
$runTests = Read-Host "🧪 테스트를 실행하시겠습니까? (y/N)"
if ($runTests -eq "y" -or $runTests -eq "Y") {
    Write-Host "📋 3. 테스트 실행 중..." -ForegroundColor $Blue
    
    # Django 테스트
    Write-Host "Django 테스트 실행 중..." -ForegroundColor $Yellow
    Set-Location hearth_chat_django
    python manage.py test --verbosity=2
    Set-Location ..
    
    # React 테스트 (package.json에 test 스크립트가 있는 경우)
    if (Test-Path "hearth_chat_react/package.json") {
        $packageJson = Get-Content "hearth_chat_react/package.json" | ConvertFrom-Json
        if ($packageJson.scripts.test) {
            Write-Host "React 테스트 실행 중..." -ForegroundColor $Yellow
            Set-Location hearth_chat_react
            npm test -- --watchAll=false
            Set-Location ..
        }
    }
    
    Write-Host "✅ 테스트 완료" -ForegroundColor $Green
}
else {
    Write-Host "⚠️ 테스트를 건너뜁니다." -ForegroundColor $Yellow
}

Write-Host ""

# 4. 빌드 확인
Write-Host "📋 4. 빌드 상태 확인" -ForegroundColor $Blue
if (Test-Path "hearth_chat_react/build") {
    Write-Host "✅ React 빌드 폴더가 존재합니다." -ForegroundColor $Green
}
else {
    Write-Host "⚠️ React 빌드 폴더가 없습니다. 빌드를 생성합니다." -ForegroundColor $Yellow
    Set-Location hearth_chat_react
    npm run build
    Set-Location ..
    Write-Host "✅ React 빌드 완료" -ForegroundColor $Green
}

Write-Host ""

# 5. 배포 안내
Write-Host "📋 5. 배포 방법 안내" -ForegroundColor $Blue
Write-Host "✅ 모든 준비가 완료되었습니다!" -ForegroundColor $Green
Write-Host ""
Write-Host "🚀 다음 중 하나의 방법으로 배포하세요:" -ForegroundColor $Yellow
Write-Host ""
Write-Host "방법 1: GitHub Actions 수동 트리거" -ForegroundColor $Blue
Write-Host "   1. GitHub 저장소 > Actions 탭"
Write-Host "   2. 'Manual Deploy to Render' 워크플로우 선택"
Write-Host "   3. 'Run workflow' 클릭"
Write-Host "   4. Environment: $Environment 선택"
Write-Host "   5. Force rebuild: $ForceRebuild 선택"
Write-Host ""
Write-Host "방법 2: Render 대시보드 직접 배포" -ForegroundColor $Blue
Write-Host "   1. https://dashboard.render.com 접속"
Write-Host "   2. 해당 서비스 선택"
Write-Host "   3. 'Manual Deploy' 클릭"
Write-Host "   4. 'Deploy latest commit' 선택"
Write-Host ""
Write-Host "💡 렌더 무료 분량을 절약하기 위해 자동 배포가 비활성화되었습니다." -ForegroundColor $Yellow
Write-Host "💡 수동으로 배포를 진행해주세요." -ForegroundColor $Yellow

# 6. 환경 변수 체크리스트
Write-Host ""
Write-Host "📋 6. 배포 전 체크리스트" -ForegroundColor $Blue
Write-Host "□ 환경 변수 설정 확인" -ForegroundColor $Yellow
Write-Host "□ 데이터베이스 연결 확인" -ForegroundColor $Yellow
Write-Host "□ 정적 파일 설정 확인" -ForegroundColor $Yellow
Write-Host "□ 보안 설정 확인" -ForegroundColor $Yellow
Write-Host "□ 백업 완료" -ForegroundColor $Yellow

Write-Host ""
Write-Host "🎉 배포 준비 완료!" -ForegroundColor $Green 