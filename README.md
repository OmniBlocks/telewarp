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

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```