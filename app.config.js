const config = require("./app.json");

const appConfig = config.expo;

if (process.env.EXPO_BASE_URL) {
  appConfig.experiments = {
    ...appConfig.experiments,
    baseUrl: process.env.EXPO_BASE_URL,
  };
}

module.exports = { expo: appConfig };
