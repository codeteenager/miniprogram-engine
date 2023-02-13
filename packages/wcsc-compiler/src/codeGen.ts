import { WCSC } from "./index";
import { escape } from "./util";
import { WcscError } from "./error";
import * as util from "./util";

export function genCode(wcscjs: WCSC): Promise<string []> {
  return new Promise((resolve, reject) => {
    const rootNodes = findRootNodes(wcscjs);
    if (wcscjs.wcscError) {
      return reject(wcscjs.wcscError);
    }
    for (const root of rootNodes) {
      // app.wxss的样式默认打包到comm，其他的root模块都不打包到comm
      if (wcscjs.templates[root].path !== wcscjs.appWxssPath) {
        wcscjs.templates[root].comm.needComm = false;
      } else if (!wcscjs.templates[root].content || !wcscjs.templates[root].file) {
        // app.wxss如果没有内容，就不需要打包到comm，少一个坑
        wcscjs.templates[root].comm.needComm = false;
      }
    }
    genComm(wcscjs).then(() => {
      genTemplate(wcscjs).then(() => {
        resolve();
      }).catch((err) => {
        reject(err);
      });
    }).catch((err) => {
      reject(err);
    });

  });
}

function genComm(wcscjs: WCSC): Promise<string> {
  return new Promise((resolve, reject) => {
    let commIndex = 0;
    const templates = wcscjs.templates;
    // 更新comm中打包的下标
    templates.forEach((template, templateIndex) => {
      if (template.comm.needComm) {
        template.comm.commIndex = commIndex;
        commIndex ++;
      }
    });
    // 更新import的模块在comm中的下标
    templates.forEach((template) => {
      if (template.children.length) {
        for (const fileItem of template.file) {
          if (Object.prototype.toString.call(fileItem) === "[object Array]" && fileItem.length === 2 && fileItem[0] === 2) {
            const tmpIndex = fileItem[1] as number;
            (fileItem as number[])[1] = templates[tmpIndex].comm.commIndex;
          }
        }
      }
    });
    let _C = ``;
    templates.forEach((template) => {
      if (template.comm.needComm) {
        if (template.comm.commIndex === 0) {
          _C = `${_C}${JSON.stringify(template.file)}`;
        } else {
          _C = `${_C},${JSON.stringify(template.file)}`;
        }
      }
    });
    _C = `[${_C}]`;
    let commCode = (
`var BASE_DEVICE_WIDTH = 750;
var isIOS = navigator.userAgent.match("iPhone");
var deviceWidth = window.screen.width || 375;
var deviceDPR = window.devicePixelRatio || 2;
var checkDeviceWidth =
  window.__checkDeviceWidth__ ||
  function() {
    var newDeviceWidth = window.screen.width || 375;
    var newDeviceDPR = window.devicePixelRatio || 2;
    var newDeviceHeight = window.screen.height || 375;
    if (
      window.screen.orientation &&
      /^landscape/.test(window.screen.orientation.type || "")
    )
      newDeviceWidth = newDeviceHeight;
    if (newDeviceWidth !== deviceWidth || newDeviceDPR !== deviceDPR) {
      deviceWidth = newDeviceWidth;
      deviceDPR = newDeviceDPR;
    }
  };
checkDeviceWidth();
var eps = 1e-4;
var transformRPX =
  window.__transformRpx__ ||
  function(number, newDeviceWidth) {
    if (number === 0) return 0;
    number = (number / BASE_DEVICE_WIDTH) * (newDeviceWidth || deviceWidth);
    number = Math.floor(number + eps);
    if (number === 0) {
      if (deviceDPR === 1 || !isIOS) {
        return 1;
      } else {
        return 0.5;
      }
    }
    return number;
  };
var setCssToHead = function(file, _xcInvalid, info) {
  console.log("setCssToHead:", file, _xcInvalid, info);
  var Ca = {};
  var css_id;
  var info = info || {};
  var _C = ${_C};
  function makeup(file, opt) {
    var _n = typeof file === "number";
    if (_n && Ca.hasOwnProperty(file)) return "";
    if (_n) Ca[file] = 1;
    var ex = _n ? _C[file] : file;
    var res = "";
    for (var i = ex.length - 1; i >= 0; i--) {
      var content = ex[i];
      if (typeof content === "object") {
        var op = content[0];
        if (op == 0)
          res = transformRPX(content[1], opt.deviceWidth) + "px" + res;
        else if (op == 1) res = opt.suffix + res;
        else if (op == 2) res = makeup(content[1], opt) + res;
      } else res = content + res;
    }
    return res;
  }
  var rewritor = function(suffix, opt, style) {
    console.log("rewritor", "_xcInvalid:", _xcInvalid, "info:", info, "suffix:", suffix, "opt:", opt, "style:", style);
    opt = opt || {};
    suffix = suffix || "";
    opt.suffix = suffix;
    if (opt.allowIllegalSelector != undefined && _xcInvalid != undefined) {
      if (opt.allowIllegalSelector) console.warn("For developer:" + _xcInvalid);
      else {
        console.error(_xcInvalid + "This wxss file is ignored.");
        return;
      }
    }
    Ca = {};
    css = makeup(file, opt);
    if (!style) {
      var head = document.head || document.getElementsByTagName("head")[0];
      window.__rpxRecalculatingFuncs__ = window.__rpxRecalculatingFuncs__ || [];
      style = document.createElement("style");
      style.type = "text/css";
      style.setAttribute("wxss:path", info.path);
      head.appendChild(style);
      window.__rpxRecalculatingFuncs__.push(function(size) {
        opt.deviceWidth = size.width;
        rewritor(suffix, opt, style);
      });
    }
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      if (style.childNodes.length == 0)
        style.appendChild(document.createTextNode(css));
      else style.childNodes[0].nodeValue = css;
    }
  };
  return rewritor;
};
setCssToHead([])();`
    );
    if (wcscjs.cmd.subpackage) {
      const subpackageAppWxssTemplate = templates[wcscjs.subpackageAppWxssTemplateIndex];
      commCode = (
`${commCode}
setCssToHead(
  ${subpackageAppWxssTemplate.comm.needComm ? `[[2, ${subpackageAppWxssTemplate.comm.commIndex}]]` : JSON.stringify(subpackageAppWxssTemplate.file)},
  ${subpackageAppWxssTemplate.xcInvalid ? `"${subpackageAppWxssTemplate.xcInvalid}"` : "undefined"},
  { path: "${wcscjs.appWxssPath}" }
)();`);
    } else {
      const appWxssTemplate = templates[wcscjs.appWxssTemplateIndex];
      commCode = (
`${commCode}
setCssToHead(
  ${appWxssTemplate.comm.needComm ? `[[2, ${appWxssTemplate.comm.commIndex}]]` : JSON.stringify(appWxssTemplate.file)},
  ${appWxssTemplate.xcInvalid ? `"${appWxssTemplate.xcInvalid}"` : "undefined"},
  { path: "${wcscjs.appWxssPath}" }
)();`);
    }
    wcscjs.comm = escape(commCode);
    resolve();
  });
}

