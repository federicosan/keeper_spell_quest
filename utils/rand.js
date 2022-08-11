// @dev you can experiment with this function in a fiddle here: https://jsfiddle.net/wsa9Lkf4/
function randn_bm(min, max, skew, noise) {
    var u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );

    num = num / 10.0 + 0.5; // Translate to 0 -> 1
    if (num > 1 || num < 0) num = randn_bm(min, max, skew, noise); // resample between 0 and 1 if out of range
    num = Math.pow(num, skew); // Skew
    if(noise){
    	num = (num * (1-noise)) + (Math.random() * noise)
    }
    num *= max - min; // Stretch to fill range
    num += min; // offset to min
    return num;
}

function normalizeWeights(elements) {
    var sum = 0;
    elements.forEach(el => {
        sum += el.weight;
    })

    elements.forEach(el => {
        el.weight /= sum;
    })
}

function _weightedRandomSelect(randv, elements) {
    let v = 0
    for (var i = 0; i < elements.length; i++) {
        v += elements[i].weight;
        if (v >= randv) {
        return elements[i]
        }
    }
}

function weightedRandomSelect(randv, elements) {
    normalizeWeights(elements);
    return _weightedRandomSelect(randv, elements)
}

function hashString(value){
    var hash = 0, i, chr;
    if (value.length === 0) return hash;
    for (i = 0; i < value.length; i++) {
        chr   = value.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

class RandGenerator {
    constructor(hash, id) {
        this.hash = hash
        this.id = id
        this.reset(hash, id);
    }

    rnd() {
        // if (TEST_RANDOM) {
        //     return Math.random();
        // }
        return this.rand();
    }
    
    rndInt() {
        return Math.round(Number.MAX_SAFE_INTEGER * this.rnd())
    }

    _rnd() {
        return this.rand();
    }

    reset(hash, id) {
        this.hash = hash
        this.id = id
        if (id) {
            hash = hashString(hash + id);
        }
        this.rand = mulberry32(xmur3(hash)());
    }

    copyWithSalt(salt) {
        return new RandGenerator(this.hash, salt)
    }
}

// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript

function xmur3(str) {
    for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++)
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353),
            h = h << 13 | h >>> 19;
    return function () {
        h = Math.imul(h ^ h >>> 16, 2246822507);
        h = Math.imul(h ^ h >>> 13, 3266489909);
        return (h ^= h >>> 16) >>> 0;
    }
}

function mulberry32(a) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function sfc32(a, b, c, d) {
    return function () {
        a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
        var t = (a + b) | 0;
        a = b ^ b >>> 9;
        b = c + (c << 3) | 0;
        c = (c << 21 | c >>> 11);
        d = d + 1 | 0;
        t = t + d | 0;
        c = c + t | 0;
        return (t >>> 0) / 4294967296;
    }
}

function xoshiro128ss(a, b, c, d) {
    return function () {
        var t = b << 9, r = a * 5; r = (r << 7 | r >>> 25) * 9;
        c ^= a; d ^= b;
        b ^= c; a ^= d; c ^= t;
        d = d << 11 | d >>> 21;
        return (r >>> 0) / 4294967296;
    }
}

function adjustRarities(score, rarities) {
    let out = []
    for(const v of rarities){
        let w = Math.pow(Math.pow(v.weight, 2), score)
        out.push({value:v.value, weight: w})
    }
    return out
}

exports.adjustRarities = adjustRarities
exports.hashString = hashString
exports.RandGenerator = RandGenerator
exports.gaussian = randn_bm
exports.weightedRandomSelect = weightedRandomSelect
exports.normalizeWeights = normalizeWeights