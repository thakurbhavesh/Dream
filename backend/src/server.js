const dotenv = require('dotenv');
dotenv.config();
const os = require('node:os');
const http = require('node:http');

const app = require('./app');
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
const smtpSettingsModel = require('./models/smtpSettingsModel');
const { initSocket } = require('./socket');
const { startMeetingScheduler } = require('./schedulers/meetingScheduler');

const BASE_PORT = Number(process.env.PORT) || 5000;
const MAX_PORT_ATTEMPTS = 5;

const startExpress = (port) =>
  new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(port, () => resolve(server));
    server.on('error', (err) => reject({ err, server }));
  });

const attachShutdownHooks = (server) => {
  const gracefulShutdown = (signal) => {
    console.log(`${signal} received. Closing server...`);
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
};

const startServer = async (port = BASE_PORT, attempt = 1) => {
  try {
    await connectDatabase();
    await smtpSettingsModel.createTableIfNotExists();

    try {
      await connectRedis();
    } catch (error) {
      console.warn('Redis connection skipped:', error.message);
    }

    const server = await startExpress(port);

    // Increase timeout for large file uploads (10 minutes)
    server.timeout = 10 * 60 * 1000;
    server.headersTimeout = 10 * 60 * 1000 + 1000;
    server.keepAliveTimeout = 5 * 60 * 1000;

    // Attach Socket.IO to the same HTTP server
    initSocket(server);

    // Meeting reminder + recurrence scheduler
    startMeetingScheduler();

    console.log(`Server running on port ${port}`);
    console.log(
      `Runtime: host=${os.hostname()} platform=${os.platform()} arch=${os.arch()} cpus=${os.cpus()?.length || 0} node=${process.version}`
    );
    attachShutdownHooks(server);
  } catch (payload) {
    const error = payload.err || payload;

    if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = port + 1;
      console.warn(`Port ${port} in use. Trying ${nextPort}...`);
      return startServer(nextPort, attempt + 1);
    }

    console.error('Failed to start server', error.message);
    process.exit(1);
  }
};

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection', reason);
  process.exit(1);
});

startServer();
