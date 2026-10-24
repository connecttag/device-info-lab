export class BaseRepository {
    constructor(db) { this.db = db; }
    statement(sql, params = []) { return this.db.prepare(sql).bind(...params); }
    async first(sql, params) { return this.statement(sql, params).first(); }
    async all(sql, params) { return (await this.statement(sql, params).all()).results ?? []; }
    async run(sql, params) { return this.statement(sql, params).run(); }
}
