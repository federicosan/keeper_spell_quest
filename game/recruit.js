const { updateAllStats } = require('./stats')
const { points } = require('../spells/points')
const { SABOTAGE_POINTS, RECRUIT_CULT_POINTS } = require('../spells/constants')
const { adventure } = require('../spells/adventure')
const { LastChapterEndTime, ChapterStartTime } = require('./clock')
const { StringMutex } = require('../utils/mutex')
const { getAllPastReferralsSet, getAllPastChantsCount } = require('../utils/user')

// async function accurateCalculateCultReferrals(cult, server) {
//   // get all users with cult
//   let users = await server.db.collection("users").find({ "chant_id": cult.id })
//   // for each user:
//   for(var i = 0; i < users.length; i++) {
//   // count users with reffered_by: user.referral_key
//     // problem: what if they didn't actually join the discord??

//   }
// }
const UserMutex = new StringMutex()

async function calculateCultReferrals(cult, server) {
  // get all users with cult
  let users = await server.db.collection("users").aggregate([
    {
      "$match": {
        "cult_id": cult.id,
        "referrals": { "$exists": true, "$type": 'array', "$not": { "$size": 0 } }
      }
    },
    {
      "$lookup": {
        from: 'users',
        localField: 'referrals',
        foreignField: 'discord.userid',
        as: 'referrals_obj'
      }
    }
  ])
  let _users = await users.toArray()
  console.log("cult", cult.id, "referrals calc num users:", _users.length)
  let sabotageCount = 0
  let selfCount = 0
  for (var i = 0; i < _users.length; i++) {
    if (_users[i].referrals_obj) {
      _users[i].referrals_obj.forEach(user => {
        if (user.cult_id == cult.id) {
          selfCount++
        } else {
          sabotageCount++
        }
      })
    }
  }
  console.log("cult:", cult.id, "self-referrals:", selfCount, "sabotage:", sabotageCount)
  await server.kvstore.set(`cult:referrals:self:${cult.id}`, selfCount)
  await server.kvstore.set(`cult:referrals:sabotage:${cult.id}`, sabotageCount)
  await server.kvstore.set(`cult:referrals:${cult.id}`, selfCount + sabotageCount)
}

async function calculateCultChants(cult, server) {
  let agg = await server.db.collection("users").aggregate([
    {
      $match: {
        "cult_id": cult.id,
        'discord.userid': {$exists: true, $ne: ''}
      }
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: "$num_chants"
        }
      }
    }
  ])
  if (agg) {
    let c = await agg.next()
    if (c) {
      await server.kvstore.set(`cult:${cult.id}`, c.total)
    }
  }
}

async function runReferralsCounter(server) {
  for (const cult of server.Cults.values()) {
    calculateCultReferrals(cult, server)
    calculateCultChants(cult,server)
  }
  var intervalId = setInterval(async function() {
    for (const cult of server.Cults.values()) {
      await calculateCultReferrals(cult, server)
      await calculateCultChants(cult,server)
    }
  }, 20 * 60 * 1000)
}

async function handleJoin(server, member, updateStats = true) {
  console.log("handleJoin: handling join for user:", member, "update-stats:", updateStats)
  var release = await UserMutex.acquire(member.id)
  try {
    await _handleJoin(server, member, updateStats)
  } finally {
    release()
  }
}

