import axios from 'axios';

// 同源部署（后端托管前端）时留空；前后端分离时通过 VITE_API_BASE_URL 指定后端地址
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export interface SearchCondition {
  field: string;
  operator: 'contains' | 'exact';
  value: string;
}

export interface SearchRequest {
  conditions: SearchCondition[];
  logic: 'AND' | 'OR';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  data: T[];
}

/** 获取可用字段列表（随数据文件变化自动适配） */
export const getFields = async (): Promise<string[]> => {
  const response = await axios.get<{ fields: string[] }>(`${BASE_URL}/fields`);
  return response.data.fields;
};

export type RecordItem = Record<string, string>;

export const search = async (request: SearchRequest): Promise<PaginatedResponse<RecordItem>> => {
  const response = await axios.post(`${BASE_URL}/search`, request);
  return response.data;
};

export const exportSearch = async (request: SearchRequest): Promise<Blob> => {
  const response = await axios.post(`${BASE_URL}/search/export`, request, {
    responseType: 'blob',
  });
  return response.data;
};

export type StatsRecord = { key: string; value: number } & Record<string, string>;

export interface StatsResponse extends PaginatedResponse<StatsRecord> {
  valueTotal: number;
}

const buildStatsParams = (fields: string[], page?: number, pageSize?: number) => {
  const params = new URLSearchParams();
  if (fields[0]) {
    params.set('field', fields[0]);
  }
  fields.forEach((f) => params.append('fields', f));
  if (page !== undefined) params.append('page', String(page));
  if (pageSize !== undefined) params.append('pageSize', String(pageSize));
  return params;
};

export const getStats = async (fields: string[], page?: number, pageSize?: number): Promise<StatsResponse> => {
  const response = await axios.get(`${BASE_URL}/stats`, {
    params: buildStatsParams(fields, page, pageSize),
  });
  return response.data;
};

export const exportStats = async (fields: string[]): Promise<Blob> => {
  const response = await axios.get(`${BASE_URL}/stats/export`, {
    params: buildStatsParams(fields),
    responseType: 'blob',
  });
  return response.data;
};

// 数据分析接口
export interface AnalyticsDataPoint {
  label: string;
  value: number;
}

export interface SankeyNode {
  name: string;
  raw: string;
  type: 'origin' | 'address';
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  origin: string;
  address: string;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface AnalyticsOverview {
  gender: AnalyticsDataPoint[];
  age: AnalyticsDataPoint[];
  origin: AnalyticsDataPoint[];
  address: AnalyticsDataPoint[];
  disease: AnalyticsDataPoint[];
  cemetery: AnalyticsDataPoint[];
  deathMonth: AnalyticsDataPoint[];
  deathDate: Record<string, AnalyticsDataPoint[]>;
  originAddressSankey: SankeyData;
  total: number;
  error?: string;
}

export const getAnalyticsOverview = async (): Promise<AnalyticsOverview> => {
  const response = await axios.get(`${BASE_URL}/analytics/overview`);
  return response.data;
};
