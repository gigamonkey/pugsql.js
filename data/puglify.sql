-- :name allObjects :all
select * from sqlite_schema

-- :name tableInfo :all
select * from pragma_table_info($table);

-- :name columns :list
select name from pragma_table_info($table)

-- :name primaryKeys :list
select name from pragma_table_info($table) where pk = 1;
