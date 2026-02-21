import { File, Directory } from "expo-file-system";
import {
  isICloudSignedIn,
  getICloudContainerPath,
} from "../../modules/icloud-container";

const ICLOUD_CONTAINER_ID = "iCloud.com.bruin.app";
const NOTES_SUBDIR = "notes";

// Cache the container path after first resolution
let cachedContainerPath: string | null = null;

/**
 * Resolve and cache the iCloud notes directory path.
 * Returns the path to <container>/Documents/notes/ or null if unavailable.
 */
async function resolveNotesPath(): Promise<string | null> {
  if (cachedContainerPath) return cachedContainerPath;

  const containerPath = await getICloudContainerPath(ICLOUD_CONTAINER_ID);
  if (!containerPath) return null;

  cachedContainerPath = containerPath;
  return cachedContainerPath;
}

/**
 * Get a Directory handle for the iCloud notes directory.
 * Creates the notes/ subdirectory if it doesn't exist.
 */
async function getNotesDirectory(): Promise<Directory | null> {
  const basePath = await resolveNotesPath();
  if (!basePath) return null;

  const dir = new Directory(basePath, NOTES_SUBDIR);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

/**
 * Get the iCloud notes directory URI string.
 * Returns empty string if not yet resolved.
 */
export function getICloudNotesDir(): string {
  if (cachedContainerPath) {
    return cachedContainerPath + "/" + NOTES_SUBDIR;
  }
  return "";
}

/**
 * Check if iCloud is available (user signed in + container accessible).
 */
export async function isICloudAvailable(): Promise<boolean> {
  try {
    if (!isICloudSignedIn()) return false;
    const dir = await getNotesDirectory();
    return dir !== null;
  } catch {
    return false;
  }
}

/**
 * List all .md files in the iCloud notes directory.
 * Filters out hidden files and .icloud placeholder files.
 */
export async function listICloudFiles(): Promise<string[]> {
  const dir = await getNotesDirectory();
  if (!dir || !dir.exists) return [];

  const entries = dir.list();
  const filenames: string[] = [];

  for (const entry of entries) {
    if (entry instanceof File) {
      const name = entry.name;
      if (name.startsWith(".")) continue;
      if (name.endsWith(".md")) {
        filenames.push(name);
      }
    }
  }

  return filenames;
}

/**
 * Read the contents of a file in the iCloud notes directory.
 */
export async function readICloudFile(filename: string): Promise<string> {
  const dir = await getNotesDirectory();
  if (!dir) throw new Error("iCloud not available");

  const file = new File(dir, filename);
  return file.text();
}

/**
 * Write content to a file in the iCloud notes directory.
 * Creates the directory structure if it does not exist.
 */
export async function writeICloudFile(
  filename: string,
  content: string
): Promise<void> {
  const dir = await getNotesDirectory();
  if (!dir) throw new Error("iCloud not available");

  const file = new File(dir, filename);
  if (!file.exists) {
    file.create({ intermediates: true });
  }
  file.write(content);
}

/**
 * Delete a file from the iCloud notes directory.
 */
export async function deleteICloudFile(filename: string): Promise<void> {
  const dir = await getNotesDirectory();
  if (!dir) return;

  const file = new File(dir, filename);
  if (file.exists) {
    file.delete();
  }
}
