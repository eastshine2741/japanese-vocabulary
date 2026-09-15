import client from './client';
import { DeviceInfo } from '../utils/deviceInfo';

export interface CreateVocPayload extends DeviceInfo {
  content: string;
}

export interface CreateVocResponse {
  issueNumber: number;
  issueUrl: string;
}

export const vocApi = {
  async create(payload: CreateVocPayload): Promise<CreateVocResponse> {
    const { data } = await client.post<CreateVocResponse>('/api/voc', payload);
    return data;
  },
};
