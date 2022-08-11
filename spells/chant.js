
const WORDS = [
  "ada",
  "aelin",
  "avari",
  "barad",
  "brith",
  "dolоros",
  "calmїt",
  "cú",
  "dоl",
  "duin",
  "ú",
  "elenya",
  "er",
  "ethuїl",
  "ẛorn",
  "goḷin",
  "giḷ",
  "ḿiṅas",
  "naḷ",
  "ṅumen",
  "noc",
  "orodruїn",
  "par",
  "sїlan",
  "quendi",
  "tiṅ",
  "thalias",
  "vоs",
  "sin",
  "cоs"
]

const WORDS_PLAIN = [
  "ada",
  "aelin",
  "avari",
  "barad",
  "brith",
  "doloros",
  "calmit",
  "cu",
  "dol",
  "duin",
  "u",
  "elenya",
  "er",
  "ethuil",
  "forn",
  "golin",
  "gil",
  "minas",
  "nal",
  "numen",
  "noc",
  "orodruin",
  "par",
  "silan",
  "quendi",
  "tin",
  "thalias",
  "vos",
  "sin",
  "cos"
]

const WORDS_PLAIN_EXT = [
  "ada",
  "aelin",
  "avari",
  "barad",
  "brith",
  "doloros",
  "calmit",
  "cu",
  "dol",
  "duin",
  "u",
  "elenya",
  "er",
  "ethuil",
  "forn",
  "golin",
  "gil",
  "minas",
  "nal",
  "numen",
  "noc",
  "orodruin",
  "par",
  "silan",
  "quendi",
  "tin",
  "thalias",
  "vos",
  "sin",
  "cos",
  "silme",
  "watate",
  "lege",
  "buna",
  "qaye",
  "fawai",
  "mas",
  "ege",
  "polinya",
  "sic",
  "tibi",
  "ego",
  "pomei",
  "set",
  "kote",
  "basa",
  "bvene",
  "bvute",
  "taur",
  "valdranya",
  "re",
  "rid",
  "rua",
  "zenar",
  "y'los",
  "waelle",
  "vra",
  "sathuus",
  "huamit",
  "bhim",
  "ashmin",
  "culivanis",
  "col",
  "cor"
]

const expectedLetter = (input) => {
  switch (input) {
      case "ḷ":
          return "l"
      case "ṅ":
          return "n"
      case "о":
          return "o"
      case "ḿ":
          return "m"
      case "ї":
          return "i"
      case "ú":
          return "u"
      case "ẛ":
          return "f"
  }
  return null
}

exports.WORDS = WORDS 
exports.WORDS_PLAIN = WORDS_PLAIN
exports.WORDS_PLAIN_EXT = WORDS_PLAIN_EXT
exports.expectedLetter = expectedLetter
