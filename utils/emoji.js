class Emoji {
  constructor(name, id) {
    this.name = name
    this.id = id
  }
  
  toString() {
    return `<:${this.name}:${this.id}>`
  }
}

exports.emoji = {
  truebeliever: new Emoji('truebeliever', '1001232962819469432'),
  magic: new Emoji('magic', '975922950551244871'),
  eye: new Emoji('eyeofobservation', '977338738189406258'),
  corrupted_eye: new Emoji('corruptedeye', '983801506107105330'),
  shard: new Emoji('shard', '982122017925005403'),
  celestial_shard: new Emoji('rare_shard', '982122044617551882'),
}