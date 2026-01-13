const path = require('path');

/**
 * Database adapter factory
 * Creates a database adapter based on DATABASE env variable
 * Supports: SQLite (default), PostgreSQL
 */

class SQLiteAdapter {
  constructor(dbPath) {
    const Database = require('better-sqlite3');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        salt TEXT NOT NULL,
        hash TEXT NOT NULL,
        joined INTEGER NOT NULL,
        bio TEXT DEFAULT '',
        featured_project_id TEXT,
        avatar_file TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        expires INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        author TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        lang_id TEXT NOT NULL,
        metadata TEXT NOT NULL,
        thumbnail INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        flagged INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_projects_author ON projects(author);
      CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

      CREATE TABLE IF NOT EXISTS counters (
        name TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recent_projects (
        project_id TEXT PRIMARY KEY,
        added_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_recent_projects_added_at ON recent_projects(added_at);
    `);
  }

  async open() {
    // SQLite is opened in constructor
    return Promise.resolve();
  }

  async get(key) {
    const [prefix, ...rest] = key.split(':');
    const identifier = rest.join(':');

    if (prefix === 'user') {
      const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(identifier);
      if (!row) throw new Error('Key not found');
      return {
        username: row.username,
        salt: row.salt,
        hash: row.hash,
        joined: row.joined,
        bio: row.bio || '',
        featuredProjectId: row.featured_project_id,
        avatarFile: row.avatar_file
      };
    }

    if (prefix === 'session') {
      const row = this.db.prepare('SELECT * FROM sessions WHERE token = ?').get(identifier);
      if (!row) throw new Error('Key not found');
      return {
        username: row.username,
        expires: row.expires
      };
    }

    if (prefix === 'project') {
      const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(identifier);
      if (!row) throw new Error('Key not found');
      return {
        id: row.id,
        author: row.author,
        name: row.name,
        description: row.description || '',
        lang_id: row.lang_id,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        thumbnail: Boolean(row.thumbnail),
        created_at: row.created_at,
        flagged: Boolean(row.flagged)
      };
    }

    if (key === 'project_counter') {
      const row = this.db.prepare('SELECT value FROM counters WHERE name = ?').get('project_counter');
      if (!row) throw new Error('Key not found');
      return row.value;
    }

    if (key === 'projects:recent') {
      const rows = this.db.prepare('SELECT project_id FROM recent_projects ORDER BY added_at ASC').all();
      return rows.map(r => r.project_id);
    }

    // Ignore projects_by_time keys (legacy index, not needed with SQL)
    if (prefix === 'projects_by_time') {
      return null;
    }

    throw new Error(`Unsupported key pattern: ${key}`);
  }

  async put(key, value) {
    const [prefix, ...rest] = key.split(':');
    const identifier = rest.join(':');

    if (prefix === 'user') {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO users (username, salt, hash, joined, bio, featured_project_id, avatar_file)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        identifier,
        value.salt,
        value.hash,
        value.joined,
        value.bio || '',
        value.featuredProjectId || null,
        value.avatarFile || null
      );
      return;
    }

    if (prefix === 'session') {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO sessions (token, username, expires)
        VALUES (?, ?, ?)
      `);
      stmt.run(identifier, value.username, value.expires);
      return;
    }

    if (prefix === 'project') {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO projects (id, author, name, description, lang_id, metadata, thumbnail, created_at, flagged)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        identifier,
        value.author,
        value.name,
        value.description || '',
        value.lang_id,
        JSON.stringify(value.metadata),
        value.thumbnail ? 1 : 0,
        value.created_at,
        value.flagged ? 1 : 0
      );
      return;
    }

