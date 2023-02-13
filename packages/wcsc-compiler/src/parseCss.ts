import postcss from "../lib/postcss";
import { ITemplate, WCSC } from "./index";
import { postcssWxss } from "./postcss-wxss";
import { parseJs } from "./postcss-wxss-js";

export function parse(wcscjs: WCSC): Promise<string []> {
  const promises: Array<Promise<string>> = [];
  const templates = wcscjs.templates;

  templates.forEach((template, idx) => {
    const promise: Promise<string> = new Promise((resolve, reject) => {
      if (!wcscjs.cmd.pc) {
        postcss([postcssWxss({wcscjs, idx})]).process(template.content, { from: undefined, to: undefined }).then((result) => {
          template.out = result.css;
          resolve();
        }).catch((err) => {
          reject(err);
        });
      } else {
        parseJs(template, idx, wcscjs).then(() => {
          if (wcscjs.wcscError) {
            reject(wcscjs.wcscError);
          } else {
            resolve();
          }
        }).catch((err) => {
          reject(err);
        });
      }
    });
    promises.push(promise);
  });

  return Promise.all(promises);
}
