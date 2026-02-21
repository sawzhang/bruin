import { File, Directory, Paths } from "expo-file-system";

/**
 * The iCloud notes directory path.
 * On iOS: ~/Library/Mobile Documents/com~apple~CloudDocs/Bruin/notes/
 *
 * We derive this from the app's document directory by navigating up to the
 * system-level iCloud Drive container.
 */
const ICLOUD_NOTES_PATH = "../../Library/Mobile Documents/com~apple~CloudDocs/Bruin/notes";

/**
 * Get a Directory instance pointing to the iCloud notes directory.
 */
function getICloudNotesDirectory(): Directory {
  return new Directory(Paths.document, ICLOUD_NOTES_PATH);
}

/**
 * Get the iCloud notes directory URI string.
 */
export function getICloudNotesDir(): string {
  return getICloudNotesDirectory().uri;
}

/**
 * Check if iCloud notes directory exists and is accessible.
 */
export async function isICloudAvailable(): Promise<boolean> {
  try {
    const dir = getICloudNotesDirectory();
    return dir.exists;
  } catch {
    return false;
  }
}

/**
 * List all .md files in the iCloud notes directory.
 * Filters out hidden files and .icloud placeholder files.
 */
export async function listICloudFiles(): Promise<string[]> {
  const dir = getICloudNotesDirectory();

  if (!dir.exists) {
    return [];
  }

  const entries = dir.list();
  const filenames: string[] = [];

  for (const entry of entries) {
    // Only process files (skip directories)
    if (entry instanceof File) {
      const name = entry.name;
      // Skip hidden files (including .icloud placeholders)
      if (name.startsWith(".")) {
        continue;
      }
      // Only include .md files
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
  const file = new File(getICloudNotesDirectory(), filename);
  return file.text();
}

/**
 * Write content to a file in the iCloud notes directory.
 * Creates the directory if it does not exist.
 */
export async function writeICloudFile(
  filename: string,
  content: string
): Promise<void> {
  const dir = getICloudNotesDirectory();

  // Ensure directory exists
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }

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
  const file = new File(getICloudNotesDirectory(), filename);
  if (file.exists) {
    file.delete();
  }
}
