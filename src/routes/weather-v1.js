const { Router } = require("express");
const { getAirports } = require("../controllers/airportController");
const { getForecast } = require("../controllers/forecastController");
const { getTurbulence } = require("../controllers/turbulenceController");
const { getMetars } = require("../controllers/metarsController");
const { apiKeyAuth } = require("../middleware/apiKeyAuth");
const { errorHandler } = require("../middleware/errorHandler");

const router = Router();

// Weather API has its own middleware to check if the API key is valid and error handler
// so we don't interfere with current middleware used for the other education APIs

router.get("/airports", apiKeyAuth, getAirports, errorHandler);
router.get("/forecast", apiKeyAuth, getForecast, errorHandler);
router.get("/turbulence", apiKeyAuth, getTurbulence, errorHandler);
router.get("/metars", apiKeyAuth, getMetars, errorHandler);



module.exports = router;