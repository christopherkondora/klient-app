---
name: git-workflow
description: Git workflow for Klient development - branch naming, commit message format, when to create branches vs commit to main, merge conflict resolution, and multi-agent coordination rules.
---

# Klient Git Workflow

## Branch Strategy

**Primary Branch:** `main`
- Always deployable
- Protected (require review for direct pushes from agents - board approval needed)
- All commits must include Paperclip co-author tag

### When to Create a Branch

**Create a feature branch when:**
- Working on a feature that will take multiple commits
- Implementing a breaking change
- Need board review before merge
- Multiple agents may work on related changes

**Commit directly to main when:**
- Quick bug fixes (<1 file, clear solution)
- Documentation updates
- Configuration tweaks
- Dependency updates (non-breaking)

### Branch Naming Convention

Format: `{type}/{short-description}`

**Types:**
- `feature/` - New functionality
- `fix/` - Bug fixes
- `refactor/` - Code restructure (no behavior change)
- `test/` - Adding or fixing tests
- `docs/` - Documentation only
- `chore/` - Tooling, config, dependencies

**Examples:**
```
feature/billingo-sandbox-mode
fix/invoice-total-calculation
refactor/zustand-store-structure
test/invoice-creation-coverage
docs/setup-instructions
chore/update-electron
```

**Rules:**
- Lowercase only
- Use hyphens, not underscores
- Keep under 40 characters
- Be specific (not `feature/invoicing`, but `feature/invoice-pdf-export`)

## Commit Message Format

```
<type>: <short description>

<optional body with more context>

Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

### Commit Types
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructure
- `test:` - Test additions/fixes
- `docs:` - Documentation
- `style:` - Formatting (no logic change)
- `chore:` - Tooling, deps, config
- `perf:` - Performance improvement

### Examples

**Good:**
```
feat: add Billingo sandbox mode toggle

Allows switching between test/production API in settings.
Persists choice in local config. Defaults to sandbox for safety.

Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

**Good (short fix):**
```
fix: correct VAT calculation rounding

Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

**Bad:**
```
update stuff
```

**Bad:**
```
Fixed the thing that was broken in the invoice module where totals weren't adding up correctly when you had multiple line items with different VAT rates
```

### Commit Message Rules
- **First line:** Max 72 characters, imperative mood ("add", not "added")
- **Body:** Optional, wrap at 72 chars, explain "why" not "what"
- **Co-author:** ALWAYS include Paperclip tag at the end
- **No emojis** in commit messages

## Multi-Agent Coordination

### Before Starting Work
1. Check for existing branches: `git branch -a`
2. Pull latest: `git pull origin main`
3. Check Paperclip for related tasks to avoid duplication

### Creating a Branch
```bash
git checkout -b feature/my-feature
```

### Committing
```bash
git add <files>  # Prefer specific files over `git add .`
git commit -m "feat: short description

Optional longer explanation here.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

### Pushing
```bash
git push origin feature/my-feature
```

### Merging Back to Main

**Option 1: Fast-forward (preferred for simple changes)**
```bash
git checkout main
git merge --ff-only feature/my-feature
git push origin main
git branch -d feature/my-feature
```

**Option 2: Squash and merge (for multi-commit features)**
```bash
git checkout main
git merge --squash feature/my-feature
git commit -m "feat: summarize feature

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
git push origin main
git branch -d feature/my-feature
```

**Option 3: Pull request (for board review)**
- Push branch
- Create PR via `gh pr create`
- Request board review
- Merge after approval

## Merge Conflict Resolution

### When Conflicts Happen
1. **Don't panic** - Conflicts are normal with multiple agents
2. **Check the conflict** - Read both versions carefully
3. **Understand intent** - What was each change trying to accomplish?
4. **Merge intelligently** - Combine changes if possible, or pick the better approach
5. **Test after resolution** - Run the code to verify correctness

### Conflict Resolution Process
```bash
git pull origin main  # Triggers conflict

# Edit conflicted files (look for <<<<<<, =======, >>>>>> markers)

git add <resolved-files>
git commit -m "merge: resolve conflicts in <component>

Combined changes from <feature-A> and <feature-B>.
Tested locally - no regressions.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

### Conflict Resolution Rules
- **Preserve both changes** when they don't contradict
- **Prefer correctness** over recency (newer isn't always better)
- **Ask if uncertain** - Reassign task to CTO or CEO for guidance
- **Test thoroughly** after resolving conflicts
- **Never force push** to shared branches (main, feature branches others use)

## Multi-Agent Scenarios

### Scenario 1: Two agents working on same file
**Solution:**
- Agent A creates `feature/invoice-pdf`
- Agent B creates `feature/invoice-email`
- Both branch from latest main
- Merge one at a time
- Second agent rebases on updated main before merging

### Scenario 2: Agent needs another agent's in-progress work
**Solution:**
- Agent A pushes `feature/stripe-setup` (not merged yet)
- Agent B creates `feature/stripe-webhooks` based on Agent A's branch:
  ```bash
  git checkout feature/stripe-setup
  git checkout -b feature/stripe-webhooks
  ```
- Agent B notes dependency in task comments
- Merge A first, then B rebases and merges

### Scenario 3: Conflicting approaches to same problem
**Solution:**
- Both agents push their branches
- CTO or CEO reviews both approaches
- Pick one, close the other
- No blame - it happens

## Common Commands

### Status & Info
```bash
git status                    # Check current state
git log --oneline -10         # Recent commits
git branch -a                 # All branches
git diff                      # Unstaged changes
git diff --staged             # Staged changes
```

### Undo Operations
```bash
git restore <file>            # Discard unstaged changes
git restore --staged <file>   # Unstage file
git reset HEAD~1              # Undo last commit (keep changes)
git reset --hard HEAD~1       # Undo last commit (lose changes) - DANGEROUS
```

### Branching
```bash
git checkout <branch>         # Switch branch
git checkout -b <new-branch>  # Create and switch
git branch -d <branch>        # Delete merged branch
git branch -D <branch>        # Force delete unmerged branch
```

### Syncing
```bash
git fetch origin              # Download remote changes (don't merge)
git pull origin main          # Fetch + merge main
git push origin <branch>      # Upload branch
git push origin --delete <branch>  # Delete remote branch
```

## Don'ts

**Never:**
- Force push to main: `git push --force origin main` ❌
- Commit without co-author tag ❌
- Use `git add .` without checking what's staged ❌
- Commit secrets or `.env` files ❌
- Amend pushed commits (rewrites history) ❌
- Delete other agents' branches without asking ❌
- Merge without testing ❌

## Best Practices

**Do:**
- Commit early and often (small, logical commits)
- Write descriptive commit messages
- Pull before starting work
- Test before committing
- Use `.gitignore` properly
- Keep commits focused (one logical change per commit)
- Communicate in Paperclip when working on shared code

---

**Note for Agents:** When in doubt, branch. It's easier to merge a branch than to untangle a messy main. If you're unsure about a conflict resolution, reassign the task to your manager - it's better to ask than to break production.
