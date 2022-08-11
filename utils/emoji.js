class Emoji {
  constructor(name, id) {
    this.name = name
    this.id = id
  }
  
  toString() {
    return `<:${this.name}:${this.id}`
  }
}

exports.emoji = {
  truebeliever: Emoji('truebeliever', '1001232962819469432'),
  magic: Emoji('magic', '975922950551244871'),
}