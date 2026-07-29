// Harder prompts require fewer photos than easy ones.
const MIN_PHOTOS_BY_DIFFICULTY = {
  easy: 10,
  medium: 6,
  hard: 3,
};

const POINTS = {
  winner: 10,
  participation: 2,
};

const CYCLE_DURATION_DAYS = {
  weekly: 7,
  monthly: 30,
};

const VOTING_WINDOW_DAYS = 3;

module.exports = { MIN_PHOTOS_BY_DIFFICULTY, POINTS, CYCLE_DURATION_DAYS, VOTING_WINDOW_DAYS };
