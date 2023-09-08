
const fs = require("fs");
const path = require("path");

const esprima = require("../lib/esprima");
const escodegen = require("../lib/escodegen");

const foundModules = require("../moduleKeys.json")
const vsModule = require("./vsModule")

class vsBundle {
    #modLoader
    #mainBundleModules

    constructor(file, modLoader) {
        this.#modLoader = modLoader;

        const main_bundle = fs.readFileSync(path.join(__dirname, "../../", file), {
            encoding: "utf-8",
        });

        const ast = esprima.parse(main_bundle);

        for (const [key, value] of Object.entries(ast)) {
            this[key] = value;
        }

        this.#setupModloader();
    }

    waitForModule(_module, method, callback) {
        const interval = setInterval(() => {
            let parent = this.#modLoader.importer(_module).default;

            if (parent && parent[method]) {
                clearInterval(interval);
                callback();
            }
        }, 0);
    }

    findModule(moduleId) {
        try {
            let key = typeof moduleId === "string" ? foundModules[moduleId] : moduleId;
            const raw = this.#mainBundleModules.find((n) => n.key.value === key);

            return new vsModule(raw, this);
        } catch (error) {
            console.log(moduleId, error)
        }
    }

    #getAllModules() {
        this.#mainBundleModules = this.body
            .filter((n) => n.type === "ExpressionStatement")[0]
            .expression.expressions.filter((n) => n.type === "CallExpression")
            .filter((n) => n.callee.type === "ArrowFunctionExpression")[0]
            .callee.body.body.filter((n) => n.type === "VariableDeclaration")
            .map((n) => n.declarations)
            .flat()
            .filter((n) => n.init !== null)
            .filter((n) => n.init.type === "ObjectExpression")
            .filter((n) => n.init.properties.length !== 0)[0].init.properties;
    }

    #injectImporter() {
        const injectModuleImporter = this.body
            .filter((n) => n.type === "ExpressionStatement")[0]
            .expression.expressions.filter((n) => n.type === "CallExpression")
            .filter((n) => n.callee.type === "ArrowFunctionExpression")[0].callee
            .body.body;

        const importer = injectModuleImporter.pop();
        const toInject = esprima.parse(`
            this.importer = (moduleID) => {
                let key = typeof moduleID === "string" ? foundModules[moduleID] : moduleID;
                return ${importer.expression.right.callee.object.name}(key)
            }
        `);

        injectModuleImporter.push(importer);
        injectModuleImporter.push(toInject.body[0]);
    }

    #constructStringCleaner() {
        const cleanString = this.body.find(
            (body) => body.type === "FunctionDeclaration" && body.params.length > 0
        );

        const dictionary = this.body.find(
            (body) => body.type === "FunctionDeclaration" && body.params.length === 0
        );

        const fixStrings = this.body.find(
            (body) => body.type === "ExpressionStatement"
        ).expression.expressions[0];

        const buildDictionary = escodegen.generate(dictionary);
        const buildCleanString = escodegen.generate(cleanString);
        const buildfixStrings = escodegen.generate(fixStrings);

        const cls = buildCleanString.replace(
            `function ${cleanString.id.name}`,
            "function "
        );

        const dict = buildDictionary.replace(
            `function ${dictionary.id.name}`,
            "function "
        );

        this.cleanerID = cleanString.id.name;

        eval(`
            var ${cleanString.id.name} = eval((${cls}))
            var ${dictionary.id.name} = eval(${dict})
            eval((${buildfixStrings}));

            this.cleanStr = ${cleanString.id.name};
        `);
    }

    #setupModloader() {
        this.#getAllModules();
        this.#injectImporter();
        this.#constructStringCleaner();
    }
}
module.exports = vsBundle;
