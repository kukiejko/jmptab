# Development setup

This is jmptab's adaptation of the RecruitmentAssistant workflow. Its statistical app has no recruiter persona, candidate data or matching algorithm; those project-specific rules do not apply here.

## Roles and flow

The owner chooses scope and release timing. Lead keeps task cards current. Product defines acceptance criteria. Architect checks design against existing code. Developer implements application code. UX reviews user-facing flows. A process-control engineer evaluates the technical and statistical correctness of results, chart readability, units, terminology, and suitability for PowerPoint presentations. Tester adds and maintains regression tests, runs the full suite and checks the browser. Security reviews storage, imports, network and deployment. Maintainer updates version, changelog and deployment instructions.

The named role roster is defined once in `devboard/agents.mjs` and appears on the local dashboard. Names identify responsibilities; the dashboard does not claim that each agent is currently running. Task cards use the same role IDs and display their matching names.

The tester may create or modify files only in `tests/tester/`, separate from application code and existing developer-owned tests. When a test exposes a defect or needs a new test hook, the tester reports it to the developer; the developer changes the application. Both test commands run tester-owned tests alongside the existing suite.

For changes to an analysis or graph, the process-control engineer reviews a representative result before release: verify the calculation and assumptions, axis labels and measurement units, meaningful precision, technical wording, and whether the chart can be configured and copied quickly into a presentation. Record actionable findings in the task card for the developer and tester.

For a substantial new request, record the requirement and plan in a `waiting` card. Approval moves it to `approved`. Implement, test and move the card through `in_progress` to `done`. Release preparation includes an `X.Y.Z` version, changelog and a full test run. Deployment is a separate release decision; the owner must request it for that release. Approval of a plan does not deploy code.

Treat app server, development guard/state/server, deployment scripts and CI workflow changes as big changes. A big approval creates a Git tag `restore/<task-id>` at the current commit, unless the tag already exists. Include the affected files, risk and rollback approach in the task detail. The supplied RecruitmentAssistant document marked other big-change triggers as unconfirmed, so they are guidance here rather than automatic gates.

## Commands

Requires Node.js 22 or newer. From the repository root:

```powershell
npm run devboard
```

Open http://127.0.0.1:8765. The dashboard binds to localhost, refreshes every three seconds and shows work state, tasks, tracked tests and the last 60 events. Pause/resume and task decisions are available there. The dashboard never commits or deploys.
If another project uses port 8765, run `npm run devboard -- 8766` and open http://127.0.0.1:8766 instead.

Create a task with a lowercase, dash-separated ID:

```powershell
npm run task:add -- feature-id "Short title" developer big waiting "What changes; risk; rollback"
npm run test:tracked
```

Task state is in ignored `.devboard/state/tasks.json`, events in `events.jsonl`, pause switch in `PAUSE` and test progress in `tests.json`. `npm run test:tracked` runs the full Node suite and updates progress; it does not replace `npm test`. The progress total becomes known when TAP reports it at the end; until then the dashboard shows completed tests.
The dashboard starts with no task cards on a new checkout. Add a card for each code change and update its status as work proceeds. These local state files are intentionally not committed, so another laptop has its own task list.

## Guards

Claude Code loads `.claude/settings.json` and runs `devboard/hook.mjs` before and after tool calls. It blocks calls while paused, protected edits without an approved big task, and SSH commands that appear to read production data. Five identical calls within the last twenty pause work. The hook depends on running from the repository root; if an agent changes its working directory, call it with an absolute path.

Codex does not load Claude's hook configuration. `AGENTS.md` gives Codex the equivalent workflow instructions, but the dashboard pause cannot forcibly stop a Codex tool call. The Node guard logic can be checked directly by piping a JSON event into `node devboard/hook.mjs pre` or `post`. This is an operational limit, not an owner approval gate.

The app's deployment time is the server start time, displayed in Help and `/app-info.json`. Restart the app after pulling a release to update that time; starting devboard has its own separate start time.
