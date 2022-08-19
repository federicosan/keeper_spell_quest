const { interactionHandler } = require('./client/interaction')
const { client } = require('./client/client')
const { stats } = require('./game/stats')
const { vote } = require('./game/vote')
const { runReferralsCounter, runPurgatory } = require('./game/recruit')
const { batch } = require('./game/batch')
const { server } = require('./server')
const Database = require("@replit/database");
const { MongoClient } = require('mongodb')
const dotenv = require('dotenv')
dotenv.config()

const Web3 = require('web3');
const web3 = new Web3(process.env.WEB3_URI)
const { spells_game } = require('./spells/controller')
const { clock } = require('./game/clock')
const { fragments } = require('./spells/fragments')

const database = new Database(process.env.REPLIT_DB_URL)
server.setDatabase(database)

let mongo = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
server.db = mongo.db("general")

var loggedIn = false
client.once('ready', async () => {
	console.log('Ready!');
  loggedIn = true
  mongo.connect(async err => {
    if(err){
      console.log("mgo connect err:", err)
    }
    batch.prepForHomecoming(server)
    // batch.migrate()
    return;
  })
});

console.log("logging in")
client.login(process.env.TOKEN);
