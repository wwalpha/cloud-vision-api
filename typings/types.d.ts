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
