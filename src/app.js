const express = require('express');
const { v4: uuidv4 } = require('uuid');
const weatherRouter = require('./routes/weather-v1');

const CORRELATION_ID_HEADER = 'x-correlation-id';
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

const app = express();

app.use(express.json());

// Stamp every response with a correlation id so any request -- success or error --
// can be traced. Echo the caller's id when they send a usable one, otherwise mint a
// fresh one. Express lowercases inbound header names, so any casing is matched.
app.use((req, res, next) => {
    const inbound = req.headers[CORRELATION_ID_HEADER];
    req.correlationId = CORRELATION_ID_PATTERN.test(inbound || '') ? inbound : uuidv4();
    res.setHeader(CORRELATION_ID_HEADER, req.correlationId);
    next();
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use('/v1/weather', weatherRouter);

app.use((req, res) => {
    res.status(404).json({ status: 404, error: 'Path not found' });
});

module.exports = app;
