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

-- :name functionTest :one
select aFunction()

-- :name addFunctionX :one
select aFunction()

-- :name txTest :insert
insert into tx_test (a) values ($a)

-- :name allTxTest :list
select * from tx_test


-- :name hasA :exists
select * from test where a = $a;
