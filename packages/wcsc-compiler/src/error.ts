export class WcscError {
  public code: number = 0;
  public message: string = "";
  public constructor(code: number, message: string) {
    this.code = code;
    this.message = message;
  }
}
