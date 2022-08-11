const { server } = require('./server')
const { stats } = require('./stats')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const { gaussian, weightedRandomSelect, adjustRarities, normalizeWeights, RandGenerator, hashString } = require('./utils/rand')
const csv = require('csv-parser')
const fs = require('fs')
// const { Creature } = require('./spells/creatures')


async function testMigrate() {
  let date = new Date()
  console.log("date:", date)
  // await checkpoint(date)
  await server.loadDiscordUsers()
  // assign new cults
  let shuffledCults = await shuffleUsers()
  for (var i = 0; i < shuffledCults.cults.length; i++) {
    let shuffledCult = shuffledCults.cults[i]
    for (const _member of shuffledCult.members) {
      // console.log("member:", _member)
      // move user to new cult
      let member = server.getMember(_member.id)
      if (!member) {
        console.log("no member found for user:", _member.id)
        continue
      }
      let lastCult = server.Cults.userCult(member)
      if (!lastCult) {
        console.log("no cult found for user:", _member.id)
        continue
      }
      try {
        member.roles.remove(lastCult.roleId)
      } catch (err) {
        console.log("failed to remove role with error:", err)
      }
      member.roles.add(cult.roleId)
    }
  }
  // await resetCultScores()
  // await resetUserPointsAndMagic(date)
  // await updateCultRoleNamesAndChannels()
}

async function findUnboundUsers() {
  let members = await server.loadDiscordUsers()
  members.each(async member => {
    let user = await server.db.collection("users").findOne({ 'discord.userid': member.id })
    if (!user) {
      console.log(`no account found for ${member}`)
    }
  })
}

async function cultCheckpoint(basepath) {
  const csvWriter = createCsvWriter({
    path: `${basepath}-cults.csv`,
    header: [
      { id: 'id', title: 'id' },
      { id: 'name', title: 'name' },
      { id: 'score', title: 'score' },
      { id: 'points', title: 'points' },
      { id: 'members', title: 'members' },
    ]
  })
  let records = []
  await stats.applyStatsToCults()

  for (const cult of server.Cults.values()) {
    records.push({
      id: cult.id,
      name: cult.getName(server),
      score: cult.stats.score,
      points: cult.stats.chants,
      members: cult.stats.population,
    })
  }
  await csvWriter.writeRecords(records)
}

async function usersCheckpoint(basepath) {
  const csvWriter = createCsvWriter({
    path: `${basepath}-users.csv`,
    header: [
      { id: 'id', title: 'id' },
      { id: 'address', title: 'address' },
      { id: 'cult', title: 'cult' },
      { id: 'points', title: 'points' },
      { id: 'chants', title: 'chants' },
      { id: 'conversions', title: 'conversions' },
      { id: 'coins', title: 'coins' },
    ]
  })

  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true } })
  let records = await users.map(user => {
    return {
      id: user.discord.userid,
      address: user.address,
      cult: user.cult_id,
      points: user.points,
      chants: user.num_chants,
      conversions: user.referrals ? user.referrals.length : 0,
      coins: user.coins
    }
  }).toArray()
  console.log("records:", records)
  await csvWriter.writeRecords(records)
}


async function checkpoint(date) {
  if (!date) {
    date = new Date()
  }
  let basepath = `./data/checkpoints/checkpoint-${date.toISOString()}`
  await cultCheckpoint(basepath)
  await usersCheckpoint(basepath)
}

class BinPackCult {
  constructor(id) {
    this.id = id
    this.points = 0
    this.members = []
    this.numZero = 0
  }

  addUser(user) {
    this.points += user.points
    this.members.push({ id: user.discord.userid, name: user.discord.name, points: user.points })
    if (user.points <= 0) {
      this.numZero += 1
    }
  }
}

class BinPackCults {
  constructor() {
    this.min = 0
    let cults = server.Cults.values()
    this.cults = [new BinPackCult(cults[0].id), new BinPackCult(cults[1].id), new BinPackCult(cults[2].id)]
  }

  insert(user) {
    this.min = (Math.floor(Math.random() * this.cults.length))
    if (user.points > 0) {
      let minPoints = this.cults[this.min].points
      for (var i = 0; i < this.cults.length; i++) {
        let cult = this.cults[i]
        if (cult.points < minPoints) {
          minPoints = cult.points
          this.min = i
        }
      }
    } else {
      let minMembers = this.cults[this.min].members.length
      for (var i = 0; i < this.cults.length; i++) {
        let cult = this.cults[i]
        if (cult.members.length < minMembers) {
          minMembers = cult.members.length
          this.min = i
        }
      }
    }
    this.cults[this.min].addUser(user)
  }

