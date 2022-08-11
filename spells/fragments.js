const { server } = require('../server')
const { WORDS_PLAIN_EXT } = require('./chant')
const { points } = require('./points')
const { emoji } = require('../utils/emoji')
const {
  FRAGMENTS_CULT_POINTS,
  FRAGMENTS_SABOTAGE_CULT_POINTS,
  FRAGMENTS_SABOTEUR_CULT_POINTS
} = require('./constants.js')
const moment = require('moment')
const { RandGenerator } = require('../utils/rand')


// game of creating value
// comment competition -- poetry, art, no links to outside media, must be OC
// do work, get rewarded
// work = building a thing?
let NUM_CULT_PIECES = 10
let NUM_OTHER_CULT_PIECES_REQD = 3
let NUM_PIECES = 5
let MIN_CHANT_LENGTH = NUM_PIECES + NUM_OTHER_CULT_PIECES_REQD
const EPOCH_PERIOD = 24 * 60 * 60 * 1000
const SUBMIT_CMD = "calmit sin" // listen with without/nothing (idiom, meaning listen with full attention)


var words = WORDS_PLAIN_EXT

String.prototype.tokenize = function(toLowerCase = true){
  return this.split(" ").filter(n => {
    if(n != ''){
      if(toLowerCase){
        return n.trim().toLowerCase()
      }
      return n.trim()
    }
    return null
  })
}

function hasChantWordsOnly(str){
  let tokens = str.tokenize()
  for(const token of tokens){
    if(!words.includes(token)){
      return false
    }
  }
  return true
}

async function currentPieces(seed){
  var usedWords = new Set()
  if (!seed) {
    seed = Math.floor((Date.now() - 4 * 60 * 60 * 1000) / EPOCH_PERIOD)  // await server.getSequenceValue( "pieces")
  }
  var rand = new RandGenerator(seed.toString())
  var pieces = []
  var idx = 0
  var sabotageIdx = 0
  var cults = server.Cults.values() // todo ensure consistent order
  for (var i = 0; i < 3 * NUM_CULT_PIECES; i++) {
    let next = words[Math.floor(rand.rnd() * words.length)]
    while (usedWords.has(next)) {
      next = words[Math.floor(rand.rnd() * words.length)]
    }
    usedWords.add(next)
    let darkNext = words[Math.floor(rand.rnd() * words.length)]
    while (usedWords.has(darkNext)) {
      darkNext = words[Math.floor(rand.rnd() * words.length)]
    }
    usedWords.add(darkNext)
    //idx += Math.max(1, Math.floor(rand.rand() * (100/(NUM_PIECES * 3))))
    idx = Math.floor(rand.rnd() * 3333)
    sabotageIdx = Math.floor(rand.rnd() * 3333) // Number.MAX_SAFE_INTEGER
    pieces.push({ word: next, idx: idx, cult: cults[i % 3].id, sabotage: darkNext, sabotageIdx: sabotageIdx })
  }
  return { pieces, seed }
}

console.log("current pieces:", currentPieces)
async function userPiece(userId, cult) {
  var { pieces, seed } = await currentPieces()
  let rand = new RandGenerator(seed.toString() + userId)
  let i = 0
  let target = Math.floor(rand.rnd() * NUM_CULT_PIECES)
  for (const piece of pieces) {
    if (piece.cult == cult.id) {
      if (i == target) {
        return piece
      }
      i++
    }
  }
  return null
}

