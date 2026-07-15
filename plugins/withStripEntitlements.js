// Strips iOS entitlements we don't want provisioned (2026-06-11):
// - com.apple.developer.applesignin — Sign in with Apple is disabled behind
//   SOCIAL_AUTH_ENABLED (since 9a48d1e); the expo-apple-authentication
//   package stays installed (SessionProvider imports it) and its
//   auto-applied config plugin force-adds the entitlement, so we delete it
//   after the fact.
// - aps-environment — remote push capability off on iOS for now (expo-
//   notifications' plugin always adds it). Android push (FCM) is unaffected.
// - com.apple.developer.associated-domains — universal links off too, so
//   provisioning needs ZERO capabilities. Shared links still work: they're
//   plain https URLs that open the web app; they just won't deep-open the
//   native app until this is re-enabled (and the AASA file is hosted).
//   Re-enabling any of these later = remove the key from STRIP below.
//
// Listed FIRST in app.json plugins: entitlement mods execute in reverse
// registration order, so first-registered runs last — after the plugins
// that add these keys (verified empirically via prebuild).
const { withEntitlementsPlist, createRunOncePlugin } = require('expo/config-plugins');

const STRIP = [
  'com.apple.developer.applesignin',
  'aps-environment',
  'com.apple.developer.associated-domains',
];

const withStripEntitlements = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    for (const key of STRIP) {
      delete cfg.modResults[key];
    }
    return cfg;
  });

module.exports = createRunOncePlugin(withStripEntitlements, 'with-strip-entitlements', '1.0.0');
