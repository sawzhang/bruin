use crate::db::models::Note;
use crate::markdown::frontmatter;
use std::fs;
use std::path::{Path, PathBuf};

/// Return the iCloud notes directory path.
pub fn get_icloud_dir() -> PathBuf {
    let home = std::env::var("HOME").expect("HOME not set");
    PathBuf::from(home)
        .join("Library")
        .join("Mobile Documents")
        .join("com~apple~CloudDocs")
        .join("Bruin")
        .join("notes")
}

/// Write note as .md file to iCloud directory using frontmatter serialization.
pub fn export_note(note: &Note) -> Result<(), String> {
    let dir = get_icloud_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create iCloud directory: {}", e))?;

    let file_path = dir.join(format!("{}.md", note.id));
    let content = frontmatter::serialize_frontmatter(note);
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write note to iCloud: {}", e))?;

    Ok(())
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