async function handleReveal(interaction) {
  var cult = server.memberCult(interaction.member)
  if (!cult) {
    interaction.reply({ content: "error: no cult found for member", components: [], ephemeral: true })
    return
  }
  var piece = await userPiece(interaction.member.id, cult)
  if (!piece) {
    interaction.reply({ content: "error: no piece found", components: [], ephemeral: true })
  }
  var explanation = `*THE CALMIT SIN*\n\nthe CALMIT SIN is a special chant that cult's need to work together to build each day to win +${FRAGMENTS_CULT_POINTS} cult points. a valid calmit sin consists of ${MIN_CHANT_LENGTH} FRAGMENTS 📜 -  ${NUM_PIECES} from your cult, and ${NUM_OTHER_CULT_PIECES_REQD} from one or both of the others.\n\nBUT BE WARNED! each cultist gets a 🌱 TRUE  fragment and a ⚔ SABOTAGE fragment. using another cult's SABOTAGE fragment in your chant will give the chanter's cult ${FRAGMENTS_SABOTAGE_CULT_POINTS} and the saboteur's cult +${FRAGMENTS_SABOTEUR_CULT_POINTS}!\n\nto submit your cult's fragment chant, go to your cult channel and begin your message with "${SUBMIT_CMD}" then the rest of the chant (ex. ${SUBMIT_CMD} ero quendi vos etc...)`

  /*
  var explanation = `*THE CALMIT SIN*\n\nthe CALMIT SIN is a special chant that cult's need to work together to build each day. each cult may build their CALMIT SIN chant out of ${MIN_CHANT_LENGTH} FRAGMENTS 📜 every ${moment.duration(EPOCH_PERIOD).humanize()} to win +${FRAGMENTS_CULT_POINTS} cult points.\n\na valid chant a collect fragments from your fellow cult members and put them in order using the fragment numbers.\n\nBUT you need ${NUM_OTHER_CULT_PIECES_REQD} from other cults in addition to ${NUM_PIECES} from your own! but be careful, each cultist gets a 🌱 TRUE  fragment and a ⚔ SABOTAGE fragment. using another cult's SABOTAGE fragment in your chant will give the chanter's cult ${FRAGMENTS_SABOTAGE_CULT_POINTS} and the saboteur's cult +${FRAGMENTS_SABOTEUR_CULT_POINTS}!\n\nto submit your cult's fragment chant, go to your cult channel and begin your message with "calmit ada sin" then the rest of the chant (ex. calmit ada sin ero quendi vos etc...)`
    */
  interaction.reply({
    content: `🌱 "${piece.word}" ${piece.idx}\n⚔ "${piece.sabotage}" ${piece.sabotageIdx}\n\n${explanation}`,
    components: [],
    ephemeral: true
  })
}

async function hasChantedInPeriod(cultId) {
  let lastCheckpoint = new Date(Date.now() - ((Date.now() - 4 * 60 * 60 * 1000) % EPOCH_PERIOD))
  let n = await server.db.collection("events").count({ timestamp: { $gte: lastCheckpoint }, event: 'fragments_chant', 'metadata.cult': cultId })
  return n && n > 0
}

const INCLUDE_ERROR_DETAIL = false

async function check(_words, cultId, seed) {
  console.log("check words:", _words, "cultId:", cultId)
  if (await hasChantedInPeriod(cultId)) {
    let nextStart = new Date(Date.now() - ((Date.now() - 4 * 60 * 60 * 1000) % EPOCH_PERIOD) + EPOCH_PERIOD)
    nextStart = Math.floor(nextStart.getTime() / 1000)
    return { state: "invalid", error: `${server.Cults.get(cultId).getName(server)} must wait until <t:${nextStart}:f> to chant again` }
  }
  if (_words.length < NUM_PIECES + NUM_OTHER_CULT_PIECES_REQD) {
    return { state: "invalid", error: `you need ${NUM_PIECES + NUM_OTHER_CULT_PIECES_REQD} total fragments (${(NUM_PIECES + NUM_OTHER_CULT_PIECES_REQD) - _words.length} more)`, saboteurs: [] }
  }
  let { pieces } = await currentPieces(seed)
  let lastWordIdx = -1
  var isSabotage = false
  var saboteurs = new Set()

  var used = new Set()
  var numOtherCultPieces = 0
  for (var word of _words) {
    word = word.trim()
    if (used.has(word)) {
      if (INCLUDE_ERROR_DETAIL) {
        return { state: "invalid", saboteurs: [], error: "duplicate word: '" + word + "'" }
      }
      return { state: "invalid", saboteurs: [], error: "duplicate word" }
    }
    used.add(word)
    var found = false
    for (const piece of pieces) {
      if (piece.word == word) {
        if (piece.idx < lastWordIdx) {
          if (INCLUDE_ERROR_DETAIL) {
            return { state: "invalid", saboteurs: [], error: "invalid ordering: '" + word + "'" }
          }
          return { state: "invalid", saboteurs: [], error: "invalid ordering" }
        }
        lastWordIdx = piece.idx
        numOtherCultPieces += 1
        found = true
        break
      } else if (piece.sabotage == word && piece.cult != cultId) {
        if (piece.sabotageIdx < lastWordIdx) {
          if (INCLUDE_ERROR_DETAIL) {
            return { state: "invalid", saboteurs: [], error: "invalid ordering: '" + word + "'" }
          }
          return { state: "invalid", saboteurs: [], error: "invalid ordering" }
        }
        lastWordIdx = piece.sabotageIdx
        isSabotage = true
        saboteurs.add(piece.cult)
        numOtherCultPieces += 1
        found = true
        break
      }
    }
    if (!found) {
      return { state: "invalid", saboteurs: [], error: "not a valid chant" }
    }
  }
  if (numOtherCultPieces < NUM_OTHER_CULT_PIECES_REQD) {
    return { state: "invalid", saboteurs: [], error: `you need ${NUM_OTHER_CULT_PIECES_REQD - numOtherCultPieces} more fragements from other cults` }
  }
  if (isSabotage) {
    return { state: "sabotage", saboteurs: saboteurs.values(), error: null }
  }
  return { state: "valid", saboteurs: [], error: null }
}

