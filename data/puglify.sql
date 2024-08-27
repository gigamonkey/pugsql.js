-- :name allObjects :all
select * from sqlite_schema order by tbl_name;

-- :name tableInfo :all
select * from pragma_table_info($table);

-- :name columns :list
select name from pragma_table_info($table);

-- :name primaryKeys :list
select name from pragma_table_info($table) where pk > 0 order by pk;

-- :name withDefaultValues :list
select name value from pragma_table_info($table) where dflt_value is not null;

-- :name isWithoutRowId :exists
select * from pragma_index_info($table);

-- :name foreignKeys :all
select * from pragma_foreign_key_list($table);
