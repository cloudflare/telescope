# Telescope Web

A web-based UI for the Telescope browser performance testing agent, powered by Web Components and Vite.

## Overview

Telescope Web provides a modern, interactive interface for running and viewing browser performance tests. It offers multiple pages for different testing scenarios and result visualization.

## Features

- **Multi-page Application**: Multiple HTML pages for different workflows
- **Web Components**: Built with TypeScript Web Components
- **Modern Build Tooling**: Powered by Vite for fast development and optimized builds
- **TypeScript Support**: Full TypeScript support with strict type checking

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Navigate to the telescope-web directory:
   ```bash
   cd telescope-web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:

```bash
npm run dev
```

This will:
- Start the Vite development server on port 3000
- Automatically open the application in your browser
- Enable hot module replacement (HMR) for instant updates

The development server will serve all HTML pages in the `src/` directory, including:
- `index.html` - Main landing page
- `pages/basic.html` - Basic test configuration
- `pages/advanced.html` - Advanced test options
- `pages/results.html` - Test results viewer
- `pages/upload.html` - File upload interface
- `pages/data/*.html` - Various data visualization pages

### Building for Production

Build the application for production:

```bash
npm run build
```

This will:
- Type-check the TypeScript code
- Build and optimize all assets
- Output the production build to the `dist/` directory

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

## Project Structure

```
telescope-web/
├── src/
│   ├── components/          # TypeScript Web Components
│   │   ├── metric-item.ts
│   │   ├── result-item.ts
│   │   ├── results.ts
│   │   └── waterfall.ts
│   ├── pages/               # HTML pages
│   │   ├── basic.html
│   │   ├── advanced.html
│   │   ├── results.html
│   │   ├── upload.html
│   │   └── data/            # Data visualization pages
│   │       ├── bottlenecks.html
│   │       ├── config.html
│   │       ├── console.html
│   │       ├── filmstrip-video.html
│   │       ├── metrics.html
│   │       ├── overview.html
│   │       ├── resources.html
│   │       └── waterfall.html
│   ├── index.html           # Main entry point
│   └── style.css            # Global styles
├── package.json
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite configuration
```

## Technologies

- **Vite**: Fast build tool and development server
- **TypeScript**: Type-safe JavaScript
- **Web Components**: Native browser component system
- **CSS**: Modern CSS with custom properties

## Configuration

### Vite Configuration

The `vite.config.ts` file is configured to:
- Automatically discover all HTML files as entry points
- Support multi-page application structure
- Provide path aliases (`@` maps to `src/`)
- Output builds to the `dist/` directory

### TypeScript Configuration

The `tsconfig.json` is configured with:
- Strict type checking
- ES2022 target
- Modern module resolution
- Vite client types

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Development Tips

- All HTML files in `src/` are automatically served by Vite
- TypeScript files can be imported directly in HTML using `<script type="module">`
- Use the `@` alias to import from the `src/` directory
- CSS changes are hot-reloaded automatically
- TypeScript errors will be shown in the browser console

## License

See the main project README for license information.

