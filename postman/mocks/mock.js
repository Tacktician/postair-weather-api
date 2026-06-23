'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

/** Parse a request URL's query string without depending on the URL global. */
function queryParams(reqUrl) {
    const qs = (reqUrl.split('?')[1] || '').split('#')[0];
    const out = {};
    for (const pair of qs.split('&')) {
        if (!pair) continue;
        const [k, v = ''] = pair.split('=');
        out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
    return out;
}

/**
 * Writes an RFC 7807 problem+json error using only native response methods
 */
function problem(res, status, title, detail, instance) {
    const body = {
        type: 'about:blank',
        title,
        status,
        detail,
        instance,
        correlationId: '00000000-0000-0000-0000-000000000000'
    };
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/problem+json');
    res.end(JSON.stringify(body));
}

/**
 * Sends an example response, unwrapping the {type, content} envelope
 * that pm.mock.sendExample produces when serializing YAML-sourced examples.
 */
function sendExample(examplePath, res) {
    try {
        // __dirname = .../postair-weather-api/postman/mocks
        // go up two levels to reach the repo root
        const repoRoot = path.resolve(__dirname, '../../');
        const fullPath = path.join(repoRoot, examplePath);
        const raw = fs.readFileSync(fullPath, 'utf8');

        const bodyMatch = raw.match(/content: \|-\n([\s\S]+?)(?=\norder:|\n\w|$)/);
        if (!bodyMatch) {
            return problem(res, 500, 'Internal Server Error',
                `Could not parse body from example: ${examplePath}`, '/');
        }

        const indented = bodyMatch[1];
        const lines = indented.split('\n');
        const indent = lines[0].match(/^(\s+)/)?.[1]?.length || 0;
        const body = lines.map(l => l.slice(indent)).join('\n').trim();

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(body);
    } catch (err) {
        problem(res, 500, 'Internal Server Error',
            `Failed to read example: ${err.message}`, '/');
    }
}

/**
 * Simulated auth gate. Returns true and writes an
 * error when the request should be rejected.
 */
function denied(req, res) {
    const key = req.headers['x-api-key'];
    if (!key) {
        problem(res, 401, 'Unauthorized', 'Missing API key', req.url);
        return true;
    }
    if (key === 'forbidden') {
        problem(res, 403, 'Forbidden', 'You do not have access to this resource', req.url);
        return true;
    }
    return false;
}

const server = http.createServer((req, res) => {
  try {
    const q = queryParams(req.url);

    //@endpoint GET /airports
    if (pm.mock.matchRequest('postman/collections/PostAir Weather API/Airports/Retrieve airport codes.request.yaml', req)) {
        if (denied(req, res)) return;
        if (q.airportCode === 'ERR') {
            return problem(res, 500, 'Internal Server Error', 'Simulated server error', req.url);
        }
        if (q.airportCode === 'ATL') {
            return sendExample(
                'postman/collections/PostAir Weather API/Airports/.resources/Retrieve airport codes.resources/examples/Retrieve ATL Report Code.example.yaml',
                res
            );
        }
        if (q.airportCode) {
            return problem(res, 404, 'Not Found', 'No airport data found for the specified criteria', req.url);
        }
        return sendExample(
            'postman/collections/PostAir Weather API/Airports/.resources/Retrieve airport codes.resources/examples/Retrieve airport codes.example.yaml',
            res
        );
    }

    //@endpoint GET /forecast
    if (pm.mock.matchRequest('postman/collections/PostAir Weather API/Forecast/Retrieve forecast.request.yaml', req)) {
        if (denied(req, res)) return;
        if (q.forecastCity === 'ERR') {
            return problem(res, 500, 'Internal Server Error', 'Simulated server error', req.url);
        }
        if (q.forecastCity === 'Atlanta') {
            return sendExample(
                'postman/collections/PostAir Weather API/Forecast/.resources/Retrieve forecast.resources/examples/Retrieve a forecast report for ATL.example.yaml',
                res
            );
        }
        if (q.forecastCity) {
            return problem(res, 404, 'Not Found', 'No forecast data found for the specified criteria', req.url);
        }
        return sendExample(
            'postman/collections/PostAir Weather API/Forecast/.resources/Retrieve forecast.resources/examples/Retrieve forecast.example.yaml',
            res
        );
    }

    //@endpoint GET /metars
    if (pm.mock.matchRequest('postman/collections/PostAir Weather API/Metars/Retrieve METAR report.request.yaml', req)) {
        if (denied(req, res)) return;
        if (q.airportCode === 'ERR') {
            return problem(res, 500, 'Internal Server Error', 'Simulated server error', req.url);
        }
        if (q.airportCode === 'ATL') {
            return sendExample(
                'postman/collections/PostAir Weather API/Metars/.resources/Retrieve METAR report.resources/examples/Retrieve METAR report for ATL.example.yaml',
                res
            );
        }
        if (q.airportCode) {
            return problem(res, 404, 'Not Found', 'No METAR data found for the specified criteria', req.url);
        }
        return sendExample(
            'postman/collections/PostAir Weather API/Metars/.resources/Retrieve METAR report.resources/examples/Retrieve METAR report.example.yaml',
            res
        );
    }

    //@endpoint GET /turbulence
    if (pm.mock.matchRequest('postman/collections/PostAir Weather API/Turbulence/Retrieve turbulence report.request.yaml', req)) {
        if (denied(req, res)) return;
        if (q.airportCode === 'ERR') {
            return problem(res, 500, 'Internal Server Error', 'Simulated server error', req.url);
        }
        if (q.airportCode === 'ATL') {
            return sendExample(
                'postman/collections/PostAir Weather API/Turbulence/.resources/Retrieve turbulence report.resources/examples/Retrieve a turbulence report for ATL.example.yaml',
                res
            );
        }
        if (q.airportCode) {
            return problem(res, 404, 'Not Found', 'No turbulence data found for the specified criteria', req.url);
        }
        return sendExample(
            'postman/collections/PostAir Weather API/Turbulence/.resources/Retrieve turbulence report.resources/examples/Retrieve turbulence report.example.yaml',
            res
        );
    }

    // No endpoint matched.
    problem(res, 404, 'Not Found', 'No mock route matched the request', req.url);
  } catch (err) {
    problem(res, 500, 'Internal Server Error',
        `Mock handler error: ${err && err.message ? err.message : err}`, req.url);
  }
});

server.listen(process.env.PORT || 4010);

module.exports = server;