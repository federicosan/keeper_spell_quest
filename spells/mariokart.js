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
const { getStats } = require('../stats')
const { gaussian, weightedRandomSelect, adjustRarities, normalizeWeights, RandGenerator, hashString } = require('../utils/rand')

var SPELL_RARITIES = [
  { value: BEES_SPELL, weight: 3 },
  { value: CONJURE_ENEMY_SPELL, weight: 3 },
  { value: CONJURE_ALLY_SPELL, weight: 3 },
  { value: CONJURE_FREEZE_SPELL, weight: 3 },
  { value: CHEST_SPELL, weight: 6 },
  { value: CULT_POINT_BOOST_SPELL, weight: 9 },
  { value: MAGIC_BOOST_SPELL, weight: 7 },
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

const average = (array) => array.reduce((a, b) => a + b) / array.length

async function rollDice(server, member, n) {
  let userCult = server.Cults.userCult(member)
  let cults = await getStats()
  return await _roll(cults, userCult, n)
}

async function _roll(cults, userCult, n, minChants = 30, doLog = true) {
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
  console.log("max:", max)
  if (max < minChants) {
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
    // skew 0-1
    skew = 1 - ((expected - Math.pow(p, 1.5)) / expected)
  } else if (p > expected) {
    // skew 1-6
    skew = (Math.pow(p, 0.7) - expected) / (1 - expected) * 5 + 1
  }
  let offset = ((avg - score) / avg) / 3
  let noise = _randomness(p, expected)
  if (doLog) {
    console.log("cult:", userCult.name, "p:", p, "expected:", expected, "skew:", skew, "offset:", offset, "noise:", noise)
  }
  var roles = []
  for (var i = 0; i < n; i++) {
    var out = 0
    if (i == 1) {
      skew = Math.pow(skew, 0.3) // was 0.7
      offset /= 2
      // noise = Math.pow(noise, 0.5)
      noise = Math.pow(noise, 0.9)
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
  roll: _roll,
}