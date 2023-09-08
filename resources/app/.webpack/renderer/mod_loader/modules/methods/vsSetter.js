
const vsMethod = require('./vsMethod')

class vsSetter extends vsMethod {
    constructor(method, mod) {
        super(method, mod);
        this.kind = "set"
    }
}

module.exports = vsSetter
