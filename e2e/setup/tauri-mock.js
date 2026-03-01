/**
 * Tauri IPC mock — injected as a Playwright init script before the app loads.
 * Replaces window.__TAURI_INTERNALS__ with an in-memory implementation so the
 * React app can run fully in a browser without the Tauri runtime.
 *
 * window.__TAURI_MOCK_DB__ is exposed for tests to read/write state directly.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // In-memory state
  // ---------------------------------------------------------------------------
  const db = {
    notes: [],
    tags: [],
    workspaces: [],
    settings: {},
    activities: [],
    tasks: [],
    templates: [],
    agents: [],
    syncState: { is_syncing: false, last_sync: null, error: null, files_synced: 0 },
    importFiles: null,
    noteLinks: [],
    _noteSeq: 1,
    _actSeq: 1,
    _taskSeq: 1,
  };

  function uid() { return 'note-' + (db._noteSeq++); }
  function now() { return new Date().toISOString(); }

  function extractTags(content) {
    if (!content) return [];
    const matches = content.match(/#([a-zA-Z0-9_/]+)/g) || [];
    return [...new Set(matches.map(function (t) { return t.slice(1); }))];
  }

  function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function toListItem(note) {
    return {
      id: note.id,
      title: note.title,
      preview: (note.content || '').slice(0, 120),
      state: note.state,
      is_pinned: note.is_pinned || false,
      word_count: note.word_count || 0,
      tags: note.tags || [],
      updated_at: note.updated_at,
      created_at: note.created_at,
    };
  }

  function logActivity(eventType, noteId, summary) {
    db.activities.unshift({
      id: 'act-' + (db._actSeq++),
      event_type: eventType,
      note_id: noteId || null,
      summary: summary || '',
      actor: 'user',
      agent_id: null,
      timestamp: now(),
    });
  }

  function syncTag(name) {
    if (!name) return;
    var parts = name.split('/');
    // Recursively create all ancestors first
    if (parts.length > 1) {
      syncTag(parts.slice(0, -1).join('/'));
    }
    var parentName = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
    if (!db.tags.find(function (t) { return t.name === name; })) {
      db.tags.push({ name: name, parent_name: parentName, is_pinned: false });
    }
  }

  // ---------------------------------------------------------------------------
  // Command handlers
  // ---------------------------------------------------------------------------
  var handlers = {
    list_notes: function (args) {
      var params = (args && args.params) || {};
      var notes = db.notes.filter(function (n) {
        if (params.trashed === true) return n.deleted;
        if (params.trashed === false) return !n.deleted;
        return true;
      });
      if (params.tags && params.tags.length > 0) {
        notes = notes.filter(function (n) {
          return params.tags.every(function (t) {
            return (n.tags || []).includes(t);
          });
        });
      }
      if (params.workspace_id) {
        notes = notes.filter(function (n) { return n.workspace_id === params.workspace_id; });
      }
      notes = notes.slice().sort(function (a, b) {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
      return notes.map(toListItem);
    },

    create_note: function (args) {
      var params = (args && args.params) || {};
      var tags = params.tags != null ? params.tags : extractTags(params.content || '');
      var note = {
        id: params.id || uid(),
        title: params.title || '',
        content: params.content || '',
        state: params.state || 'draft',
        is_pinned: false,
        deleted: false,
        word_count: countWords(params.content),
        tags: tags,
        workspace_id: params.workspace_id || null,
        created_at: now(),
        updated_at: now(),
        version: 1,
      };
      db.notes.unshift(note);
      tags.forEach(syncTag);
      logActivity('note_created', note.id, 'Created "' + note.title + '"');
      return Object.assign({}, note);
    },

    get_note: function (args) {
      var note = db.notes.find(function (n) { return n.id === (args && args.id); });
      if (!note) throw new Error('Note not found: ' + (args && args.id));
      return Object.assign({}, note);
    },

    update_note: function (args) {
      var params = (args && args.params) || {};
      var note = db.notes.find(function (n) { return n.id === params.id; });
      if (!note) throw new Error('Note not found: ' + params.id);
      if (params.title != null) note.title = params.title;
      if (params.content != null) {
        note.content = params.content;
        note.word_count = countWords(params.content);
        if (params.tags == null) {
          note.tags = extractTags(params.content);
        }
      }
      if (params.tags != null) note.tags = params.tags;
      note.updated_at = now();
      note.version = (note.version || 1) + 1;
      note.tags.forEach(syncTag);
      logActivity('note_updated', note.id, 'Updated "' + note.title + '"');
      return Object.assign({}, note);
    },

    delete_note: function (args) {
      var idx = db.notes.findIndex(function (n) { return n.id === (args && args.id); });
      if (idx === -1) return null;
      if (args.permanent) {
        db.notes.splice(idx, 1);
      } else {
        db.notes[idx].deleted = true;
      }
      return null;
    },

    trash_note: function (args) {
      var note = db.notes.find(function (n) { return n.id === (args && args.id); });
      if (note) {
        note.deleted = true;
        logActivity('note_trashed', note.id, 'Trashed "' + note.title + '"');
      }
      return null;
    },

    restore_note: function (args) {
      var note = db.notes.find(function (n) { return n.id === (args && args.id); });
      if (note) {
        note.deleted = false;
        logActivity('note_restored', note.id, 'Restored "' + note.title + '"');
      }
      return null;
    },

    pin_note: function (args) {
      var note = db.notes.find(function (n) { return n.id === (args && args.id); });
      if (note) {
        note.is_pinned = args.pinned != null ? args.pinned : !note.is_pinned;
        logActivity('note_pinned', note.id, 'Pinned "' + note.title + '"');
      }
      return null;
    },

    set_note_state: function (args) {
      var note = db.notes.find(function (n) { return n.id === (args && args.id); });
      if (!note) throw new Error('Note not found');
      note.state = args.state;
      note.updated_at = now();
      logActivity('state_changed', note.id, 'State → ' + args.state);
      return Object.assign({}, note);
    },

    list_tags: function () {
      return db.tags.map(function (t) {
        return {
          name: t.name,
          parent_name: t.parent_name || null,
          is_pinned: t.is_pinned || false,
          note_count: db.notes.filter(function (n) {
            return !n.deleted && (n.tags || []).includes(t.name);
          }).length,
        };
      });
    },

    get_tag_tree: function () { return handlers.list_tags(); },
    update_note_tags: function () { return null; },
    remove_unused_tags: function () { return null; },

    pin_tag: function (args) {
      var tag = db.tags.find(function (t) { return t.name === (args && args.name); });
      if (tag) tag.is_pinned = args.pinned;
      return null;
    },

    rename_tag: function (args) {
      var oldName = (args && args.old_name) || (args && args.oldName);
      var newName = (args && args.new_name) || (args && args.newName);
      var tag = db.tags.find(function (t) { return t.name === oldName; });
      if (tag) {
        tag.name = newName;
        db.notes.forEach(function (n) {
          var idx = (n.tags || []).indexOf(oldName);
          if (idx > -1) n.tags[idx] = newName;
        });
      }
      return null;
    },

    delete_tag: function (args) {
      db.tags = db.tags.filter(function (t) { return t.name !== (args && args.name); });
      return null;
    },

    get_notes_by_tag: function (args) {
      return db.notes
        .filter(function (n) { return !n.deleted && (n.tags || []).includes(args && args.tag); })
        .map(toListItem);
    },

    list_workspaces: function () {
      return db.workspaces.map(function (w) {
        return { id: w.id, name: w.name, created_at: now() };
      });
    },

    create_workspace: function (args) {
      var name = (args && (args.name || (args.params && args.params.name))) || 'New Workspace';
      var ws = { id: 'ws-' + Date.now(), name: name };
      db.workspaces.push(ws);
      return ws;
    },

    delete_workspace: function (args) {
      db.workspaces = db.workspaces.filter(function (w) { return w.id !== (args && args.id); });
      return null;
    },

    set_current_workspace: function () { return null; },
    get_current_workspace: function () { return null; },

    get_sync_status: function () {
      return Object.assign({}, db.syncState);
    },
    trigger_sync: function () { return null; },
    get_sync_logs: function () { return []; },
    retry_sync: function () { return null; },

    get_all_settings: function () { return Object.assign({}, db.settings); },
    get_setting: function (args) { return (db.settings[args && args.key]) || null; },
    set_setting: function (args) {
      var key = (args && args.key) || (args && args.params && args.params.key);
      var value = (args && args.value) || (args && args.params && args.params.value);
      if (key) db.settings[key] = value;
      return null;
    },

    full_text_search: function (args) {
      var q = ((args && args.params && args.params.query) || '').toLowerCase();
      if (!q) return [];
      return db.notes
        .filter(function (n) {
          return !n.deleted && (
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q)
          );
        })
        .map(toListItem);
    },

    search_notes: function (args) {
      var q = ((args && args.params && args.params.query) || '').toLowerCase();
      if (!q) return [];
      return db.notes
        .filter(function (n) {
          return !n.deleted && (
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q)
          );
        })
        .map(toListItem);
    },

    semantic_search: function () { return []; },

    export_note_markdown: function (args) {
      var note = db.notes.find(function (n) { return n.id === (args && args.id); });
      return note ? ('# ' + note.title + '\n\n' + note.content) : '';
    },

    export_note_html: function (args) {
      var note = db.notes.find(function (n) { return n.id === (args && args.id); });
      return note
        ? '<html><body><h1>' + note.title + '</h1><div>' + note.content + '</div></body></html>'
        : '';
    },

    import_markdown_files: function (args) {
      var paths = (args && args.paths) || [];
      paths.forEach(function (path) {
        var file = (db.importFiles || []).find(function (f) { return f.path === path; });
        if (file) {
          var note = {
            id: uid(),
            title: file.title || path.split('/').pop().replace('.md', ''),
            content: file.content || '',
            state: 'draft',
            is_pinned: false,
            deleted: false,
            word_count: countWords(file.content),
            tags: [],
            workspace_id: null,
            created_at: now(),
            updated_at: now(),
            version: 1,
          };
          db.notes.unshift(note);
        }
      });
      return null;
    },
    get_knowledge_graph: function () {
      var nodes = db.notes
        .filter(function (n) { return !n.deleted; })
        .map(function (n) {
          return { id: n.id, title: n.title || 'Untitled', link_count: 0, tags: n.tags || [] };
        });
      return { nodes: nodes, edges: db.noteLinks.slice() };
    },
    get_forward_links: function () { return []; },
    get_backlinks: function () { return []; },
    sync_note_links: function () { return null; },
    get_activity_feed: function (args) {
      var limit = (args && args.limit) || 50;
      var agentId = args && args.agentId;
      var events = db.activities.slice();
      if (agentId) {
        events = events.filter(function (e) { return e.agent_id === agentId; });
      }
      return events.slice(0, limit);
    },
    list_agents: function () { return db.agents.slice(); },
    register_agent: function (args) {
      var agent = {
        id: 'agent-' + Date.now(),
        name: (args && args.name) || 'Agent',
        description: (args && args.description) || '',
        capabilities: (args && args.capabilities) || [],
        is_active: true,
        created_at: now(),
        updated_at: now(),
      };
      db.agents.push(agent);
      return Object.assign({}, agent);
    },
    update_agent: function () { return null; },
    deactivate_agent: function (args) {
      var agent = db.agents.find(function (a) { return a.id === (args && args.id); });
      if (agent) {
        agent.is_active = false;
        agent.updated_at = now();
      }
      return agent ? Object.assign({}, agent) : null;
    },
    set_current_agent: function () { return null; },
    get_agent_audit_log: function () { return []; },
    bind_agent_workspace: function () { return null; },
    unbind_agent_workspace: function () { return null; },
    get_agent_workspaces: function () { return []; },
    list_tasks: function (args) {
      var status = args && args.status;
      var tasks = db.tasks.slice();
      if (status) {
        tasks = tasks.filter(function (t) { return t.status === status; });
      }
      return tasks;
    },

    create_task: function (args) {
      var task = {
        id: 'task-' + (db._taskSeq++),
        title: (args && args.title) || 'Untitled Task',
        description: (args && args.description) || null,
        status: 'todo',
        priority: (args && args.priority) || 'medium',
        due_date: (args && args.due_date) || null,
        assigned_agent_id: null,
        linked_note_id: (args && args.linked_note_id) || null,
        workspace_id: (args && args.workspace_id) || null,
        created_at: now(),
        updated_at: now(),
      };
      db.tasks.push(task);
      return Object.assign({}, task);
    },

    update_task: function (args) {
      var task = db.tasks.find(function (t) { return t.id === (args && args.id); });
      if (!task) return null;
      if (args.title != null) task.title = args.title;
      if (args.status != null) task.status = args.status;
      if (args.priority != null) task.priority = args.priority;
      task.updated_at = now();
      return Object.assign({}, task);
    },

    complete_task: function (args) {
      var task = db.tasks.find(function (t) { return t.id === (args && args.id); });
      if (task) {
        task.status = 'done';
        task.updated_at = now();
      }
      return task ? Object.assign({}, task) : null;
    },

    delete_task: function (args) {
      db.tasks = db.tasks.filter(function (t) { return t.id !== (args && args.id); });
      return null;
    },

    assign_task: function () { return null; },

    list_templates: function () {
      return db.templates.slice();
    },

    create_note_from_template: function (args) {
      var params = (args && args.params) || {};
      var template = db.templates.find(function (t) { return t.id === params.template_id; });
      var title = params.title || (template ? template.name : 'From Template');
      var content = template ? (template.content || '') : '';
      var tags = template ? (template.tags || []) : [];
      var note = {
        id: uid(),
        title: title,
        content: content,
        state: 'draft',
        is_pinned: false,
        deleted: false,
        word_count: countWords(content),
        tags: tags,
        workspace_id: null,
        created_at: now(),
        updated_at: now(),
        version: 1,
      };
      db.notes.unshift(note);
      tags.forEach(syncTag);
      logActivity('note_created', note.id, 'Created from template "' + title + '"');
      return Object.assign({}, note);
    },
    list_workflow_templates: function () { return []; },
    get_workflow_template: function () { return null; },
    create_workflow_template: function () { return null; },
    execute_workflow: function () { return null; },
    delete_workflow_template: function () { return null; },
    list_webhooks: function () { return []; },
    register_webhook: function () { return { id: 'wh-1' }; },
    delete_webhook: function () { return null; },
    update_webhook: function () { return null; },
    test_webhook: function () { return null; },
    get_webhook_logs: function () { return []; },
    get_word_count: function (args) {
      var note = db.notes.find(function (n) { return n.id === (args && args.id); });
      return note ? countWords(note.content) : 0;
    },
    batch_create_notes: function (args) {
      var notes = (args && args.params) || [];
      return notes.map(function (p) { return handlers.create_note({ params: p }); });
    },
    append_to_note: function (args) {
      var note = db.notes.find(function (n) { return n.id === (args && args.id); });
      if (!note) throw new Error('Note not found');
      note.content = note.content + (args.separator || '\n\n') + (args.content || '');
      note.updated_at = now();
      return Object.assign({}, note);
    },
    reindex_embeddings: function () { return null; },

    // Tauri plugin: event
    'plugin:event|listen': function () {
      return Math.floor(Math.random() * 1000000);
    },
    'plugin:event|unlisten': function () { return null; },
    'plugin:event|emit': function () { return null; },

    // Tauri plugin: dialog
    'plugin:dialog|open': function () {
      if (!db.importFiles || db.importFiles.length === 0) return null;
      return db.importFiles.map(function (f) { return f.path; });
    },
    'plugin:dialog|save': function () { return null; },

    // Tauri plugin: fs
    'plugin:fs|write_text_file': function () { return null; },
  };

  // ---------------------------------------------------------------------------
  // Expose DB for test manipulation (seed data before page.goto())
  // ---------------------------------------------------------------------------
  window.__TAURI_MOCK_DB__ = db;

  // ---------------------------------------------------------------------------
  // window.__TAURI_INTERNALS__ — what @tauri-apps/api uses under the hood
  // ---------------------------------------------------------------------------
  window.__TAURI_INTERNALS__ = {
    invoke: function (cmd, payload) {
      var handler = handlers[cmd];
      if (handler) {
        try {
          return Promise.resolve(handler(payload));
        } catch (err) {
          return Promise.reject(err);
        }
      }
      console.warn('[TauriMock] unhandled command:', cmd, payload);
      return Promise.resolve(null);
    },

    transformCallback: function (callback, once) {
      var id = Math.floor(Math.random() * 1000000);
      window.__tauri_callbacks = window.__tauri_callbacks || {};
      window.__tauri_callbacks[id] = { callback: callback, once: !!once };
      return id;
    },

    metadata: {
      currentWindow: { label: 'main' },
      windows: [{ label: 'main' }],
      webviews: [{ label: 'main', windowLabel: 'main' }],
    },

    ipc: function () {},
  };

  console.log('[TauriMock] initialized — window.__TAURI_MOCK_DB__ ready');
}());
