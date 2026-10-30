-- Apply the selected display name while preserving all other site preferences.
INSERT INTO siteSettings (id, brand) VALUES (1, 'كونكت لينك')
ON CONFLICT(id) DO UPDATE SET brand = excluded.brand;
