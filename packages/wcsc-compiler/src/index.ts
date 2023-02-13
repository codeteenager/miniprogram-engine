import * as parseCss from "./parseCss";
import * as util from "./util";
import {genCode} from "./codeGen";
import { WcscError } from "./error";
import * as path from "path";

interface IPackageJson {
  version: string;
}

let packageJson: IPackageJson;

try {
  packageJson = require("../package.json");
} catch (e) {
  packageJson = {
    version: "0.0.0",
  };
}

export interface IWCSCCompileConfig {
  cmd: string[];
  FILESBASE: string;
  FILES: string[];
}
export interface ICMD {
  cp: boolean;
  db: boolean;
  js: boolean;
  lc: boolean;
  o: boolean;
  om: boolean;
  pc: number;
  s: boolean;
  sd: boolean;
  st: boolean;
  subpackage: string;
}

export interface IChildNode {
  import: {
    start: {
      line: number;
      column: number;
    };
    end: {
      line: number;
      column: number;
    };
    raws: string;
  };
  index: number;
  path: string;
}

export interface IParentNode {
  index: number;
  path: string;
}

export interface ITemplate {
  path: string;
  content: string;
  children: IChildNode[];
  parents: IParentNode[];
  out: string;
  file: Array<string | number[]>;
  xcInvalid: string;
  key: string;
  comm: {
    needComm: boolean; // 是否需要把样式打包到comm
    commIndex: number; // 样式打包到comm的下标
  };
}

