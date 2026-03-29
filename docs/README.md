# Artisyn.io Backend API

## TABLE OF CONTENT

1. [Schema](schema.md)
2. [Response Format](RESPONSE.md)
3. [Controller Format](CONTROLLERS.md)
4. [Routing](routing.md)
5. [API Endpoints](ENDPOINTS.md)
6. [Documenting](ENDPOINTS.md)

## Contributing

Clone the REPO

```sh
git clone https://github.com/artisyn-io/artisyn-api.git
```

Setup your Postgre credentials and update the `DATABASE_URL` env variable. Use a dedicated schema for local development rather than `public` to avoid drift with other apps sharing the same database.

```sh
pnpm install
```

This will run the `setup` script during `postinstall`, which ensures `.env` exists and generates the Prisma client.

To create or fully reinitialize the local development database, run:

```sh
pnpm initialize
```

`initialize` performs a forced Prisma reset for the local development database, reapplies migrations, and runs the configured seed.

Finally fire up the dev server

```sh
pnpm dev
```

## Documenting

You are required to document every new feature, change, or addition made to the API. To update the documentation, follow these steps:

- Visit the [API Documentation](https://artisyn.apidog.io).
- Scroll to the bottom of the page and select **Clone** or **Export**.
- Make the necessary changes to the cloned/exported version.
- Export your updated version.
- Replace the existing [DOCUMENTATION.json](https://github.com/toneflix/artisyn-api/blob/main/DOCUMENTATION.json) file with your updated version.

This ensures the API documentation remains accurate and up to date with all changes.
