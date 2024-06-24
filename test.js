import { DB } from './pugsql.js';

/*
 * Simple smoke test.
 */

const db = new DB('db.db', 'schema.sql')
      .addFunction('aFunction', () => 42)
      .addQueries('queries.sql');


function* g() {
  for (let i = 0; i < 5; i++) {
    yield { a: `a-${i}`, b: `b-${i}` };
  }
}

const toInsert = [
  { a: 'hello', b: 'goodbye' },
  { a: 'one', b: 'two' },
  { a: 'red', b: 'green' },
  { a: 'yellow', b: 'gold' },
  { a: 'java', b: 'csa' },
  { a: 'javascript', b: 'itp' },
];

const changed = [
  { a: 'hello', b: 'goodbye' },
  { a: 'two', b: 'two' },
];

const allInserted = [...changed, ...toInsert.slice(2), ...g()];

const expect = (label, value, expected) => {
  const g = JSON.stringify(value);
  const e = JSON.stringify(expected);

  if (g === e) {
    console.log(`PASS: ${label}`);
  } else {
    console.log(`FAIL: ${label}`);
    console.log(`  - got ${g}`);
    console.log(`  - expected: ${e}`);
  }
};

// Run a query that happens to do an insert
expect('runTest', db.runTest(toInsert[0]), { changes: 1, lastInsertRowid: 1 });
expect('runTest', db.runTest(toInsert[1]), { changes: 1, lastInsertRowid: 2 });

// Get all the values inserted so far
expect('allTest', db.allTest(), toInsert.slice(0, 2));

// Do an update and get the number of rows changed
expect('changesTest', db.changesTest(), 1);

// Get the first value
expect('getTest', db.getTest(), toInsert[0]);

// Get all the values
expect('allTest', db.allTest(), changed);

// Do an instert and get the lastInsertRowid
expect('lastRowIDTest', db.lastRowIDTest(toInsert[2]), 3);

// Insert one row
expect('insertTest - one row', db.insertTest(toInsert[3]), 4);

// Insert multiple rows from an array
expect('insertTest - array', db.insertTest(toInsert.slice(4, 6)), 6);

// Insert multiple rows from a generator
expect('insertTest - generator', db.insertTest(g()), 11);

// Get all the values again
expect('allTest - after', db.allTest(), allInserted);

// Get the first column of the first row
expect('oneTest', db.oneTest(), toInsert[0].a);

// Get the list of first values
expect(
  'listTest',
  db.listTest(),
  allInserted.map((x) => x.a),
);

expect('getWithColumnTest', db.getWithColumnTest(), 'goodbye');
expect(
  'allWithColumnTest',
  db.allWithColumnTest(),
  allInserted.map((x) => x.b),
);


expect('functionTest', db.functionTest(), 42);

db.txTest({a: 'foo'});
try {
  db.txTest({a: 'foo'}); // this violates a constraint and will fail.
} catch {
  console.log('Got expected exception.');
  // We expect the first insert to have happened.
  expect('after no-tx inserts', db.allTxTest(), ['foo']);
}

try {
  db.transaction(() => {
    db.txTest({a: 'bar'});
    db.txTest({a: 'bar'}); // this violates a constraint and will fail.
  });
  console.log('No exception.');
  console.log(db.allTxTest());
} catch (e) {
  console.log('Got expected exception.');
  // We expect no change since the tx failed.
  expect('after tx inserts', db.allTxTest(), ['foo']);
}

try {
  db.transaction(() => {
    // this violates a constraint and will fail.
    db.txTest([{a: 'bar'}, {a: 'bar'}]);

  });
  console.log('No exception.');
  console.log(db.allTxTest());
} catch (e) {
  console.log('Got expected exception.');
  // We expect no change since the tx failed.
  expect('after tx inserts', db.allTxTest(), ['foo']);
}
