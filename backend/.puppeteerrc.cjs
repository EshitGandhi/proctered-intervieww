const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to reside in the app directory
  // so that Render doesn't lose the Chrome executable between the build and start stages
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
