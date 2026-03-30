const { v4: uuidv4 } = require('uuid');
const { getForecastData } = require('../services/weatherDataLoader');
const { StatusCodes, getReasonPhrase } = require('http-status-codes');
const demoLogger = require('../util/logger').demoLogger(module);

exports.getForecast = async (req, res, next) => {
    try {
        const { forecastCity } = req.query;

        if (forecastCity && typeof forecastCity !== 'string') {
            return sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Invalid forecastCity parameter");
        }

        let forecastData = await getForecastData();
        if (forecastCity) {
            forecastData = filterForecastDataByCity(forecastData, forecastCity);
        }

        if (forecastData.length === 0) {
            return sendErrorResponse(res, StatusCodes.NOT_FOUND, "No forecast data found for the specified criteria");
        }

        const correlationId = uuidv4();
        res.setHeader('x-correlation-id', correlationId); // Set custom header
        res.status(StatusCodes.OK).json(forecastData);
    } catch (error) {
        const status = error instanceof SyntaxError ? StatusCodes.BAD_REQUEST : StatusCodes.INTERNAL_SERVER_ERROR;
        const detail = error instanceof SyntaxError ? "Invalid request syntax" : "An unexpected error occurred";

        sendErrorResponse(res, status, detail);
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

function filterForecastDataByCity(forecastData, forecastCity) {
    return forecastData.filter(forecast =>
        forecast.city.toLowerCase() === forecastCity.toLowerCase()
    );
}