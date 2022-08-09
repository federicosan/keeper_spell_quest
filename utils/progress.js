exports.progress = (value, total, steps) => {
  let _nBars = Math.round((value/total*100).toFixed(0) / steps * 2)
  let msg = ''
  for(var i = 0; i < steps; i++) {
    if(_nBars <= 0) {
      msg += "░"
    } else if (_nBars == 1) {
      msg += "▒"
      _nBars -= 1
    } else {
      msg += "█"
      _nBars -= 2
    }
  }
  return msg
}