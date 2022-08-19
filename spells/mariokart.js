const {
  ENEMY_TYPE,
  ALLY_TYPE,
  FREEZE_TYPE,
  TARGET_CULT_TYPE,
  TARGET_PLAYER_TYPE,
  TARGET_CREATURE_TYPE,
  CONJURE_ENEMY_SPELL,
  CONJURE_ALLY_SPELL,
  CONJURE_FREEZE_SPELL,
  ATTACK_SPELL,
  MAGIC_BOOST_SPELL,
  CULT_POINT_BOOST_SPELL,
  ABDUCT_SPELL,
  CHEST_SPELL,
  BEES_SPELL
} = require('./constants.js')
const { getStats } = require('../game/stats')
const { gaussian, weightedRandomSelect, adjustRarities, normalizeWeights, RandGenerator, hashString } = require('../utils/rand')

var SPELL_RARITIES = [
  { value: BEES_SPELL, weight: 2 },
  { value: CONJURE_ENEMY_SPELL, weight: 4 },
  { value: CONJURE_ALLY_SPELL, weight: 4 },
  { value: CONJURE_FREEZE_SPELL, weight: 3 },
  { value: CHEST_SPELL, weight: 5 },
  { value: MAGIC_BOOST_SPELL, weight: 4 },
  { value: CULT_POINT_BOOST_SPELL, weight: 6 },
  { value: ATTACK_SPELL, weight: 25 }
]

function _randomness(p, expected) {
  let max = Math.min(1, Math.pow(p, 2) * 2 + 0.4)
  let min = Math.pow(p, 3) * 5 // 3.5 // best place to add randomness, increases min randomness a lot for high p cults
  if (max < min) {
    min, max = max, min
  }
  let skew = 1
  if (p < expected) {
    // skew 1-6
    skew = (Math.pow(p, 0.7) - expected) / (1 - expected) * 5 + 1
  } else if (p > expected) {
    // skew 0-1
    skew = 1 - ((expected - Math.pow(p, 1.5)) / expected)
  }
  let rand = gaussian(0, 1, skew, 0.9)
  // let rand = gaussian(0, 1, skew, 0.6)
  // console.log("max:", max, "min:", min, "rand:", rand)
  return rand * (max - min) + min
}

async function rollDice(server, member, n) {
  let userCult = server.Cults.userCult(member)
  let cults = await getStats()
  return await roll(cults, userCult, n)
}

const POSITIVE_SKEW_SCALAR = 2 // was 5
const OFFSET_SCALAR = 0.4
function getRollInputs(cults, userCult, n, minChants = 30, doLog = true) {
  let sum = 0
  let max = 0
  let score = 0
  for (const cult of cults) {
    sum += cult.score
    if (cult.chants > max) {
      max = cult.chants
    }
    if (cult.id == userCult.id) {
      score = cult.score
    }
  }
  if (max < minChants) {
    return {max: max}
    var roles = []
    for (var i = 0; i < n; i++) {
      roles.push(gaussian(0, 1, 1, 0.5))
    }
    return roles
  }
  if (sum == 0) {
    sum = 1
  }
  let avg = sum / cults.length
  let p = score / sum
  let expected = 1 / cults.length
  let skew = 1
  if (doLog) {
    console.log("p:", p, "expected:", expected)
  }
  if (p < expected) {
    // trailing: skew 0-1
    skew = 1 - ((expected - Math.pow(p, 1.1)) / expected)
  } else if (p > expected) {
    // leading: skew 1-6
    // amount cult is leading over expectation / sum of other cult's expected scores
    let ratio = (Math.pow(p, 0.9) - expected) / (1 - expected)
    skew = ratio * POSITIVE_SKEW_SCALAR + 1
  }
  let offset = ((avg - score) / avg) / cults.length * OFFSET_SCALAR
  let noise = _randomness(p, expected)
  return { p, expected, skew, offset, noise, max }
}

async function roll(cults, userCult, n, minChants = 30, doLog = true) {
  var { p, expected, skew, offset, noise, max } = getRollInputs(cults, userCult, n, minChants, doLog)
  if (doLog) {
    console.log("cult:", userCult.name, "p:", p, "expected:", expected, "skew:", skew, "offset:", offset, "noise:", noise)
  }
  var roles = []
  if (max < minChants) {
    for (var i = 0; i < n; i++) {
      roles.push(gaussian(0, 1, 1, 0.5))
    }
    return roles
  }
  for (var i = 0; i < n; i++) {
    var out = 0
    if (i == 1) {
      skew = Math.pow(skew, 0.3) // was 0.7 (lower power closer to 1)
      offset /= 2
      noise = Math.pow(noise, 0.9) // was 0.5 (lower power higher noise)
    }
    while (out <= 0 || out >= 1) {
      out = gaussian(0, 1, skew, noise) + offset
    }
    roles.push(out)
  }
  return roles
}

function selectSpell(roll, doLog = false) {
  if (doLog) {
    let rarities = adjustRarities(1 - roll, SPELL_RARITIES)
    normalizeWeights(rarities)
    console.log("role:", roll, "rarities:", rarities)
    return weightedRandomSelect(Math.random(), rarities)
  }
  return weightedRandomSelect(Math.random(), adjustRarities(1 - roll, SPELL_RARITIES))
}

exports.mariokart = {
  selectSpell: selectSpell,
  rollDice: rollDice,
  getRollInputs: getRollInputs,
  roll: roll,
}