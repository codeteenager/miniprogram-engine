import postcss from "../lib/postcss";
import postcssSelectorParser from "postcss-selector-parser";
import { ValueParser, ParsedValue, Node } from "../lib/postcss-value-parser";
import postcssValueParser = require("../lib/postcss-value-parser");
import { ITemplate, WCSC } from "./index";
import * as util from "./util";
import { pathToFileURL } from "url";

interface IPostcssWcssJsStore {
  preFile: string;
  file: Array<string | number[]>;
  wcscjs: WCSC;
  template: ITemplate;
  templateIdx: number;
  insideAtrule: boolean;
  atruleName: string;
  xcInvalid: string;
}

interface IRuleSelectoStore {
  needAddOriginClass: boolean;
  ruleNode: postcss.Rule;
  xcInvalid: string;
}

interface IDeclValueStore {
  hasDeclValueRpx: boolean;
  keepDeclValueRpx: boolean;
  delcNode: postcss.Declaration;
}

interface ISelectorNode {
  type: string;
  value: string;
  node: postcssSelectorParser.Node;
}

function isKeyframes(node: postcss.Node) {
  return node.type === "atrule" && /^(-\w+-)?keyframes$/.test(node.name);
}

const ruleSelectorWalker = (node: postcssSelectorParser.Node, store: IPostcssWcssJsStore, ruleSelectoStore: IRuleSelectoStore) => {
  if (store.wcscjs.wcscError) {
    return;
  }
  if (node.type === "root") {
    // root节点，只需要处理first子节点
    ruleSelectorWalker(node.first, store, ruleSelectoStore);
  } else if (node.type === "selector") {
    // selector节点
    node.nodes.forEach((child, index) => {
      ruleSelectorWalker(child, store, ruleSelectoStore);
    });
  } else if (node.type === "attribute") {
    // 属性选择器
    store.preFile = `${store.preFile}[${node.attribute || ""}${node.operator || ""}${node.raws.value || ""}]`;
    if (!ruleSelectoStore.xcInvalid) {
      const line: number = ruleSelectoStore.ruleNode.source && ruleSelectoStore.ruleNode.source.start && ruleSelectoStore.ruleNode.source.start.line || 0;
      let column: number = ruleSelectoStore.ruleNode.source && ruleSelectoStore.ruleNode.source.start && ruleSelectoStore.ruleNode.source.start.column || 0;
      column = ruleSelectoStore.ruleNode.selector.indexOf(node.attribute || "") + column;
      ruleSelectoStore.xcInvalid = `Some selectors are not allowed in component wxss, including tag name selectors, ID selectors, and attribute selectors.(${store.template.path}:${line}:${column})`;
    }
  } else if (node.type === "class") {
    // 类选择器
    // .text text需要处理
    // #wordscard.text text不需要处理
    // #wordscard .text text需要处理
    const prev = node.prev();
    if ((node.parent && node === node.parent.first) || (prev && prev.type === "combinator" && prev.value === " ") || (prev && prev.type === "tag")) {
      store.preFile = `${store.preFile}.`;
      store.file.push(store.preFile);
      store.file.push([1]);
      store.preFile = `${node.value}`;
      ruleSelectoStore.needAddOriginClass = true;
    } else {
      store.preFile = `${store.preFile}.${node.value}`;
    }
  } else if (node.type === "id") {
    // id选择器
    store.preFile = `${store.preFile}#${node.value}`;
    if (!ruleSelectoStore.xcInvalid) {
      const line: number = ruleSelectoStore.ruleNode.source && ruleSelectoStore.ruleNode.source.start && ruleSelectoStore.ruleNode.source.start.line || 0;
      let column: number = ruleSelectoStore.ruleNode.source && ruleSelectoStore.ruleNode.source.start && ruleSelectoStore.ruleNode.source.start.column || 0;
      column = ruleSelectoStore.ruleNode.selector.indexOf(node.value || "") - 1 + column;
      ruleSelectoStore.xcInvalid = `Some selectors are not allowed in component wxss, including tag name selectors, ID selectors, and attribute selectors.(${store.template.path}:${line}:${column})`;
    }
  } else if (node.type === "tag") {
    // 标签选择器
    if (node.parent && node.parent.parent && node.parent.parent.type === "pseudo") {
      /**
       * .one:nth-child(1){
       *    margin-top: 0;
       *    padding-top: 1em;
       *  }
       * 这种1是tag类型，需要特殊处理
       */
      store.preFile = `${store.preFile}${node.value}`;
    } else {
      if (!store.insideAtrule || (store.insideAtrule && store.atruleName === "media")) {
        if (node.value === "page" || node.value === "Page") {
          store.preFile = `${store.preFile}body`;
          ruleSelectoStore.needAddOriginClass = true;
        } else {
          if (!(node.value[0] === "w" && node.value[1] === "x" && node.value[2] === "-")) {
            store.preFile = `${store.preFile}wx-${node.value}`;
            ruleSelectoStore.needAddOriginClass = true;
          } else {
            store.preFile = `${store.preFile}${node.value}`;
            // if (!ruleSelectoStore.xcInvalid) {
            //   const line: number = ruleSelectoStore.ruleNode.source && ruleSelectoStore.ruleNode.source.start && ruleSelectoStore.ruleNode.source.start.line || 0;
            //   let column: number = ruleSelectoStore.ruleNode.source && ruleSelectoStore.ruleNode.source.start && ruleSelectoStore.ruleNode.source.start.column || 0;
            //   column = ruleSelectoStore.ruleNode.selector.indexOf(node.value || "") + column;
            //   ruleSelectoStore.xcInvalid = `Some selectors are not allowed in component wxss, including tag name selectors, ID selectors, and attribute selectors.(${store.template.path}:${line}:${column})`;
            // }
          }
        }
      } else {
        store.preFile = `${store.preFile}${node.value}`;
      }
    }
  } else if (node.type === "pseudo") {
    store.preFile = `${store.preFile}${node.value}`;
    if (node.first || node.last || node.nodes.length) {
      store.preFile = `${store.preFile}(`;
    }
    node.nodes.forEach((child, index) => {
      ruleSelectorWalker(child, store, ruleSelectoStore);
    });
    if (node.first || node.last || node.nodes.length) {
      store.preFile = `${store.preFile})`;
    }
  } else if (node.type === "universal") {
    store.preFile = `${store.preFile}${node.value}`;
  } else if (node.type === "combinator") {
    store.preFile = `${store.preFile}${node.value}`;
  }
};

