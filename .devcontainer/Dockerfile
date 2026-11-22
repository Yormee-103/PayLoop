FROM mcr.microsoft.com/devcontainers/rust:1-1-bookworm

# Install Node.js 22 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get update && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Add wasm32v1-none target and Rust developer components
RUN rustup target add wasm32v1-none \
    && rustup component add rustfmt clippy

# Install Stellar CLI for Soroban smart contract development
RUN cargo install --locked stellar-cli --features opt
