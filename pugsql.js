import Database from 'better-sqlite3';
import fs from 'fs';

// Quick version of my old db code with an interface inspired by PugSQL

/*
 * The kind of queries we support.
 */
const kinds = {
  // Execute SQL, returns { changes, lastInsertRowId } object.
  run: () => (stmt) => (...args) => stmt.run(...args),

  // Execute SQL and return just the number of rows changed
  changes: () => (stmt) => (...args) => stmt.run(...args).changes,

  // Execute SQL and return just the lastInsertRowId value
  lastRowID: () => (stmt) => (...args) => stmt.run(...args).lastInsertRowid,

  // Insert either one value of all the values in an interable
  insert: () => (stmt) => (args) => {
    if (Symbol.iterator in args) {
      let insert = stmt.database.transaction((items) => {
        let info;
        for (const item of items) {
          info = stmt.run(item);
        }
        return info;
      });
      return insert(args)?.lastInsertRowid;
    } else {
      return stmt.run(args).lastInsertRowid;
    }
  },

  // Get one row of the results as an object if no column is specified,
  // otherwise the value of the named column in the first row returned
  get: (column) => {
    if (column) {
      return (stmt) => (...args) => stmt.get(...args)?.[column];
    } else {
      return (stmt) => (...args) => stmt.get(...args);
    }
  },

  // Get all the results as an array of objects if no column is specified,
  // otherwise a list of the vaues in the named colunmn.
  all: (column) => {
    if (column) {
      return (stmt) => (...args) => stmt.all(...args).map((r) => r[column]);
    } else {
      return (stmt) => (...args) => stmt.all(...args);
    }
  },

  // Get a single value from the first column of the first row.
  one: () => (stmt) => (...args) => stmt.pluck(true).get(...args),

  // Get an array of the values from the first column
  list: () => (stmt) => (...args) => stmt.pluck(true).all(...args),
};

class DB {
  constructor(filename, schema = null, verbose = false) {
    const opts = verbose ? { verbose: console.log } : undefined;
    this.db = new Database(filename, opts);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    if (schema) {
      this.db.exec(fs.readFileSync(schema, 'utf8'));
    }
    this.modules = {};
  }

  /*
   * Add a function that can be used in SQL, e.g. this.dbFunction('now', () =>
   * Date.now())
   */
  addFunction(name, fn) {
    this.db.function(name, fn);
    return this;
  }

  /*
   * Parse specifications of SQL functions from text file.
   */
  module(filename) {
    if (!(filename in this.modules)) {
      this.modules[filename] = this.#loadModule(filename);
    }
    return this.modules[filename];
  }

  #loadModule(filename) {
    return Object.fromEntries(
      this.#specs(filename).map((spec) => {
        if (!(spec.kind in kinds)) {
          throw new Error(`Unknown kind of query: ${spec.kind}`);
        }
        try {
          return [spec.name, kinds[spec.kind](spec.arg)(this.db.prepare(spec.sql))];
        } catch {
          throw new Error(`Can't prepare ${JSON.stringify(spec)}`);
        }
      }),
    );
  }

  #specs(filename) {
    const lines = fs.readFileSync(filename, 'utf-8').split(/\r?\n/);

    const r = [];
    let current = null;

    lines.forEach((line, i) => {
      const m = line.match(/^--\s+:name\s+(\w+)\s+:(\w+)(?:\((.*?)\))?\s*$/);

      if (m) {
        if (current != null) r.push(current);
        const [name, kind, arg] = m.slice(1);
        current = { name, kind, arg, sql: '', line: i };
      } else if (!line.match(/^\s*$/)) {
        current.sql += `${line}\n`;
      }
    });

    if (current != null) r.push(current);
    return r;
  }
}

export { DB };
