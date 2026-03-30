const { v4: uuidv4 } = require('uuid');
const { getMetarsData } = require('../services/weatherDataLoader');
const { StatusCodes, getReasonPhrase } = require('http-status-codes');
const demoLogger = require('..//util/logger').demoLogger(module);

exports.getMetars = async (req, res, next) => {
    try {
        const { airportCode } = req.query;

        // Validate airportCode
        if (airportCode && typeof airportCode !== 'string') {
            return sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Invalid airportCode parameter");
        }
        let metarsData = await getMetarsData();

        if (airportCode) {
            metarsData = metarsData.filter(metar => metar.code === airportCode.toUpperCase());
        }

        if (metarsData.length === 0) {
            return sendErrorResponse(res, StatusCodes.NOT_FOUND, "No METAR data found for the specified criteria");
        }

        const correlationId = uuidv4();
        res.setHeader('x-correlation-id', correlationId); // Set custom header
        res.status(StatusCodes.OK).json(metarsData);
    } catch (error) {
        demoLogger.error(error);
        next(error);
    }
};

function sendErrorResponse(res, statusCode, detail) {

    demoLogger.error('HTTP status:'+statusCode+' detail:'+detail);
    res.setHeader('Content-Type', 'application/problem+json');
    res.status(statusCode).json({
        type: `https://en.wikipedia.org/wiki/HTTP_${statusCode}`,
        title: getReasonPhrase(statusCode),
        status: statusCode,
        detail: detail,
        instance: `urn:api:request:${uuidv4()}`,
        correlationId: uuidv4()
    });
}