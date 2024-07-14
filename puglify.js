#!/usr/bin/env node

/*
 * Generate a bunch of standard queries based on SQLite metadata. I typically
 * generate these to a separate .sql file and then add it and also custom
 * queries to my pugsql DB object. Another approach would be to generate these
 * and only copy the ones you need into your actual .sql file.
 */

import { DB } from './pugsql.js';
import { argv } from 'process';
import  path from 'path';
import { fileURLToPath } from 'url';
import pluralize from 'pluralize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const queries = path.join(__dirname, 'data/puglify.sql');

const db = new DB(':memory:', argv[2]).addQueries(queries);

// Text manipulation

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

const decapitalize = (s) => s[0].toLowerCase() + s.slice(1);

const camelCase = (s) => s.split('_').map(capitalize).join('');

const lowerCamelCase = (s) => decapitalize(camelCase(s));

const param = (n) => '$' + lowerCamelCase(n);

const params = (names) => names.map(param)

const where = (keys) => keys.map(n => `${n} = ${param(n)}`).join(' and ');

for (const obj of db.allObjects()) {
  if (obj.type === 'table') {
    const table = obj.tbl_name;
    const columns = db.columns({table});
    const keys = db.primaryKeys({table});
    const foreignKeys = db.foreignKeys({table});
    const keySet = new Set(keys);
    const nonKeys = columns.filter(c => !keySet.has(c));
    const isRowId = !db.isWithoutRowId({table});

    if (keys.length > 0) {
      console.log(`-- :name ${lowerCamelCase(pluralize.singular(table))} :get`);
      console.log(`select * from ${table} where ${where(keys)};`);
      console.log();
    }

    if (foreignKeys.length > 0) {
      const others = foreignKeys.map(k => camelCase(pluralize.singular(k.table))).join('And');
      const keys = foreignKeys.map(k => k.from);
      console.log(`-- :name ${lowerCamelCase(pluralize.singular(table))}For${others} :get`);
      console.log(`select * from ${table} where ${where(keys)};`);
      console.log();

      console.log(`-- :name ${lowerCamelCase(table)}For${others} :all`);
      console.log(`select * from ${table} where ${where(keys)};`);
      console.log();
    }

    console.log(`-- :name ${lowerCamelCase(table)} :all`);
    console.log(`select * from ${table};`);
    console.log();

    console.log(`-- :name insert${camelCase(pluralize.singular(table))} :insert`);
    console.log(`insert into ${table} (${columns.join(', ')}) values (${params(columns).join(', ')});`);
    console.log();

    if (keys.length > 0 && nonKeys.length > 0) {
      console.log(`-- :name update${camelCase(pluralize.singular(table))} :run`);
      console.log(`update ${table} set (${nonKeys.join(', ')}) = (${params(nonKeys).join(', ')}) where ${where(keys)}`);
      console.log();
    }

    if (isRowId) {

      console.log(`-- :name make${camelCase(pluralize.singular(table))} :insert`);
      console.log(`insert into ${table} (${nonKeys.join(', ')}) values (${params(nonKeys).join(', ')});`);
      console.log();
    }

  }
}
