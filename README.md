# PostAir Weather API (standalone demo)

This repository is a **standalone demo HTTP API** intended for use with the <a href="https://academy.postman.com/path/api-testing-path" target="_blank" rel="noopener noreferrer"><strong>API Testing learning path</strong></a> on Postman Academy (Postman’s API Testing courses). It is **designed to run on your machine** so you can send requests, write tests in Postman, and practice workflows without depending on a shared hosted environment.

## What it provides

- **REST endpoints** for airports, forecasts, turbulence, and METAR-style data, aligned with the bundled OpenAPI description (`api-docs/postair-openapi-3_1.yaml`).
- **API key authentication** via the `x-api-key` header (`WEATHER_API_KEY` in your environment).
- **Static JSON fixtures** as the backing data store (no external weather services or databases required).

## Stack

- Node.js (LTS recommended)
- Express
- Winston (logging)

## Prerequisites

- Node.js 18+
- npm

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```
2. Copy the environment template and set your API key (the server validates `x-api-key` against this value):

   ```bash
   cp env.example .env
   ```
   Edit the `.env` and set `WEATHER_API_KEY` to a non-empty secret. Optionally set `PORT` (default is `3000`).
3. Start the server:
   ```bash
   npm start
   ```
   The app listens on `http://localhost:${PORT:-3000}` (see `PORT` in `.env`)

## Usage / Quickstart

### Export Your API Key (zsh)
Use the same value as `WEATHER_API_KEY` in `.env` so you can pass it to `curl`:
   ```bash
   export WEATHER_API_KEY="your-secret-here"
   ```

### Sample Requests
With the server running, default base URL `http://localhost:3000` (change the port if you changed `PORT`.

#### Airports — list
```bash
curl -sS -H "x-api-key: $WEATHER_API_KEY" \
  "http://localhost:3000/v1/weather/airports"
```
#### Airports — filter by country
```bash
curl -sS -H "x-api-key: $WEATHER_API_KEY" \
  "http://localhost:3000/v1/weather/airports?countryName=United%20States"
```
#### Airports — filter by code
```bash
curl -sS -H "x-api-key: $WEATHER_API_KEY" \
  "http://localhost:3000/v1/weather/airports?airportCode=ATL"
```
#### Forecast
```bash
curl -sS -H "x-api-key: $WEATHER_API_KEY" \
  "http://localhost:3000/v1/weather/forecast"
```
#### Forecast — filter by city
```bash
curl -sS -H "x-api-key: $WEATHER_API_KEY" \
  "http://localhost:3000/v1/weather/forecast?forecastCity=Ocala"
```

#### Turbulence
```bash
curl -sS -H "x-api-key: $WEATHER_API_KEY" \
  "http://localhost:3000/v1/weather/turbulence?airportCode=ATL"
```
### METARs
```bash
curl -sS -H "x-api-key: $WEATHER_API_KEY" \
  "http://localhost:3000/v1/weather/metars?airportCode=ATL"
```
`-sS` keeps the response body readable while still surfacing curl errors; remove `-sS` if you want a progress meter.

### OpenAPI
The contract lives under `api-docs/` (for example `postair-openapi-3_1.yaml`). Import it into Postman to generate a collection or to align requests with the documented paths and schemas.



