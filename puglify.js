#!/usr/bin/env node

import { DB } from './pugsql.js';
import { argv } from 'process';
import  path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const queries = path.join(__dirname, 'data/puglify.sql');

const db = new DB(':memory:', argv[2]).addQueries(queries);

// Text manipulation

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

const decapitalize = (s) => s[0].toLowerCase() + s.slice(1);

const camelCase = (s) => s.split('_').map(capitalize).join('');

const lowerCamelCase = (s) => decapitalize(camelCase(s));

const depluralize = (s) => {
  if (s.match(/ies$/)) {
    return s.replace(/ies$/, 'y');
  } else if (s.match(/s$/)) {
    return s.replace(/s$/, '');
  } else {
    return s;
  }
}

const param = (n) => '$' + lowerCamelCase(n);

const params = (names) => names.map(param)

const where = (keys) => keys.map(n => `${n} = ${param(n)}`).join(' and ');

for (const obj of db.allObjects()) {
  if (obj.type === 'table') {
    const table = obj.tbl_name;
    const columns = db.columns({table});
    const keys = db.primaryKeys({table});

    console.log(`-- :name ${lowerCamelCase(table)} :all`);
    console.log(`select * from ${table}`);
    console.log();

    console.log(`-- :name insert${camelCase(depluralize(table))} :insert`);
    console.log(`insert into ${table} (${columns.join(', ')}) values (${params(columns).join(', ')})`);
    console.log();

    if (keys.length > 0) {
      console.log(`-- :name get${camelCase(depluralize(table))} :get`);
      console.log(`select * from ${table} where ${where(keys)}`);
      console.log();
    }

  }
}
