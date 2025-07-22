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

const tableName = (table) => camelCase(pluralize.singular(table));

const param = (n) => '$' + lowerCamelCase(n);

const params = (names) => names.map(param)

const where = (keys) => keys.map(n => `${n} = ${param(n)}`).join(' and ');


////////////////////////////////////////////////////////////////////////////////
// Emitters for the different kinds of queries we may emit for each table

// Get all records from table
const emitAll = (table) => {
  console.log(`-- :name ${lowerCamelCase(table)} :all`);
  console.log(`select * from ${table};`);
  console.log();
};

// Get one record by the key
const emitGetter = (table, keys) => {
  console.log(`-- :name ${lowerCamelCase(pluralize.singular(table))} :get`);
  console.log(`select * from ${table} where ${where(keys)};`);
  console.log();
};

// Get one record with certain foreign keys.
const emitGetterByForeignKey = (table, foreignKeys) => {
  const others = foreignKeys.map(k => camelCase(pluralize.singular(k.table))).join('And');
  const keys = foreignKeys.map(k => k.from);
  console.log(`-- :name ${lowerCamelCase(pluralize.singular(table))}For${others} :get`);
  console.log(`select * from ${table} where ${where(keys)};`);
  console.log();
};

// Get all records with certain foreign keys.
const emitAllByForeignKey = (table, keys, foreignKeys) => {
  const others = foreignKeys.map(k => camelCase(pluralize.singular(k.table))).join('And');
  console.log(`-- :name ${lowerCamelCase(table)}For${others} :all`);
  console.log(`select * from ${table} where ${where(keys)};`);
  console.log();
};

// Insert of all columns
const emitInsert = (table, columns) => {
  console.log(`-- :name insert${tableName(table)} :insert`);
  console.log(`insert into ${table} (${columns.join(', ')}) values (${params(columns).join(', ')});`);
  console.log();
};

// Insert of all columns without default values. Does include key.
const emitInsertWithDefaults = (table, notDefaulted) => {
  console.log(`-- :name insert${tableName(table)}WithDefaultValues :insert`);
  console.log(`insert into ${table} (${notDefaulted.join(', ')}) values (${params(notDefaulted).join(', ')});`);
  console.log();
};

// Updater for each column that is part of a foreign key.
const emitDefaultColumnUpdaters = (table, keys, withDefaultValues) => {
  withDefaultValues.forEach(c => {
    console.log(`-- :name update${tableName(table)}${camelCase(c)} :run`);
    console.log(`update ${table} set ${c} = ${param(c)} where ${where(keys)}`);
    console.log();
  });
};

// Updater for all non-key columns
const emitUpdater = (table, keys, nonKeys) => {
  console.log(`-- :name update${tableName(table)} :run`);
  console.log(`update ${table} set (${nonKeys.join(', ')}) = (${params(nonKeys).join(', ')}) where ${where(keys)}`);
  console.log();
};

// Updater for all non-key columns that don't have default values
const emitUpdaterWithoutDefaultedColumns = (table, keys, nonKeyNonDefaulted) => {
  console.log(`-- :name update${tableName(table)}ExceptDefaults :run`);
  console.log(`update ${table} set (${nonKeyNonDefaulted.join(', ')}) = (${params(nonKeyNonDefaulted).join(', ')}) where ${where(keys)}`);
  console.log();
};

// Insert new record with automatic key but all non-key values specified.
const emitMake = (table, nonKeys) => {
  console.log(`-- :name make${tableName(table)} :insert`);
  console.log(`insert into ${table} (${nonKeys.join(', ')}) values (${params(nonKeys).join(', ')});`);
  console.log();
};

// Insert values but let rowid key and defaulted columns get set automatically
const emitMakeWithDefaults = (table, nonKeyNonDefaulted) => {
  console.log(`-- :name make${tableName(table)}WithDefaultValues :insert`);
  console.log(`insert into ${table} (${nonKeyNonDefaulted.join(', ')}) values (${params(nonKeyNonDefaulted).join(', ')});`);
  console.log();
};


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

    //console.warn(`table: ${table}; keys: ${keys}; nonKeys: ${nonKeys}; withDefaultValues: ${JSON.stringify(withDefaultValues)}`);

    emitAll(table);
    emitInsert(table, columns);

    if (keys.length > 0) {
      emitGetter(table, keys);
      if (nonKeys.length > 0) {
        emitUpdater(table, keys, nonKeys);
      }
      if (nonKeyNonDefaulted.length > 0) {
        emitUpdaterWithoutDefaultedColumns(table, keys, nonKeyNonDefaulted);
      }
    }

    if (foreignKeys.length > 0) {
      emitGetterByForeignKey(table, foreignKeys);
      emitAllByForeignKey(table, keys, foreignKeys);
    }

    if (withDefaultValues.length > 0) {
      emitInsertWithDefaults(table, notDefaulted);
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
  }
}
