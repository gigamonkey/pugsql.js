# pugsql.js

A JavaScript implementation of the idea behind Daniel McKinley's excellent
[PugSQL] Python library. Define your SQL queries in `.sql` files with simple
comment metadata, and pugsql.js turns them into callable methods on a database
object.

Unlike PugSQL, pugsql.js works exclusively with SQLite via the [better-sqlite3]
library.

## Install

```sh
npm install pugsql
```

## Quick start

Define a schema:

```sql
-- schema.sql
create table users (id integer primary key, name text, email text);
```

Define your queries in a `.sql` file:

```sql
-- queries.sql

-- :name insertUser :insert
insert into users (name, email) values ($name, $email)

-- :name userById :get
select * from users where id = $id

-- :name allUsers :all
select * from users
```

Use them in your code:

```js
import { DB } from 'pugsql';

const db = new DB('app.db', 'schema.sql')
  .addQueries('queries.sql');

db.insertUser({ name: 'Alice', email: 'alice@example.com' });
const user = db.userById({ id: 1 });
// { id: 1, name: 'Alice', email: 'alice@example.com' }
```

## Query file format

Each query is defined by a metadata comment followed by one or more lines of
SQL:

```sql
-- :name queryName :kind
SQL statement here
```

The metadata comment must match the pattern `-- :name <name> :<kind>`. Blank
lines and other comments between queries are ignored. A query's SQL extends
until the next metadata comment or end of file.

Some kinds accept an optional argument in parentheses:

```sql
-- :name userName :get(name)
select * from users where id = $id
```

## Query kinds

| Kind | Returns | Notes |
| --- | --- | --- |
| `run` | `{ changes, lastInsertRowid }` | The raw result from better-sqlite3 |
| `changes` | `number` | Number of rows changed |
| `lastRowID` | `number` | Last inserted row ID |
| `insert` | `number` | Last inserted row ID. Accepts a single object or an iterable of objects for batch insert (automatically wrapped in a transaction) |
| `get` | `object` or value | First row as an object. With `get(column)`, returns just that column's value |
| `all` | `array` | All rows as objects. With `all(column)`, returns an array of that column's values |
| `one` | value | Single value from the first column of the first row |
| `list` | `array` | Array of values from the first column of all rows |
| `exists` | `boolean` | Whether the query returned any results |

## API

### `new DB(filename, schema?, verbose?)`

Creates a new database connection. Automatically enables WAL journal mode and
foreign keys.

- `filename` — Path to the SQLite database file, or `':memory:'` for an
  in-memory database.
- `schema` — Optional path to a `.sql` file to execute on open (e.g. to create
  tables).
- `verbose` — If `true`, logs all SQL statements to the console.

### `db.addQueries(filename)`

Parses the given `.sql` file and attaches each query as a method on the `db`
object. Returns `db` for chaining.

### `db.addFunction(name, fn)`

Registers a custom SQL function. Returns `db` for chaining.

```js
db.addFunction('double', (x) => x * 2);
// Now usable in queries: select double(value) from table
```

### `db.transaction(fn, ...args)`

Executes `fn` inside a transaction. If `fn` throws, the transaction is rolled
back and the exception is re-thrown.

```js
db.transaction(() => {
  db.insertUser({ name: 'Bob', email: 'bob@example.com' });
  db.insertUser({ name: 'Carol', email: 'carol@example.com' });
});
```

## Batch inserts

The `insert` kind supports inserting multiple rows from any iterable, including
arrays and generators:

```js
db.insertUser([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
]);

function* generateUsers() {
  for (let i = 0; i < 100; i++) {
    yield { name: `user${i}`, email: `user${i}@example.com` };
  }
}
db.insertUser(generateUsers());
```

Batch inserts are automatically wrapped in a transaction and return the
`lastInsertRowid` of the final row.

## SQL parameters

Query parameters use better-sqlite3's named parameter syntax with a `$` prefix:

```sql
-- :name findUser :get
select * from users where name = $name and email = $email
```

```js
db.findUser({ name: 'Alice', email: 'alice@example.com' });
```

## puglify

pugsql.js includes a CLI tool called `puglify` that auto-generates standard
CRUD queries by introspecting a SQLite database schema:

```sh
npx puglify schema.sql > generated-queries.sql
```

It generates getters, inserters, updaters, and foreign-key-based lookups for
each table, with query names derived from the table and column names.

[PugSQL]: https://pugsql.org/
[better-sqlite3]: https://github.com/WiseLibs/better-sqlite3
