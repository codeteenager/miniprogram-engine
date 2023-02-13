import * as fs from "fs";
import * as path from "path";
import { WCSC } from "./index";

export function getFileContent(FILES: string[], FILESBASE: string): Promise<Buffer[]> {
  const promises: Array<Promise<Buffer>> = [];
  FILES.forEach((FILE: string) => {
    const promise: Promise<Buffer> = new Promise((resolve, reject) => {
      if (FILESBASE) {
        FILE = path.join(FILESBASE, FILE);
      }
      fs.readFile(FILE, (err: NodeJS.ErrnoException | null, data: Buffer) => {
        if (err) {
          return reject(err);
        } else {
          return resolve(data);
        }
      });
    });
    promises.push(promise);
  });
  return Promise.all(promises);
}

interface IItem {
  [key: string]: IItem | any;
}

export function getAndRemoveFromArr<T extends IItem, U>(arr: T[], key: string, val: U): T | void {
  let idx = -1;
  for (let i = 0; i < arr.length; ++i) {
    if (arr[i][key] === val) {
      idx = i;
      break;
    }
  }
  let res: T;
  if (idx !== -1) {
    res = arr[idx];
    arr.splice(idx, 1);
    return res;
  }
}

export function getArrIdx<T extends IItem, U>(arr: T[], key: string, val: U): number {
  let idx = -1;
  for (let i = 0; i < arr.length; ++i) {
    if (arr[i][key] === val) {
      idx = i;
      break;
    }
  }
  return idx;
}

export function unescape(str: string): string {
  const res: string[] = [];
  let idx: number = 0;
  while (idx < str.length) {
    if (str[idx] === "\\" && str[idx + 1] === "x") {
      if (str[idx + 2] === "2" && str[idx + 3] === "2") {
        res.push("\"");
        idx += 4;
      } else if (str[idx + 2] === "2" && str[idx + 3] === "6") {
        res.push("&");
        idx += 4;
      } else if (str[idx + 2] === "2" && str[idx + 3] === "7") {
        res.push("'");
        idx += 4;
      } else if (str[idx + 2] === "5" && str[idx + 3] === "c") {
        res.push("\\");
        idx += 4;
      } else if (str[idx + 2] === "3" && str[idx + 3] === "c") {
        res.push("<");
        idx += 4;
      } else if (str[idx + 2] === "3" && str[idx + 3] === "d") {
        res.push("=");
        idx += 4;
      } else if (str[idx + 2] === "3" && str[idx + 3] === "e") {
        res.push(">");
        idx += 4;
      } else {
        res.push(str[idx]);
        idx += 1;
      }
    } else if (str[idx] === "\\" && str[idx + 1] === "\\" && str[idx + 2] === "n") {
      res.push("\\n");
      idx += 3;
    } else if (str[idx] === "\\" && str[idx + 1] === "n") {
      res.push("\n");
      idx += 2;
    } else {
      res.push(str[idx]);
      idx += 1;
    }
  }
  return res.join("");
}

export function escape(str: string): string {
  const res: string[] = [];
  let idx: number = 0;
  while (idx < str.length) {
    if (str[idx] === "\\" && str[idx + 1] === "\n") {
      res.push("\\\\n");
      idx += 2;
    } else if (str[idx] === "\n") {
      res.push("\\n");
      idx += 1;
    } else if (str[idx] === "\"") {
      res.push("\\x22");
      idx += 1;
    } else if (str[idx] === "&") {
      res.push("\\x26");
      idx += 1;
    } else if (str[idx] === "'") {
      res.push("\\x27");
      idx += 1;
    } else if (str[idx] === "<") {
      res.push("\\x3c");
      idx += 1;
    } else if (str[idx] === "=") {
      res.push("\\x3d");
      idx += 1;
    } else if (str[idx] === ">") {
      res.push("\\x3e");
      idx += 1;
    } else if (str[idx] === "\\") {
      res.push("\\x5c");
      idx += 1;
    } else {
      res.push(str[idx]);
      idx += 1;
    }
  }
  return res.join("");
}

export function handleImportPath(path: string, wcscjs: WCSC) {
  path = path.trim();
  if (path[0] === "\"" && path[path.length - 1] === "\"") {
    path = path.slice(1, path.length - 1);
  } else if (path[0] === "\'" && path[path.length - 1] === "\'") {
    path = path.slice(1, path.length - 1);
  }
  return path;
}
/**
 * @description 获取当前路径path1下的相对路径path2的当前路径
 * @param path1 {string} 当前路径
 * @param path2 {string} 相对路径
 */
export function getNormalizePath(path1: string, path2: string): string {
  let path3 = "";
  if (path.posix.isAbsolute(path2)) {
    path3 = "." + path2;
  } else {
    path3 = path.posix.join(path.posix.dirname(path1), path2);
    path3 = `./${path3}`;
  }
  return path3;
}
