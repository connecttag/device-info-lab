import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

// Exercise real SQLite SQL rather than mocking repository responses.
export function createDatabase() {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
    const db = {
        prepare(sql) {
            const statement = sqlite.prepare(sql);
            const wrap = (params = []) => ({
                bind: (...values) => wrap(values),
                async first() { return statement.get(...params) ?? null; },
                async all() { return { success: true, results: statement.all(...params) }; },
                async run() {
                    const info = statement.run(...params);
                    return { success: true, meta: { changes: Number(info.changes) } };
                }
            });
            return wrap();
        },
        async batch(statements) {
            sqlite.exec('BEGIN');
            try {
                const results = [];
                for (const statement of statements) results.push(await statement.run());
                sqlite.exec('COMMIT');
                return results;
            } catch (error) {
                sqlite.exec('ROLLBACK');
                throw error;
            }
        },
        close() { sqlite.close(); }
    };
    return db;
}

export function createEnv(db = createDatabase()) {
    return {
        DB: db,
        APP_ENV: 'development',
        ADMIN_KEY: 'test-admin-key-for-local-unit-tests-only-123456',
        TOKEN_SECRET: 'test-signing-key-for-local-unit-tests-only-123456',
        ASSETS: { async fetch() { return new Response('<html></html>', { headers: { 'content-type': 'text/html' } }); } }
    };
}

export function request(path, options = {}) {
    const { cf, ...init } = options;
    const result = new Request(`http://localhost:8787${path}`, init);
    if (cf) Object.defineProperty(result, 'cf', { value: cf });
    return result;
}
