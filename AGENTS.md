# jmptab development workflow

Read `docs/DEVELOPMENT_SETUP.md` before a large change. Keep tasks in `.devboard/state/tasks.json` using `npm run task:add`. Check `.devboard/state/PAUSE` before starting work. A pause means stop at the next safe point until the owner resumes.

For protected files (`server.mjs`, devboard state/guard/server logic, deployment scripts and GitHub workflows), use an approved `big` task. A waiting approval card is a request for the owner, not permission to modify or deploy. Existing user authorization for a specific change takes precedence; do the authorized implementation without asking again.

Run `npm run test:tracked` for work that changes behavior. Before a release, update `package.json` and `CHANGELOG.md`, run the full tests, and show exact deployment commands. Deploy only when the owner requests it for that release.

The `.claude/settings.json` hooks apply to Claude Code. Codex does not load that file automatically; follow the same workflow instructions here and use `node devboard/hook.mjs pre` or `post` with a JSON tool event when checking the guard manually.
