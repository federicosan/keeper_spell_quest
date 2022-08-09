const emojiRegex = require('emoji-regex')
var GraphemeBreaker = require('grapheme-breaker')

function isOneEmoji(input) {
  return GraphemeBreaker.break(input).length == 1
  
  const regex = emojiRegex()
  console.log("matchall:", input.matchAll(regex))
  let matches = input.matchAll(regex)
  let expectedLen = 0
  let numMatches = 0
  for (const match of matches) {
    console.log("match:", match)
    const emoji = match[0];
    numMatches++
    expectedLen += [...emoji].length
  }
  console.log("nummatches:", numMatches, "expectedlen:", expectedLen, "input.length:", input.length)
  return numMatches == 1 && expectedLen == input.length
  // var output = input.replace(/([\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2694-\u2697]|\uD83E[\uDD10-\uDD5D])/g, "")
  // return fancyCount(input) - fancyCount(output) == 1 && fancyCount(output) == 0
}

console.log("isOneEmoji:", isOneEmoji('🥸'))
console.log("isOneEmoji:", isOneEmoji('🪱'))
console.log("isOneEmoji:", isOneEmoji('🪱 t'))
console.log("isOneEmoji:", isOneEmoji('t 🪱 t'))
console.log("isOneEmoji:", isOneEmoji('🥸 t'))