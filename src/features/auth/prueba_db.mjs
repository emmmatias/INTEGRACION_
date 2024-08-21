import sqlite3 from 'sqlite3'

const db_path = "./users.db" 

const user_db = new sqlite3.Database(db_path,sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error(err)
    }
})

user_db.run(`CREATE TABLE IF NOT EXISTS users (
          user_id TEXT NOT NULL,
          access_token TEXT NOT NULL,
          token_type TEXT NOT NULL,
          scope TEXT NOT NULL,
          saldo INTEGER,
          activo BOOLEAN
        )`, (err) => {
            console.error(err)
        })

let users = user_db.run(`SELECT * FROM users`, (err) => console.error(err))
console.log(users)