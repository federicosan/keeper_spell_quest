const {
  MAGIC_BOOST_SPELL,
  CULT_POINT_BOOST_SPELL,
  COINS_C,
  CHANT_POINTS,
  RECRUIT_POINTS,
  FRAGMENTS_CULT_POINTS,
  FRAGMENTS_SABOTAGE_CULT_POINTS,
  FRAGMENTS_SABOTEUR_CULT_POINTS,
  RECRUIT_PYRAMID_SCHEME_COINS_C
} = require('./constants.js')
const { server } = require('../server.js')
const { adventure } = require('./adventure')
const { getAllPastReferralsSet, getAllPastChantsCount } = require('../utils/user')

var PyramidSchemeEnabled = false
// prices:
// conjure -- set dust amount 10-30, effects likelihood of rare spell
// common-spell: 10 dust
// spell: 30 dust
// monster-summon: 100 dust

// 1 spell each day, more if you recruit

// attack: 1-30 
// defense: 5 - 77
// 
// inventory: 4 spells max
// summoning rate: 1:6 with attack spells ?
// spell damage:
// should take 1-2 spells for weak monsters, 12-20 for ancients
// 3-10 damage
// async function seedPoints(server){
// for each user in mongo, grant 20?
// for each user in mongo with points == 0, get their chant count + conversions
// calculate points
// save -- totalPoints (points), balance (dust)
// }

async function getActiveMagicBoost(server, memberId) {
  let _24hrago = new Date(new Date().getTime() - (24 * 60 * 60 * 1000))
  let boost = await server.db.collection("events").findOne({ timestamp: { $gte: _24hrago }, spell_type: MAGIC_BOOST_SPELL, 'metadata.target.id': memberId })
  if (boost) {
    return boost.metadata.spell.metadata.boost
  }
  return null
}

async function getActiveCultBoost(server, memberId) {
  let _24hrago = new Date(new Date().getTime() - (24 * 60 * 60 * 1000))
  let boost = await server.db.collection("events").findOne({ timestamp: { $gte: _24hrago }, spell_type: CULT_POINT_BOOST_SPELL, 'metadata.target.id': memberId })
  if (boost) {
    return boost.metadata.spell.metadata.boost
  }
  return null
}

async function addPointsToUser(server, user, amount) {
  if (amount == 0) {
    return
  }
  if (!user.points) {
    user.points = 0
  }
  if (!user.coins) {
    user.coins = 0
  }
  if (user.points + amount > 0) {
    let member = server.getMember(user.discord.userid)
    if (member.roles.cache.has(server.Roles.Unzealous)) {
      try {
        member.roles.remove(server.Roles.Unzealous)
      } catch (err) {
        console.log("failed to remove unzealous role with error:", err)
      }
    }
  }
  user.points += amount
  user.coins += amount * COINS_C
  let boost = await getActiveMagicBoost(server, user.discord.userid)
  if (boost && boost > 0) {
    user.coins += boost
  }
  await server.db.collection("users").updateOne({ 'address': user.address }, {
    $set: { coins: user.coins, points: user.points, num_chants: user.num_chants }
  })
}

async function addReferralCoinsToUser(server, user) {
  user.coins += RECRUIT_PYRAMID_SCHEME_COINS_C
  let boost = await getActiveMagicBoost(server, user.discord.userid)
  if (boost && boost > 0) {
    user.coins += boost
  }
  await server.db.collection("users").updateOne({ 'address': user.address }, {
    $set: { coins: user.coins }, $inc: { num_referral_chants: 1 }
  })
}

async function handleRecruitment(server, user, targetUserId) {
  // check if user has points multiplier active
  try {
    await server.db.collection("events").insertOne({
      "metadata": { "user": user.discord.userid, "target": targetUserId },
      "timestamp": new Date(),
      "event": "recruit"
    })
  } catch (error) {
    console.log("handleRecruitment error:", error)
    return
  }
  await addPointsToUser(server, user, RECRUIT_POINTS)
}

async function handleChant(server, user) {
  console.log("points handleChant user:", user.discord.userid)
  try {
    await server.db.collection("events").insertOne({
      "metadata": { "user": user.discord.userid },
      "timestamp": new Date(),
      "event": "chant"
    })
  } catch (error) {
    console.log("handleChant error:", error)
    return
  }
  user.num_chants += 1
  await addPointsToUser(server, user, CHANT_POINTS)
  
  // Pyramid scheme coin kickpagck
  if (PyramidSchemeEnabled){
    if (user.referred_by && user.referred_by !== "") {
      let zealot = await server.db.collection("users").findOne({ "referral_key": user.referred_by })
      if(zealot){
        await addReferralCoinsToUser(server, zealot)
      }
    }
  }
}

