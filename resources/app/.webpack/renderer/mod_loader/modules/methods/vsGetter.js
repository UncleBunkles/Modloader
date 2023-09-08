
const vsMethod = require('./vsMethod')

class vsGetter extends vsMethod {
    constructor(method, mod) {
        super(method, mod);
        this.kind = "get"
    }
}

module.exports = vsGetter
