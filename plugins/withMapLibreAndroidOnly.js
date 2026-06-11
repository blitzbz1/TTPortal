/**
 * Android-only replacement for the @maplibre/maplibre-react-native config
 * plugin (T044).
 *
 * The upstream plugin unconditionally writes BOTH platforms: Android gradle
 * properties AND iOS bits (dSYM build settings, signature stripping, a
 * Podfile `$MLRN.post_install` hook). MapLibre is iOS-excluded via
 * react-native.config.js (Metro only resolves the MapLibre shim on
 * Android), so the iOS modifications would configure a framework that is
 * never linked.
 *
 * The Android half is inlined below (the package's exports map blocks deep
 * imports of `lib/commonjs/plugin/android.js`); it mirrors upstream
 * v11.0.1: each `props.android.<key>` becomes an
 * `org.maplibre.reactnative.<key>` gradle property.
 */
const {
  createRunOncePlugin,
  withGradleProperties,
} = require('@expo/config-plugins');

const GRADLE_PROPERTIES_PREFIX = 'org.maplibre.reactnative.';

let pkg = { name: '@maplibre/maplibre-react-native', version: 'UNVERSIONED' };
try {
  pkg = require('@maplibre/maplibre-react-native/package.json');
} catch {
  // keep fallback
}

function getGradleProperties(props) {
  return Object.entries(props?.android || {}).reduce((properties, [key, value]) => {
    if (key && value) {
      properties.push({
        type: 'property',
        key: `${GRADLE_PROPERTIES_PREFIX}${key}`,
        value: value.toString(),
      });
    }
    return properties;
  }, []);
}

function mergeGradleProperties(oldProperties, newProperties) {
  const merged = oldProperties.filter(
    (item) => !(item.type === 'property' && item.key.startsWith(GRADLE_PROPERTIES_PREFIX)),
  );
  merged.push(...newProperties);
  return merged;
}

const withMapLibreAndroidOnly = (config, props) => {
  const gradleProperties = getGradleProperties(props);
  return withGradleProperties(config, (c) => {
    c.modResults = mergeGradleProperties(c.modResults, gradleProperties);
    return c;
  });
};

module.exports = createRunOncePlugin(
  withMapLibreAndroidOnly,
  `${pkg.name}-android-only`,
  pkg.version,
);
