const { createClient } = require('redis');
const dotenv = require('dotenv');

dotenv.config();

const redisEnabled = process.env.REDIS_ENABLED === 'true';

const redisUsername = process.env.REDIS_USERNAME || (process.env.REDIS_PASSWORD ? 'default' : undefined);

const buildClient = () =>
  createClient({
    url: process.env.REDIS_URL || undefined,
    socket: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined,
      reconnectStrategy(retries) {
        if (retries > 0) {
          return new Error('Redis unavailable');
        }
        return 50;
      },
    },
    username: redisUsername,
    password: process.env.REDIS_PASSWORD,
  });

const redisClient = redisEnabled
  ? buildClient()
  : {
      isOpen: false,
      connect: async () => {},
      get: async () => null,
      setEx: async () => {},
      del: async () => {},
      incr: async () => 0,
    };

if (redisEnabled) {
  redisClient.on('error', (err) => {
    console.error('Redis error', err.message);
  });
}

const connectRedis = async () => {
  if (!redisEnabled || !redisClient) {
    console.info('Redis disabled via REDIS_ENABLED flag');
    return;
  }

  if (redisClient.isOpen) {
    return;
  }

  await redisClient.connect();
  console.log('Redis connected');
};

module.exports = {
  redisClient,
  connectRedis,
};
