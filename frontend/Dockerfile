FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG LAB_API_URL=http://backend:8000
ENV LAB_API_URL=$LAB_API_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.mjs .
USER node
EXPOSE 3000
CMD ["npm", "start"]
