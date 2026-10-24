PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
    template TEXT NOT NULL DEFAULT 'welcome' CHECK(template IN ('welcome', 'deviceInfo', 'promotional', 'notFound', 'training', 'custom')),
    pageTitle TEXT,
    pageMessage TEXT,
    companyName TEXT,
    companyWebsite TEXT,
    isActive INTEGER NOT NULL DEFAULT 1 CHECK(isActive IN (0, 1)),
    createdAt INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idxLinksCreated ON links(createdAt DESC);

CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    linkId TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    createdAt INTEGER NOT NULL,
    retainUntil INTEGER NOT NULL,
    ip TEXT,
    country TEXT,
    browserName TEXT,
    osName TEXT,
    isBot INTEGER NOT NULL DEFAULT 0,
    edgeJson TEXT NOT NULL,
    browserJson TEXT,
    enrichedAt INTEGER,
    trainingJson TEXT,
    trainingAt INTEGER
);
CREATE INDEX IF NOT EXISTS idxVisitsCreated ON visits(createdAt DESC, id);
CREATE INDEX IF NOT EXISTS idxVisitsLinkCreated ON visits(linkId, createdAt DESC, id);
CREATE INDEX IF NOT EXISTS idxVisitsRetention ON visits(retainUntil);

CREATE TABLE IF NOT EXISTS adminSessions (
    tokenHash TEXT PRIMARY KEY,
    expiresAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idxSessionsExpiry ON adminSessions(expiresAt);

CREATE TABLE IF NOT EXISTS rateLimits (
    bucketKey TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idxRateExpiry ON rateLimits(expiresAt);
