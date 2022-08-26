const { RandGenerator } = require('../utils/rand')
const { WORDS } = require("./chant");

var kind = ["Conjuring", "Transforming", "Banishing", "Divining"];
var element = ["Frost", "Ash", "Fire", "Poison", "Lightning"];
var prefixes = [
  "Arcane",
  "Befouled",
  "Ancient",
  "Burned",
  "Blessed",
  "Hidden",
  "Dark",
  "Faerie",
  "Dwarven",
  "Druid",
  "Demonic",
  "Corrupted",
  "Celestial"
];
var suffixes = [
  "of Vitality",
  "of Hope",
  "of Disaster",
  "of Death",
  "of the Undead",
  "of Power",
  "of the Outer Realm",
  "of Oblivion",
  "of Ascension",
  "of the Dragon",
  "of Time"
];

var gods = [
  "Anu the Builder",
  "Iluvatar",
  "Manwe",
  "Tathamet",
  "Ytar",
  "Tyre",
  "Dalaran"
]

class Spell {
  constructor(name, incantation, power, type) {
    this.name = name
    this.incantation = incantation
    this.power = power
    this.type = type
  }
}

class SpellGenerator {
  constructor(type, kinds, spells, prefixes, suffixes, gods, postProcessor) {
    this.type = type
    this.kinds = kinds
    this.spells = spells
    this.prefixes = prefixes
    this.suffixes = suffixes
    this.gods = gods
    this.postProcessor = postProcessor
  }

  _getName(randomizer, greatness) {
    let out = ""
    out += this.kinds[randomizer.rndInt() % this.kinds.length] + " " + this.spells[randomizer.rndInt() % this.spells.length]
    if (greatness >= 13 && greatness % 3 != 0) {
      out = this.prefixes[randomizer.rndInt() % this.prefixes.length] + " " + out
    }
    if (greatness >= 16 && greatness % 2 == 0) {
      out += " " + this.suffixes[randomizer.rndInt() % this.suffixes.length]
    }
    if (greatness >= 19) {
      out = this.gods[randomizer.rndInt() % this.gods.length] + "'s " + out
    }
    return out
  }

  _getIncantation(name, greatness) {
    let r = new RandGenerator(name)
    let v = r.rnd()
    let n = (v % 7) + 4
    if (greatness > 16) {
      n += 5
    }
    let out = ""
    for (var i = 0; i < n; i++) {
      if (i != 0) {
        out += " "
      }
      out += WORDS[Math.floor(WORDS.length * r.rnd())]
    }
    return out
  }

  create(power) {
    let rand = Math.round(Number.MAX_SAFE_INTEGER * power)
    let randomizer = new RandGenerator(rand.toString())
    let greatness = Math.floor(power * 21)
    let name = this._getName(randomizer, greatness)
    let incantation = this._getIncantation(name, greatness)
    let spell = new Spell(name, incantation, power, this.type)
    if (this.postProcessor) {
      this.postProcessor(spell)
    }
    return spell
  }
}

exports.SpellGenerator = SpellGenerator
exports.prefixes = prefixes
exports.suffixes = suffixes
exports.gods = gods