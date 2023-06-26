export interface Image2WordsRequest {
  content: string;
  language: string;
}

export type Image2WordsResponse = string[];

export interface Image2LinesRequest {
  content: string;
  language: string;
}

export type Image2LinesResponse = string[];

export interface HandwritingRequest {
  content: string;
  language: string;
}

export interface HandwritingResponse {
  text: string;
}

export interface SymbolLine {
  x: number;
  y: number;
  word: string;
}

export interface Pdf2LinesRequest {
  content: string;
  language: string;
}

export type Pdf2LinesResponse = string[];
