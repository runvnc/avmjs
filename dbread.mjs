import Database from 'better-sqlite3'


let dir = '/var/lib/algorand/mainnet-v1.0/'
let db = 'ledger.block.sqlite'
let pathname = dir + db

const algodb = new Database(pathname)

let res = await algodb.prepare('select * from sqlite_schema').all()

console.log(res)