function genTemplate(wcscjs: WCSC): Promise<string> {
  return new Promise((resolve, reject) => {
    const templates = wcscjs.templates;
    templates.forEach((template) => {
      if (template.out) {
        return;
      }
      const templateCode = (
`setCssToHead(
  ${ template.comm.needComm ? `[[2, ${template.comm.commIndex}]]` : JSON.stringify(template.file)},
  ${template.xcInvalid ? `"${template.xcInvalid}"` : "undefined"},
  { path: "${template.path || "" }" }
)`
      );
      template.out = escape(templateCode);
      template.key = template.path;
    });
    resolve();
  });
}

interface IVisitMap {
  [key: string]: boolean;
}

function dfsNode(wcscjs: WCSC, path: number[], unvisited: number[], node: number) {
  if (path.indexOf(node) >= 0) {
    path.push(node);
    const pathName: string[] = [];
    path.forEach((templateIndex) => {
      pathName.push(wcscjs.templates[templateIndex].path);
    });
    wcscjs.wcscError = new WcscError(-1, "ERR: exist cycle import " + pathName.join("->"));
    path.pop();
    return;
  }
  path.push(node);
  const unvisitedIdx = unvisited.indexOf(node);
  if (unvisitedIdx !== -1) {
    unvisited.splice(unvisitedIdx, 1);
  }
  const template = wcscjs.templates[node];
  for (const child of template.children) {
    dfsNode(wcscjs, path, unvisited, child.index);
    if (wcscjs.wcscError) {
      return;
    }
  }
  path.pop();
}

function findRootNodes(wcscjs: WCSC): number[] {
  const templates = wcscjs.templates;
  const unvisited: number[] = [];
  const rootNodes: number[] = [];
  for (let i = 0; i < templates.length; ++i) {
    unvisited.push(i);
    if (templates[i].parents.length === 0) {
      rootNodes.push(i);
    }
  }

  for (const root of rootNodes) {
    dfsNode(wcscjs, [], unvisited, root);
    if (wcscjs.wcscError) {
      return [];
    }
  }

  while (unvisited.length) {
    dfsNode(wcscjs, [], unvisited, unvisited[0]);
    if (wcscjs.wcscError) {
      return [];
    }
  }
  return rootNodes;
}
