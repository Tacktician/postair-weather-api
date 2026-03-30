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
