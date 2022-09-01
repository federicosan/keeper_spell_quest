const { User, Cultist } = require('./types/user')
const { Cult, Cults } = require('./types/cult')
const { FREEZER_TYPE } = require('./spells/constants')
const { KeyValueStore } = require('./utils/kvstore')

class Server {
  constructor(id, cults, testCult, welcomeChannel, statsChannel, beginChannel, altarChannel, channels, emojis, roles) {
    this.Id = id
    this.Cults = cults
    this.TestCult = testCult
    this.WelcomeChannelId = welcomeChannel
    this.StatsId = statsChannel
    this.BeginChannelId = beginChannel
    this.AltarChannelId = altarChannel
    this.channels = channels
    this.Emojis = emojis
    this.Roles = roles
    this.ADMIN_ID = "821876872391950386"
    this.admins = ["821876872391950386"]
  }

  setClient(client) {
    this.client = client
  }
  
  setDB(db) {
   this.db = db
   this.kvstore = new KeyValueStore(db) 
  }

  setDatabase(database) {
    this.database = database
  }

  getChannel(id) {
    return this.client.channels.cache.get(id)
  }

  getChannelName(id) {
    let channel = this.client.channels.cache.get(id)
    return channel.name
  }

  async getNextSequenceValue(sequenceName) {
    var sequenceDocument = await this.db.collection("counters").findOneAndUpdate(
      { id: sequenceName },
      { $inc: { sequence_value: 1 } }
    );
    return sequenceDocument.value.sequence_value.toString();
  }

  async getSequenceValue(sequenceName) {
    var sequenceDocument = await this.db.collection("counters").findOne({
      id: sequenceName
    });
    if (!sequenceDocument) {
      return null
    }
    return sequenceDocument.sequence_value.toString();
  }
  
  async getUser(id) {
    let user = await this.db.collection("users").findOne({ 'discord.userid': id })
    if(user && user !== undefined){
      return new Cultist(user)
    }
    return null
  }
  
  async getCultForUserId(id){
    
  }

  async loadUser(id) {
    let user = await this.kvstore.get(`user:${id}`)
    if (user == null) {
      user = new User(id, 0)
    } else {
      Object.setPrototypeOf(user, User.prototype)
    }
    return user
  }

  async loadDiscordUsers() {
    var guild = this.client.guilds.cache.get(this.Id);
    let members = await guild.members.fetch()
    return members
  }

  async saveUser(user) {
    await this.kvstore.set(`user:${user.Id}`, user)
  }

  getMember(id) {
    let guild = this.client.guilds.cache.get(this.Id)
    return guild.members.cache.get(id)
  }

  userIdCult(id) {
    let guild = this.client.guilds.cache.get(this.Id)
    let member = guild.members.cache.get(id)
    if (!member) {
      return null
    }
    return this.Cults.userCult(member)
  }

  memberCult(member) {
    return this.Cults.userCult(member)
  }

  memberHasRole(member, roleId) {
    if (!member) {
      return false
    }
    if (typeof member === 'string' || member instanceof String) {
      let guild = this.client.guilds.cache.get(this.Id)
      member = guild.members.cache.get(id)
    }
    return member.roles.cache.has(roleId)
  }

  async userIsFrozen(user) {
    if (typeof user === 'string' || user instanceof String) {
      let c = await this.db.collection("creatures").count({ 'target.id': user, 'type': FREEZE_TYPE })
      return c > 0
    }
    return user.roles.cache.has(this.Roles.Abducted)
  }

  async getCachedMessage(channelId, key) {
    let messageId = await this.kvstore.get(`${key}:${channelId}`)
    if (!messageId) {
      return null
    }
    let channel = this.client.channels.cache.get(channelId)
    try {
      return await channel.messages.fetch(messageId)
    } catch(err){
      console.log("error:", err)
    }
    return null
  }

