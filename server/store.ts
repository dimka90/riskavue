import { DatabaseSync } from 'node:sqlite';
import type { Action, Decision } from '../shared/types.ts';
export class Store {
    db: DatabaseSync;
    constructor(path: string) {
        this.db = new DatabaseSync(path);
        this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS actions(id TEXT PRIMARY KEY, status TEXT NOT NULL, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS decisions(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY);`);
        // A crash after dispatch cannot safely be retried: reconciliation is required.
        for (const a of this.actions().filter(a => a.status === 'running'))
            this.saveAction({ ...a, status: 'unknown', result: 'Server restarted during execution. Check exchange state before another action.' });
    }
    get<T>(key: string): T | undefined { const row = this.db.prepare('SELECT value FROM state WHERE key=?').get(key) as {
        value: string;
    } | undefined; return row ? JSON.parse(row.value) : undefined; }
    set(key: string, value: unknown) { this.db.prepare('INSERT INTO state VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value)); }
    saveAction(a: Action) { this.db.prepare('INSERT INTO actions VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,value=excluded.value').run(a.id, a.status, JSON.stringify(a)); }
    action(id: string) { const row = this.db.prepare('SELECT value,status FROM actions WHERE id=?').get(id) as {
        value: string; status: Action["status"];
    } | undefined; return row ? {...JSON.parse(row.value),status:row.status} as Action : undefined; }
    actions(): Action[] { return (this.db.prepare('SELECT value,status FROM actions ORDER BY rowid DESC LIMIT 100').all() as {
        value: string; status: Action["status"];
    }[]).map(x => ({...JSON.parse(x.value),status:x.status})); }
    claim(id: string) { return Number(this.db.prepare("UPDATE actions SET status='running' WHERE id=? AND status='pending'").run(id).changes) === 1; }
    once(id: string) { return Number(this.db.prepare('INSERT OR IGNORE INTO events VALUES(?)').run(id).changes) === 1; }
    log(kind: string, message: string) { this.db.prepare('INSERT INTO decisions(at,kind,message) VALUES(?,?,?)').run(Date.now(), kind, message); }
    decisions(): Decision[] { return this.db.prepare('SELECT * FROM decisions ORDER BY id DESC LIMIT 100').all() as unknown as Decision[]; }
    close() { this.db.close(); }
}
