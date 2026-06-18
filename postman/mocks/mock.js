'use strict';

const http = require('http');

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
 * (so it doesn't depend on how the runtime's res.json())
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
 * Simulated auth gate (realistic, input-driven). Returns true and writes an
 * error when the request should be rejected:
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

/**
 * Simulated error triggers (realistic, input-driven):
 *   - missing x-api-key                       -> 401   (denied)
 *   - x-api-key: forbidden                    -> 403   (denied)
 *   - lookup value 'ERR'                       -> 500   (reserved sentinel)
 *   - lookup value present but unknown         -> 404   (no data)
 *   - lookup value omitted                     -> 200   (generic list example)
 *   - lookup value === the known value         -> 200   (specific example)
 */
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
            return pm.mock.sendExample(
                'postman/collections/PostAir Weather API/Airports/.resources/Retrieve airport codes.resources/examples/Retrieve ATL Report Code.example.yaml',
                res
            );
        }
        if (q.airportCode) {
            return problem(res, 404, 'Not Found', 'No airport data found for the specified criteria', req.url);
        }
        return pm.mock.sendExample(
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
            return pm.mock.sendExample(
                'postman/collections/PostAir Weather API/Forecast/.resources/Retrieve forecast.resources/examples/Retrieve a forecast report for ATL.example.yaml',
                res
            );
        }
        if (q.forecastCity) {
            return problem(res, 404, 'Not Found', 'No forecast data found for the specified criteria', req.url);
        }
        return pm.mock.sendExample(
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
            return pm.mock.sendExample(
                'postman/collections/PostAir Weather API/Metars/.resources/Retrieve METAR report.resources/examples/Retrieve METAR report for ATL.example.yaml',
                res
            );
        }
        if (q.airportCode) {
            return problem(res, 404, 'Not Found', 'No METAR data found for the specified criteria', req.url);
        }
        return pm.mock.sendExample(
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
            return pm.mock.sendExample(
                'postman/collections/PostAir Weather API/Turbulence/.resources/Retrieve turbulence report.resources/examples/Retrieve a turbulence report for ATL.example.yaml',
                res
            );
        }
        if (q.airportCode) {
            return problem(res, 404, 'Not Found', 'No turbulence data found for the specified criteria', req.url);
        }
        return pm.mock.sendExample(
            'postman/collections/PostAir Weather API/Turbulence/.resources/Retrieve turbulence report.resources/examples/Retrieve turbulence report.example.yaml',
            res
        );
    }

    // No endpoint matched.
    problem(res, 404, 'Not Found', 'No mock route matched the request', req.url);
  } catch (err) {
    // Defensive: a missing/renamed example or other handler fault becomes a
    // well-formed problem+json instead of a hung or opaque-500 request.
    problem(res, 500, 'Internal Server Error',
        `Mock handler error: ${err && err.message ? err.message : err}`, req.url);
  }
});

// The Postman runtime sets PORT from the config `port`; fall back for safety.
server.listen(process.env.PORT || 4010);

module.exports = server;
