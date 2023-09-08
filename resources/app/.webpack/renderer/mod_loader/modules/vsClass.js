
const escodegen = require("../lib/escodegen");

const { vsMethod, vsGetter, vsSetter } = require("./methods");

class vsClass {
    constructor(ast) {
        for (const [key, value] of Object.entries(ast)) {
            this[key] = value;
        }

        this.body.body = this.body.body.map(method => {
            return new vsMethod(escodegen.generate(method))
        })
    }

    get methods() {
        return this.body.body
    }

    toString() {
        return escodegen.generate(this)
    }

    getMethod(methodName) {
        return this.body.body.find(method => method.key.name === methodName || method.key.value === methodName)
    }

    addMethod(method, mod, key) {
        if (key === 'createGetter') {
            method = new vsGetter(method, mod)
        } else if (key === 'createSetter') {
            method = new vsSetter(method, mod)
        } else {
            method = new vsMethod(method, mod)
        }

        if (method) this.body.body.push(method)
    }
}

module.exports = vsClass;
