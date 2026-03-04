FROM --platform=linux/amd64 node:24-bookworm

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install system dependencies for Playwright browsers and ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    # Chromium/Firefox dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    # Firefox dependencies
    libgtk-3-0 \
    # WebKit dependencies
    libgstreamer1.0-0 \
    libgtk-4-1 \
    libgraphene-1.0-0 \
    libwoff1 \
    libgstreamer-plugins-base1.0-0 \
    libgstreamer-gl1.0-0 \
    libgstreamer-plugins-bad1.0-0 \
    libavif15 \
    libharfbuzz-icu0 \
    libenchant-2-2 \
    libsecret-1-0 \
    libhyphen0 \
    libmanette-0.2-0 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for running Chrome securely (with sandbox enabled)
RUN groupadd -r telescope && useradd -r -g telescope -G audio,video telescope \
    && mkdir -p /home/telescope ${PLAYWRIGHT_BROWSERS_PATH} \
    && chown -R telescope:telescope /home/telescope ${PLAYWRIGHT_BROWSERS_PATH}

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (this runs postinstall which installs Playwright browsers)
RUN npm ci

# Install Chrome, Chrome Beta, and Edge via Playwright
# Note: Chrome Canary is not available on Linux
RUN npx playwright install chrome chrome-beta msedge

# Copy the rest of the application
COPY . .

# Build TypeScript
RUN npm run build

# Create results directory and set ownership for non-root user
RUN mkdir -p /app/results /app/tmp /app/recordings \
    && chown -R telescope:telescope /app ${PLAYWRIGHT_BROWSERS_PATH}

# Switch to non-root user for running Chrome with sandbox enabled
USER telescope

# Default command - show help
ENTRYPOINT ["node", "dist/src/cli.js"]
CMD ["--help"]