const transformRuleSelector = (node: postcss.Rule, store: IPostcssWcssJsStore, ruleSelectoStore: IRuleSelectoStore) => {
  node.selectors.forEach((selector, selectorIndex) => {
    postcssSelectorParser((selectors: postcssSelectorParser.Root) => {
      ruleSelectorWalker(selectors, store, ruleSelectoStore);
    }).processSync(selector);
    if (selectorIndex < node.selectors.length - 1) {
      store.preFile = `${store.preFile}, `;
    }
    if (store.wcscjs.wcscError) {
      return;
    }
  });
};

const transformDeclValueWord = (node: Node, store: IPostcssWcssJsStore, declValueStore: IDeclValueStore) => {
  if (store.wcscjs.wcscError) {
    return;
  }
  if (declValueStore.keepDeclValueRpx) {
    store.preFile = `${store.preFile}${node.value}`;
  } else {
    const splitor = "-";
    const values = node.value.split(splitor);
    values.forEach((value, index) => {
      if (values.length > 1 && index > 0) {
        value = splitor + value;
      }
      const pair = postcssValueParser.unit(value);
      if (pair) {
        const num = Number(pair.number);
        const unit = pair.unit;
        if (unit === "rpx") {
          if (store.preFile) {
            store.file.push(store.preFile);
          }
          store.file.push([0, num]);
          store.preFile = ``;
          declValueStore.hasDeclValueRpx = true;
        } else {
          store.preFile = `${store.preFile}${value}`;
        }
      } else {
        store.preFile = `${store.preFile}${value}`;
      }
    });
  }
};

function isNetUrl(url: string) {
  let res = false;
  if (url[0] === "/" && url[1] === "/") {
    res = true;
  } else if (url[0] === "h" && url[1] === "t" && url[2] === "t" && url[3] === "p" && url[4] === ":" && url[5] === "/" && url[6] === "/") {
    res = true;
  } else if (url[0] === "h" && url[1] === "t" && url[2] === "t" && url[3] === "p" && url[4] === "s" && url[5] === ":" && url[6] === "/" && url[7] === "/") {
    res = true;
  } else if (url[0] === "d" && url[1] === "a" && url[2] === "t" && url[3] === "a") {
    res = true;
  }
  return res;
}

