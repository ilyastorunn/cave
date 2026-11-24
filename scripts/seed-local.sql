-- Local-only sample data for development. Not a migration; never run on remote.
DELETE FROM items;
DELETE FROM folders WHERE id <> 'root';

INSERT INTO folders (id, parent_id, slug, name) VALUES
  ('f-tasarim',     'root',      'tasarim',     'Tasarım'),
  ('f-referanslar', 'f-tasarim', 'referanslar', 'Referanslar'),
  ('f-tipografi',   'f-tasarim', 'tipografi',   'Tipografi'),
  ('f-muzik',       'root',      'muzik',       'Müzik'),
  ('f-okuma',       'root',      'okuma',       'Okuma listesi');

INSERT INTO items (id, folder_id, type, x, y, w, h, z, target_folder_id) VALUES
  ('i-1', 'root',      'folder', -340, -90, 200, 140, 1, 'f-tasarim'),
  ('i-2', 'root',      'folder',  -80, -40, 200, 140, 2, 'f-muzik'),
  ('i-3', 'root',      'folder',  180, -110, 200, 140, 3, 'f-okuma'),
  ('i-4', 'f-tasarim', 'folder', -220, -70, 200, 140, 1, 'f-referanslar'),
  ('i-5', 'f-tasarim', 'folder',   40, -70, 200, 140, 2, 'f-tipografi');
