import { addTask } from './workflow.mjs';

const [, , id, title, role = 'developer', kind = 'small', status = 'todo', ...detail] = process.argv;
if (!id || !title) {
  console.error('Usage: npm run task:add -- <id> "<title>" [role] [small|big] [todo|waiting] [detail]');
  process.exitCode = 1;
} else {
  try {
    const task = addTask({ id, title, agent: role, big: kind === 'big', status, detail: detail.join(' '), steps: 0 });
    console.log(`Created ${task.id}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
