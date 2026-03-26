param(
    [string]$FeatureDir = "specs/001-user-auth",
    [int]$MaxIterations = 100,
    [int]$MaxBatchSize = 6,
    [int]$SleepSeconds = 3,
    [switch]$DryRun,
    [switch]$Compact,
    [switch]$Status,
    [switch]$Verbose,
    [switch]$FullOutput
)

$ErrorActionPreference = 'Stop'

# ============================================================================
# STYLING & UI HELPERS
# ============================================================================

$script:Theme = @{
    Primary    = 'Cyan'
    Secondary  = 'DarkCyan'
    Success    = 'Green'
    Warning    = 'Yellow'
    Error      = 'Red'
    Muted      = 'DarkGray'
    Text       = 'White'
    Tool       = 'Magenta'
    Result     = 'Blue'
    Batch      = 'DarkYellow'
}

$script:Icons = @{
    Robot      = "[R]"
    Check      = "[+]"
    Cross      = "[X]"
    Arrow      = ">>>"
    Gear       = "[*]"
    Clock      = "[T]"
    Money      = "[$]"
    File       = "[F]"
    Folder     = "[D]"
    Lightning  = "[!]"
    Star       = "[S]"
    Wave       = "[~]"
    Batch      = "[B]"
    Task       = "[#]"
}

$script:Stats = @{
    StartTime      = Get-Date
    TotalCost      = 0.0
    TotalDuration  = 0
    ToolCalls      = 0
    Iterations     = 0
    TasksCompleted = 0
    TasksFailed    = 0
}

function Write-Banner {
    Write-Host ""
    Write-Host "  RALPH - Autonomous Implementation Agent" -ForegroundColor $Theme.Primary
    Write-Host "  ========================================" -ForegroundColor $Theme.Muted
    Write-Host "  Feature: $FeatureDir" -ForegroundColor $Theme.Secondary
    Write-Host ""
}

function Write-Box {
    param(
        [string]$Title,
        [string]$Subtitle = "",
        [string]$Color = $Theme.Primary
    )
    $width = 50
    $line = "-" * $width
    Write-Host ""
    Write-Host "  +$line+" -ForegroundColor $Color
    Write-Host "  |" -ForegroundColor $Color -NoNewline
    $paddedTitle = $Title.PadRight($width)
    Write-Host $paddedTitle -ForegroundColor $Theme.Text -NoNewline
    Write-Host "|" -ForegroundColor $Color
    if ($Subtitle) {
        Write-Host "  |" -ForegroundColor $Color -NoNewline
        $paddedSubtitle = $Subtitle.PadRight($width)
        Write-Host $paddedSubtitle -ForegroundColor $Theme.Muted -NoNewline
        Write-Host "|" -ForegroundColor $Color
    }
    Write-Host "  +$line+" -ForegroundColor $Color
    Write-Host ""
}

function Write-Iteration {
    param([int]$Current, [int]$Total, [int]$BatchSize)
    Write-Host "  Iteration " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host "$Current" -NoNewline -ForegroundColor $Theme.Primary
    Write-Host " of " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host "$Total" -NoNewline -ForegroundColor $Theme.Muted
    if ($BatchSize -gt 1) {
        Write-Host " | " -NoNewline -ForegroundColor $Theme.Muted
        Write-Host "$BatchSize tasks" -ForegroundColor $Theme.Batch
    } else {
        Write-Host ""
    }
}

function Write-Status {
    param([string]$Icon, [string]$Label, [string]$Message, [string]$Color = $Theme.Text)
    Write-Host "  $Icon " -NoNewline -ForegroundColor $Color
    Write-Host "$Label " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host $Message -ForegroundColor $Color
}

function Write-SessionStats {
    $elapsed = (Get-Date) - $script:Stats.StartTime
    $elapsedStr = "{0:hh\:mm\:ss}" -f $elapsed
    Write-Host ""
    Write-Host "  ----------------------------------------" -ForegroundColor $Theme.Muted
    Write-Host "  $($Icons.Clock) " -NoNewline -ForegroundColor $Theme.Primary
    Write-Host "Elapsed: " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host $elapsedStr -NoNewline -ForegroundColor $Theme.Text
    Write-Host "  |  " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host "$($Icons.Money) " -NoNewline -ForegroundColor $Theme.Success
    Write-Host "Cost: " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host ('$' + [math]::Round($script:Stats.TotalCost, 4)) -NoNewline -ForegroundColor $Theme.Success
    Write-Host "  |  " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host "$($Icons.Gear) " -NoNewline -ForegroundColor $Theme.Tool
    Write-Host "Tools: " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host $script:Stats.ToolCalls -ForegroundColor $Theme.Tool
}

