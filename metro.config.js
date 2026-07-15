const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Support .wasm files for expo-sqlite web
config.resolver.assetExts = [...(config.resolver.assetExts || []), 'wasm'];

// Platform shims for react-native-maps.
// - web: Leaflet-based OSM shim.
// - android: MapLibre + OpenFreeMap shim (avoids Google Maps SDK / API key).
// - ios: untouched → real react-native-maps → Apple Maps.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-maps') {
    if (platform === 'web') {
      return {
        filePath: path.resolve(__dirname, 'src/shims/react-native-maps.web.js'),
        type: 'sourceFile',
      };
    }
    if (platform === 'android') {
      return {
        filePath: path.resolve(__dirname, 'src/shims/react-native-maps.android.js'),
        type: 'sourceFile',
      };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
