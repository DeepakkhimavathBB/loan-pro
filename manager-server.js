const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3003;

app.use(cors());
app.use(bodyParser.json());

// Manager data
const managers = [
  { id: 1, username: 'admin', password: 'admin123' },
  { id: 2, username: 'deepak', password: 'deep123' }
];

// Endpoint to check login
app.get('/managers', (req, res) => {
  const { username, password } = req.query;

  const user = managers.find(
    m => m.username === username && m.password === password
  );

  if (user) {
    res.json([user]); // return array to keep it consistent with previous code
  } else {
    res.json([]); // empty array if login fails
  }
});

// Optional: Get all managers
app.get('/managers/all', (req, res) => {
  res.json(managers);
});

app.listen(PORT, () => {
  console.log(`Manager server running on http://localhost:${PORT}`);
});
