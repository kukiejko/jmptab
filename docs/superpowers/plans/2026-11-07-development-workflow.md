# Development Workflow Implementation Plan

> **For agentic workers:** Implement the steps in this plan in order and verify each with the Node test suite.

**Goal:** Bring the RecruitmentAssistant development dashboard, task gates, pause control and test progress workflow into jmptab.

**Architecture:** Keep project state in ignored `.devboard/state/` files. A small Node server serves the local dashboard and exposes validated task actions. A separate CLI handles task creation and a test wrapper reports progress. Repository guidance describes the gates and the limits of automatic enforcement.

**Tech Stack:** Node.js 22 built-ins, HTML/CSS/JavaScript, `node:test`.

**Spec:** `C:/Users/andrz/Projects/RecruitmentAssistant/docs/DEVELOPMENT_SETUP.md` (reference only; project-specific recruitment rules are excluded).

## Global Constraints

- Node.js 22 or newer, no runtime dependencies.
- Local dashboard binds only to `127.0.0.1`.
- Version uses `X.Y.Z`; changelog and deployment timestamp semantics stay aligned with the app.
- Approval changes task status and may create a restore tag for a big task; it never commits or deploys.

---

### Task 1: State and gates

**Files:** `devboard/state.mjs`, `devboard/workflow.mjs`, `tests/devboard-workflow.test.mjs`.

**Interfaces:** `readState()`, `writeTasks()`, `appendEvent()`, `decideTask()` and `checkAction()`.

- [ ] Add tests for task approval, pause, protected edits, repeated calls and malformed state.
- [ ] Implement pure decisions plus atomic JSON writes and bounded event history.
- [ ] Run `node --test tests/devboard-workflow.test.mjs`.

### Task 2: Local dashboard and task CLI

**Files:** `devboard/server.mjs`, `devboard/index.html`, `devboard/task.mjs`, `tests/devboard-server.test.mjs`.

**Interfaces:** `createDevboardServer()` and `npm run devboard`.

- [ ] Add route tests for read, pause, resume, approve and reject, including invalid input and cross-origin POST.
- [ ] Implement the local API, task CLI and dashboard with task columns, progress, timeline and release metadata.
- [ ] Run `node --test tests/devboard-server.test.mjs`.

### Task 3: Test reporting and project guidance

**Files:** `devboard/test-progress.mjs`, `AGENTS.md`, `docs/DEVELOPMENT_SETUP.md`, `package.json`, `CHANGELOG.md`, `.gitignore`, `README.md`.

- [ ] Add tracked test command and guide for task lifecycle, gates, guards, deployment and restart.
- [ ] Bump version and changelog.
- [ ] Run tracked tests, then `npm test`, and review git diff.