async function handleCastPoints(server, user, points) {
  console.log("points handleChant user:", user.discord.userid)
  user.num_cast_points = user.num_cast_points ? user.num_cast_points+points : points
  user.points = user.points ? user.points + points : points
  await server.db.collection("users").updateOne({ 'address': user.address }, {
    $set: { points: user.points, num_cast_points: user.num_cast_points }
  })
}

async function handleFragmentsChant(server, userId, cult, isSabotaged, saboteurs) {
  console.log("points handleFragmentChant user:", userId, "cult:", cult.id)
  try {
    await server.db.collection("events").insertOne({
      "metadata": {
        "user": userId,
        "cult": cult.id,
        "sabotaged": isSabotaged,
        "saboteurs": saboteurs
      },
      "timestamp": new Date(),
      "event": "fragments_chant"
    })
  } catch (error) {
    console.log("handleChant error:", error)
    return
  }
  // var points = isSabotaged ? FRAGMENTS_SABOTAGE_CULT_POINTS : FRAGMENTS_CULT_POINTS
  if (isSabotaged) {
    cult.addPoints(server.kvstore, `cult:fragments:sabotage`, 1)
    adventure.log(server, `${cult.getName(server)}'s CALMIT SIN SABOTAGED! -𐂥${Math.abs(FRAGMENTS_SABOTAGE_CULT_POINTS)}`)
  } else {
    cult.addPoints(server.kvstore, `cult:fragments`, 1)
    adventure.log(server, `${cult.getName(server)}'s CALMIT SIN CHANTED! +𐂥${Math.abs(FRAGMENTS_CULT_POINTS)}`)
  }
  for (const cultId of saboteurs) {
    let _cult = server.Cults.get(cultId)
    if (_cult) {
      _cult.addPoints(server.kvstore, `cult:fragments:saboteur`, 1)
      adventure.log(server, `${_cult.getName(server)} sabotaged ${cult.getName(server)} +𐂥${Math.abs(FRAGMENTS_SABOTEUR_CULT_POINTS)}`)
    }
  }
  // let boost = await getActiveCultBoost(server, userId)
  // console.log("boost:", boost)
  // if (boost && !isSabotaged) {
  //   await cult.incrementBonusPoints(server.kvstore, (boost - 1) * points)
  // }
}

async function getUserStats(server, interaction, userId) {
  if (!userId) {
    userId = interaction.member.id
  }
  let user = await server.db.collection("users").findOne({ "discord.userid": userId })
  if (!user) {
    await interaction.reply({ content: 'user not found', ephemeral: true })
    return null;
  }
  let magicBoost = await getActiveMagicBoost(server, userId)
  let cpBoost = await getActiveCultBoost(server, userId)
  let allPastReferrals = getAllPastReferralsSet(user)
  let pastChants = getAllPastChantsCount(user)
  let msg = `<:magic:975922950551244871> ${user.coins ? user.coins : 0} 🗝${user.allowlists}`
  msg += `\n𐂥 cult point multiplier: x${cpBoost ? cpBoost : 1}\n<:magic:975922950551244871> magic boost: +${magicBoost ? magicBoost : 0}`
    msg+= `\n\n**this chapter**\nrecruits: ${user.referrals ? user.referrals.length : 0} chants: ${user.num_chants ? user.num_chants : 0}`
  msg += `\n\n**all chapters**\nrecruits: ${allPastReferrals.size} chants: ${pastChants}`
  //msg += `\n🗝${user.allowlists}`
  return msg
}

async function handleUserStatsInteraction(server, interaction, userId) {
  let _stats = await getUserStats(server, interaction, userId)
  if (!_stats) {
    try {
      await interaction.reply({ content: 'user not found', ephemeral: true })
    } catch (error) {
      console.log('handleUserStatsInteraction user not found reply error:', error)
    }
    return;
  }
  try {
    await interaction.reply({ content: _stats, ephemeral: true })
  } catch (error) {
    console.log('handleUserStatsInteraction error:', error)
  }
}

function userTag(user) {
  let member = server.getMember(user.discord.userid)
  if (member) {
    return member.displayName
  }
  if (user.discord.name && user.discord.name != '') {
    return user.discord.name
  }
  return `<@${user.discord.userid}>`
}

