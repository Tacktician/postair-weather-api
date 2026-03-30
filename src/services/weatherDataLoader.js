const fs = require('fs').promises;
const path = require('path');
const demoLogger = require('../util/logger').demoLogger(module);

let airportsData = [];
let turbulenceData = [];
let forecastData = [];
let metarsData = [];

async function loadData() {
    try {
        airportsData = JSON.parse(await fs.readFile(path.join(__dirname, '../data/airport-codes.json'), 'utf8'));
        turbulenceData = JSON.parse(await fs.readFile(path.join(__dirname, '../data/turbulence-v1.json'), 'utf8'));
        forecastData = JSON.parse(await fs.readFile(path.join(__dirname, '../data/flight-weather-v2.json'), 'utf8'));
        metarsData = JSON.parse(await fs.readFile(path.join(__dirname, '../data/metars.json'), 'utf8'));
        //console.log('Weather API Data loaded successfully');
        demoLogger.info('Weather API Data loaded successfully');
    } catch (error) {
        //console.error('Error loading data:', error);
        demoLogger.error('Error loading data:', error);
    }
}

module.exports = {
    loadData,
    getAirportsData: async () => airportsData,
    getTurbulenceData: async () => turbulenceData,
    getForecastData: async () => forecastData,
    getMetarsData: async () => metarsData,
};