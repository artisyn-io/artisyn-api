# Artisyn.io Backend API

## Find Artisans Near You

Artisyn is a decentralised protocol built on Starknet that connects local artisans with users through community-curated listings. Our platform creates a trustless ecosystem where skilled workers can be discovered, verified, and compensated without relying on centralised intermediaries.

[![Run Tests](https://github.com/toneflix/artisyn-api/actions/workflows/test.yml/badge.svg)](https://github.com/toneflix/artisyn-api/actions/workflows/test.yml)

## Project

- 📱 [App](https://github.com/toneflix/artisyn.io)
- 📡 **[Backend (API) (Current)](https://github.com/toneflix/artisyn-api)**
- 📝 [Smart Contracts](https://github.com/toneflix/artisyn-contracts)
- 📚 [Fork/Clone API Documentation](https://artisyn.apidog.io)
- [![Telegram](https://core.telegram.org/img/favicon-16x16.png) Telegram Channel](http://t.me/@artisynOD)

## Documentation

- [Read Documentation](docs)

## Copy the `.env` file

```bash
cp .env.example .env
```

## Install the dependencies

```bash
pnpm install
```
OR

```bash
yarn install
```

## Generate Prisma Client

```bash
pnpm prisma generate
```
OR

```bash
yarn prisma generate
```

## Run Migrations

```bash
pnpm migrate
```
OR
```bash
yarn migrate
```

## Seed the database

```bash
pnpm seed
```
OR

```bash
yarn seed
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)

```bash
pnpm dev
```
OR

```bash
yarn dev
```

## Run Tests

```bash
pnpm test
```
OR

```bash
yarn test
```

## Contribution Guide

To contribute to this project, please read the [Documentation](specs) and proceed to check for available issues, find one you can resolve? Make something awesome and open a pull request.
