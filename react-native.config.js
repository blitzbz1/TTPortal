module.exports = {
  dependencies: {
    'react-native-maps': {
      platforms: {
        android: null,
      },
    },
    // Metro resolves the MapLibre shim only on Android (see metro.config.js),
    // but autolinking still compiled the native framework into every IPA —
    // multi-MB dead weight that was unreachable on iOS (T044).
    '@maplibre/maplibre-react-native': {
      platforms: {
        ios: null,
      },
    },
  },
};
