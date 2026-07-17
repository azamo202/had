# import_h1_data.ps1
# Reads بيانات_المشاريع.csv and updates indicator_monthly_values in Supabase
# H1 data goes into month=6 (June) as the cumulative value for the first half

$SUPABASE_URL = "https://xbvalutyozrrvxfrdejn.supabase.co"
$SUPABASE_KEY = "sb_publishable_yLmnusHcgptfNKfeUQ3J_A_mlvhOGeO"

$headers = @{
    "apikey"        = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Content-Type"  = "application/json"
    "Prefer"        = "return=representation"
}

function Invoke-Supabase($path, $method = "GET", $body = $null) {
    $uri = "$SUPABASE_URL/rest/v1/$path"
    if ($body) {
        return Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Body ($body | ConvertTo-Json -Depth 5)
    } else {
        return Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
    }
}

# ──────────────────────────────────────
# 1. Load CSV
# ──────────────────────────────────────
Write-Host "📂 Reading CSV..." -ForegroundColor Cyan
$csvPath = Join-Path $PSScriptRoot "بيانات_المشاريع.csv"
$rows = Import-Csv -Path $csvPath -Encoding UTF8

Write-Host "✅ Loaded $($rows.Count) rows" -ForegroundColor Green

# ──────────────────────────────────────
# 2. Fetch all projects & indicators from Supabase
# ──────────────────────────────────────
Write-Host "🔄 Fetching projects from Supabase..." -ForegroundColor Cyan
$projects = Invoke-Supabase "operational_projects?select=id,project_name"

Write-Host "🔄 Fetching indicators from Supabase..." -ForegroundColor Cyan
$indicators = Invoke-Supabase "project_indicators?select=id,project_id,indicator_name"

Write-Host "🔄 Fetching existing monthly values..." -ForegroundColor Cyan
$existingMonthly = Invoke-Supabase "indicator_monthly_values?select=id,indicator_id,month"

Write-Host "✅ Got $($projects.Count) projects, $($indicators.Count) indicators" -ForegroundColor Green

# ──────────────────────────────────────
# 3. Build lookups
# ──────────────────────────────────────
$projLookup = @{}
foreach ($p in $projects) {
    $projLookup[$p.project_name.Trim()] = $p.id
}

$indLookup = @{}
foreach ($ind in $indicators) {
    $key = "$($ind.project_id)__$($ind.indicator_name.Trim())"
    $indLookup[$key] = $ind.id
}

$existingLookup = @{}
foreach ($mv in $existingMonthly) {
    $key = "$($mv.indicator_id)__$($mv.month)"
    $existingLookup[$key] = $mv.id
}

# ──────────────────────────────────────
# 4. Process each row
# ──────────────────────────────────────
$notScheduled = "غير مجدول في النصف الأول"
$upsertCount = 0
$skipCount = 0
$notFoundProjects = @()
$notFoundIndicators = @()

foreach ($row in $rows) {
    $projectName = $row.'المشروع التشغيلي'.Trim()
    $indicatorName = $row.'مؤشر القياس'.Trim()
    $targetRaw = $row.'المستهدف'.Trim()
    $actualRaw = $row.'المنجز'.Trim()
    $projectProgressRaw = $row.'نسبة إنجاز المشروع'.Trim()

    # Skip "not scheduled" rows
    if ($targetRaw -eq $notScheduled) {
        $skipCount++
        continue
    }

    # Find project
    $projectId = $projLookup[$projectName]
    if (-not $projectId) {
        if ($notFoundProjects -notcontains $projectName) {
            $notFoundProjects += $projectName
        }
        $skipCount++
        continue
    }

    # Find indicator
    $indKey = "${projectId}__${indicatorName}"
    $indicatorId = $indLookup[$indKey]
    if (-not $indicatorId) {
        if ($notFoundIndicators -notcontains "$projectName > $indicatorName") {
            $notFoundIndicators += "$projectName > $indicatorName"
        }
        $skipCount++
        continue
    }

    # Parse target value (remove % sign)
    $targetIsPct = $targetRaw.EndsWith('%')
    $targetValue = $targetRaw.TrimEnd('%').Trim()
    $targetNum = $null
    if ($targetValue -match '^\d+(\.\d+)?$') { $targetNum = [double]$targetValue }

    # Parse actual value
    $actualIsPct = $actualRaw.EndsWith('%')
    $actualValue = $actualRaw.TrimEnd('%').Trim()
    $actualNum = $null
    if ($actualValue -match '^\d+(\.\d+)?$') { $actualNum = [double]$actualValue }

    # We store H1 data in month=6 (June) as the cumulative H1 entry
    $month = 6
    $mvKey = "${indicatorId}__${month}"
    $existingId = $existingLookup[$mvKey]

    $payload = @{
        indicator_id           = $indicatorId
        month                  = $month
        target_value           = $targetNum
        target_value_raw       = $targetValue
        target_is_percentage   = $targetIsPct
        achieved_value         = $actualNum
        achieved_is_percentage = $actualIsPct
    }

    try {
        if ($existingId) {
            # UPDATE
            $patchHeaders = $headers.Clone()
            $patchHeaders["Prefer"] = "return=minimal"
            Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/indicator_monthly_values?id=eq.$existingId" `
                -Method PATCH -Headers $patchHeaders `
                -Body ($payload | ConvertTo-Json -Depth 3) | Out-Null
        } else {
            # INSERT
            Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/indicator_monthly_values" `
                -Method POST -Headers $headers `
                -Body ($payload | ConvertTo-Json -Depth 3) | Out-Null
        }
        $upsertCount++
        Write-Host "  ✅ [$projectName] $indicatorName" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Error on [$projectName] $indicatorName : $_" -ForegroundColor Red
    }
}

# ──────────────────────────────────────
# 5. Summary
# ──────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Upserted : $upsertCount rows" -ForegroundColor Green
Write-Host "⏭  Skipped  : $skipCount rows (not scheduled or not found)" -ForegroundColor Yellow

if ($notFoundProjects.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Projects NOT FOUND in DB ($($notFoundProjects.Count)):" -ForegroundColor Yellow
    $notFoundProjects | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
}

if ($notFoundIndicators.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Indicators NOT FOUND in DB ($($notFoundIndicators.Count)):" -ForegroundColor Yellow
    $notFoundIndicators | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
}
Write-Host "═══════════════════════════════════" -ForegroundColor Cyan
