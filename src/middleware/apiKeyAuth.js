const { v4: uuidv4 } = require('uuid');
//const config = require('config');

exports.apiKeyAuth = async (req, res, next) => {

    const apiKey = req.headers['x-api-key'];
    //const validApiKey = config.get('apiKey'); // Read from config file
    const validApiKey = process.env.WEATHER_API_KEY || '1234'

    if (!apiKey) {
        return res.status(401).json({
            type: "https://en.wikipedia.org/wiki/HTTP_401",
            title: "Unauthorized",
            status: 401,
            detail: "Missing API key",
            instance: `urn:api:request:${uuidv4()}`,
            correlationId: uuidv4()
        });
    }

    // For this example, we'll just check if it's not empty
    if (apiKey.trim() === '' || apiKey !== validApiKey) {
        return res.status(401).json({
            type: "https://en.wikipedia.org/wiki/HTTP_401",
            title: "Unauthorized",
            status: 401,
            detail: "Invalid API key",
            instance: `urn:api:request:${uuidv4()}`,
            correlationId: uuidv4()
        });
    }

    next();
};

//module.exports = apiKeyAuth;