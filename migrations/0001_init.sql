-- Folders form a tree. The root folder has id 'root', parent NULL, slug ''.
CREATE TABLE folders (
  id         TEXT PRIMARY KEY,
  parent_id  TEXT REFERENCES folders(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (parent_id, slug)
);

-- Everything placed on a canvas. Position/size are world coordinates of the
-- canvas of folder_id. A folder card is an item of type 'folder' whose
-- target_folder_id is the folder it opens.
CREATE TABLE items (
  id               TEXT PRIMARY KEY,
  folder_id        TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('folder','image','link','embed','note','file')),
  x                REAL NOT NULL DEFAULT 0,
  y                REAL NOT NULL DEFAULT 0,
  w                REAL NOT NULL DEFAULT 200,
  h                REAL NOT NULL DEFAULT 140,
  z                INTEGER NOT NULL DEFAULT 0,
  target_folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  data             TEXT NOT NULL DEFAULT '{}', -- type-specific JSON
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX items_folder ON items (folder_id);

INSERT INTO folders (id, parent_id, slug, name) VALUES ('root', NULL, '', 'Ana canvas');
