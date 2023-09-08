
const esprima = require("../../lib/esprima");
const estraverse = require("../../lib/estraverse");

class vsMethod {
    #hasSuper

    constructor(method, mod = null) {
        let methodSTR = method.toString();

        if (mod) {
            methodSTR = methodSTR.replaceAll(
                "self.",
                `window.modloader.mods.${mod.name}.`
            ).replace(
                /(require\(['"])(.+?['"]\))/g,
                `$1./mod_loader/mods/${mod.name}${mod.pathModifier || ""}/$2`
            ).replace("_super", "super")
        }

        try {
            methodSTR = esprima.parse(this.#wrapToClass(methodSTR)).body[0].body.body[0];
        } catch (error) {
            methodSTR = methodSTR.replace("function" , "")
            methodSTR = esprima.parse(this.#wrapToClass(methodSTR)).body[0].body.body[0];
        }

        for (const [key, value] of Object.entries(methodSTR)) {
            this[key] = value;
        }

        this.#hasSuper = this.value.body.body.findIndex(
            (_super) => _super.expression?.callee?.type === "Super"
        );
    }

    #wrapToClass(str) {
        return `
        class _wrapper {\n
            ${str.toString()}
        \n}
        `
    }

     overwrite(method, mod) {
        method = new vsMethod(method, mod);
        this.value.body.body = method.value.body.body;
    }

    pre(method, mod) {
        method = new vsMethod(method, mod);

        if (this.hasSuper === -1) {
            this.value.body.body.unshift(...method.value.body.body);
        } else {
            this.value.body.body.splice(
                this.hasSuper + 1,
                0,
                ...method.value.body.body
            );
        }
    }

    post(method, mod) {
        method = new vsMethod(method, mod);
        this.value.body.body.push(...method.value.body.body);
    }

    overwriteSignature(callback) {
        this.#applySignatureMod(callback);
    }

    extendSignature(callback) {
        this.#applySignatureMod(callback, true);
    }

    #applySignatureMod(options, extend = false) {
        let customArgs = [];
        let replaceArgs = false;
        let argsEquivalent = {};

        if (typeof options === "string") {
            replaceArgs = true;
            customArgs = options.split(",");
        } else {
            customArgs = options.args.split(",");
            replaceArgs = options?.replaceArgs;
        }

        customArgs = customArgs.map((arg) => {
            return {
                type: "Identifier",
                name: arg,
            };
        });

        this.value.params.forEach((param, index) => {
            if(param.name)
              argsEquivalent[param.name] = customArgs[index].name.split("=")[0].trim();
            else
            argsEquivalent[param.left.name] = customArgs[index].name.split("=")[0].trim();
        });

        if (extend) {
            this.value.params = [...this.value.params, ...customArgs];
        } else {
            this.value.params = [...customArgs];

            if (replaceArgs) {
                estraverse.replace(this, {
                    enter: () => {},
                    leave: (node) => {
                        if (
                            node.type === esprima.Syntax.Identifier &&
                            argsEquivalent.hasOwnProperty(node.name)
                        ) {
                            return {
                                type: "Identifier",
                                name: argsEquivalent[node.name],
                            };
                        }
                    },
                });
            }
        }
    }
}

module.exports = vsMethod;
