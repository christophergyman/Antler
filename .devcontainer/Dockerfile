FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# Tauri v2 system dependencies
# https://v2.tauri.app/start/prerequisites/#linux
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
    # Build essentials
    build-essential \
    curl \
    wget \
    file \
    # Tauri/WebKitGTK dependencies
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    # Additional Tauri dependencies
    libssl-dev \
    libsoup-3.0-dev \
    libjavascriptcoregtk-4.1-dev \
    # Playwright dependencies
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
    # Clean up
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Install Bun for root user
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Install Bun for vscode user
USER vscode
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/home/vscode/.bun/bin:${PATH}"

# Install devcontainer CLI globally for vscode user
RUN /home/vscode/.bun/bin/bun install -g @devcontainers/cli

USER root