const transformDeclValueNodeWalker = (node: postcssValueParser.Node, store: IPostcssWcssJsStore, declValueStore: IDeclValueStore) => {
  if (store.wcscjs.wcscError) {
    return;
  }
  if (node.type === "word") {
    transformDeclValueWord(node, store, declValueStore);
  } else if (node.type === "string") {
    node.value = node.value.replace(/\\/g, "\\\\"); // 需要转义
    store.preFile = `${store.preFile}${node.quote}${node.value}${node.quote}`;
  } else if (node.type === "div") {
    store.preFile = `${store.preFile}${node.value}`;
  } else if (node.type === "comment") {
    // do nothing
  } else if (node.type === "function") {
    // handle function
    if (node.value === "url") {
      if (node.nodes) {
        store.preFile = `${store.preFile} ${node.value}(`;
        const urlNode = node.nodes[0];
        let url = urlNode.value;
        if (!isNetUrl(url) && !declValueStore.keepDeclValueRpx) {
          // do-not-use-local-path
          const between = declValueStore.delcNode.raws.between;
          const path = store.template.path;
          let line: number = 0;
          let column: number = 0;
          if (declValueStore.delcNode.source && declValueStore.delcNode.source.start) {
            line = declValueStore.delcNode.source.start.line;
            column = declValueStore.delcNode.source.start.column;
          }
          column = column + declValueStore.delcNode.prop.length;
          if (between) {
            for (let i = 0; i < between.length; ++i) {
              if (between[i] !== " ") {
                column += i + 1;
                break;
              }
            }
          }
          url = `${url}-do-not-use-local-path-${path}&${line}&${column}`;
        }
        store.preFile = `${store.preFile} ${(urlNode as postcssValueParser.StringNode).quote || ""}${url}${(urlNode as postcssValueParser.StringNode).quote || ""} )`;
      }
    } else {
      store.preFile = `${store.preFile} ${node.value}(`;
      if (node.nodes) {
        for (let i = 0; i < node.nodes.length; ++i) {
          const childNode = node.nodes[i];
          if (childNode.type === "space") {
            store.preFile = `${store.preFile} `;
            for (const j = i + 1; j < node.nodes.length; ++i) {
              if (node.nodes[j].type === "space") {
                i++;
              } else {
                break;
              }
            }
          } else {
            transformDeclValueNodeWalker(childNode, store, declValueStore);
          }
        }
      }
      store.preFile = `${store.preFile})`;
    }

  } else if (node.type === "space") {
    if (store.preFile[store.preFile.length - 1] !== " ") {
      store.preFile = `${store.preFile} `;
    }
  }
};

const transformDeclValue = (node: postcss.Declaration, store: IPostcssWcssJsStore, declValueStore: IDeclValueStore) => {
  if (store.wcscjs.wcscError) {
    return;
  }
  const root: ParsedValue = postcssValueParser(node.value);
  if (root.nodes) {
    for (let i = 0; i < root.nodes.length; ++i) {
      const childNode = root.nodes[i];
      if (childNode.type === "space") {
        store.preFile = `${store.preFile} `;
        for (const j = i + 1; j < root.nodes.length; ++i) {
          if (root.nodes[j].type === "space") {
            i++;
          } else {
            break;
          }
        }
      } else {
        transformDeclValueNodeWalker(childNode, store, declValueStore);
        if (store.wcscjs.wcscError) {
          return;
        }
      }
    }
  }
};