function Write-TaskStats {
    Write-Host ""
    Write-Host "  $($Icons.Check) Completed: " -NoNewline -ForegroundColor $Theme.Success
    Write-Host $script:Stats.TasksCompleted -NoNewline -ForegroundColor $Theme.Success
    Write-Host "  |  " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host "$($Icons.Cross) Failed: " -NoNewline -ForegroundColor $Theme.Error
    Write-Host $script:Stats.TasksFailed -ForegroundColor $Theme.Error
}

function Format-ToolInput {
    param([string]$InputStr, [int]$MaxLength = 200)
    if ($InputStr.Length -gt $MaxLength) {
        return $InputStr.Substring(0, $MaxLength) + "..."
    }
    return $InputStr
}

# ============================================================================
# TASK PARSING
# ============================================================================

function Get-TasksFromFile {
    param([string]$TasksFile)

    if (-not (Test-Path $TasksFile)) {
        Write-Host "  $($Icons.Cross) Tasks file not found: $TasksFile" -ForegroundColor $Theme.Error
        return @()
    }

    $content = Get-Content $TasksFile -Raw
    $lines = $content -split "`n"

    $tasks = @()
    $currentPhase = ""

    foreach ($line in $lines) {
        # Detect phase headers
        if ($line -match '^## Phase (\d+):?\s*(.*)') {
            $currentPhase = "Phase $($matches[1])"
        }

        # Parse task lines: - [ ] T001 [P] Description or - [x] T001 Description
        if ($line -match '^\s*-\s*\[([ xX])\]\s*(T\d+[a-z]?)\s*(.*)$') {
            $status = $matches[1]
            $taskId = $matches[2]
            $description = $matches[3].Trim()

            $isParallel = $description -match '\[P\]'
            $description = $description -replace '\[P\]\s*', ''

            $tasks += [PSCustomObject]@{
                Id          = $taskId
                Status      = if ($status -eq ' ') { 'pending' } else { 'complete' }
                Description = $description
                Phase       = $currentPhase
                IsParallel  = $isParallel
                Line        = $line
            }
        }
    }

    return $tasks
}

function Get-NextTaskBatch {
    param(
        [array]$Tasks,
        [int]$MaxBatch = 6
    )

    $incomplete = $Tasks | Where-Object { $_.Status -eq 'pending' }

    if (-not $incomplete -or $incomplete.Count -eq 0) {
        return @()
    }

    $first = $incomplete[0]

    # Non-parallel task - return alone
    if (-not $first.IsParallel) {
        return @($first)
    }

    # Parallel task - find batchable siblings in same phase
    $batch = @($first)
    $currentPhase = $first.Phase

    $remaining = $incomplete | Select-Object -Skip 1

    foreach ($task in $remaining) {
        # Stop if different phase
        if ($task.Phase -ne $currentPhase) { break }

        # Stop if not parallel
        if (-not $task.IsParallel) { break }

        # Stop if max batch reached
        if ($batch.Count -ge $MaxBatch) { break }

        $batch += $task
    }

    return $batch
}

function Get-TaskProgress {
    param([array]$Tasks)

    $total = @($Tasks).Count
    $completeTasks = @($Tasks | Where-Object { $_.Status -eq 'complete' })
    $complete = $completeTasks.Count
    $pending = $total - $complete
    $percent = if ($total -gt 0) { [math]::Round(($complete / $total) * 100, 1) } else { 0 }

    return [PSCustomObject]@{
        Total    = [int]$total
        Complete = [int]$complete
        Pending  = [int]$pending
        Percent  = $percent
    }
}

# ============================================================================
# CONTEXT BUILDING (Matching speckit.implement)
# ============================================================================

function Get-ContextFiles {
    param([string]$FeatureDir)

    $rootDir = Split-Path -Parent $PSScriptRoot
    if (-not $rootDir) { $rootDir = Get-Location }

    $featurePath = Join-Path $rootDir $FeatureDir

    $context = @{
        TasksFile      = Join-Path $featurePath "tasks.md"
        PlanFile       = Join-Path $featurePath "plan.md"
        DataModelFile  = Join-Path $featurePath "data-model.md"
        ContractsDir   = Join-Path $featurePath "contracts"
        ResearchFile   = Join-Path $featurePath "research.md"
        QuickstartFile = Join-Path $featurePath "quickstart.md"
        ProgressFile   = Join-Path $featurePath "progress.md"
        DoubtsFile     = Join-Path $rootDir "DOUBTS_AND_DECISIONS.md"
    }

    return $context
}