export interface IOutMap {
  [key: string]: string;
}
export class WCSC {
  public cmd: ICMD = {
    cp: false,
    db: false,
    js: false,
    lc: false,
    o: false,
    om: false,
    pc: 0,
    s: false,
    sd: false,
    st: false,
    subpackage: "",
  };
  public templates: ITemplate[] = [];
  public outString: string = "";
  public outMap: IOutMap = {};
  public version: string = `wcsc_v0.4me_20190304_db__wcscjs_${packageJson && packageJson.version || "0.0.0"}`;
  public comm: string = "";
  public wcscError: WcscError | undefined;
  public appWxssTemplateIndex: number = -1;
  public appWxssPath: string = "./app.wxss";
  public subpackageAppWxssTemplateIndex: number = -1;
  public subpackageAppWxssPath: string = "";
  private compileConfig: IWCSCCompileConfig;
  public constructor(compileConfig: IWCSCCompileConfig) {
    this.compileConfig = compileConfig;
    this.compileConfig.FILES.sort();
    this.parseCmd();
  }
  public compile(): Promise<string | IOutMap> {
    const wcscjs = this;
    return new Promise((resolve, reject) => {
      wcscjs.compileConfig.FILES.sort();
      wcscjs.appWxssTemplateIndex = wcscjs.compileConfig.FILES.indexOf(this.appWxssPath);
      wcscjs.subpackageAppWxssTemplateIndex = wcscjs.compileConfig.FILES.indexOf(this.subpackageAppWxssPath);
      wcscjs.compileConfig.FILES = wcscjs.compileConfig.FILES.slice(0, this.cmd.pc);
      if (wcscjs.appWxssTemplateIndex >= this.cmd.pc) {
        wcscjs.compileConfig.FILES.pop();
        wcscjs.compileConfig.FILES.unshift(this.appWxssPath);
      }
      if (wcscjs.subpackageAppWxssTemplateIndex >= this.cmd.pc) {
        wcscjs.compileConfig.FILES.pop();
        wcscjs.compileConfig.FILES.unshift(this.subpackageAppWxssPath);
      }
      if (wcscjs.cmd.subpackage) {
        wcscjs.subpackageAppWxssPath = "./" + path.posix.join(wcscjs.cmd.subpackage, "app.wxss");
      }

      util.getFileContent(this.compileConfig.FILES, this.compileConfig.FILESBASE).then((contents) => {
        wcscjs.compileConfig.FILES.forEach((FILE, idx) => {
          wcscjs.templates.push({
            children: [],
            comm: {
              commIndex: 0,
              needComm: true,
            },
            content: contents[idx].toString("utf8"),
            file: [],
            key: "",
            out: "",
            parents: [],
            path: FILE,
            xcInvalid: "",
          });
        });
        // app.wxss无论是否存在，都会生成目标代码，如果不存在，补充一个默认的
        if (wcscjs.appWxssTemplateIndex === -1) {
          wcscjs.templates.unshift({
            children: [],
            comm: {
              commIndex: 0,
              needComm: true,
            },
            content: "",
            file: [],
            key: "",
            out: "",
            parents: [],
            path: this.appWxssPath,
            xcInvalid: "",
          });
          wcscjs.appWxssTemplateIndex = 0;
        }
        // subpackage如果需要编译
        if (wcscjs.cmd.subpackage && wcscjs.subpackageAppWxssTemplateIndex === -1) {
          wcscjs.templates.unshift({
            children: [],
            comm: {
              commIndex: 0,
              needComm: true,
            },
            content: "",
            file: [],
            key: "",
            out: "",
            parents: [],
            path: this.subpackageAppWxssPath,
            xcInvalid: "",
          });
          wcscjs.subpackageAppWxssTemplateIndex = 0;
          if (wcscjs.appWxssTemplateIndex === 0) {
            wcscjs.appWxssTemplateIndex = 1;
          }
        }
        parseCss.parse(wcscjs).then(() => {
          if (wcscjs.wcscError) {
            reject(wcscjs.wcscError);
            return;
          }
          genCode(wcscjs).then(() => {
            if (wcscjs.wcscError) {
              reject(wcscjs.wcscError);
              return;
            }
            const templates = wcscjs.templates;
            if (wcscjs.cmd.om) {
              wcscjs.outMap.version = wcscjs.version;
              wcscjs.outMap.comm = wcscjs.comm;
              templates.forEach((template) => {
                wcscjs.outMap[template.path] = template.out;
              });
              resolve(wcscjs.outMap);
            } else {
              wcscjs.outString = `${wcscjs.outString}version=${wcscjs.version}`;
              wcscjs.outString = `${wcscjs.outString}=comm=${wcscjs.comm}`;
              templates.forEach((template) => {
                wcscjs.outString = `${wcscjs.outString}=${template.key}=${template.out}`;
              });
              resolve(wcscjs.outString);
            }
          }).catch((err) => {
            reject(err);
          });
        }).catch((err) => {
          reject(err);
        });
      }).catch((err: NodeJS.ErrnoException | null) => {
        if (err) {
          reject(err);
        }
      });
    });
  }
  private parseCmd() {
    const cmd: string[] = this.compileConfig.cmd;
    let idx: number = -1;
    // need to lint the css
    idx = cmd.indexOf("-lc");
    if (idx > -1) {
      this.cmd.lc = true;
    } else {
      this.cmd.lc = false;
    }
    // 'someclass { font-size: 18px }'
    idx = cmd.indexOf("-sd");
    if (idx > -1) {
      this.cmd.sd = true;
    } else {
      this.cmd.sd = false;
    }
    // read from stdin
    idx = cmd.indexOf("-s");
    if (idx > -1) {
      this.cmd.s = true;
    } else {
      this.cmd.s = false;
    }
    // output destination (default stdout)
    idx = cmd.indexOf("-o");
    if (idx > -1) {
      this.cmd.o = true;
    } else {
      this.cmd.o = false;
    }
    // output map else output string
    idx = cmd.indexOf("-om");
    if (idx > -1) {
      this.cmd.om = true;
    } else {
      this.cmd.om = false;
    }
    // print tree
    idx = cmd.indexOf("-st");
    if (idx > -1) {
      this.cmd.st = true;
    } else {
      this.cmd.st = false;
    }
    // add debug attr
    idx = cmd.indexOf("-db");
    if (idx > -1) {
      this.cmd.db = true;
    } else {
      this.cmd.db = false;
    }
    // js formate output
    idx = cmd.indexOf("-js");
    if (idx > -1) {
      this.cmd.js = true;
    } else {
      this.cmd.js = false;
    }
    // add class prefix
    idx = cmd.indexOf("-cp");
    if (idx > -1) {
      this.cmd.cp = true;
    } else {
      this.cmd.cp = false;
    }
    // page wxss files count
    idx = cmd.indexOf("-pc");
    if (idx > -1) {
      this.cmd.pc = parseInt(cmd[idx + 1], 10);
    } else {
      this.cmd.pc = 0;
    }
    // subpackage
    idx = cmd.indexOf("--subpackage");
    if (idx > -1) {
      this.cmd.subpackage = cmd[idx + 1];
    } else {
      this.cmd.subpackage = "";
    }

  }
}
