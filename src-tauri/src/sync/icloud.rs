use crate::db::models::Note;
use crate::markdown::frontmatter;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

/// Status of iCloud availability.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ICloudStatus {
    pub available: bool,
    pub directory: String,
    pub writable: bool,
    pub error: Option<String>,
}

/// Check if the iCloud directory exists and is writable.
pub fn is_icloud_available() -> bool {
    match get_icloud_dir() {
        Ok(dir) => {
            if !dir.exists() {
                return false;
            }
            // Test write access by creating and removing a temp file
            let test_file = dir.join(".bruin-write-test");
            match fs::write(&test_file, "test") {
                Ok(()) => {
                    let _ = fs::remove_file(&test_file);
                    true
                }
                Err(_) => false,
            }
        }
        Err(_) => false,
    }
}

/// Get detailed iCloud status information.
pub fn get_icloud_status() -> ICloudStatus {
    match get_icloud_dir() {
        Ok(dir) => {
            let dir_str = dir.to_string_lossy().to_string();
            if !dir.exists() {
                return ICloudStatus {
                    available: false,
                    directory: dir_str,
                    writable: false,
                    error: Some("iCloud directory does not exist".to_string()),
                };
            }
            let test_file = dir.join(".bruin-write-test");
            match fs::write(&test_file, "test") {
                Ok(()) => {
                    let _ = fs::remove_file(&test_file);
                    ICloudStatus {
                        available: true,
                        directory: dir_str,
                        writable: true,
                        error: None,
                    }
                }
                Err(e) => ICloudStatus {
                    available: true,
                    directory: dir_str,
                    writable: false,
                    error: Some(format!("Directory not writable: {}", e)),
                },
            }
        }
        Err(e) => ICloudStatus {
            available: false,
            directory: String::new(),
            writable: false,
            error: Some(e),
        },
    }
}

/// Return the old iCloud notes directory path (com~apple~CloudDocs).
fn get_legacy_icloud_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .map_err(|_| "HOME environment variable not set".to_string())?;
    Ok(PathBuf::from(home)
        .join("Library")
        .join("Mobile Documents")
        .join("com~apple~CloudDocs")
        .join("Bruin")
        .join("notes"))
}

/// Return the iCloud notes directory path using the shared app container.
/// This path is accessible from both macOS (desktop) and iOS (mobile).
///
/// macOS path: ~/Library/Mobile Documents/iCloud~com~bruin~app/Documents/notes/
/// iOS path: resolved via FileManager.url(forUbiquityContainerIdentifier:)
pub fn get_icloud_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .map_err(|_| "HOME environment variable not set".to_string())?;
    let new_dir = PathBuf::from(&home)
        .join("Library")
        .join("Mobile Documents")
        .join("iCloud~com~bruin~app")
        .join("Documents")
        .join("notes");

    // If the new container dir exists, use it
    if new_dir.exists() {
        return Ok(new_dir);
    }

    // Check if the legacy directory has files (backward compatibility)
    let legacy_dir = get_legacy_icloud_dir()?;
    if legacy_dir.exists() {
        // Migrate: create the new directory and move files
        if let Err(e) = migrate_to_new_container(&legacy_dir, &new_dir) {
            eprintln!("iCloud migration warning: {}", e);
            // Fall back to legacy path if migration fails
            return Ok(legacy_dir);
        }
        return Ok(new_dir);
    }

    // Neither exists yet — use the new path (will be created on first write)
    Ok(new_dir)
}

/// Migrate notes from the legacy com~apple~CloudDocs path to the new
/// iCloud~com~bruin~app container path.
fn migrate_to_new_container(legacy_dir: &Path, new_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(new_dir)
        .map_err(|e| format!("Failed to create new iCloud directory: {}", e))?;

    let entries = fs::read_dir(legacy_dir)
        .map_err(|e| format!("Failed to read legacy directory: {}", e))?;

    let mut migrated = 0;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        // Skip hidden files
        if file_name.starts_with('.') {
            continue;
        }

        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            let dest = new_dir.join(file_name);
            // Copy rather than move, so the legacy location still works if
            // the user rolls back to an older version
            fs::copy(&path, &dest)
                .map_err(|e| format!("Failed to copy {}: {}", file_name, e))?;
            migrated += 1;
        }
    }

    if migrated > 0 {
        eprintln!("iCloud migration: copied {} notes to new container", migrated);
    }

    Ok(())
}

/// Write note as .md file to iCloud directory using frontmatter serialization.
pub fn export_note(note: &Note) -> Result<(), String> {
    let dir = get_icloud_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create iCloud directory: {}", e))?;

    let file_path = dir.join(format!("{}.md", note.id));
    let content = frontmatter::serialize_frontmatter(note);
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write note to iCloud: {}", e))?;

    Ok(())
}

/// Compute SHA-256 hash of title + content for sync comparison.
pub fn compute_sync_hash(title: &str, content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(title.as_bytes());
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Delete a note's .md file from the iCloud directory.
pub fn delete_note_file(id: &str) -> Result<(), String> {
    let file_path = get_icloud_dir()?.join(format!("{}.md", id));
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete note file: {}", e))?;
    }
    Ok(())
}

/// List all .md files in the iCloud directory.
pub fn list_icloud_files() -> Result<Vec<PathBuf>, String> {
    let dir = get_icloud_dir()?;
    if !dir.exists() {
        return Ok(vec![]);
    }

    let entries =
        fs::read_dir(&dir).map_err(|e| format!("Failed to read iCloud directory: {}", e))?;

    let mut files = Vec::new();
    for entry in entries {
        let entry =
            entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        // Skip hidden files (including .icloud placeholders)
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if file_name.starts_with('.') {
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            files.push(path);
        }
    }

    Ok(files)
}

/// Read .md file, parse frontmatter, return Note data.
pub fn import_file(path: &Path) -> Result<Note, String> {
    let raw = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file {}: {}", path.display(), e))?;

    let (fm, body) = frontmatter::parse_frontmatter(&raw)?;

    let now = chrono::Utc::now().to_rfc3339();
    let word_count = body
        .split_whitespace()
        .filter(|s| !s.is_empty())
        .count() as i64;

    let tags = if fm.tags.is_empty() {
        crate::markdown::tags::extract_tags(&body)
    } else {
        fm.tags
    };

    Ok(Note {
        id: fm.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
        title: fm.title.unwrap_or_default(),
        content: body,
        created_at: fm.created_at.unwrap_or_else(|| now.clone()),
        updated_at: fm.updated_at.unwrap_or(now),
        is_trashed: false,
        is_pinned: fm.is_pinned,
        word_count,
        file_path: Some(path.to_string_lossy().to_string()),
        sync_hash: None,
        tags,
        state: "draft".to_string(),
        workspace_id: None,
        version: 1,
    })
}
