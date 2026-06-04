const path = require("path");
const dotenv = require("dotenv");
const appConfig = require("./app.json");

dotenv.config({
  path: path.join(__dirname, "../..", ".env"),
});

module.exports = appConfig;
