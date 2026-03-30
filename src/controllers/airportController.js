const { v4: uuidv4 } = require('uuid');
const { getAirportsData } = require('../services/weatherDataLoader');
const { StatusCodes, getReasonPhrase } = require('http-status-codes');
const demoLogger = require('../util/logger').demoLogger(module);

exports.getAirports = async (req, res, next) => {
    try {
        const { countryName, airportCode } = req.query;
        const queryParamCount = Object.keys(req.query).length;

        // Validate query parameters
        //if ('countryName' in req.query && typeof countryName !== 'string') {
        //    return sendErrorResponse(res, HttpStatus.StatusCodes.BAD_REQUEST, "Invalid countryName parameter");
        //}

        //
        // The below code to validate they query parameters that are optional, but when used some constraints need to be applied
        // is kinda sucky.
        //

        if (countryName) {
            if (!('countryName' in req.query)) {
                return sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Invalid countryName parameter");
            }
            if (typeof countryName !== 'string') {
                return sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Invalid countryName parameter");
            }
        } else if (queryParamCount == 1 && !('countryName' in req.query) && !airportCode) {
            return sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Invalid countryName parameter");
        }

        if (airportCode) {
            if (!('airportCode' in req.query)) {
                return sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Invalid airportCode parameter");
            }
            if (typeof airportCode !== 'string') {
                return sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Invalid airtportCode parameter");
            }
        } else if(queryParamCount == 1 && !('airportCode' in req.query) && !countryName) {
            return sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Invalid airtportCode parameter");
        }

        if (queryParamCount == 2) {
            if (!('countryName' in req.query) || !('airportCode' in req.query)) {
                return sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Invalid countryCode or airtportCode parameter");
            }
        }


        //if (airportCode && typeof airportCode !== 'string') {
        //    return sendErrorResponse(res, HttpStatus.StatusCodes.BAD_REQUEST, "Invalid airportCode parameter");
        //}

        let filteredAirports = await getAirportsData();

        if (countryName) {
            filteredAirports = filteredAirports.filter(country => country.country.toLowerCase() === countryName.toLowerCase());
        }

        if (airportCode) {
            filteredAirports = filteredAirports.map(country => ({
                ...country,
                airports: country.airports.filter(airport => airport.code === airportCode.toUpperCase())
            })).filter(country => country.airports.length > 0);
        }

        if (filteredAirports.length === 0) {
            return sendErrorResponse(res, StatusCodes.NOT_FOUND, "No airport data found for the specified criteria");
        }

        const correlationId = uuidv4();
        res.setHeader('x-correlation-id', correlationId); // Set custom header
        res.status(StatusCodes.OK).json(filteredAirports);
    } catch (error) {
        const status = error instanceof SyntaxError ? StatusCodes.BAD_REQUEST : StatusCodes.INTERNAL_SERVER_ERROR;
        const detail = error instanceof SyntaxError ? "Invalid request syntax" : "An unexpected error occurred";

        sendErrorResponse(res, status, detail);
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