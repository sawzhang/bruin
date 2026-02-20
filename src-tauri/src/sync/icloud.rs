use crate::db::models::Note;
use crate::markdown::frontmatter;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

/// Return the iCloud notes directory path.
pub fn get_icloud_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .map_err(|_| "HOME environment variable not set".to_string())?;
    Ok(PathBuf::from(home)
        .join("Library")
        .join("Mobile Documents")
        .join("com~apple~CloudDocs")
        .join("Bruin")
        .join("notes"))
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
    })
}
