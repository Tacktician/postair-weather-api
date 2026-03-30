const { v4: uuidv4 } = require('uuid');
const { getTurbulenceData } = require('../services/weatherDataLoader');
const { StatusCodes, getReasonPhrase } = require('http-status-codes');
//const c = require('config');
const demoLogger = require('../util/logger').demoLogger(module);

exports.getTurbulence = async (req, res, next) => {
    try {
        const { airportCode } = req.query;

        // Validate airportCode
        if (airportCode && typeof airportCode !== 'string') {
            return sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Invalid airportCode parameter");
        }

        let turbulenceData = await getTurbulenceData();

        // Validate turbulenceData
        if (!Array.isArray(turbulenceData)) {
            throw new Error("Turbulence data is not in the expected format");
        }

        if (airportCode) {
            turbulenceData = turbulenceData.filter(report => report.airport.code === airportCode.toUpperCase());
        }

        if (turbulenceData.length === 0) {
            return sendErrorResponse(res, StatusCodes.NOT_FOUND, "No turbulence data found for the specified criteria");
        }

        const correlationId = uuidv4();
        res.setHeader('x-correlation-id', correlationId); // Set custom header
        res.status(StatusCodes.OK).json(turbulenceData);
    } catch (error) {
        sendErrorResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, "An unexpected error occurred");
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