  insertToCult(user, cultId) {
    for (var _cult of this.cults) {
      if (_cult.id == cultId) {
        _cult.addUser(user)
      }
    }
  }
}

async function shuffleUsers() {
  console.log("shuffling users")
  let cults = new BinPackCults()
  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true, $ne: '', $nin: server.admins } }).sort({ 'points': -1, 'num_chants': -1 })
  users = await users.toArray()
  console.log("num users:", users.length)
  for (const user of users) {
    if (!user.discord || !user.discord.userid || user.discord.userid == '') {
      console.log('empty userid:', user)
      continue
    }
    let member = server.getMember(user.discord.userid)
    if (!member) {
      console.log("no member found for user:", user.discord.userid)
      continue
    }
    cults.insert(user)
  }
  for (var i = 0; i < cults.cults.length; i++) {
    console.log(`${i}: points: ${cults.cults[i].points} members: ${cults.cults[i].members.length} num-zero: ${cults.cults[i].numZero}`)
  }
  for (var i = 0; i < cults.cults.length; i++) {
    console.log(`${i}: members: ${cults.cults[i].members.map(member => `${member.name}-${member.points}`)}`)
  }
  console.log("done shuffling users")
  return cults
}

async function shuffleUsersKeepCults() {
  console.log("shuffling users")
  let cults = new BinPackCults()
  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true, $ne: '', $nin: server.admins } }).sort({ 'points': -1, 'num_chants': -1 })
  users = await users.toArray()
  console.log("num users:", users.length)
  let n = 0
  for (const user of users) {
    if (!user.discord || !user.discord.userid || user.discord.userid == '') {
      console.log('empty userid:', user)
      continue
    }
    let member = server.getMember(user.discord.userid)
    if (!member) {
      // console.log("no member found for user:", user.discord.userid)
      continue
    }
    if (user.cult_id && user.cult_id != '') {
      console.log("home user:", user.discord.userid, "cult:", user.cult_id)
      cults.insertToCult(user, user.cult_id)
      n++
    } else {
      cults.insert(user)
    }
  }
  console.log("num assigned to existing cult:", n)
  for (var i = 0; i < cults.cults.length; i++) {
    console.log(`${i} ${cults.cults[i].id}: points: ${cults.cults[i].points} members: ${cults.cults[i].members.length} num-zero: ${cults.cults[i].numZero}`)
  }
  for (var i = 0; i < cults.cults.length; i++) {
    console.log(`${i} ${cults.cults[i].id}: members: ${cults.cults[i].members.map(member => `${member.name}-${member.points}`)}`)
  }
  console.log("done shuffling users")
  return cults
}

async function markUnzealous() {
  await server.loadDiscordUsers()
  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true, $ne: '', $nin: server.admins } }).sort({ 'points': -1, 'num_chants': -1 })
  users = await users.toArray()
  console.log("num users:", users.length)
  for (const user of users) {
    if (!user.discord || !user.discord.userid || user.discord.userid == '') {
      console.log('empty userid:', user)
      continue
    }
    if (user.points <= 0) {
      let member = server.getMember(user.discord.userid)
      if (!member) {
        console.log("no member found for user:", user.discord.userid)
        continue
      }
      member.roles.add("997279025292644372")
    }
    // let lastCult = server.Cults.userCult(member)
    // member.roles.remove(lastCult.roleId)
  }
}

async function markWL() {
  await server.loadDiscordUsers()
  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true, $ne: '', $nin: server.admins }, 'cult_id': '973532685479854110' })
  users = await users.toArray()
  console.log("num users:", users.length)
  for (const user of users) {
    if (!user.discord || !user.discord.userid || user.discord.userid == '') {
      console.log('empty userid:', user)
      continue
    }

    let member = server.getMember(user.discord.userid)
    if (!member) {
      console.log("no member found for user:", user.discord.userid)
      continue
    }
    member.roles.add("999446087901384786")
    // let lastCult = server.Cults.userCult(member)
    // member.roles.remove(lastCult.roleId)
  }
}

async function markCultists() {
  await server.loadDiscordUsers()
  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true, $ne: '', $nin: server.admins }, 'cult_id':  {$exists: true, $ne: '' } })
  users = await users.toArray()
  console.log("num users:", users.length)
  for (const user of users) {
    if (!user.discord || !user.discord.userid || user.discord.userid == '') {
      console.log('empty userid:', user)
      continue
    }

    let member = server.getMember(user.discord.userid)
    if (!member) {
      console.log("no member found for user:", user.discord.userid)
      continue
    }
    member.roles.add("1007389250787999845")
    // let lastCult = server.Cults.userCult(member)
    // member.roles.remove(lastCult.roleId)
  }
}

