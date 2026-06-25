const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 3000;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle DB client', err);
});

app.get('/records', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customer_accounts ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).send('Error fetching records');
  }
});

app.get('/formatted-records', async (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  try {
    const result = await pool.query(
      'SELECT * FROM customer_accounts ORDER BY id LIMIT 5 OFFSET $1',
      [offset]
    );
    const rows = result.rows;
    let tableHtml = '<table border="1"><tr>';
    if (rows.length > 0) {
      Object.keys(rows[0]).forEach(col => { tableHtml += `<th>${col}</th>`; });
      tableHtml += '</tr>';
      rows.forEach(row => {
        tableHtml += '<tr>';
        Object.values(row).forEach(val => { tableHtml += `<td>${val}</td>`; });
        tableHtml += '</tr>';
      });
    }
    tableHtml += '</table>';
    res.send(`
      <h1>Top Records</h1>
      ${tableHtml}
      <a href="/formatted-records?offset=${offset + 5}">More</a>
      <br>
      <a href="/">Back</a>
    `);
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Something went wrong! Please try again later.');
  }
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Hello, Welcome !!</h1>
    <p>Available APIs:</p>
    <ul>
      <li><a href="/records">/records</a> - Get all records</li>
      <li><a href="/formatted-records">/formatted-records</a> - Show incremental records</li>
    </ul>
  `);
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Something went wrong! Please try again later.');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});