function Build-ContextSection {
    param([hashtable]$Context)

    $sections = @()

    # REQUIRED files
    $sections += "## Context Files (Read these FIRST)"
    $sections += ""
    $sections += "### REQUIRED - Always read these:"
    $sections += "- **tasks.md**: $($Context.TasksFile) - Task list and execution plan"
    $sections += "- **plan.md**: $($Context.PlanFile) - Tech stack, architecture, file structure"
    $sections += ""

    # CONDITIONAL files
    $sections += "### IF EXISTS - Read if available:"

    if (Test-Path $Context.DataModelFile) {
        $sections += "- **data-model.md**: $($Context.DataModelFile) - Entities and relationships"
    }

    if (Test-Path $Context.ContractsDir) {
        $sections += "- **contracts/**: $($Context.ContractsDir) - API specifications"
    }

    if (Test-Path $Context.ResearchFile) {
        $sections += "- **research.md**: $($Context.ResearchFile) - Technical decisions"
    }

    if (Test-Path $Context.QuickstartFile) {
        $sections += "- **quickstart.md**: $($Context.QuickstartFile) - Setup instructions"
    }

    $sections += ""
    $sections += "### Progress Tracking:"
    $sections += "- **progress.md**: $($Context.ProgressFile) - Learnings from previous iterations (READ before implementing, WRITE after completing)"
    $sections += "- **doubts.md**: $($Context.DoubtsFile) - Decision log"

    return $sections -join "`n"
}

# ============================================================================
# PROMPT BUILDER
# ============================================================================