async function _handleJoin(server, member, updateStats = true) {
  let user = await server.db.collection("users").findOne({ "discord.userid": member.id })
  if (!user) {
    console.log("user not found")
    return
  }
  console.log("loaded user")
  if (!user.cult_id || user.cult_id === "") {
    console.log("no cult for user:", member.id)
    return
  }

  var guild = server.client.guilds.cache.get(server.Id)
  if (member.id == '779732189482188830') {
    return
  }

  // Add role
  let cult = server.Cults.get(user.cult_id)
  if (!cult) {
    console.log("no cult for user:", user)
    return
  }
  console.log("handleJoin: adding cult role of cult:", cult.id, "for user:", member.id)
  try {
    await member.roles.add(cult.roleId)
  } catch (err) {
    console.log("error adding role:", err)
  }
  console.log("handleJoin: added cult role of cult:", cult.id, "for user:", member.id)
  console.log("handleJoin: adding cultist role for user:", member.id)
  try {
    await member.roles.add(server.Roles.Cultist)
  } catch (err) {
    console.log("error adding role:", err)
  }
  console.log("handleJoin: added cultist role for user:", member.id)
  if (getAllPastChantsCount(user) < 1) {
    console.log("handleJoin: adding unzealous role for user:", member.id)
    try {
      await member.roles.add(server.Roles.Unzealous)
    } catch (err) {
      console.log("add unzealous role errror:", err)
    }
    console.log("handleJoin: added unzealous role for user:", member.id)
  }

  // Handle referral
  if (user.referred_by && user.referred_by !== "") {
    console.log("handling referral...")
    let zealot = await server.db.collection("users").findOne({ "referral_key": user.referred_by })
    if (zealot) {
      console.log("zealot:", zealot)
      let referrals = getAllPastReferralsSet(zealot)
      let addOne = !referrals.has(member.id)
      if (!zealot.referrals) {
        zealot.referrals = []
      }

      if (addOne) {
        let zealotMember = guild.members.cache.get(zealot.discord.userid)
        if (!zealotMember) {
          console.log("no member for account id:", zealot.discord.userid)
          return
        }
        let zealotCult = server.Cults.userCult(zealotMember)
        zealot.referrals.push(member.id)
        if(!zealotCult && zealot.cult_id && zealot.cult_id != ''){
          zealotCult = server.Cults.get(zealot.cult_id)
        }
        if(!zealotCult){
          console.log("no cult for zealot id:", zealot.discord ? zealot.discord.userid : `no id, account: ${zealot.address}`)
          return
        }

        let isSabotage = cult.id != zealotCult.id
        let basePoints = isSabotage ? SABOTAGE_POINTS : RECRUIT_CULT_POINTS
        let boost = await points.getActiveCultBoost(server, zealot.discord.userid)
        if (!boost) {
          boost = 1
        }

        // Do point assignments to zealot & cult
        let isDeadZoneRecruitment = user.created_at > LastChapterEndTime && user.created_at < ChapterStartTime
        console.log("isDeadZoneRecruitment:", isDeadZoneRecruitment)
        if (!isDeadZoneRecruitment) {
          // add cult points
          await zealotCult.addPoints(server.kvstore, `cult:referrals:${isSabotage ? 'sabotage' : 'self'}`, 1)
          if (boost > 1) {
            await zealotCult.incrementBonusPoints(server.kvstore, basePoints * (boost - 1))
          }
        }
        // add user points & magic
        await points.handleRecruitment(server, zealot, member.id)
        try {
          await server.db.collection("users").updateOne({ "discord.userid": zealot.discord.userid }, { $set: { referrals: zealot.referrals, num_referrals: referrals.size + 1 } })
        } catch (error) {
          console.error(error)
        }

        // Do announcements
        if (!isDeadZoneRecruitment) {
          let _altar = server.client.channels.cache.get("978078135193071657")
          if (_altar) {
            _altar.send(`${zealotMember} ${zealotCult.emoji} recruited ${member} ${cult.emoji} to ${cult.getName(server)} for +𐂥${(basePoints * boost).toFixed(1)} ${isSabotage ? " - SABOTAGE!" : ""}`).catch(console.error)
          }
          adventure.log(server, `${zealotMember} converted ${member} to ${cult.getName(server)} +𐂥${(basePoints * boost).toFixed(2)} ( ${basePoints} x boost:${boost} )`)
        }

        // Assign True Believer role
        if (referrals.size + 1 >= 2 && !zealotMember.roles.cache.has(server.Roles.TrueBeliever)) {
          zealotMember.roles.add(server.Roles.TrueBeliever)
          adventure.log(server, `${zealotMember} is now a True Believer <:truebeliever:1001232962819469432>`)
        }
        if(updateStats){
          updateAllStats()
        }
      }
      console.log("handled referral")
    } else {
      console.log("handleJoin: no zealot found for referred_by:", user.referred_by)
    }
  }
}

async function handleSabotage(server, interaction) {
  var role = interaction.options.getRole('cult')
  let cult;
  for (var _cult of server.Cults.values()) {
    if (_cult.roleId == role) {
      cult = _cult
      break
    }
  }
  if (!cult) {
    interaction.reply({ content: 'not a valid cult role', ephemeral: true })
    return
  }

  await server.db.collection("users").update({ 'discord.userid': interaction.member.id }, { $set: { referral_target_cult_id: cult.id } })
  interaction.reply({ content: `your zealous link will now convert cultists to ${cult.getName(server)}`, ephemeral: true })
}

async function runPurgatory(server) {
  const cleanStart = async () => {
    try {
      var guild = await server.client.guilds.cache.get(server.Id)
      let channel = guild.channels.cache.get('986712037633720390')
      let _lastMsg = '1010303218678501468';
      let _now = Date.now()
      while (true) {
        let messages = await channel.messages.fetch({
          limit: 99,
          after: _lastMsg
        })
        messages = [...messages.values()]
        if (messages.length == 0) {
          break;
        }
        if (messages.length == 0) {
          break;
        }
        console.log("deleting messages in purgatory")
        await channel.bulkDelete(messages, true)
      }
    } catch (error) {
      console.log("runPurgatory error:", error)
    }
  }
  const cleanPurgatory = async () => {
    try {
      var guild = await server.client.guilds.cache.get(server.Id)
      let channel = guild.channels.cache.get('979919655105875999')
      let _lastMsg = '989271008328429628';
      let _now = Date.now()
      while (true) {
        let messages = await channel.messages.fetch({
          limit: 99,
          after: _lastMsg
        })
        messages = [...messages.values()]
        if (messages.length == 0) {
          break;
        }
        _lastMsg = messages[0].id
        messages = messages.filter(a => a.createdAt < _now - 24 * 60 * 60 * 1000)
        if (messages.length == 0) {
          break;
        }
        console.log("deleting messages in purgatory")
        await channel.bulkDelete(messages, true)
      }
    } catch (error) {
      console.log("runPurgatory error:", error)
    }
  }
  cleanPurgatory()
  setInterval(() => {
    cleanPurgatory()
  }, 60 * 60 * 1000) // 1hr
}

exports.runReferralsCounter = runReferralsCounter
exports.handleJoin = handleJoin
exports.handleSabotage = handleSabotage
exports.runPurgatory = runPurgatory