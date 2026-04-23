const { seedDemoData } = require('../services/demoSeedService');

try {
  const result = seedDemoData({ reset: true });
  if (!result.seeded) {
    console.log('Demo data reset skipped:', result.reason);
    process.exit(0);
  }

  console.log(
    `Demo data reset complete: ${result.tasks} tasks, ${result.tests} tests, ${result.attempts} attempts.`
  );
} catch (error) {
  console.error('Failed to reset demo data:', error);
  process.exit(1);
}
