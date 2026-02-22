use crate::commands::notes::fetch_note;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn export_note_markdown(
    db: State<'_, Mutex<Connection>>,
    id: String,
    strip_frontmatter: Option<bool>,
) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let note = fetch_note(&conn, &id)?;

    if strip_frontmatter.unwrap_or(false) {
        Ok(note.content)
    } else {
        let tags_yaml = if note.tags.is_empty() {
            "[]".to_string()
        } else {
            format!("[{}]", note.tags.iter().map(|t| format!("\"{}\"", t)).collect::<Vec<_>>().join(", "))
        };

        Ok(format!(
            "---\ntitle: \"{}\"\ncreated_at: \"{}\"\nupdated_at: \"{}\"\ntags: {}\nstate: \"{}\"\n---\n\n{}",
            note.title.replace('"', "\\\""),
            note.created_at,
            note.updated_at,
            tags_yaml,
            note.state,
            note.content,
        ))
    }
}

#[tauri::command]
pub fn export_note_html(
    db: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let note = fetch_note(&conn, &id)?;

    let parser = pulldown_cmark::Parser::new(&note.content);
    let mut html_body = String::new();
    pulldown_cmark::html::push_html(&mut html_body, parser);

    let html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }}
  h1 {{ font-size: 1.8rem; margin-bottom: 0.5rem; }}
  h2 {{ font-size: 1.4rem; }}
  h3 {{ font-size: 1.2rem; }}
  pre {{ background: #f5f5f5; padding: 1rem; border-radius: 6px; overflow-x: auto; }}
  code {{ background: #f0f0f0; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.9em; }}
  pre code {{ background: none; padding: 0; }}
  blockquote {{ border-left: 3px solid #ddd; margin-left: 0; padding-left: 1rem; color: #666; }}
  img {{ max-width: 100%; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th, td {{ border: 1px solid #ddd; padding: 0.5rem; text-align: left; }}
  th {{ background: #f5f5f5; }}
  .meta {{ color: #888; font-size: 0.85rem; margin-bottom: 1.5rem; }}
</style>
</head>
<body>
<h1>{title}</h1>
<p class="meta">Last updated: {updated_at}</p>
{body}
</body>
</html>"#,
        title = html_escape(&note.title),
        updated_at = &note.updated_at,
        body = html_body,
    );

    Ok(html)
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
