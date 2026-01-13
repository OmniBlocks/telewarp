# telewarp
Experimental project sharing


Some styles and images are copied from https://codeberg.org/ampmod/ampmod under the GPLv3, which this project is also under.

## Configuration

### Database

TeleWarp supports both SQLite and PostgreSQL databases. Configure using environment variables:

#### SQLite (Default)
```bash
DATABASE=sqlite
DATABASE_PATH=/path/to/database.db  # Optional, defaults to ./src/telewarp.db
```

#### PostgreSQL
```bash
DATABASE=postgresql
DATABASE_URL=postgresql://user:password@host:port/database
```

### Running the Server

#### Standalone (SQLite)
```bash
npm install
npm start
```

For development with auto-reload:
```bash
npm run dev
```

#### Docker Compose

##### PostgreSQL Only (for local development)
Start PostgreSQL container:
```bash
docker compose -f docker-compose.postgres.yml up -d
```

Then run the app locally with PostgreSQL:
```bash
DATABASE=postgresql DATABASE_URL=postgresql://telewarp:telewarp_dev_password@localhost:5432/telewarp npm start
```

Stop PostgreSQL:
```bash
docker compose -f docker-compose.postgres.yml down
```

##### Full Stack (App + PostgreSQL)
Run everything with Docker Compose:
```bash
docker compose up -d
```

Stop everything:
```bash
docker compose down
```