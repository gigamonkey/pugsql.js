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
import pkg from './package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const queries = path.join(__dirname, 'data/puglify.sql');

const db = new DB(':memory:', argv[2]).addQueries(queries);

// Text manipulation

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

const decapitalize = (s) => s[0].toLowerCase() + s.slice(1);

const camelCase = (s) => s.split('_').map(capitalize).join('');

const lowerCamelCase = (s) => decapitalize(camelCase(s));

const tableName = (table) => camelCase(pluralize.singular(table));

const param = (n) => '$' + lowerCamelCase(n);

const params = (names) => names.map(param)

const where = (keys) => keys.map(n => `${n} = ${param(n)}`).join(' and\n  ');

const emit = (sql) => {
  const oneline = sql.replaceAll(/\s+/g, ' ');
  if (oneline.length <= 100) {
    console.log(oneline);
  } else {
    console.log(sql);
  }
  console.log();
};


////////////////////////////////////////////////////////////////////////////////
// Emitters for the different kinds of queries we may emit for each table

// Get all records from table
const emitAll = (table) => {
  console.log(`-- :name ${lowerCamelCase(table)} :all`);
  emit(`select * from ${table};`);
};

// Get one record by the key
const emitGetter = (table, keys) => {
  console.log(`-- :name ${lowerCamelCase(pluralize.singular(table))} :get`);
  emit(`select * from ${table}\nwhere\n  ${where(keys)};`);
};

// Get one record with certain foreign keys.
const emitGetterByForeignKey = (table, foreignKeys) => {
  const others = foreignKeys.map(k => camelCase(pluralize.singular(k.table))).join('And');
  const keys = foreignKeys.map(k => k.from);
  console.log(`-- :name ${lowerCamelCase(pluralize.singular(table))}For${others} :get`);
  emit(`select * from ${table}\nwhere\n  ${where(keys)};`);
};

// Get all records with certain foreign keys.
const emitAllByForeignKey = (table, foreignKeys) => {
  const others = foreignKeys.map(k => camelCase(pluralize.singular(k.table))).join('And');
  const keys = foreignKeys.map(k => k.from);
  console.log(`-- :name ${lowerCamelCase(table)}For${others} :all`);
  emit(`select * from ${table}\nwhere\n  ${where(keys)};`);
};

// Insert of all columns
const emitInsert = (table, columns) => {
  console.log(`-- :name insert${tableName(table)} :insert`);
  emit(`insert into ${table}\n  (${columns.join(', ')})\nvalues\n  (${params(columns).join(', ')});`);
};

// Insert of all columns without default values. Does include key.
const emitInsertWithDefaults = (table, notDefaulted) => {
  console.log(`-- :name insert${tableName(table)}WithDefaultValues :insert`);
  emit(`insert into ${table}\n  (${notDefaulted.join(', ')})\nvalues\n  (${params(notDefaulted).join(', ')});`);
};

// Updater for each column that is part of a foreign key.
const emitDefaultColumnUpdaters = (table, keys, withDefaultValues) => {
  withDefaultValues.forEach(c => {
    console.log(`-- :name update${tableName(table)}${camelCase(c)} :run`);
    emit(`update ${table} set ${c} = ${param(c)}\nwhere\n  ${where(keys)}`);
  });
};

// Updater for all non-key columns
const emitUpdater = (table, keys, nonKeys) => {
  console.log(`-- :name update${tableName(table)} :run`);
  emit(`update ${table} set\n  (${nonKeys.join(', ')}) =\n  (${params(nonKeys).join(', ')})\nwhere\n  ${where(keys)}`);
};

// Updater for all non-key columns that don't have default values
const emitUpdaterWithoutDefaultedColumns = (table, keys, nonKeyNonDefaulted) => {
  console.log(`-- :name update${tableName(table)}ExceptDefaults :run`);
  emit(`update ${table} set\n  (${nonKeyNonDefaulted.join(', ')}) =\n  (${params(nonKeyNonDefaulted).join(', ')})\nwhere\n  ${where(keys)}`);
};

// Insert new record with automatic key but all non-key values specified.
const emitMake = (table, nonKeys) => {
  console.log(`-- :name make${tableName(table)} :insert`);
  emit(`insert into ${table}\n  (${nonKeys.join(', ')})\nvalues\n  (${params(nonKeys).join(', ')});`);
};

// Insert values but let rowid key and defaulted columns get set automatically
const emitMakeWithDefaults = (table, nonKeyNonDefaulted) => {
  console.log(`-- :name make${tableName(table)}WithDefaultValues :insert`);
  emit(`insert into ${table}\n  (${nonKeyNonDefaulted.join(', ')})\nvalues\n  (${params(nonKeyNonDefaulted).join(', ')});`);
};

console.log(`-- Generated with pugilify v${pkg.version}.\n`);

for (const obj of db.allObjects()) {
  if (obj.type === 'table') {
    const table = obj.tbl_name;
    const columns = db.columns({table});
    const keys = db.primaryKeys({table});
    const foreignKeys = db.foreignKeys({table});
    const withDefaultValues = db.withDefaultValues({table});

    const keySet = new Set(keys);
    const hasDefault = new Set(withDefaultValues);

    const nonKeys = columns.filter(c => !keySet.has(c));
    const notDefaulted = columns.filter(c => !hasDefault.has(c));

    const isRowId = !db.isWithoutRowId({table});
    const nonKeyNonDefaulted = columns.filter(c => !keySet.has(c) && !hasDefault.has(c));

    const dashes = '-'.repeat(Math.max(0, 60 - (table.length + 4)));

    console.log(`-- ${table} ${dashes}\n`);

    emitAll(table);
    emitInsert(table, columns);

    if (0 < keys.length && keys.length < columns.length) {
      emitGetter(table, keys);
      emitUpdater(table, keys, nonKeys);
      if (nonKeyNonDefaulted.length > 0 && withDefaultValues.length > 0) {
        emitUpdaterWithoutDefaultedColumns(table, keys, nonKeyNonDefaulted);
      }
    }

    if (0 < foreignKeys.length && foreignKeys.length < columns.length) {
      emitGetterByForeignKey(table, foreignKeys);
      emitAllByForeignKey(table, foreignKeys);
    }

    if (withDefaultValues.length > 0) {
      if (notDefaulted.length > 0) {
        emitInsertWithDefaults(table, notDefaulted);
      }
      emitDefaultColumnUpdaters(table, keys, withDefaultValues);
    }

    // For normal ROWID tables, we want to be able to insert rows without specifying the key.
    if (isRowId) {
      if (nonKeys.length > 0) {
        emitMake(table, nonKeys);
      }
      if (nonKeyNonDefaulted.length > 0) {
        emitMakeWithDefaults(table, nonKeyNonDefaulted);
      }
    }

    console.log('');
  }
}
