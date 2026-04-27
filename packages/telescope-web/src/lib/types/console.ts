export interface ConsoleLocation {
  url: string;
  lineNumber: number;
  columnNumber: number;
}

export interface ConsoleMessage {
  type: string;
  text: string;
  location: ConsoleLocation;
}
