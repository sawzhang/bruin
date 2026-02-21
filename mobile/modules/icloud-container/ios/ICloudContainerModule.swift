import ExpoModulesCore

public class ICloudContainerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ICloudContainer")

    /// Check if the user is signed into iCloud.
    Function("isAvailable") { () -> Bool in
      return FileManager.default.ubiquityIdentityToken != nil
    }

    /// Get the Documents path inside the iCloud ubiquity container.
    /// Must be called on a background thread (first call may be slow).
    /// Creates the Documents and notes subdirectories if needed.
    AsyncFunction("getContainerPath") { (containerId: String) -> String? in
      guard let containerUrl = FileManager.default.url(
        forUbiquityContainerIdentifier: containerId
      ) else {
        return nil
      }

      let documentsUrl = containerUrl.appendingPathComponent("Documents")

      // Ensure Documents directory exists
      if !FileManager.default.fileExists(atPath: documentsUrl.path) {
        try? FileManager.default.createDirectory(
          at: documentsUrl,
          withIntermediateDirectories: true,
          attributes: nil
        )
      }

      return documentsUrl.path
    }
  }
}
