-- :name runTest :run
insert into test (a, b) values ($a, $b)

-- :name changesTest :changes
update test set a = b where a = 'one'

-- :name getTest :get
select * from test

-- :name allTest :all
select * from test

-- :name lastRowIDTest :lastRowID
insert into test (a, b) values ($a, $b)

-- :name insertTest :insert
insert into test (a, b) values ($a, $b)

-- :name oneTest :one
select * from test

-- :name listTest :list
select * from test

-- :name getWithColumnTest :get(b)
select * from test

-- :name allWithColumnTest :all(b)
select * from test
