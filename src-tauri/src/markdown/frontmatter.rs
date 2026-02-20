use crate::db::models::Note;
use yaml_rust2::{Yaml, YamlLoader};

#[derive(Debug, Clone)]
pub struct FrontmatterData {
    pub id: Option<String>,
    pub title: Option<String>,
    pub tags: Vec<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub is_pinned: bool,
}

/// Serialize a Note into a markdown string with YAML frontmatter.
pub fn serialize_frontmatter(note: &Note) -> String {
    let mut fm = String::new();
    fm.push_str("---\n");
    fm.push_str(&format!("id: \"{}\"\n", note.id));
    fm.push_str(&format!("title: \"{}\"\n", note.title.replace('"', "\\\"")));
    if !note.tags.is_empty() {
        fm.push_str("tags:\n");
        for tag in &note.tags {
            fm.push_str(&format!("  - \"{}\"\n", tag));
        }
    } else {
        fm.push_str("tags: []\n");
    }
    fm.push_str(&format!("created_at: \"{}\"\n", note.created_at));
    fm.push_str(&format!("updated_at: \"{}\"\n", note.updated_at));
    fm.push_str(&format!("is_pinned: {}\n", note.is_pinned));
    fm.push_str("---\n");
    fm.push_str(&note.content);
    fm
}

/// Parse a markdown string with YAML frontmatter into FrontmatterData and body content.
pub fn parse_frontmatter(content: &str) -> Result<(FrontmatterData, String), String> {
    if !content.starts_with("---") {
        return Ok((
            FrontmatterData {
                id: None,
                title: None,
                tags: vec![],
                created_at: None,
                updated_at: None,
                is_pinned: false,
            },
            content.to_string(),
        ));
    }

    let rest = &content[3..];

    // Find closing --- delimiter. Try \n---\n first (has body after), then \n--- at end.
    let (end, body_offset) = if let Some(pos) = rest.find("\n---\n") {
        (pos, pos + 5) // skip \n---\n
    } else if let Some(pos) = rest.find("\n---") {
        // Check it's actually at the end or followed by EOF
        let after = pos + 4;
        if after >= rest.len() || rest[after..].trim().is_empty() {
            (pos, rest.len()) // no body
        } else {
            (pos, after)
        }
    } else {
        return Err("Invalid frontmatter: no closing ---".to_string());
    };

    let yaml_str = &rest[..end];
    let body = if body_offset < rest.len() {
        rest[body_offset..].to_string()
    } else {
        String::new()
    };

    let docs = YamlLoader::load_from_str(yaml_str.trim())
        .map_err(|e| format!("YAML parse error: {}", e))?;

    if docs.is_empty() {
        return Ok((
            FrontmatterData {
                id: None,
                title: None,
                tags: vec![],
                created_at: None,
                updated_at: None,
                is_pinned: false,
            },
            body,
        ));
    }

    let doc = &docs[0];

    let id = doc["id"].as_str().map(String::from);
    let title = doc["title"].as_str().map(String::from);
    let created_at = doc["created_at"].as_str().map(String::from);
    let updated_at = doc["updated_at"].as_str().map(String::from);
    let is_pinned = doc["is_pinned"].as_bool().unwrap_or(false);

    let tags = match &doc["tags"] {
        Yaml::Array(arr) => arr
            .iter()
            .filter_map(|t| t.as_str().map(String::from))
            .collect(),
        _ => vec![],
    };

    Ok((
        FrontmatterData {
            id,
            title,
            tags,
            created_at,
            updated_at,
            is_pinned,
        },
        body,
    ))
}
