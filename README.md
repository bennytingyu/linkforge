# LinkForge

LinkForge is a web application planned to use **React.js** for the frontend and **Express.js** for the backend. This repository is currently in the planning stage; application code and package scripts have not yet been added.

## Planned technology stack

- **Frontend:** React.js, with Vite for local development and production builds.
- **Backend:** Express.js running on Node.js.
- **API:** A REST API connecting the React interface to the Express server.
- **Package manager:** npm.

## Proposed project structure

```text
linkforge/
├── client/                 # React application
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── services/       # API requests
│   │   └── App.jsx         # Root React component
│   └── package.json
├── server/                 # Express application
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Shared request middleware
│   │   └── index.js        # Server entry point
│   ├── .env.example        # Documented environment variables
│   └── package.json
└── README.md
```

This structure is a proposal and will be created during implementation.

## Local development

Install a supported Node.js LTS release and npm before setting up the application.

The following commands describe the intended workflow **after the frontend and backend have been scaffolded**. They require a `package.json` in each directory and the scripts described below.

### Backend

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

The backend should provide a `dev` script for development and a `start` script for production.

### Frontend

In a separate terminal, starting from the repository root:

```bash
cd client
npm install
npm run dev
```

The frontend should provide Vite's `dev`, `build`, and `preview` scripts. Open the development URL printed in the terminal.

## Planned configuration

The server's `.env.example` should document its required configuration. A minimal starting point is:

```dotenv
PORT=3000
NODE_ENV=development
```

During development, configure Vite to proxy `/api` requests to the Express server at `http://localhost:3000`. Frontend API calls can then use relative paths such as `/api/health`.

Keep local `.env` files out of version control. Never include server secrets in frontend code or Vite environment variables exposed to the browser.

## Production build

Once the frontend has been scaffolded:

```bash
cd client
npm run build
```

Vite will generate the frontend assets in `client/dist/`. Deployment should either serve those assets through Express or host them separately with the appropriate API URL and CORS configuration.

## Implementation roadmap

- [ ] Scaffold the React frontend and Express backend.
- [ ] Add development scripts and environment configuration.
- [ ] Implement a health-check API endpoint.
- [ ] Build the application pages and API routes.
- [ ] Add input validation and consistent error handling.
- [ ] Add tests for core application behavior.
- [ ] Document deployment and update this README with working setup commands.