  async updateCachedMessage(channelId, key, value) {
    let messageId = await this.kvstore.get(`${key}:${channelId}`)
    let channel = this.client.channels.cache.get(channelId)
    if (messageId) {
      try {
        let msg = await channel.messages.fetch(messageId)
        if (msg) {
          msg.edit(value)
          return msg
        }
      } catch(err){
        console.log("error:", err)
      }
    }
    let message = await channel.send(value)
    await this.kvstore.set(`${key}:${channelId}`, message.id)
    return message
  }
  
  isAdmin(id){
    return this.admins.includes(id)
  }

}

const spellQuestServer = new Server("970091626779254874",
  new Cults({
    // "1007387236343492638": new Cult(
    //   "culivanis",
    //   "1007387236343492638",
    //   "ashmin col thalias",
    //   "🪐",
    //   "🪐",
    //   // roleId
    //   "1007386782767267960",
    //   // statsChannel
    //   "1007387977770610878",
    //   // proposalsChannel
    //   "1007387876369121380",
      // {
      //   ChestsChannel: ''
      // },
    //   // emoji id
    //   null,
    //   // bonus points
    //   0
    // ),
    "972639993635938344": new Cult(
      "minas kin",
      "972639993635938344",
      "forn nal numen",
      "🥼",
      "🥼",
      "973761425677897759",
      "977052635603554324",
      "977642272348864572",
      {
        ChestsChannel: '1012876161421946941'
      },
      // emoji id
      null,
      // bonus points
      0
    ),
    "973532685479854110": new Cult(
      "orodruin",
      "973532685479854110",
      "golin barad quendi",
      "🧿",
      "🧿",
      "973810497742843924",
      "977060905089105941",
      "977642383040716801",
      {
        ChestsChannel: '1012876251473649684'
      },
      // emoji id
      null,
      // bonus points
      0
    )
    // "973532570266533898": new Cult(
    //   "vos silan",
    //   "973532570266533898",
    //   "avari noc brith",
    //   "🪞",
    //   "🪞",
    //   "973810144758616145",
    //   "977052689768804382",
    //   "977642330750353479",
      // {
      //   ChestsChannel: ''
      // },
    //   // emoji id
    //   null,
    //   // bonus points
    //   0
    // )
  }),
  new Cult(
    "Coven of Parsimony",
    "973532516092882944",
    "chant",
    "🌙",
    "🌙",
    "973761990340276255"
  ),
  "973821687743258654", // welcome channel
  "974824235384057977",
  "973760681763565578",
  "978078135193071657",
  {
    DungeonSectionId: "988261012295794698",
    EnterChannelId: "986712037633720390",
    AdventureLogChannelId: "989617981233451028",
    GameTimerChannelId: "999040396258717706",
    AltarChannelId: "978078135193071657",
    AutonomousCouncilChannelId: "1007018715474313216"
  },
  {
    AYE: "976559748143001642",
    NAY: "976559312103174228"
  },
  {
    Cultist: "1007389250787999845",
    TrueBeliever: "1001219339577479240",
    Unzealous: "997279025292644372",
    Abducted: "998705483277938739",
    Lost: "1004460065463484518"
  }
)

const testServer = {
  Id: "845219291943272448",
  Cults: new Cults({
    "hexadethicult": new Cult(
      "hexadethicult",
      "974823282790514798",
      "chant",
      "🩸"
    ),
    "daemoncabal": new Cult(
      "daemoncabal",
      "974823324997787728",
      "chant",
      "🎭"
    ),
    "pointlessguild": new Cult(
      "pointlessguild",
      "974823343838601267",
      "chant",
      "🕴"
    )
  }),
  StatsId: "974824617967484989",
  Emojis: {
    AYE: "976559748143001642",
    NAY: "976559312103174228"
  },
  Roles: {
    Unzealous: "997279025292644372"
  }
}

exports.testServer = testServer
exports.server = spellQuestServer