function Build-IterationPrompt {
    param(
        [array]$TaskBatch,
        [hashtable]$Context,
        [int]$IterationNum
    )

    $contextSection = Build-ContextSection -Context $Context

    # Task assignment section
    $taskIds = ($TaskBatch | ForEach-Object { $_.Id }) -join ", "
    $taskList = ($TaskBatch | ForEach-Object { "- **$($_.Id)**: $($_.Description)" }) -join "`n"
    $isBatch = $TaskBatch.Count -gt 1

    $taskSection = if ($isBatch) {
        @"
## Your Tasks: $taskIds (Parallel Batch)

These $($TaskBatch.Count) tasks are marked [P] (parallel) and can be done together:

$taskList

Implement ALL of them in this iteration. They are independent and touch different concerns.
"@
    } else {
        @"
## Your Task: $($TaskBatch[0].Id)

$taskList

Implement this ONE task completely before finishing.
"@
    }

    # Quality gates section
    $qualitySection = @"
## Quality Gates (ALL must pass before marking complete)

Run these checks after implementation:

1. **Lint**: ``npm run lint`` (or setup if not configured)
   - Fix ALL errors before proceeding
   - Warnings should be addressed if in files you touched

2. **TypeCheck**: ``npm run typecheck`` (if tsconfig.json exists)
   - Zero type errors allowed

3. **Tests**: ``npm test`` (or ``npm run test``)
   - All tests must pass
   - Each task includes implementation + tests together
   - **Target ≥80% coverage on files you touch**

4. **Security**: ``npm audit --audit-level=high``
   - No high or critical vulnerabilities
   - Document exceptions if unavoidable

5. **Size Limits** (per project constitution):
   - Functions must be < 50 lines (refactor if larger)
   - Files must be < 500 lines (split if larger) - EXCEPT test files (*.test.ts, *.spec.ts) can be up to 1000 lines
   - Cognitive complexity < 15

6. **JSDoc Documentation**:
   - All exported functions/classes you create MUST have JSDoc
   - Any undocumented exports in files you touch SHOULD be documented
   - Include @param, @returns, and @throws as applicable

**CRITICAL: If ANY gate fails:**
- Do NOT mark task(s) as complete
- Do NOT commit broken code
- Fix the issue first (lint error, test failure, size violation)
- Re-run ALL checks until they pass
- Only THEN proceed to completion protocol
"@

    # Completion protocol
    $completionSection = @"
## CRITICAL: Completion Protocol (MUST FOLLOW)

**YOU MUST COMPLETE ALL THESE STEPS BEFORE THE SESSION ENDS.**
**FAILURE TO COMPLETE THESE STEPS MEANS THE TASK WILL BE RETRIED.**

### Step 1: Mark Task Complete in tasks.md
- Open the tasks.md file
- Find your task(s): $taskIds
- Change ``- [ ]`` to ``- [x]`` for EACH completed task
- Save the file
- **VERIFY**: Read tasks.md again to confirm the checkbox changed

### Step 2: Commit All Changes
Run these commands:
```bash
git add -A
git commit -m "feat($taskIds): [brief description]"
```
**VERIFY**: Run ``git status`` to confirm working tree is clean

### Step 3: Push to Remote
```bash
git push
```
**VERIFY**: Confirm push succeeded (no errors)

### Step 4: Document in progress.md
**IMPORTANT: You MUST append to the file at $($Context.ProgressFile)**

Use the Edit or Write tool to append this format:
```markdown
## Iteration $IterationNum - $taskIds
- What was implemented (1-2 sentences)
- Learnings for future iterations (patterns discovered, gotchas encountered)
- Useful commands discovered (add to CLAUDE.md if reusable)
---
```
Do NOT include: file lists, code examples/snippets. Just patterns, gotchas, and commands.

### Step 5: Signal Completion (MANDATORY)
**AS YOUR FINAL ACTION**, output this EXACT text:
``<iteration-complete>DONE</iteration-complete>``

---

**IMPORTANT REMINDERS:**
- If you skip Step 1, the same task will run again next iteration
- If you skip Step 5, the system won't know you finished
- Complete ALL steps even if the task seemed simple
- Do NOT end the session without outputting the completion signal

**If blocked or unable to complete:**
- Document the blocker in $($Context.ProgressFile)
- Do NOT output the completion signal
- Do NOT mark tasks as complete
"@

    # Test-after guidance
    $tddSection = @"
## Test-After Approach

Tasks in tasks.md combine implementation + tests in single tasks:
- Each task includes: implementation AND unit/component tests
- Workflow: Implement function → Write tests → Verify ≥80% coverage

After implementing, run coverage check on the file:
``npm run test:coverage -- --collectCoverageFrom="<file-you-changed>"``

## Assertion Quality

Assert exact values, not existence:
- **USE**: ``toBe(exactValue)``, ``toEqual(exactObject)``, ``toThrow(SpecificError)``, ``toHaveBeenCalledWith(exactArgs)``
- **AVOID**: ``toBeDefined()``, ``toBeTruthy()``, ``toMatchObject({})``

React Native: Use ``getByRole``/``getByText`` queries, ``userEvent`` over ``fireEvent``.
"@

    $coverageSection = @"
## Coverage Requirements

**Per-Task**: After implementing each file, verify coverage:
``npm run test:coverage -- --collectCoverageFrom="src/services/your-file.ts"``
Target: ≥80% on the file you just implemented.

**At Phase Checkpoint**: Before marking checkpoint complete:
1. Run ``npm run test:coverage``
2. Verify ≥80% on all services, hooks, and lib files touched in this phase
"@

    # Assemble full prompt
    $prompt = @"
You are an autonomous implementation agent. Complete the assigned task(s) in a single iteration.

**CRITICAL**: You MUST end this session by:
1. Marking task(s) as [x] in tasks.md
2. Committing and pushing changes
3. Outputting ``<iteration-complete>DONE</iteration-complete>``
If you don't do these steps, THIS SAME TASK WILL RUN AGAIN.

$contextSection

$taskSection

## Before Implementing

1. **Read progress.md** at $($Context.ProgressFile) - check Learnings from previous iterations
2. If you need to research something (APIs, libraries, patterns), use the Task tool with subagent_type=Explore
3. Check plan.md and existing code for established patterns

$qualitySection

$tddSection

$coverageSection

## Code Standards

- Follow patterns established in plan.md and existing code
- Self-documenting code with clear naming
- Handle errors explicitly with actionable messages
- No ``any`` types in TypeScript
- Functions < 50 lines, files < 500 lines (test files: 1000 lines max)

## Logging (src/lib/logger.ts)

Use the logger from ``src/lib/logger.ts`` (NOT console.log):
- ``logger.debug(msg, data?)`` - Dev only, verbose details
- ``logger.info(msg, data?)`` - Business events (user signed in, event created)
- ``logger.warn(msg, data?)`` - Recoverable issues (retry succeeded, fallback used)
- ``logger.error(msg, error, data?)`` - Failures requiring attention
- ``logger.track(event, data?)`` - User actions for analytics

**When to log**: Auth flows, service operations, API errors, state transitions
**Skip logging**: Renders, CRUD success, mappers, pure utilities

## Document Commands in CLAUDE.md

When you set up the app or discover useful commands, add them to CLAUDE.md:
- How to run the app: ``npx expo start``, ``npx expo start --clear``
- How to run tests: ``npm test``, ``npm run test:watch``
- How to lint/typecheck: ``npm run lint``, ``npm run typecheck``
- Supabase commands: ``supabase start``, ``supabase db push``, ``supabase gen types typescript``
- Build commands: ``eas build --profile development``

## Document Doubts

If uncertain about implementation choices, document in DOUBTS_AND_DECISIONS.md:
- What the doubt was
- Options considered
- Decision made and why

$completionSection
"@

    return $prompt
}

# ============================================================================
# CLAUDE STREAMING
# ============================================================================

