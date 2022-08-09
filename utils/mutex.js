const { Mutex } = require('async-mutex')

const mutex = new Mutex()

class StringMutex {
  constructor() {
    this.map = {}
    this.mutex = new Mutex()
  }

  async acquire(key) {
    var release = await this.mutex.acquire()
    if (key in this.map) {
      var _mutex = this.map[key]
      release()
      return await _mutex.acquire()
    }
    var _mutex = new Mutex()
    this.map[key] = _mutex
    release()
    var _release = await _mutex.acquire()
    return _release
  }
}

exports.StringMutex = StringMutex