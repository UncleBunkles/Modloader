
const estraverse = require("../lib/estraverse");
const esprima = require("../lib/esprima");

const vsClass = require("./vsClass");

class vsModule {
    constructor(module, bundle) {
        this.bundle = bundle;

        for (const [key, value] of Object.entries(module)) {
            this[key] = value;
        }

        this.clean();
        this.findDefault();
    }

    findDefault() {
        const exportVariable = this.value.params[1].name;
        let exportDefault = null;

        estraverse.traverse(this, {
            enter: (node) => {
                if (
                    node.type === "AssignmentExpression" &&
                    node.operator === "=" &&
                    node.left.type === "MemberExpression" &&
                    node.left.object.name === exportVariable &&
                    node.left.property.value === "default"
                ) {
                    exportDefault = node.right;
                }
            },
        });

        if (exportDefault.name) {
            estraverse.traverse(this, {
                enter: (node) => {
                    if (
                        node.type === "VariableDeclarator" &&
                        node.id.name === exportDefault.name
                    ) {
                        this.default = node
                    }

                    if (
                        node.type === "ClassDeclaration" &&
                        node.id.name === exportDefault.name
                    ) {
                        this.default = new vsClass(node)
                    }
                },
            })
        } else if (exportDefault.type === "ClassExpression") {
            this.default = new vsClass(exportDefault)
        }
    }

    clean() {
        const cleaners = [this.bundle.cleanerID];

        estraverse.traverse(this, {
            enter: function (node) {
                if (
                    node.type === "VariableDeclarator" &&
                    node.init &&
                    node.init.type === "Identifier"
                ) {
                    if (cleaners.includes(node.init.name)) {
                        cleaners.push(node.id.name);
                    }
                }
            },
            leave: function (node, parent) {},
        });

        estraverse.replace(this, {
            enter: () => {},
            leave: (node) => {
                if (
                    node.type === esprima.Syntax.CallExpression &&
                    node.callee.type === esprima.Syntax.Identifier &&
                    cleaners.includes(node.callee.name)
                ) {
                    let val = this.bundle.cleanStr(node.arguments[0].value);
                    if (val) {
                        node = {
                            type: esprima.Syntax.Literal,
                            raw: val,
                            value: val,
                        };
                    }
                }

                return node;
            },
        });
    }
}

module.exports = vsModule;
