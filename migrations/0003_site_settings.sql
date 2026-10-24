CREATE TABLE siteSettings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    brand TEXT NOT NULL CHECK(length(brand) BETWEEN 1 AND 80)
);