async function handleMessage(message) {
  var cult = server.memberCult(message.member)
  if (!cult) {
    message.reply("error: no cult found for you | talk to @hypervisor")
    return
  }
  if (message.channel.id != cult.id) {
    message.reply("you may only chant fragments in your cult channel.")
    return
  }
  if(!server.memberHasRole(message.member, server.Roles.TrueBeliever) ) {
    message.reply(`only true believers ${emoji.truebeliever} can chant the calmit sin. find one to perform the chant.`)
    return
  }
  var _words = message.content.trim().replace(`${SUBMIT_CMD}`, "").tokenize()
  var { state, error, saboteurs } = await check(_words, cult.id)
  switch (state) {
    case "invalid":
      message.reply(error)
      return
    case "valid":
      await points.handleFragmentsChant(server, message.member.id, cult, false, saboteurs)
      message.reply(`aeilin, your fragments are pure, this chant is accepted! +𐂥${FRAGMENTS_CULT_POINTS}`)
      return
    case "sabotage":
      await points.handleFragmentsChant(server, message.member.id, cult, true, saboteurs)
      let saboteurCultNames = saboteurs.map(id => server.Cults.get(id).getName(server))
      message.reply(`SABOTAGE! -𐂥${FRAGMENTS_SABOTAGE_CULT_POINTS} to ${cult.getName(server)}, +𐂥${FRAGMENTS_SABOTEUR_CULT_POINTS} to ${saboteurCultNames.join(", ")}`)
      return
  }
  message.reply("error? talk to @hypervisor...")
  return
}

async function test() {
  var _seed = 25224929
  _seed = null
  let { pieces, seed } = await currentPieces(_seed)
  console.log("seed:", seed, "pieces:", pieces)
  await server.loadDiscordUsers()
  let uid = '525630753812250624'
  var cult = server.userIdCult(uid)
  if (!cult) {
    interaction.reply({ content: "error: no cult found for member", components: [], ephemeral: true })
  }
  var piece = await userPiece(uid, cult)
  console.log("piece:", piece)
  
  let content = "calmit sin  rid bhim brith barad fawai tin"
  let _words = content.trim().replace(`${SUBMIT_CMD} `, "").tokenize()
  let resp = await check(_words, '972639993635938344')
  console.log("resp:", resp, "should be valid, is valid:", resp.state == 'valid')
  
  // 784 816 1133 2118 2776 2951 3100 3209
  resp = await check("er avari tin ego vra orodruin u y'los".split(" "), cult.id, _seed)
  console.log("resp:", resp, "should be valid, is valid:", resp.state == 'valid')

  resp = await check("er avari tin ego vra orodruin u avari".split(" "), cult.id, _seed)
  console.log("resp:", resp, "should be invalid, is invalid:", resp.state != 'valid')
}

exports.fragments = {
  SUBMIT_CMD: SUBMIT_CMD,
  handleReveal: handleReveal,
  handleMessage: handleMessage,
  test: test,
  hasChantWordsOnly: hasChantWordsOnly
}