# UBC public website

This repository is the deliberately small, production-facing UBC website used
for GoDaddy Node.js Hosting. GoDaddy can import the repository directly because
`package.json` and the server entry point are at the repository root.

The server:

- serves the approved static UBC site;
- listens on GoDaddy's required `PORT` environment variable;
- adds baseline browser security headers;
- accepts no healthcare files or patient data;
- proxies the privacy-safe contact request to the existing authoritative D1
  endpoint; and
- does not log or persist inquiry contents on GoDaddy.

`LEAD_API_URL` may override the existing lead endpoint later. Do not point it
at an endpoint that lacks equivalent server validation, access controls, and
durable storage.

## Local verification

Node.js 22 or newer is recommended. No third-party runtime packages are
required.

```bash
npm test
npm start
```

The server listens on `process.env.PORT` when provided and otherwise uses port
3000 for local development.

## GoDaddy deployment

1. Create a Node.js Hosting application.
2. Choose GitHub as the source and select this repository's `main` branch.
3. Use `npm run build` as the build command and `npm start` as the start
   command if GoDaddy requests them.
4. Confirm the GoDaddy preview address works before connecting `ubcdig.com`.

Do not add credentials, patient information, healthcare files, or submitted
inquiry contents to this repository.
