const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod = null;

const connectDB = async () => {
  let uri = process.env.MONGO_URI;

  // If using default localhost URI, try real MongoDB first, fall back to in-memory
  const useRealMongo = uri && !uri.includes('localhost') && !uri.includes('127.0.0.1');

  if (!useRealMongo) {
    try {
      // Attempt real local MongoDB first (quick timeout)
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      console.log('✅ MongoDB connected (local)');
      return;
    } catch {
      // Fall through to in-memory
    }

    console.log('⚡ Local MongoDB not found — starting in-memory MongoDB...');
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
    console.log(`✅ In-memory MongoDB started at: ${uri}`);
    console.log('⚠️  Note: Data will be lost when server restarts. Use MongoDB Atlas for persistence.');
  }

  try {
    await mongoose.connect(uri);
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
  process.exit(0);
});

module.exports = connectDB;

