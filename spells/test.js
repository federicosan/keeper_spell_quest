const { testCreatures } = require('./creatures')
const { testSpells } = require('./spells')
const { mariokart } = require('./mariokart')
const { jStat } = require('jstat')
const { 
  ENEMY_TYPE, 
  ALLY_TYPE, 
  TARGET_CULT_TYPE, 
  TARGET_PLAYER_TYPE, 
  TARGET_CREATURE_TYPE, 
  CONJURE_ENEMY_SPELL,
  CONJURE_ALLY_SPELL,
  ATTACK_SPELL,
  MAGIC_BOOST_SPELL,
  CULT_POINT_BOOST_SPELL
} = require('./constants.js')

async function _testCreatures(){
  let n = 40
  for(var i = 0; i < n; i ++) {
    let power = Math.random()
    let creature = await testCreatures.generateEnemy(power)
    console.log("dice-roll:", power.toFixed(2), "creature:", creature)
  }
  for(var i = 0; i < n; i ++) {
    let power = Math.random()
    let creature = await testCreatures.generateAlly(power)
    console.log("dice-roll:", power.toFixed(2), "creature:", creature)
  }
  return
}

const average = (array) => array.reduce((a, b) => a + b) / array.length

function _rollStatsStr(roles){
  const prefix = "\n\t"
  return [
    prefix+"mean: ", jStat.mean(roles),
    prefix+"min: ", jStat.min(roles),
    prefix+"max: ", jStat.max(roles),
    prefix+"stdev: ", jStat.stdev(roles),
    prefix+"range: ", jStat.range(roles),
    prefix+"variance: ", jStat.variance(roles)
  ].join('')
}

async function _testWeightedDice(verbose = false){
  let cults = [
    {id: 1, score: 0.35, chants: 100,  name: "a"},  
    {id: 2, score: 0.93, chants: 100,  name: "b"},  
    {id: 3, score: 1.02, chants: 100,  name: "c"},  
  ]
  for(var cult of cults){    
    var roles = []
    var powerRoles = []
    for(var i = 0; i < 100; i++){
      let _roles = await mariokart.roll(cults, cult, 2, 0, false)
      roles.push( _roles[0])
      powerRoles.push(_roles[1])
    }
    let inputs = mariokart.getRollInputs(cults, cult, 2, 0, false)
    if(verbose){
      console.log("cult:", cult, "roles:", roles, "power-roles:", powerRoles,"\nroll-stats:", _rollStatsStr(roles), "\npower-role-stats:", _rollStatsStr(powerRoles))
    }
    console.log("cult:", cult,"\ninputs:", inputs, "\nspell-roll-stats:", _rollStatsStr(roles), "\npower-role-stats:", _rollStatsStr(powerRoles))
  }
  
  
  
  // cults = [
  //   {id: 1, score: 4},  
  //   {id: 2, score: 0.95},  
  //   {id: 3, score: 2},  
  // ]
  // for(var cult of cults){    
  //   let roles = await mariokart.roll(cults, cult, 20, 0)
  //   console.log("cult:", cult, "roles:", roles, "avg:", average(roles))
  // }
}

async function _testSpells(){
  let n = 40
  for(var i = 0; i < n; i ++) {
    let { roles , spell } = await testSpells.conjure()
    console.log("dice-rolls:", roles[0].toFixed(2), roles[1].toFixed(2), "spell:", spell)
  }
  let types = [
    // CONJURE_ENEMY_SPELL,
    // CONJURE_ALLY_SPELL,
    // ATTACK_SPELL,
    // MAGIC_BOOST_SPELL,
    // CULT_POINT_BOOST_SPELL
  ]
  for(var _type of types) {
    let { roles , spell } = await testSpells.conjure(_type)
    console.log(_type, "dice-roll:", roles[1].toFixed(2), "spell:", spell)
  }
  return
}

async function _testSpellsAndDice(){
  let cults = [
    {id: 1, score: 2.15},  
    {id: 2, score: 0.95},  
    {id: 3, score: 1.65},  
  ]
  for(var cult of cults){    
    console.log("\n\ncult:", cult)
    for(var i = 0; i < 10; i ++) {
      let roles = await mariokart.roll(cults, cult, 2, 0, false)
      let { _ , spell } = await testSpells.conjure(null, roles)
      console.log("dice-rolls:", roles[0].toFixed(2), roles[1].toFixed(2), "spell:", spell)
    }
  }
  return
}

_testWeightedDice()
// _testCreatures()
// _testSpells()
// _testSpellsAndDice()