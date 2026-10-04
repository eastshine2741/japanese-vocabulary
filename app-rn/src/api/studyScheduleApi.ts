import client from './client';
import { StudyScheduleResponse } from '../types/studySchedule';

/** 스펙은 `docs/product-intents/261004-study-schedule-api.md`. */
export const studyScheduleApi = {
  async get(dailyTarget: number): Promise<StudyScheduleResponse> {
    const { data } = await client.get<StudyScheduleResponse>('/api/study-schedule', {
      params: { dailyTarget },
    });
    return data;
  },
};
