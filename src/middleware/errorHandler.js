const { v4: uuidv4 } = require('uuid');
const { StatusCodes } = require('http-status-codes');
const demoLogger = require('../util/logger').demoLogger(module);

exports.errorHandler = async (err, req, res, next) => {

    demoLogger.error(err);

    const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    const errorResponse = {
        type: `https://en.wikipedia.org/wiki/HTTP_${statusCode}`,
        title: err.message || 'Internal Server Error',
        status: statusCode,
        detail: err.detail || 'An unexpected error occurred',
        instance: `urn:api:request:${uuidv4()}`,
        correlationId: uuidv4()
    };

    res.setHeader('Content-Type', 'application/problem+json'); // Set the Content-Type header
    res.status(statusCode).json(errorResponse);
};

//module.exports = errorHandler;