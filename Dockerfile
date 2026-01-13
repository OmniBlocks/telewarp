FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Create directories for user uploads
RUN mkdir -p /app/telewarp-projects /app/telewarp-avatars /app/tmp

EXPOSE 3000

CMD ["npm", "start"]