class UserHistoryEntry {
  constructor(user, date) {
    this.created = date
    this.cult_id = user.cult_id
    this.referrals = user.referrals
    this.points = user.points
    this.coins = user.coins
    this.num_chants = user.num_chants
    this.num_referral_chants = user.num_referral_chants ? user.num_referral_chants : 0
  }
}

async function resetChanting() {
  return
  await server.loadDiscordUsers()
  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true, $ne: '', $nin: server.admins } }).sort({ 'points': -1, 'num_chants': -1 })
  users = await users.toArray()
  console.log("num users:", users.length)

  for (const user of users) {
    if (!user.discord || !user.discord.userid || user.discord.userid == '') {
      console.log('empty userid:', user)
      continue
    }
    if ([
      '389329759072419851',
      '671012151762092085',
      '353437064286437377',
      '976094641642409994',
      '810979183906783332',
      '695831676005122138',
    ].includes(user.discord.userid)) {
      console.log("already chanted")
    }
    let replitUser = await server.loadUser(user.discord.userid)
    if (!replitUser) {
      console.log("no replit user found for user:", user.discord.userid)
    } else {
      replitUser.lastChant = 0
      await server.saveUser(replitUser)
    }
  }
  console.log("done resetting chanting")
}

async function resetUserPointsAndMagic(date) {
  await server.loadDiscordUsers()
  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true, $ne: '', $nin: server.admins } }).sort({ 'points': -1, 'num_chants': -1 })
  users = await users.toArray()
  console.log("num users:", users.length)

  for (const user of users) {
    if (!user.discord || !user.discord.userid || user.discord.userid == '') {
      console.log('empty userid:', user)
      continue
    }
    if (user.history && user.history.length > 0 && user.history[user.history.length - 1].created >= date) {
      console.log("history already set, continuing")
      continue
    }
    console.log("resetting user:", user.discord.userid)
    let entry = new UserHistoryEntry(user, date)
    if (user.history) {
      user.history.push(entry)
    } else {
      user.history = [entry]
      console.log("single entry user:", user.discord.userid)
    }
    user.points = 0
    if (user.coins < 0) {
      user.coins = 0
    }
    // get all spells
    let c = await server.db.collection("items").count({ owner: user.discord.userid })
    if (c && c > 0) {
      user.coins += c * 15
    }
    await server.db.collection("users").updateOne({ 'discord.userid': user.discord.userid }, { $set: { points: 0, num_chants: 0, referrals: [], coins: user.coins, history: user.history } })
  }
  // for(const user of users){
  //   if(!user.discord || !user.discord.userid || user.discord.userid == ''){
  //     console.log('empty userid:', user)
  //     continue
  //   }
  //   let replitUser = await server.loadUser(user.discord.userid)
  //   if(!replitUser){
  //     console.log("no replit user found for user:", user.discord.userid )
  //   } else {
  //     replitUser.lastChant = 0
  //     await server.saveUser(replitUser)
  //   }
  // }
  // delete all spells
  await server.db.collection("items").remove({}, { $multi: true })
}

async function killAllCreatures() {
  let creatures = await server.db.collection("creatures").find({
    healthRemaining: { $gt: 0 }
  })
  creatures = await creatures.toArray()
  if (!creatures) {
    return
  }
  creatures.map(async (creature) => {
    let channel = server.client.channels.cache.get(creature.channelId)
    setTimeout(() => {
      channel.delete()
    }, 10 * 1000)
    await server.db.collection("creatures").update({ id: creature.id }, { $set: { healthRemaining: 0 } })
    // Object.setPrototypeOf(creature, Creature.prototype)
    // creature.healthRemaining = 0
    // await creature.handleDefeat(server)
    return
  })
}

// COLORS
// pointless: #565656
// hex: #010101
// wizards: #cc1818
async function updateCultRoleNamesAndChannels() {
  for (const cult of server.Cults.values()) {
    await cult.rename(server, cult.name, cult.emoji)
    let role = cult.getRole(server)
    try {
      await role.edit({
        color: "#cc1818"
      })
    } catch (error) {
      console.log(error)
      server.client.catch(error)
      return false
    }
  }
}

async function resetCultScores() {
  for (const cult of server.Cults.values()) {
    await cult.resetPoints(server.database)
  }
}

