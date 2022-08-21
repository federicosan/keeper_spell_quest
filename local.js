const { client } = require('./client/client')
const { batch } = require('./game/batch')
const { server } = require('./server')
const Database = require("@replit/database");
const { MongoClient } = require('mongodb')
const dotenv = require('dotenv')
dotenv.config()

console.log("db key:", process.env.REPLIT_DB_URL)
const database = new Database(process.env.REPLIT_DB_URL)
server.setDatabase(database)

let mongo = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
server.setDB(mongo.db("general"))

var loggedIn = false
client.once('ready', async () => {
	console.log('Ready!');
  loggedIn = true
  mongo.connect(async err => {
    if(err){
      console.log("mgo connect err:", err)
    }
    batch.migrateDatabase()
    // batch.prepForHomecoming(server)
    // batch.migrate()
    return;
  })
});

console.log("logging in")
client.login(process.env.TOKEN);