async function loserboard(server, length) {
  if (!length) {
    length = 20
  }
  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true, $ne: '', $nin: server.admins } }).sort({ 'points': 1 }).sort({ 'num_chants': 1 }).limit(length)
  let i = await server.Cults.countMembers(server)
  let rows = await users.map(user => {
    let cult = server.Cults.dbUserCult(user)
    let emoji = ""
    if (cult) {
      emoji = cult.emoji
    }
    var msg = `${i + 1} | ${emoji} ${userTag(user)} • 𐂥 points: ${user.points ? user.points : 0} • recruits: ${user.referrals ? user.referrals.length : 0} • chants: ${user.num_chants}`
    //  • <:magic:975922950551244871> ${user.coins ? user.coins : 0}
    i--
    return msg
  }).toArray()
  return `**WALL OF SHAME**\n\n${rows.join('\n')}`
}

async function cultLoserboard(server, cultId, length) {
  if (!length) {
    length = 20
  }
  let cult = server.Cults.get(cultId)
  let users = await server.db.collection("users").find({ cult_id: cultId, 'discord.userid': { $exists: true, $ne: '', $nin: server.admins } }).sort({ 'points': 1 }).sort({ 'num_chants': 1 }).limit(length)
  let i = await cult.countMembers(server)
  let rows = await users.map(user => {
    var msg = `${i} | ${userTag(user)} • 𐂥 points: ${user.points ? user.points : 0} • recruits: ${user.referrals ? user.referrals.length : 0} • chants: ${user.num_chants}`
    i--
    return msg
  }).toArray()
  return `**${cult.getName(server)} WALL OF SHAME**\n\n${rows.join('\n')}`
}

async function leaderboard(server, length) {
  if (!length) {
    length = 20
  }
  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true, $ne: '', $nin: server.admins } }).sort({ 'points': -1, 'num_chants': -1 }).limit(length)
  let i = 1
  let rows = await users.map(user => {
    let cult = server.Cults.dbUserCult(user)
    let emoji = ""
    if (cult) {
      emoji = cult.emoji
    }
    var msg = `${i} | ${emoji} ${userTag(user)} • 𐂥 points: ${user.points ? user.points : 0} • recruits: ${user.referrals ? user.referrals.length : 0} • chants: ${user.num_chants}`
    //  • <:magic:975922950551244871> ${user.coins ? user.coins : 0}
    i++
    return msg
  }).toArray()
  return `**TRUE ZEALOTS**\n\n${rows.join('\n')}`
}

async function cultLeaderboard(server, cultId, length) {
  if (!length) {
    length = 20
  }
  let cult = server.Cults.get(cultId)
  let users = await server.db.collection("users").find({ cult_id: cultId, 'discord.userid': { $exists: true, $ne: '', $nin: server.admins } }).sort({ 'points': -1, 'num_chants': -1 }).limit(length)
  let i = 1
  let rows = await users.map(user => {
    var msg = `${i} | ${userTag(user)} • 𐂥 points: ${user.points ? user.points : 0} • recruits: ${user.referrals ? user.referrals.length : 0} • chants: ${user.num_chants}`
    i++
    return msg
  }).toArray()
  return `**${cult.getName(server)} TRUE ZEALOTS**\n\n${rows.join('\n')}`
}

function getReferralRankingMessage(users) {
  let msg = "**TRUE BELIEVER LEADER BOARD**\n\n"
  var i = 0
  for (const user of users) {
    let cult = server.Cults.dbUserCult(user)
    let emoji = ""
    if (cult) {
      emoji = cult.emoji
    }
    msg += `${i + 1} | ${emoji} ${userTag(user)}  • recruits: ${user.num_referrals ? user.num_referrals : 0}\n`
    i++
  }
  if (msg.length > 0) {
    msg = msg.substring(0, msg.length - 1)
  }
  return msg
}

async function referralLeaderboard() {
  let users = await server.db.collection("users").find({ 'discord.userid': { $exists: true, $ne: '', $nin: server.admins }, 'num_referrals': { $gte: 2 } }).sort({ num_referrals: -1 }).limit(25)
  users = await users.toArray()
  return getReferralRankingMessage(users)
}

exports.points = {
  handleRecruitment: handleRecruitment,
  handleChant: handleChant,
  handleFragmentsChant: handleFragmentsChant,
  handleCastPoints: handleCastPoints,
  handleUserStatsInteraction: handleUserStatsInteraction,
  getUserStats: getUserStats,
  getActiveMagicBoost: getActiveMagicBoost,
  getActiveCultBoost: getActiveCultBoost,
  loserboard: loserboard,
  cultLoserboard: cultLoserboard,
  leaderboard: leaderboard,
  cultLeaderboard: cultLeaderboard,
  referralLeaderboard: referralLeaderboard
}