import { requireNativeModule } from "expo-modules-core";

interface ICloudContainerModuleType {
  isAvailable(): boolean;
  getContainerPath(containerId: string): Promise<string | null>;
}

const ICloudContainer =
  requireNativeModule<ICloudContainerModuleType>("ICloudContainer");

/**
 * Check if the user is signed into iCloud (ubiquity identity token exists).
 */
export function isICloudSignedIn(): boolean {
  return ICloudContainer.isAvailable();
}

/**
 * Get the Documents path inside the iCloud ubiquity container.
 * Returns null if iCloud is not available or the container can't be accessed.
 *
 * The returned path points to: <container>/Documents/
 * Notes should be stored at: <container>/Documents/notes/
 */
export async function getICloudContainerPath(
  containerId: string
): Promise<string | null> {
  return ICloudContainer.getContainerPath(containerId);
}