    if (key === 'project_counter') {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO counters (name, value)
        VALUES ('project_counter', ?)
      `);
      stmt.run(value);
      return;
    }

    if (key === 'projects:recent') {
      // Replace the entire recent projects list
      this.db.prepare('DELETE FROM recent_projects').run();
      const stmt = this.db.prepare('INSERT INTO recent_projects (project_id, added_at) VALUES (?, ?)');
      const insertMany = this.db.transaction((projects) => {
        projects.forEach((projectId, index) => {
          stmt.run(projectId, index);
        });
      });
      insertMany(value);
      return;
    }

    // Ignore projects_by_time keys (legacy index, not needed with SQL)
    if (prefix === 'projects_by_time') {
      return;
    }

    throw new Error(`Unsupported key pattern: ${key}`);
  }

  async del(key) {
    const [prefix, ...rest] = key.split(':');
    const identifier = rest.join(':');

    if (prefix === 'user') {
      this.db.prepare('DELETE FROM users WHERE username = ?').run(identifier);
      return;
    }

    if (prefix === 'session') {
      this.db.prepare('DELETE FROM sessions WHERE token = ?').run(identifier);
      return;
    }

    if (prefix === 'project') {
      this.db.prepare('DELETE FROM projects WHERE id = ?').run(identifier);
      return;
    }

    throw new Error(`Unsupported key pattern: ${key}`);
  }

  async close() {
    this.db.close();
  }
}

class PostgreSQLAdapter {
  constructor(connectionString) {
    const { Pool } = require('pg');
    this.pool = new Pool({ connectionString });
  }

  async open() {
    // Test connection and create schema
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          username TEXT PRIMARY KEY,
          salt TEXT NOT NULL,
          hash TEXT NOT NULL,
          joined BIGINT NOT NULL,
          bio TEXT DEFAULT '',
          featured_project_id TEXT,
          avatar_file TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          expires BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          author TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          lang_id TEXT NOT NULL,
          metadata JSONB NOT NULL,
          thumbnail BOOLEAN DEFAULT false,
          created_at BIGINT NOT NULL,
          flagged BOOLEAN DEFAULT false
        );

        CREATE INDEX IF NOT EXISTS idx_projects_author ON projects(author);
        CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

        CREATE TABLE IF NOT EXISTS counters (
          name TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS recent_projects (
          project_id TEXT PRIMARY KEY,
          added_at BIGINT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_recent_projects_added_at ON recent_projects(added_at);
      `);
    } finally {
      client.release();
    }
  }

  async get(key) {
    const [prefix, ...rest] = key.split(':');
    const identifier = rest.join(':');

    if (prefix === 'user') {
      const result = await this.pool.query('SELECT * FROM users WHERE username = $1', [identifier]);
      if (result.rows.length === 0) throw new Error('Key not found');
      const row = result.rows[0];
      return {
        username: row.username,
        salt: row.salt,
        hash: row.hash,
        joined: parseInt(row.joined),
        bio: row.bio || '',
        featuredProjectId: row.featured_project_id,
        avatarFile: row.avatar_file
      };
    }

    if (prefix === 'session') {
      const result = await this.pool.query('SELECT * FROM sessions WHERE token = $1', [identifier]);
      if (result.rows.length === 0) throw new Error('Key not found');
      const row = result.rows[0];
      return {
        username: row.username,
        expires: parseInt(row.expires)
      };
    }

    if (prefix === 'project') {
      const result = await this.pool.query('SELECT * FROM projects WHERE id = $1', [identifier]);
      if (result.rows.length === 0) throw new Error('Key not found');
      const row = result.rows[0];
      return {
        id: row.id,
        author: row.author,
        name: row.name,
        description: row.description || '',
        lang_id: row.lang_id,
        metadata: row.metadata || {},
        thumbnail: row.thumbnail,
        created_at: parseInt(row.created_at),
        flagged: row.flagged
      };
    }

    if (key === 'project_counter') {
      const result = await this.pool.query('SELECT value FROM counters WHERE name = $1', ['project_counter']);
      if (result.rows.length === 0) throw new Error('Key not found');
      return result.rows[0].value;
    }

    if (key === 'projects:recent') {
      const result = await this.pool.query('SELECT project_id FROM recent_projects ORDER BY added_at ASC');
      return result.rows.map(r => r.project_id);
    }

    // Ignore projects_by_time keys (legacy index, not needed with SQL)
    if (prefix === 'projects_by_time') {
      return null;
    }

    throw new Error(`Unsupported key pattern: ${key}`);
  }

  async put(key, value) {
    const [prefix, ...rest] = key.split(':');
    const identifier = rest.join(':');

    if (prefix === 'user') {
      await this.pool.query(`
        INSERT INTO users (username, salt, hash, joined, bio, featured_project_id, avatar_file)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (username) DO UPDATE SET
          salt = EXCLUDED.salt,
          hash = EXCLUDED.hash,
          joined = EXCLUDED.joined,
          bio = EXCLUDED.bio,
          featured_project_id = EXCLUDED.featured_project_id,
          avatar_file = EXCLUDED.avatar_file
      `, [
        identifier,
        value.salt,
        value.hash,
        value.joined,
        value.bio || '',
        value.featuredProjectId || null,
        value.avatarFile || null
      ]);
      return;
    }

    if (prefix === 'session') {
      await this.pool.query(`
        INSERT INTO sessions (token, username, expires)
        VALUES ($1, $2, $3)
        ON CONFLICT (token) DO UPDATE SET
          username = EXCLUDED.username,
          expires = EXCLUDED.expires
      `, [identifier, value.username, value.expires]);
      return;
    }

    if (prefix === 'project') {
      await this.pool.query(`
        INSERT INTO projects (id, author, name, description, lang_id, metadata, thumbnail, created_at, flagged)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          author = EXCLUDED.author,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          lang_id = EXCLUDED.lang_id,
          metadata = EXCLUDED.metadata,
          thumbnail = EXCLUDED.thumbnail,
          created_at = EXCLUDED.created_at,
          flagged = EXCLUDED.flagged
      `, [
        identifier,
        value.author,
        value.name,
        value.description || '',
        value.lang_id,
        value.metadata,
        value.thumbnail || false,
        value.created_at,
        value.flagged || false
      ]);
      return;
    }

    if (key === 'project_counter') {
      await this.pool.query(`
        INSERT INTO counters (name, value)
        VALUES ('project_counter', $1)
        ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value
      `, [value]);
      return;
    }

    if (key === 'projects:recent') {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM recent_projects');
        
        for (let i = 0; i < value.length; i++) {
          await client.query(
            'INSERT INTO recent_projects (project_id, added_at) VALUES ($1, $2)',
            [value[i], i]
          );
        }
        
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      return;
    }

    // Ignore projects_by_time keys (legacy index, not needed with SQL)
    if (prefix === 'projects_by_time') {
      return;
    }

    throw new Error(`Unsupported key pattern: ${key}`);
  }

  async del(key) {
    const [prefix, ...rest] = key.split(':');
    const identifier = rest.join(':');

    if (prefix === 'user') {
      await this.pool.query('DELETE FROM users WHERE username = $1', [identifier]);
      return;
    }

    if (prefix === 'session') {
      await this.pool.query('DELETE FROM sessions WHERE token = $1', [identifier]);
      return;
    }

    if (prefix === 'project') {
      await this.pool.query('DELETE FROM projects WHERE id = $1', [identifier]);
      return;
    }

    throw new Error(`Unsupported key pattern: ${key}`);
  }

  async close() {
    await this.pool.end();
  }
}

function createDatabaseAdapter() {
  const dbType = (process.env.DATABASE || 'sqlite').toLowerCase();

  if (dbType === 'sqlite') {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'telewarp.db');
    console.log(`✔ Using SQLite database at: ${dbPath}`);
    return new SQLiteAdapter(dbPath);
  } else if (dbType === 'postgresql' || dbType === 'postgres') {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
    }
    console.log('✔ Using PostgreSQL database');
    return new PostgreSQLAdapter(connectionString);
  } else {
    throw new Error(`Unsupported database type: ${dbType}. Use 'sqlite' or 'postgresql'`);
  }
}

module.exports = { createDatabaseAdapter };
