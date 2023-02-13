import postcss from "../lib/postcss";
import postcssSelectorParser from "postcss-selector-parser";
import {ValueParser, ParsedValue, Node } from "../lib/postcss-value-parser";
import postcssValueParser = require("../lib/postcss-value-parser");
import { WCSC } from "./index";

const transformSelector = (selectors: postcssSelectorParser.Root) => {
  selectors.walkClasses((selector: postcssSelectorParser.Node) => {
    selector.replaceWith(postcssSelectorParser.className({value: `\x25\x25HERESUFFIX\x25\x25${selector.value}`}));
  });
  selectors.walkTags((tag: postcssSelectorParser.Node) => {
    tag.value = "wx-" + tag.value;
  });
};

const transformWord = (node: Node) => {
  const pair = postcssValueParser.unit(node.value);
  if (pair) {
    const num = Number(pair.number);
    const unit = pair.unit.toLowerCase();
    if (unit === "rpx") {
      node.value = `\x25\x25?${num + unit}?\x25\x25`;
    }
  }
};

const transformValue = (value: string): string => {
  const parseValueAst: ParsedValue = postcssValueParser(value);
  parseValueAst.walk((node) => {
    if (node.type === "word") {
      transformWord(node);
    } else if (node.type === "function") {
      if (node.value !== "url") {
        postcssValueParser.walk(node.nodes, (node: Node) => {
          if (node.type === "word") {
            transformWord(node);
          }
        });
      }
      return false;
    }
  });
  return parseValueAst.toString();
};

export interface IPluginOpts {
  wcscjs: WCSC;
  idx: number;
}

export const postcssWxss = postcss.plugin("postcss-wxss", (opts: IPluginOpts | undefined) => {
  return (root: postcss.Root, result: postcss.Result) => {
    const realOpts = opts as IPluginOpts;
    root.raws.after = "\n";
    root.walk((node: postcss.Node) => {

      if (node.type === "rule") {
        if (node.parent.first !== node) {
          node.raws.before = "\n";
        }
        node.raws.after = " ";
        node.selectors = node.selectors.map((selector) => {
          return postcssSelectorParser(transformSelector).processSync(selector);
        });
      } else if (node.type === "decl") {
        node.raws.before = " ";
        node.raws.between = ": ";
        node.value = transformValue(node.value);
      } else if (node.type === "comment") {
        node.remove();
      } else if (node.type === "atrule") {
        //
      }
    });

  };
});