function Invoke-ClaudeStreaming {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Prompt,
        [string]$Label = "Claude"
    )

    $textOutput = ""
    $iterationCost = 0
    $iterationDuration = 0
    $iterationTools = 0

    $promptFile = [System.IO.Path]::GetTempFileName()
    try {
        $Prompt | Out-File -FilePath $promptFile -Encoding utf8 -NoNewline

        & claude --dangerously-skip-permissions -p --verbose --output-format stream-json (Get-Content $promptFile -Raw) 2>&1 | ForEach-Object {
            $line = $_

            try {
                $json = $line | ConvertFrom-Json -ErrorAction Stop

                switch ($json.type) {
                    "system" {
                        $timestamp = Get-Date -Format "HH:mm:ss"
                        Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                        Write-Host "$($Icons.Lightning) Session initialized" -ForegroundColor $Theme.Secondary
                    }
                    "assistant" {
                        if ($json.message.content) {
                            foreach ($block in $json.message.content) {
                                if ($block.type -eq "text") {
                                    $timestamp = Get-Date -Format "HH:mm:ss"
                                    $lines = $block.text -split "`n"
                                    foreach ($textLine in $lines) {
                                        if ($textLine.Trim()) {
                                            Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                            Write-Host "$($Icons.Arrow) " -NoNewline -ForegroundColor $Theme.Success
                                            # Truncate long lines for display (200 chars default, full if -FullOutput)
                                            $displayLine = if ($FullOutput) {
                                                $textLine
                                            } elseif ($textLine.Length -gt 200) {
                                                $textLine.Substring(0, 197) + "..."
                                            } else {
                                                $textLine
                                            }
                                            Write-Host $displayLine -ForegroundColor $Theme.Text
                                        }
                                    }
                                    $textOutput += $block.text + "`n"
                                }
                                elseif ($block.type -eq "tool_use") {
                                    $iterationTools++
                                    $script:Stats.ToolCalls++
                                    $timestamp = Get-Date -Format "HH:mm:ss"
                                    Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                    Write-Host "$($Icons.Gear) " -NoNewline -ForegroundColor $Theme.Tool
                                    Write-Host "$($block.name)" -NoNewline -ForegroundColor $Theme.Tool
                                    # Always show tool input, always capped at 200 chars (commands don't need full output)
                                    if ($block.input) {
                                        $inputStr = ($block.input | ConvertTo-Json -Compress)
                                        $inputStr = Format-ToolInput -InputStr $inputStr -MaxLength 200
                                        Write-Host " $inputStr" -ForegroundColor $Theme.Muted
                                    } else {
                                        Write-Host ""
                                    }
                                }
                            }
                        }
                    }
                    "user" {
                        if ($json.message.content) {
                            foreach ($block in $json.message.content) {
                                if ($block.type -eq "tool_result") {
                                    $timestamp = Get-Date -Format "HH:mm:ss"
                                    Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                    Write-Host "$($Icons.Check) " -NoNewline -ForegroundColor $Theme.Result
                                    Write-Host "Result received" -ForegroundColor $Theme.Result
                                }
                            }
                        }
                    }
                    "result" {
                        $iterationCost = $json.total_cost_usd
                        $iterationDuration = $json.duration_ms
                        $script:Stats.TotalCost += $iterationCost
                        $script:Stats.TotalDuration += $iterationDuration

                        Write-Host ""
                        Write-Host "  +------------------------------------------+" -ForegroundColor $Theme.Success
                        Write-Host "  | " -NoNewline -ForegroundColor $Theme.Success
                        Write-Host "$($Icons.Check) Iteration finished" -NoNewline -ForegroundColor $Theme.Success
                        $durationSec = [math]::Round($iterationDuration / 1000, 1)
                        Write-Host " | ${durationSec}s" -NoNewline -ForegroundColor $Theme.Muted
                        Write-Host " | " -NoNewline -ForegroundColor $Theme.Success
                        Write-Host ('$' + [math]::Round($iterationCost, 4)) -NoNewline -ForegroundColor $Theme.Success
                        Write-Host " | $iterationTools tools" -NoNewline -ForegroundColor $Theme.Tool
                        Write-Host " |" -ForegroundColor $Theme.Success
                        Write-Host "  +------------------------------------------+" -ForegroundColor $Theme.Success

                        if ($json.result) {
                            $textOutput += $json.result
                        }
                    }
                }
            }
            catch {
                if ($line -and $line.ToString().Trim()) {
                    Write-Host "  $line" -ForegroundColor $Theme.Muted
                }
            }
        }
    }
    catch {
        Write-Host "  $($Icons.Cross) ERROR: $($_.Exception.Message)" -ForegroundColor $Theme.Error
    }
    finally {
        Remove-Item $promptFile -Force -ErrorAction SilentlyContinue
    }

    return $textOutput
}

