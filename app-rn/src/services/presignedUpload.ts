/** 서명된 URL 로 로컬 파일을 올린다. headers 는 서명에 들어가 있어 그대로 보내야 한다. */
export async function putToPresignedUrl(fileUri: string, uploadUrl: string, headers: Record<string, string>): Promise<void> {
  const body = await (await fetch(fileUri)).blob();
  // 공용 axios 를 쓰면 JWT·JSON 헤더가 붙어 서명이 깨진다.
  const res = await fetch(uploadUrl, { method: 'PUT', headers, body });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
}
