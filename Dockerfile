# Gunakan image Bun resmi (Alpine = sangat ringan)
FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .
RUN bun run build

# Ubah port ke 3777
EXPOSE 3777

# Set environment variable
ENV NODE_ENV=production
ENV PORT=3777

CMD ["bun", "run", "server.ts"]