# ============================================================================
# PROGRESS COMPACTION
# ============================================================================

function Invoke-ProgressCompaction {
    param([string]$ProgressFile)

    if (-not (Test-Path $ProgressFile)) {
        Write-Status -Icon $Icons.Cross -Label "Compact:" -Message "Progress file not found" -Color $Theme.Warning
        return
    }

    $lineCount = (Get-Content $ProgressFile | Measure-Object -Line).Lines
    Write-Status -Icon $Icons.File -Label "Lines:" -Message "$lineCount lines in progress file" -Color $Theme.Muted

    if ($lineCount -lt 500 -and -not $Compact) {
        Write-Status -Icon $Icons.Check -Label "Compact:" -Message "Not needed (< 500 lines)" -Color $Theme.Muted
        return
    }

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = $ProgressFile -replace '\.md$', ".backup.$timestamp.md"
    Copy-Item $ProgressFile $backupFile

    Write-Box -Title "$($Icons.Folder) Compacting Progress File" -Color $Theme.Warning
    Write-Status -Icon $Icons.File -Label "Backup:" -Message $backupFile -Color $Theme.Muted

    $compactPrompt = @"
You are a documentation compactor. Compact the progress file and commit the changes.

## Files
- Progress file: $ProgressFile
- Backup file: $backupFile (already created)

## Step 1: Read and Compact
1. Read the progress file at $ProgressFile
2. Keep any header sections (# Progress Log, ## Learnings, etc.)
3. MERGE older iteration details into a '## Compacted History' section:
   - Key patterns discovered (deduplicated)
   - Important gotchas (deduplicated)
   - Useful commands (deduplicated)
   - Do NOT include: code examples/snippets, file lists
   - Target: Compacted History section should be under 300 lines
4. Keep the LAST 5 iterations in full detail (these don't count toward 300 line limit)
5. Write the compacted content back to $ProgressFile

DO NOT lose critical learnings - deduplicate and summarize older content.

## Step 2: Commit and Push
After writing the compacted file:
``````bash
git add $ProgressFile $backupFile
git commit -m "chore: compact progress file"
git push
``````

Verify the push succeeded before ending.
"@

    $result = Invoke-ClaudeStreaming -Prompt $compactPrompt -Label "Compactor"

    $newLineCount = (Get-Content $ProgressFile | Measure-Object -Line).Lines
    Write-Status -Icon $Icons.Check -Label "Result:" -Message "Compacted from $lineCount to $newLineCount lines" -Color $Theme.Success
}

# ============================================================================
# STATUS MODE
# ============================================================================

function Show-Status {
    param([string]$FeatureDir)

    $context = Get-ContextFiles -FeatureDir $FeatureDir
    $tasks = Get-TasksFromFile -TasksFile $context.TasksFile
    $progress = Get-TaskProgress -Tasks $tasks

    Write-Banner
    Write-Box -Title "Task Status" -Subtitle "$FeatureDir"

    Write-Host "  Progress: " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host "$($progress.Complete)/$($progress.Total)" -NoNewline -ForegroundColor $Theme.Primary
    Write-Host " ($($progress.Percent)%)" -ForegroundColor $Theme.Success
    Write-Host ""

    # Show by phase
    $phases = $tasks | Group-Object -Property Phase | Sort-Object Name

    foreach ($phase in $phases) {
        $phaseComplete = ($phase.Group | Where-Object { $_.Status -eq 'complete' }).Count
        $phaseTotal = $phase.Group.Count
        $phasePercent = if ($phaseTotal -gt 0) { [math]::Round(($phaseComplete / $phaseTotal) * 100) } else { 0 }

        $statusColor = if ($phasePercent -eq 100) { $Theme.Success }
                       elseif ($phasePercent -gt 0) { $Theme.Warning }
                       else { $Theme.Muted }

        Write-Host "  $($phase.Name): " -NoNewline -ForegroundColor $Theme.Text
        Write-Host "$phaseComplete/$phaseTotal" -NoNewline -ForegroundColor $statusColor
        Write-Host " ($phasePercent%)" -ForegroundColor $statusColor
    }

    Write-Host ""

    # Show next batch
    $nextBatch = Get-NextTaskBatch -Tasks $tasks -MaxBatch $MaxBatchSize
    if ($nextBatch.Count -gt 0) {
        Write-Host "  Next task(s):" -ForegroundColor $Theme.Primary
        foreach ($task in $nextBatch) {
            $parallelTag = if ($task.IsParallel) { " [P]" } else { "" }
            Write-Host "    $($task.Id)$parallelTag - " -NoNewline -ForegroundColor $Theme.Batch
            $desc = if ($task.Description.Length -gt 60) { $task.Description.Substring(0, 57) + "..." } else { $task.Description }
            Write-Host $desc -ForegroundColor $Theme.Muted
        }
    } else {
        Write-Host "  All tasks complete!" -ForegroundColor $Theme.Success
    }

    Write-Host ""
}

# ============================================================================
# MAIN SCRIPT
# ============================================================================

$rootDir = Split-Path -Parent $PSScriptRoot
if (-not $rootDir) { $rootDir = Get-Location }

# Handle special modes
if ($Status) {
    Show-Status -FeatureDir $FeatureDir
    exit 0
}

if ($Compact) {
    $context = Get-ContextFiles -FeatureDir $FeatureDir
    Invoke-ProgressCompaction -ProgressFile $context.ProgressFile
    exit 0
}

# Validate feature directory
$context = Get-ContextFiles -FeatureDir $FeatureDir
if (-not (Test-Path $context.TasksFile)) {
    Write-Host "  $($Icons.Cross) Tasks file not found: $($context.TasksFile)" -ForegroundColor $Theme.Error
    Write-Host "  Run /speckit.tasks first to generate tasks." -ForegroundColor $Theme.Muted
    exit 1
}

if (-not (Test-Path $context.PlanFile)) {
    Write-Host "  $($Icons.Cross) Plan file not found: $($context.PlanFile)" -ForegroundColor $Theme.Error
    Write-Host "  Run /speckit.plan first to generate the plan." -ForegroundColor $Theme.Muted
    exit 1
}

Write-Banner

# Parse tasks
$tasks = Get-TasksFromFile -TasksFile $context.TasksFile
$initialProgress = Get-TaskProgress -Tasks $tasks

Write-Box -Title "$($Icons.Star) Implementation Session" -Subtitle "Tasks: $($initialProgress.Complete)/$($initialProgress.Total) complete ($($initialProgress.Percent)%)"

Write-Status -Icon $Icons.File -Label "Tasks:" -Message $context.TasksFile -Color $Theme.Secondary
Write-Status -Icon $Icons.File -Label "Progress:" -Message $context.ProgressFile -Color $Theme.Secondary
Write-Host ""

# Check if already complete
if ($initialProgress.Pending -eq 0) {
    Write-Box -Title "$($Icons.Check) All Tasks Complete!" -Color $Theme.Success
    exit 0
}

# Create progress file if it doesn't exist
if (-not (Test-Path $context.ProgressFile)) {
    $header = "# Progress Log`n`nIteration learnings and patterns discovered during implementation.`n`n---`n"
    $header | Out-File -FilePath $context.ProgressFile -Encoding utf8
    Write-Status -Icon $Icons.File -Label "Created:" -Message $context.ProgressFile -Color $Theme.Success
}

# Check for progress compaction
if ((Test-Path $context.ProgressFile) -and ((Get-Content $context.ProgressFile | Measure-Object -Line).Lines -gt 1000)) {
    Invoke-ProgressCompaction -ProgressFile $context.ProgressFile
    Start-Sleep -Seconds $SleepSeconds
}

# Main iteration loop
for ($i = 1; $i -le $MaxIterations; $i++) {
    $script:Stats.Iterations = $i

    # Re-parse tasks each iteration (they may have been updated)
    $tasks = Get-TasksFromFile -TasksFile $context.TasksFile
    $progress = Get-TaskProgress -Tasks $tasks

    # Get next batch
    $batch = Get-NextTaskBatch -Tasks $tasks -MaxBatch $MaxBatchSize

    if ($batch.Count -eq 0) {
        Write-Box -Title "$($Icons.Check) All Tasks Complete!" -Color $Theme.Success
        break
    }

    # Display iteration header
    Write-Host ""
    Write-Host "  ========================================" -ForegroundColor $Theme.Primary
    Write-Iteration -Current $i -Total $MaxIterations -BatchSize $batch.Count
    Write-Host "  Progress: $($progress.Complete)/$($progress.Total) ($($progress.Percent)%)" -ForegroundColor $Theme.Muted
    Write-Host "  ========================================" -ForegroundColor $Theme.Primary
    Write-Host ""

    # Show tasks in this batch
    foreach ($task in $batch) {
        $parallelTag = if ($task.IsParallel) { " [P]" } else { "" }
        Write-Host "  $($Icons.Task) $($task.Id)$parallelTag " -NoNewline -ForegroundColor $Theme.Batch
        $desc = if ($task.Description.Length -gt 70) { $task.Description.Substring(0, 67) + "..." } else { $task.Description }
        Write-Host $desc -ForegroundColor $Theme.Text
    }
    Write-Host ""

    # Dry run mode
    if ($DryRun) {
        Write-Status -Icon $Icons.Wave -Label "DryRun:" -Message "Would execute batch of $($batch.Count) task(s)" -Color $Theme.Warning
        Start-Sleep -Seconds 1
        continue
    }

    # Build and execute prompt
    $prompt = Build-IterationPrompt -TaskBatch $batch -Context $context -IterationNum $i
    $result = Invoke-ClaudeStreaming -Prompt $prompt -Label "Implementation"

    Write-SessionStats

    # Check for completion signal
    if ($result -match "<iteration-complete>DONE</iteration-complete>") {
        $script:Stats.TasksCompleted += $batch.Count
        Write-Host ""
        Write-Status -Icon $Icons.Check -Label "Status:" -Message "Iteration complete - $($batch.Count) task(s) done" -Color $Theme.Success

        # Push any unpushed commits
        $unpushed = & git log '@{u}..HEAD' --oneline 2>$null
        if ($unpushed) {
            Write-Status -Icon $Icons.Arrow -Label "Git:" -Message "Pushing commits..." -Color $Theme.Muted

            $maxRetries = 3
            $retryDelay = 2
            $pushSuccess = $false

            for ($retry = 1; $retry -le $maxRetries; $retry++) {
                $pushOutput = & git push 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $pushSuccess = $true
                    break
                }
                if ($retry -lt $maxRetries) {
                    Write-Status -Icon $Icons.Warning -Label "Git:" -Message "Push failed, retrying in ${retryDelay}s..." -Color $Theme.Warning
                    Start-Sleep -Seconds $retryDelay
                    $retryDelay = $retryDelay * 2
                }
            }

            if ($pushSuccess) {
                Write-Status -Icon $Icons.Check -Label "Git:" -Message "Pushed successfully" -Color $Theme.Success
            } else {
                Write-Status -Icon $Icons.Warning -Label "Git:" -Message "Push failed after $maxRetries attempts" -Color $Theme.Warning
            }
        }
    } else {
        $script:Stats.TasksFailed += $batch.Count
        Write-Host ""
        Write-Status -Icon $Icons.Cross -Label "Status:" -Message "Iteration incomplete - will retry" -Color $Theme.Warning
    }

    Write-TaskStats

    # Check for progress compaction every 10 iterations
    if ($i % 10 -eq 0) {
        $progressLines = (Get-Content $context.ProgressFile -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
        if ($progressLines -gt 500) {
            Write-Status -Icon $Icons.File -Label "Compact:" -Message "Progress file at $progressLines lines, compacting..." -Color $Theme.Warning
            Invoke-ProgressCompaction -ProgressFile $context.ProgressFile
        }
    }

    # Brief pause before next iteration
    Start-Sleep -Seconds $SleepSeconds
}

# Final summary
$elapsed = (Get-Date) - $script:Stats.StartTime
$elapsedStr = "{0:hh\:mm\:ss}" -f $elapsed
$finalProgress = Get-TaskProgress -Tasks (Get-TasksFromFile -TasksFile $context.TasksFile)

Write-Host ""
Write-Host ""
Write-Host "  +==================================================+" -ForegroundColor $Theme.Primary
Write-Host "  |                                                  |" -ForegroundColor $Theme.Primary
Write-Host "  |  $($Icons.Star) SESSION COMPLETE $($Icons.Star)                          |" -ForegroundColor $Theme.Primary
Write-Host "  |                                                  |" -ForegroundColor $Theme.Primary
Write-Host "  +==================================================+" -ForegroundColor $Theme.Primary
Write-Host "  |  Iterations: $($script:Stats.Iterations.ToString().PadRight(36))|" -ForegroundColor $Theme.Primary
Write-Host "  |  Tasks Done: $($script:Stats.TasksCompleted.ToString().PadRight(36))|" -ForegroundColor $Theme.Primary
Write-Host "  |  Progress:   $("$($finalProgress.Complete)/$($finalProgress.Total) ($($finalProgress.Percent)%)".PadRight(36))|" -ForegroundColor $Theme.Primary
Write-Host "  |  Total Cost: $('$' + [math]::Round($script:Stats.TotalCost, 4).ToString().PadRight(35))|" -ForegroundColor $Theme.Primary
Write-Host "  |  Total Time: $($elapsedStr.PadRight(36))|" -ForegroundColor $Theme.Primary
Write-Host "  |  Tool Calls: $($script:Stats.ToolCalls.ToString().PadRight(36))|" -ForegroundColor $Theme.Primary
Write-Host "  +==================================================+" -ForegroundColor $Theme.Primary
Write-Host ""

if ($finalProgress.Pending -eq 0) {
    exit 0
} else {
    exit 1
}
