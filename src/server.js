require('dotenv').config();

const app = require('./app');
const weatherData = require('./services/weatherDataLoader');

const PORT = process.env.PORT || 3000;

async function main() {
    await weatherData.loadData();

    app.listen(PORT, () => {
        console.log(`Listening on http://localhost:${PORT}`);
        console.log(`Weather API base: http://localhost:${PORT}/v1/weather`);
    });
}

main().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});