// Load .env first
require('dotenv').config();

const Redis = require("ioredis");

// Connect using REDISURL from environment
const redis = new Redis(process.env.REDISURL);

redis.on("connect", () => console.log("Redis connected!"));
redis.on("error", (err) => console.error("Redis connection error:", err));

module.exports = {
  redis,

  cooldowns: {
    get: async (key) =>
      await redis.get(`cooldowns/${key}`),

    set: async (key, time) =>
      await redis.set(`cooldowns/${key}`, Date.now() + time, "PX", time),

    update: async (key, time) =>
      await redis.pexpire(`cooldowns/${key}`, time),
  },

  config: {
    get: async (guildID) => {
      const raw = await redis.get(`config/${guildID}`);
      return raw ? JSON.parse(raw) : null;
    },

    set: async (guildID, config) =>
      await redis.set(
        `config/${guildID}`,
        JSON.stringify(
          Object.fromEntries(Object.entries(config).filter(([k, v]) => v !== null))
        )
      ),

    delete: async (guildID) =>
      await redis.del(`config/${guildID}`),
  },

  blacklist: {
    get: async (channelID) =>
      await redis.hget("blacklist", channelID),

    set: async (channelID, value) =>
      await redis.hset("blacklist", channelID, value),

    delete: async (channelID) =>
      await redis.hdel("blacklist", channelID),
  },
};