async function cleanCultRoles() {
  let members = await server.loadDiscordUsers()
  members.each(async member => {
    let user = await server.db.collection("users").findOne({ 'discord.userid': member.id })
    if (!user) {
      for (const [key, cult] of server.Cults.entries()) {
        if (member.roles.cache.has(cult.roleId)) {
          console.log("unbound cultist:", member.id)
          member.roles.remove(cult.roleId)
        }
      }
    }
  })
}

async function prepForHomecoming() {
  let members = await server.loadDiscordUsers()
  // 1. mark all active players as `onboarded`, unset cult
  if ( true ) {
    await markCultists()
  }
  if (false) {
    let n = 0
    members.each(async member => {
      let user = await server.db.collection("users").findOne({ 'discord.userid': member.id, 'cult_id': { $exists: true, $ne: '' } })
      let cult = server.memberCult(member)
      if (!cult) {
        if (user && user.cult_id != '') {
          await server.db.collection("users").updateOne({ 'discord.userid': member.id }, { $set: { cult_id: '' } })
        }
        return
      }

      if (user) {
        await server.db.collection("users").updateOne({ 'discord.userid': member.id }, { $set: { onboarded: true, cult_id: '' } })
        n++
      }
    })
    console.log("num updated:", n)
  }
  if (false) {
    let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true, $ne: '' }, cult_id: { $exists: true, $ne: '' } })
    users.map(async (user) => {
      let member = server.getMember(user.discord.userid)
      if (!member) {
        await server.db.collection("users").updateOne({ 'discord.userid': user.discord.userid }, { $set: { onboarded: true, cult_id: '', in_server: false } })
      }
    }).toArray()
  }
  // 2. remove all cult roles
  if (false) {
    members.each(async member => {
      for (const [key, cult] of server.Cults.entries()) {
        if (member.roles.cache.has(cult.roleId)) {
          console.log("unbound cultist:", member.id)
          member.roles.remove(cult.roleId)
        }
      }
    })
  }
  if (false) {
    console.log("resetting cult scores...")
    await resetCultScores()
  }
  if (false) {
    console.log("killing all creatures...")
    await killAllCreatures()
    console.log("killed all creatures...")
  }
  // 3. open up homecoming!
}

async function ensureUserCultRoleAssigned(date) {
  await server.loadDiscordUsers()
  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true, $ne: '', $nin: server.admins } })
  users = await users.toArray()
  console.log("num users:", users.length)

  for (const user of users) {
    if (!user.discord || !user.discord.userid || user.discord.userid == '') {
      console.log('empty userid:', user)
      continue
    }
    if (user.discord.userid == '365989466126549013') {
      console.log("found cloud caster")
    }
    let member = server.getMember(user.discord.userid)
    if (!member) {
      console.log("no member found for user:", user.discord.userid)
      continue
    }
    // user has cult role:
    let cult = server.Cults.get(user.cult_id)
    if (!cult) {
      console.log("user:", user.discord.name, user.discord.userid, "no cult assigned")
      continue
    }
    if (!member.roles.cache.has(cult.roleId)) {
      console.log("user:", user.discord.name, user.discord.userid, "does not have cult role")
      member.roles.add(cult.roleId)
    }
    for (const [key, _cult] of server.Cults.entries()) {
      if (_cult.id != cult.id && member.roles.cache.has(_cult.roleId)) {
        console.log("user:", user.discord.name, user.discord.userid, "has wrong cult:", _cult.name)
      }
    }
  }
}

