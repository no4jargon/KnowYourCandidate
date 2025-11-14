const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data', 'tests.json');

function readTests() {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }
  const content = fs.readFileSync(DATA_PATH, 'utf8');
  if (!content.trim()) {
    return [];
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse tests.json', error);
    throw error;
  }
}

function writeTests(tests) {
  const directory = path.dirname(DATA_PATH);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(tests, null, 2));
}

function findTestById(tests, id) {
  return tests.find((test) => test.id === id);
}

function findTestByPublicId(tests, publicId) {
  return tests.find((test) => test.public_id === publicId);
}

function findTestByTaskAndType(tests, taskId, type) {
  return tests.find((test) => test.hiring_task_id === taskId && test.type === type);
}

module.exports = {
  readTests,
  writeTests,
  findTestById,
  findTestByPublicId,
  findTestByTaskAndType
};
