const {
  withEntitlementsPlist,
  withInfoPlist,
} = require("@expo/config-plugins");

const ICLOUD_CONTAINER_ID = "iCloud.com.bruin.app";

/**
 * Expo config plugin to add iCloud Documents capability.
 * Sets entitlements for iCloud container access and configures
 * NSUbiquitousContainers in Info.plist so the app's Documents
 * folder is visible in Files app and iCloud Drive on macOS.
 */
function withICloud(config) {
  // Set iCloud entitlements
  config = withEntitlementsPlist(config, (config) => {
    config.modResults["com.apple.developer.icloud-container-identifiers"] = [
      ICLOUD_CONTAINER_ID,
    ];
    config.modResults["com.apple.developer.ubiquity-container-identifiers"] = [
      ICLOUD_CONTAINER_ID,
    ];
    config.modResults["com.apple.developer.icloud-services"] = [
      "CloudDocuments",
    ];
    return config;
  });

  // Configure NSUbiquitousContainers so the app's iCloud container
  // is publicly visible in iCloud Drive (Files app on iOS, Finder on macOS)
  config = withInfoPlist(config, (config) => {
    config.modResults.NSUbiquitousContainers = {
      [ICLOUD_CONTAINER_ID]: {
        NSUbiquitousContainerIsDocumentScopePublic: true,
        NSUbiquitousContainerSupportedFolderLevels: "Any",
        NSUbiquitousContainerName: "Bruin",
      },
    };
    return config;
  });

  return config;
}

module.exports = withICloud;