async function migrate() {
  let date = new Date(1659556800 * 1000)
  console.log("date:", date)
  // await checkpoint(date)

  await server.loadDiscordUsers()
  // await cleanCultRoles()
  // assign new cults
  if (false) {
    let shuffledCults = await shuffleUsersKeepCults()
    let cults = server.Cults.values()
    for (var i = 0; i < shuffledCults.cults.length; i++) {
      let shuffledCult = shuffledCults.cults[i]
      let cult = server.Cults.get(shuffledCult.id)
      for (const _member of shuffledCult.members) {
        // move user to new cult
        let member = server.getMember(_member.id)
        if (!member) {
          console.log("no member found for user:", _member.id)
          continue
        }
        for (const [key, _cult] of server.Cults.entries()) {
          if (_cult.id != cult.id && member.roles.cache.has(_cult.roleId)) {
            console.log("unbound cultist:", member.id)
            member.roles.remove(_cult.roleId)
          } else if (_cult.id == cult.id) {
            if (!member.roles.cache.has(_cult.roleId)) {
              console.log("adding role:", cult.roleId, "to user:", member.id)
              await member.roles.add(cult.roleId)
            }
            await server.db.collection("users").update({ 'discord.userid': member.id }, { $set: { cult_id: cult.id } })
            console.log("added user:", member.id, "to cult:", cult.name)
          }
        }
        // console.log("adding role:", cult.roleId, "to user:", member.id)
        // // await member.roles.add(cult.roleId)
        // await server.db.collection("users").update({ 'discord.userid': member.id }, { $set: { cult_id: cult.id } })
        // console.log("added user:", member.id, "to cult:", cult.name)
      }
    }
  }
  // console.log("resetting cult scores...")
  // await resetCultScores()
  // console.log("cult scores reset")
  // console.log("killing all creatures...")
  // await killAllCreatures()
  console.log("resetting user points...")
  await resetUserPointsAndMagic(date)
  console.log("updating cult role names...")
  // await updateCultRoleNamesAndChannels()
}



function allPastReferrals(zealot) {
  let all = zealot.referrals ? new Set(zealot.referrals) : new Set()
  if (zealot.history && zealot.history.length > 0) {
    for (var entry of zealot.history) {
      if (entry.referrals && entry.referrals.length > 0) {
        for (var ref of entry.referrals) {
          all.add(ref)
        }
      }
    }
  }
  return all
}

async function initNumReferrals() {
  let members = await server.loadDiscordUsers()
  members.each(async member => {
    let user = await server.db.collection("users").findOne({ 'discord.userid': member.id })
    if (!user) {
      return
    }
    let referrals = allPastReferrals(user)
    await server.db.collection("users").updateOne({ 'discord.userid': member.id }, { $set: { num_referrals: referrals.size } })
  })
}

function loadUsersCheckpoint(basepath) {
  let cultId = '973532570266533898'
  let users = []
  var basepath = `./data/checkpoints/checkpoint-2022-07-27T19:04:15.369Z-users.csv`
  fs.createReadStream(basepath)
    .pipe(csv())
    .on('data', (row) => {
      console.log(row);
      if (row.cult == cultId && row.id !== "" && row.coins != 'NaN') {
        users.push({
          value: row.id,
          weight: row.points == 0 ? 1 : Math.pow(row.points * 2, 1.2),
          points: row.points,
          keys: 0
        })
      }
    })
    .on('end', async () => {
      console.log('CSV file successfully processed');
      normalizeWeights(users)
      for (var i = 0; i < 94; i++) {
        var next = weightedRandomSelect(Math.random(), users)
        next.keys++
      }
      // console.log("num:", users.length)
      console.log("num:", users.length, "users:", users)
      for (var user of users) {
        if (user.keys == 0) {
          continue
        }
        console.log("userid:", user.value, "numkeys:", user.keys)
        await server.db.collection("users").updateOne({ 'discord.userid': user.value }, { $inc: { allowlists: user.keys } })
      }
      console.log("done")
    });
}

async function assignKeys() {
  let cultId = '973532685479854110'
  // load users
  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true } })
  let weh = await users.map(user => {
    return {
      id: user.discord.userid,
      address: user.address,
      cult: user.cult_id,
      points: user.points,
      chants: user.num_chants,
      conversions: user.referrals ? user.referrals.length : 0,
      coins: user.coins
    }
  }).toArray()
  var SPELL_RARITIES = [
    { value: CONJURE_ENEMY_SPELL, weight: 3 },
    { value: CONJURE_ALLY_SPELL, weight: 3 },
    { value: CONJURE_FREEZE_SPELL, weight: 3 },
    { value: CHEST_SPELL, weight: 6 },
    { value: CULT_POINT_BOOST_SPELL, weight: 10 },
    { value: MAGIC_BOOST_SPELL, weight: 7 },
    { value: ATTACK_SPELL, weight: 25 }
  ]
}

exports.batch = {
  resetCultScores: resetCultScores,
  resetChanting: resetChanting,
  checkpoint: checkpoint,
  migrate: migrate,
  testMigrate: testMigrate,
  markUnzealous: markUnzealous,
  findUnboundUsers: findUnboundUsers,
  shuffleUsers: shuffleUsers,
  ensureUserCultRoleAssigned: ensureUserCultRoleAssigned,
  markWL: markWL,
  initNumReferrals: initNumReferrals,
  loadUsersCheckpoint: loadUsersCheckpoint,
  prepForHomecoming: prepForHomecoming
}