const postcssNodeWalker = (node: postcss.Node, store: IPostcssWcssJsStore) => {
  if (store.wcscjs.wcscError) {
    return;
  }
  if (node.type === "root") {
    if (node.nodes && node.nodes.length) {
      for (const childNode of node.nodes) {
        postcssNodeWalker(childNode, store);
      }
    }
  } else if (node.type === "rule") {
    const ruleSelectoStore: IRuleSelectoStore = {
      needAddOriginClass: false,
      ruleNode: node,
      xcInvalid: "",
    };
    transformRuleSelector(node, store, ruleSelectoStore);
    store.preFile = `${store.preFile}{`;
    if (node.nodes && node.nodes.length) {
      for (const childNode of node.nodes) {
        postcssNodeWalker(childNode, store);
      }
    }
    if (store.wcscjs.cmd.db) {
      if (!(store.insideAtrule && store.atruleName === "keyframes") && ruleSelectoStore.needAddOriginClass) {
        store.preFile = `${store.preFile} ;wxcs_originclass: ${node.selector};`; // 原始的selector
      }
      store.preFile = `${store.preFile} ;wxcs_fileinfo: ${store.template.path} ${node.source && node.source.start && node.source.start.line || 0} ${node.source && node.source.start && node.source.start.column || 0};`; // rule文件位置信息
    }
    store.preFile = `${store.preFile}}\n`;
    if (ruleSelectoStore.xcInvalid) {
      store.xcInvalid = ruleSelectoStore.xcInvalid;
    }
  } else if (node.type === "decl") {
    // 样式声明
    store.preFile = `${store.preFile}${node.prop}`;
    store.preFile = `${store.preFile}${node.raws.between || ": "}`;
    const declValueStore: IDeclValueStore = {
      delcNode: node,
      hasDeclValueRpx: false,
      keepDeclValueRpx: false,
    };
    transformDeclValue(node, store, declValueStore);
    if (node.important) {
      store.preFile = `${store.preFile} !important`;
    } else if (node.raws.important) {
      store.preFile = `${store.preFile} ${node.raws.important}`;
    }
    store.preFile = `${store.preFile};`;
    if (declValueStore.hasDeclValueRpx && store.wcscjs.cmd.db) {
      // 如果样式声明中有rpx，需要把rpx的原来定义再处理一次
      store.preFile = `${store.preFile};wxcs_style_${node.prop}`;
      store.preFile = `${store.preFile}: `;
      declValueStore.keepDeclValueRpx = true;
      transformDeclValue(node, store, declValueStore);
      if (node.important) {
        store.preFile = `${store.preFile} !important`;
      } else if (node.raws.important) {
        store.preFile = `${store.preFile} ${node.raws.important}`;
      }
      store.preFile = `${store.preFile};`;
    }
  } else if (node.type === "comment") {
    // 注释
  } else if (node.type === "atrule") {
    // @xxxxx
    if (node.name === "import") {
      const rawChildPath = util.handleImportPath(node.params, store.wcscjs);
      const realChildPath = util.getNormalizePath(store.template.path, rawChildPath);
      const childIdx = util.getArrIdx(store.wcscjs.templates, "path", realChildPath);
      if (childIdx === -1) {
        store.wcscjs.wcscError = {
          code: -1,
          message: `ERR: path \`${realChildPath}\` not found from \`${store.template.path}\`.`,
        };
        return;
      } else if (childIdx !== -1 && store.wcscjs.templates[childIdx].content) {
        // 如果被import的文件存在，并且有内容，才将被import的文件加到当前文件的依赖

        // 更新文件引用信息
        store.template.children.push({
          import: {
            end: {
              column: node.source && node.source.end && node.source.end.column || 0,
              line: node.source && node.source.end && node.source.end.line || 0,
            },
            raws: rawChildPath,
            start: {
              column: node.source && node.source.start && node.source.start.column || 0,
              line: node.source && node.source.start && node.source.start.line || 0,
            },
          },
          index: childIdx,
          path: realChildPath,
        });
        store.wcscjs.templates[childIdx].parents.push({
          index: store.templateIdx,
          path: store.template.path,
        });
        if (store.preFile) {
          store.file.push(store.preFile);
        }
        store.file.push([2, childIdx]); // 先把import节点的下标放进去，后面需要修正为comm中的下标
        store.preFile = ``;

      }
    } else {
      store.preFile = `${store.preFile}@${node.name} ${node.params}`;
      if (node.nodes && node.nodes.length) {
        store.preFile = `${store.preFile}{`;
        store.insideAtrule = true;
        store.atruleName = node.name;
        if (isKeyframes(node)) {
          store.atruleName = "keyframes";
        }
        for (const childNode of node.nodes) {
          postcssNodeWalker(childNode, store);
        }
        store.insideAtrule = false;
        store.atruleName = "";
        if (store.wcscjs.cmd.db) {
          store.preFile = `${store.preFile} ;wxcs_fileinfo: ${store.template.path} ${node.source && node.source.start && node.source.start.line || 0} ${node.source && node.source.start && node.source.start.column || 0};`; // atrule文件位置信息
        }
        store.preFile = `${store.preFile}}\n`;
      }
    }
  }
};

export function parseJs(template: ITemplate, idx: number, wcscjs: WCSC): Promise<string> {
  return new Promise((resolve, reject) => {
    if (template.content && template.content.trim()) {
      let root: postcss.Root;
      try {
        root = postcss.parse(template.content, { from: "/wcscjs.css" });
      } catch (err) {
        wcscjs.wcscError = {
          code: -1,
          message: "ERR: " + err.message.replace(/\/wcscjs\.css/, template.path),
        };
        reject(wcscjs.wcscError);
        return;
      }

      const store: IPostcssWcssJsStore = {
        atruleName: "",
        file: [],
        insideAtrule: false,
        preFile: ``,
        wcscjs,
        template,
        templateIdx: idx,
        xcInvalid: "",
      };
      postcssNodeWalker(root, store);
      if (wcscjs.wcscError) {
        reject(wcscjs.wcscError);
        return;
      }
      if (store.preFile) {
        store.file.push(store.preFile);
        store.preFile = "";
      }
      template.file = store.file;
      template.xcInvalid = store.xcInvalid;
      resolve();
    } else {
      // 没有文件内容，可能为空文件，或者为假的app.wxss
      resolve();
    }
  });
}
