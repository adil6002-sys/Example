const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

// GET /api/settings
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settingsObj = {};
  rows.forEach(r => {
    settingsObj[r.key] = r.value;
  });
  res.json({ success: true, data: settingsObj });
});

// PUT /api/settings
router.put('/', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid settings payload' });
  }

  const upsert = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  for (const [key, value] of Object.entries(updates)) {
    upsert.run(key, String(value));
  }

  const rows = db.prepare('SELECT * FROM settings').all();
  const settingsObj = {};
  rows.forEach(r => {
    settingsObj[r.key] = r.value;
  });

  res.json({ success: true, message: 'Settings updated successfully', data: settingsObj });
});

module.exports = router;
