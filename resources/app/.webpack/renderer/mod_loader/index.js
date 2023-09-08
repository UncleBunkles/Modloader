
const fs = require("fs");
const path = require("path");

const escodegen = require("./mod_loader/lib/escodegen");

const { vsBundle } = require("./mod_loader/modules");
const foundModules = require("./mod_loader/moduleKeys.json")

const hexToInt = (hex) => parseInt(hex, 16);

class ModLoader {
    #bundle

    constructor() {
        this.#bundle = new vsBundle("main.bundle.js", this)
        this.importer = {};
        this.mods = this.#getMods();

        for (let key in foundModules) {
            foundModules[key] = typeof foundModules[key] === "string"
                ? hexToInt(foundModules[key])
                : foundModules[key];
        }

        this.#getModuleKeys().forEach(moduleKey => {
            for (let key in moduleKey) {
                foundModules[key] = typeof moduleKey[key] === "string"
                    ? hexToInt(moduleKey[key])
                    : moduleKey[key];
            }
        })

        this.#applyMods();
        this.#injectModInit();
        this.build(this);
    }

    build() {
        return function () {
            return eval(escodegen.generate(this.#bundle));
        }.call(this);
    }

    init() {
        this.#bundle.waitForModule("Game","Core", () => {
            Object.values(this.mods).forEach(mod => {
                mod.init();
            })
        })
    }

    setupGameInstance() {
        window.modloader.Game = this.__proto__.constructor;
        window.modloader.init();
    }

    #applyMods() {
        this.#setupMods()

        let hooks = this.#getHooks()
        this.#applyHooks(hooks)
    }

    #setupMods() {
        for (let mod in this.mods) {
            this.mods[mod] = new this.mods[mod](this)
            this.mods[mod].name = mod
        }
    }

    #getHooks() {
        let hooks = {
            createGetter: {},
            createSetter: {},
            overwrite: {},
            pre: {},
            post: {},
            overwriteSignature: {},
            extendSignature: {}
        }

        for (let mod in this.mods) {
            for (let hook in hooks) {
                for (let callback in this.mods[mod][hook]) {
                    if (hooks[hook][callback] === undefined) {
                        hooks[hook][callback] = []
                    }

                    hooks[hook][callback].push(this.mods[mod])
                }
            }
        }

        return hooks
    }

    #applyHooks(hooks) {
        for (let hookType in hooks) {
            Object.getOwnPropertyNames(hooks[hookType]).sort().forEach(hook => {
                hooks[hookType][hook].forEach(mod => {
                    this.#setupCallback(mod, hookType, hook);
                })
            })
        }
    }

    #setupCallback(mod, type, hook) {
        const callbackStack = hook.split(".");
        const parentModuleName = callbackStack[callbackStack.length - 2];
        const methodName = callbackStack[callbackStack.length - 1];

        let methods = {};
        methods[methodName] = mod[type][hook];

        this.#extendModule(mod, parentModuleName, type, methods);
    }

    #extendModule(mod, _module, key, methods) {
        const module = this.#bundle.findModule(_module);

        Object.keys(methods).forEach((method) => {
            try {
                this.#applyHook(mod, module.default, key, method, methods[method]);
            } catch (error) {
                console.log(mod, _module, key, methods, error)
            }
        });
    }

    #applyHook(mod, class_, key, method, callback) {
        const existing_method = class_.getMethod(method)

        if (existing_method) {
            existing_method[key](callback, mod)
        } else {
            if (['pre', 'post'].includes(key)) {
                throw `Error (using pre/post on method which doesn't exist: ${method}) [${mod.constructor.name}]`
            }

            class_.addMethod(callback, mod, key)
        }
    }

    #injectModInit() {
        this.#applyHooks({
            post: {
                "Game.constructor": [{
                    post: {
                        "Game.constructor": this.setupGameInstance
                    }
                }],
            },
        });
    }

    #getMods() {
        const ret = {};
        fs.readdirSync(path.join(__dirname, "/mod_loader/mods/"), {
            withFileTypes: true,
        })
            .filter((fileName) => fileName.isDirectory())
            .forEach((dir) => {
                ret[dir.name] = require(path.join(
                    __dirname,
                    `/mod_loader/mods/${dir.name}/${
                        fs
                            .readdirSync(path.join(__dirname, `/mod_loader/mods/${dir.name}/`), {
                                withFileTypes: true,
                            })
                            .filter((filename) => filename.name === `${dir.name}.js`)[0].name
                    }`
                ));
            });
        return ret;
    }

    #getModuleKeys() {
        return fs
            .readdirSync(path.join(__dirname, "mod_loader/mods/"), {
                withFileTypes: true,
            })
            .filter(fileName => fileName.isDirectory())
            .map(dir => {
                let filename = fs
                    .readdirSync(path.join(__dirname, `mod_loader/mods/${dir.name}/`), {
                        withFileTypes: true,
                    })
                    .filter((filename) => filename.name.includes("moduleKeys"))[0];

                return filename
                    ? require(path.join(
                        __dirname,
                        `mod_loader/mods/${dir.name}/${filename.name}`
                    ))
                    : undefined;
            })
            .filter(el => el);
    }
}

window.modloader = new ModLoader();
