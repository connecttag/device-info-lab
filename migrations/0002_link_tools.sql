CREATE TABLE linkGroups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(name) BETWEEN 1 AND 80),
    createdAt INTEGER NOT NULL
);
ALTER TABLE links ADD COLUMN groupId TEXT REFERENCES linkGroups(id) ON DELETE SET NULL;
ALTER TABLE links ADD COLUMN maxUses INTEGER CHECK(maxUses IS NULL OR maxUses BETWEEN 1 AND 1000000);
ALTER TABLE links ADD COLUMN useCount INTEGER NOT NULL DEFAULT 0 CHECK(useCount >= 0);
ALTER TABLE links ADD COLUMN accentColor TEXT NOT NULL DEFAULT '#6956d8';
ALTER TABLE links ADD COLUMN backgroundColor TEXT NOT NULL DEFAULT '#f5f6fa';
ALTER TABLE links ADD COLUMN logoData TEXT;
ALTER TABLE visits ADD COLUMN template TEXT NOT NULL DEFAULT 'welcome';
UPDATE visits SET template = (SELECT template FROM links WHERE links.id = visits.linkId);
UPDATE links SET useCount = (SELECT COUNT(*) FROM visits WHERE visits.linkId = links.id);
CREATE INDEX idxLinksGroup ON links(groupId, createdAt DESC);
CREATE INDEX idxVisitsTemplateCreated ON visits(template, createdAt DESC);
-- Runs in the same atomic statement as the conditional admitted INSERT. No quota
-- refund on visit deletion: retention cleanup must not reopen exhausted links.
CREATE TRIGGER countAdmittedVisit AFTER INSERT ON visits BEGIN
    UPDATE links SET useCount = useCount + 1 WHERE id = NEW.linkId;
END;
