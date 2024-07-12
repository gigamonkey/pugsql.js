-- :name allObjects :all
select * from sqlite_schema order by tbl_name;

-- :name tableInfo :all
select * from pragma_table_info($table);

-- :name columns :list
select name from pragma_table_info($table);

-- :name primaryKeys :list
select name from pragma_table_info($table) where pk > 0 order by pk;
