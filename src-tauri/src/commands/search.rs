use crate::db::models::*;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

fn fetch_note_tags(conn: &Connection, note_id: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ?1 ORDER BY t.name")
        .map_err(|e| e.to_string())?;

    let tags = stmt
        .query_map([note_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tags)
}

#[tauri::command]
pub fn search_notes(
    db: State<'_, Mutex<Connection>>,
    params: SearchNotesParams,
) -> Result<Vec<NoteListItem>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let limit = params.limit.unwrap_or(20);

    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.title, snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) as preview, \
             n.updated_at, n.is_pinned, n.is_trashed, n.word_count, n.workspace_id \
             FROM notes_fts fts \
             JOIN notes n ON n.rowid = fts.rowid \
             WHERE notes_fts MATCH ?1 AND n.is_trashed = 0 \
             ORDER BY rank \
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![params.query, limit], |row| {
            Ok(NoteListItem {
                id: row.get(0)?,
                title: row.get(1)?,
                preview: row.get(2)?,
                updated_at: row.get(3)?,
                is_pinned: row.get::<_, i32>(4)? != 0,
                is_trashed: row.get::<_, i32>(5)? != 0,
                word_count: row.get(6)?,
                tags: vec![],
                state: "draft".to_string(),
                workspace_id: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items: Vec<NoteListItem> = Vec::new();
    for row in rows {
        let mut item = row.map_err(|e| e.to_string())?;
        item.tags = fetch_note_tags(&conn, &item.id)?;
        items.push(item);
    }

    Ok(items)
}

// --- Semantic Search ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticSearchResult {
    pub id: String,
    pub title: String,
    pub preview: String,
    pub similarity: f64,
    pub tags: Vec<String>,
}

fn cosine_similarity(a: &[f64], b: &[f64]) -> f64 {
    let mut dot = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;
    for i in 0..a.len() {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 { 0.0 } else { dot / denom }
}

#[tauri::command]
pub fn semantic_search(
    db: State<'_, Mutex<Connection>>,
    query_embedding: Vec<f64>,
    limit: Option<usize>,
    min_similarity: Option<f64>,
) -> Result<Vec<SemanticSearchResult>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let max_results = limit.unwrap_or(10);
    let threshold = min_similarity.unwrap_or(0.3);

    // Get all embeddings
    let mut stmt = conn
        .prepare("SELECT note_id, embedding FROM note_embeddings")
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut results: Vec<(String, f64)> = Vec::new();
    for (note_id, embedding_json) in &rows {
        let embedding: Vec<f64> = serde_json::from_str(embedding_json)
            .map_err(|e| format!("Failed to parse embedding: {}", e))?;

        if embedding.len() != query_embedding.len() {
            continue;
        }

        let sim = cosine_similarity(&query_embedding, &embedding);
        if sim >= threshold {
            results.push((note_id.clone(), sim));
        }
    }

    // Sort by similarity descending
    results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(max_results);

    let mut output: Vec<SemanticSearchResult> = Vec::new();
    for (note_id, similarity) in results {
        let note = conn
            .query_row(
                "SELECT title, content FROM notes WHERE id = ?1",
                [&note_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .map_err(|e| e.to_string())?;

        let tags = fetch_note_tags(&conn, &note_id)?;
        let preview = if note.1.len() > 200 {
            note.1[..200].to_string()
        } else {
            note.1.clone()
        };

        output.push(SemanticSearchResult {
            id: note_id,
            title: note.0,
            preview,
            similarity: (similarity * 1000.0).round() / 1000.0,
            tags,
        });
    }

    Ok(output)
}
