FROM node:22-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci

# Copy the rest of the source
COPY . .

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]

CMD ["npm", "run", "dev"]
