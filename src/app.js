const express = require('express');
const weatherRouter = require('./routes/weather-v1');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use('/v1/weather', weatherRouter);

app.use((req, res) => {
    res.status(404).json({ status: 404, error: 'Path not found' });
});

module.exports = app;