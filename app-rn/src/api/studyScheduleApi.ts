import client from './client';
import { StudyScheduleResponse } from '../types/studySchedule';

/** 오늘의 복습 스케줄과 1년 기억 단어 수 예보. */
export const studyScheduleApi = {
  async get(): Promise<StudyScheduleResponse> {
    const { data } = await client.get<StudyScheduleResponse>('/api/study-schedule');
    return data;
  },
};
