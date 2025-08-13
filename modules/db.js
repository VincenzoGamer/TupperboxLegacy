require('dotenv').config();
const { Pool } = require("pg");
const fs = require("fs");
const cache = require("./redis");

let pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: { rejectUnauthorized: false }
});

const question = q => {
  let rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(q, ans => { rl.close(); res(ans); });
  });
};

const blacklistBitfield = (blockProxies, blockCommands) => {
  let blacklist = 0;
  if (blockCommands) blacklist |= 1;
  if (blockProxies) blacklist |= 2;
  return blacklist;
};

module.exports = {

  init: async () => {
    console.log("Starting DB init...");

    try {
      console.log("Attempting to connect to Postgres...");
      const client = await pool.connect();
      console.log("Postgres connection successful!");
      client.release();
    } catch (err) {
      console.error("Failed to connect to Postgres:", err);
      throw err;
    }

    try {
      console.log("Checking/creating tables...");
      await pool.query(`
        create or replace function create_constraint_if_not_exists (t_name text, c_name text, constraint_sql text) 
        returns void AS
        $$
        begin
          if not exists (select constraint_name from information_schema.constraint_column_usage where table_name = t_name and constraint_name = c_name) then
            execute constraint_sql;
          end if;
        end;
        $$ language 'plpgsql';

        CREATE TABLE IF NOT EXISTS webhooks(
          id VARCHAR(32) PRIMARY KEY,
          channel_id VARCHAR(32) NOT NULL,
          token VARCHAR(100) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS servers(
          id VARCHAR(32) PRIMARY KEY,
          prefix TEXT NOT NULL,
          lang TEXT NOT NULL,
          lang_plural TEXT,
          log_channel VARCHAR(32)
        );

        CREATE TABLE IF NOT EXISTS blacklist(
          id VARCHAR(32) NOT NULL,
          server_id VARCHAR(32) NOT NULL,
          is_channel BOOLEAN NOT NULL,
          block_proxies BOOLEAN NOT NULL,
          block_commands BOOLEAN NOT NULL,
          PRIMARY KEY (id, server_id)
        );

        CREATE TABLE IF NOT EXISTS groups(
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(32) NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          tag VARCHAR(32)
        );

        CREATE TABLE IF NOT EXISTS members(
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(32) NOT NULL,
          name VARCHAR(80) NOT NULL,
          position INTEGER NOT NULL,
          avatar_url TEXT NOT NULL,
          brackets TEXT[] NOT NULL,
          posts INTEGER NOT NULL,	
          show_brackets BOOLEAN NOT NULL,
          birthday DATE,
          description TEXT,
          tag VARCHAR(32),
          group_id INTEGER,
          UNIQUE (user_id,name)
        );

        CREATE TABLE IF NOT EXISTS global_blacklist(
          user_id VARCHAR(50) PRIMARY KEY
        );

        ALTER TABLE groups ADD COLUMN IF NOT EXISTS position INTEGER;
        ALTER TABLE members ADD COLUMN IF NOT EXISTS group_pos INTEGER;

        SELECT create_constraint_if_not_exists('groups','groups_user_id_name_key',
          'ALTER TABLE groups ADD CONSTRAINT groups_user_id_name_key UNIQUE (user_id, name);'
        );
        SELECT create_constraint_if_not_exists('groups','members_group_id_fkey',
          'ALTER TABLE members ADD CONSTRAINT members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id);'
        );
      `);
      await pool.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS members_lower_idx ON members(lower(name))");
      await pool.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS webhooks_channelidx ON webhooks(channel_id);");
      console.log("Tables checked/created successfully!");
    } catch (err) {
      console.error("Error creating/checking tables:", err);
      throw err;
    }

    console.log("Checking for import files...");
    const importFiles = ["../tulpae.json", "../webhooks.json", "../servercfg.json"];
    for (const file of importFiles) {
      try {
        if (!fs.existsSync(file)) {
          console.log(`File not found: ${file}`);
          continue;
        }
        console.log(`File found: ${file}`);
      } catch (err) {
        console.error(`Error checking file ${file}:`, err);
      }
    }

    try {
      console.log("Checking Redis connection...");
      await cache.redis.set("test", 1);
      const val = await cache.redis.get("test");
      console.log("Redis test value:", val);
      if (val != 1) throw new Error("Cache integrity check failed");
      await cache.redis.del("test");
      console.log("Redis check passed!");
    } catch (err) {
      console.error("Redis error:", err);
      throw err;
    }

    console.log("DB init finished successfully!");
  },

  connect: () => pool.connect(),
  end: async () => await pool.end(),

  query: (text, params, callback) => pool.query(text, params, callback),

  members: {
    // member functions same as before...
  },

  groups: {
    // group functions same as before...
  },

  config: {
    // config functions same as before...
  },

  blacklist: {
    // blacklist functions same as before...
  },

  webhooks: {
    // webhooks functions same as before...
  },

  getGlobalBlacklisted: async (id) => (await pool.query("SELECT * FROM global_blacklist WHERE user_id = $1", [id])).rows[0],
};
