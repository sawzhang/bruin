use regex::Regex;

/// Extract tags from markdown content, ignoring tags inside code blocks.
pub fn extract_tags(content: &str) -> Vec<String> {
    let tag_re = Regex::new(r"#([a-zA-Z0-9_]+(?:/[a-zA-Z0-9_]+)*)").unwrap();

    // Remove fenced code blocks before extracting tags
    let code_block_re = Regex::new(r"(?s)```.*?```").unwrap();
    let cleaned = code_block_re.replace_all(content, "");

    let mut tags: Vec<String> = tag_re
        .captures_iter(&cleaned)
        .map(|cap| cap[1].to_string())
        .collect();

    tags.sort();
    tags.dedup();
    tags
}

/// For a tag like "work/projects", return the parent "work".
pub fn get_parent_tag(tag: &str) -> Option<String> {
    tag.rfind('/').map(|pos| tag[..pos].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_tags() {
        let content = "Hello #rust and #work/projects are great\n```\n#not_a_tag\n```\n#another";
        let tags = extract_tags(content);
        assert_eq!(tags, vec!["another", "rust", "work/projects"]);
    }

    #[test]
    fn test_get_parent_tag() {
        assert_eq!(get_parent_tag("work/projects"), Some("work".to_string()));
        assert_eq!(get_parent_tag("simple"), None);
    }
}
