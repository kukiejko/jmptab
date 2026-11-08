# jmptab development workflow

Read `docs/DEVELOPMENT_SETUP.md` before a large change. For each code change, create a task card with `npm run task:add` before editing, keep its status current, and mark it `done` when verified. The dashboard reads cards from `.devboard/state/tasks.json`; it does not discover Git commits or requests automatically. Check `.devboard/state/PAUSE` before starting work. A pause means stop at the next safe point until the owner resumes.

For protected files (`server.mjs`, devboard state/guard/server logic, deployment scripts and GitHub workflows), use an approved `big` task. A waiting approval card is a request for the owner, not permission to modify or deploy. Existing user authorization for a specific change takes precedence; do the authorized implementation without asking again.

Run `npm run test:tracked` for work that changes behavior. Before a release, update `package.json` and `CHANGELOG.md`, run the full tests, and show exact deployment commands. Deploy only when the owner requests it for that release.

Before adding or changing any user-facing feature, inspect the existing menus, dialogs, toolbar, context menus, and related workflows for the same functionality. Reuse or connect an existing implementation when possible. If the feature needs more than one entry point, keep one shared implementation and make the entry points consistent. Include this duplication check in the change review.

The tester is responsible for adding and maintaining regression tests. In the tester role, create or edit files only under `tests/tester/`; do not edit application code or the other test directories. Report defects and missing test hooks to the developer. The developer fixes application code. Both `npm test` and `npm run test:tracked` include the tester directory.

The `.claude/settings.json` hooks apply to Claude Code. Codex does not load that file automatically; follow the same workflow instructions here and use `node devboard/hook.mjs pre` or `post` with a JSON tool event when checking the guard manually.
