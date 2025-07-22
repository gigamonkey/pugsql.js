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
    const withDefaultValues = db.withDefaultValues({table});
    const keySet = new Set(keys);
    const nonKeys = columns.filter(c => !keySet.has(c));
    const isRowId = !db.isWithoutRowId({table});
    const hasDefault = new Set(withDefaultValues);
    const nonKeyNonDefault = columns.filter(c => !keySet.has(c) && !hasDefault.has(c));

    const tableName = camelCase(pluralize.singular(table));

    //console.warn(`table: ${table}; keys: ${keys}; nonKeys: ${nonKeys}; withDefaultValues: ${JSON.stringify(withDefaultValues)}`);

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

    console.log(`-- :name insert${tableName} :insert`);
    console.log(`insert into ${table} (${columns.join(', ')}) values (${params(columns).join(', ')});`);
    console.log();

    if (withDefaultValues.length > 0) {
      const cols = columns.filter(c => !hasDefault.has(c));
      console.log(`-- :name insert${tableName}WithDefaultValues :insert`);
      console.log(`insert into ${table} (${cols.join(', ')}) values (${params(cols).join(', ')});`);
      console.log();
      withDefaultValues.forEach(c => {
        console.log(`-- :name update${tableName}${camelCase(c)} :run`);
        console.log(`update ${table} set ${c} = ${param(c)} where ${where(keys)}`);
        console.log();
      });
    }

    if (keys.length > 0 && nonKeyNonDefault.length > 0) {
      console.log(`-- :name update${tableName} :run`);
      console.log(`update ${table} set (${nonKeyNonDefault.join(', ')}) = (${params(nonKeyNonDefault).join(', ')}) where ${where(keys)}`);
      console.log();
    }

    if (isRowId && nonKeyNonDefault.length > 0) {
      console.log(`-- :name make${tableName} :insert`);
      console.log(`insert into ${table} (${nonKeyNonDefault.join(', ')}) values (${params(nonKeyNonDefault).join(', ')});`);
      console.log();
    }

  }
}
