/**
 * @architecture arch.native.protocol
 * @implements RESP-NATIVE-PROTOCOL
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { WwwApi } from "./shared";

const SessionApiContext = createContext<{ id: string; api: WwwApi } | null>(null);

/** 선택 인자가 없는 조회도 해당 탭에 묶고 다른 탭의 사건은 전달하지 않는다. */
export function SessionApiProvider({ id, children }: { id: string; children: ReactNode }) {
  const value = useMemo(() => {
    const base = window.www;
    const api: WwwApi = {
      ...base,
      steerTurn: (selection, threadId, turnId, text, messageId) => {
        if (selection.sessionId !== id) return Promise.reject(new Error("다른 대화 탭의 요청입니다."));
        return base.steerTurn(selection, threadId, turnId, text, messageId);
      },
      openExternal: (url) => base.openExternal(url, id),
      workspace: () => base.workspace(id),
      developmentPolicy: () => base.developmentPolicy(id),
      developmentStatus: (workId) => base.developmentStatus(workId, id),
      completeDevelopmentWork: (workId) => base.completeDevelopmentWork(workId, id),
      listReports: () => base.listReports(id),
      readReport: (reportId) => base.readReport(reportId, id),
      chooseReportRepository: () => base.chooseReportRepository(id),
      exportReport: (reportId) => base.exportReport(reportId, id),
      nativeReportStatus: () => base.nativeReportStatus(id),
      setNativeReportEnabled: (enabled) => base.setNativeReportEnabled(enabled, id),
      retryNativeReport: (key) => base.retryNativeReport(key, id),
      onEvent: (listener) => base.onEvent((event) => { if (event.sessionId === id) listener(event); }),
      onActivityResources: (listener) => base.onActivityResources((snapshot) => { if (snapshot.sessionId === id) listener(snapshot); }),
    };
    return { id, api };
  }, [id]);
  return <SessionApiContext.Provider value={value}>{children}</SessionApiContext.Provider>;
}

export function useSessionApi(): WwwApi {
  const context = useContext(SessionApiContext);
  if (context) return context.api;
  if (typeof window !== "undefined" && window.www) return window.www;
  throw new Error("대화 탭의 API 연결이 필요합니다.");
}

export function useSessionId(): string {
  return useContext(SessionApiContext)?.id ?? "default";
}
