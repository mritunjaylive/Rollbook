import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import * as api from "./api";
import type {
  ActivityKind,
  AttendanceStatus,
  CreditType,
  Snapshot,
} from "./types";
import { saveToOfflineQueue } from "../idb";

export const SNAPSHOT_KEY = ["rollbook-snapshot"] as const;

export function useSnapshot() {
  const { user, isPending } = useCurrentUserState();
  return useQuery({
    queryKey: SNAPSHOT_KEY,
    queryFn: () => api.getSnapshot(),
    enabled: !isPending && Boolean(user),
    staleTime: 10_000,
  });
}

export function selectActive(snapshot: Snapshot | undefined) {
  if (!snapshot) {
    return {
      semester: null,
      subjects: [],
      periods: [],
      attendance: [],
      credits: [],
      activities: [],
    };
  }
  const semester =
    snapshot.semesters.find((s) => s.isActive) ?? snapshot.semesters[0] ?? null;
  const subjects = semester
    ? snapshot.subjects.filter((s) => s.semesterId === semester.id)
    : [];
  const periods = semester
    ? snapshot.periods.filter((p) => p.semesterId === semester.id)
    : [];
  const subjectIds = new Set(subjects.map((s) => s.id));
  const periodIds = new Set(periods.map((p) => p.id));
  return {
    semester,
    subjects,
    periods,
    attendance: snapshot.attendance.filter((a) => periodIds.has(a.periodId)),
    credits: snapshot.credits.filter((c) => subjectIds.has(c.subjectId)),
    activities: snapshot.activities,
  };
}

export function useInvalidateSnapshot() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
}

export function useRollbookMutations() {
  const invalidate = useInvalidateSnapshot();

  const upsertProfile = useMutation({
    mutationFn: (data: {
      studentName: string;
      studentId: string;
      collegeName: string;
      thresholdPercent?: number;
    }) => api.upsertProfile({ data }),
    onSuccess: () => invalidate(),
  });

  const upsertSemester = useMutation({
    mutationFn: (data: {
      id?: string;
      courseName: string;
      semesterName: string;
      startDate?: string | null;
      makeActive?: boolean;
    }) => api.upsertSemester({ data }),
    onSuccess: () => invalidate(),
  });

  const setActiveSemester = useMutation({
    mutationFn: (id: string) => api.setActiveSemester({ data: { id } }),
    onSuccess: () => invalidate(),
  });

  const setSemesterClassesOver = useMutation({
    mutationFn: (data: { id: string; classesOver: boolean }) =>
      api.setSemesterClassesOver({ data }),
    onSuccess: () => invalidate(),
  });

  const upsertSubject = useMutation({
    mutationFn: (data: {
      id?: string;
      semesterId: string;
      name: string;
      code?: string | null;
      defaultTeacher?: string | null;
      description?: string | null;
    }) => api.upsertSubject({ data }),
    onSuccess: () => invalidate(),
  });

  const setSubjectClosed = useMutation({
    mutationFn: (data: { id: string; closed: boolean }) =>
      api.setSubjectClosed({ data }),
    onSuccess: () => invalidate(),
  });

  const deleteSubject = useMutation({
    mutationFn: (id: string) => api.deleteSubject({ data: { id } }),
    onSuccess: () => invalidate(),
  });

  const upsertPeriod = useMutation({
    mutationFn: (data: {
      id?: string;
      semesterId: string;
      subjectId: string;
      dayOfWeek: number;
      periodNumber: number;
      startTime: string;
      endTime: string;
      teacherName?: string;
    }) => api.upsertPeriod({ data }),
    onSuccess: () => invalidate(),
  });

  const deletePeriod = useMutation({
    mutationFn: (id: string) => api.deletePeriod({ data: { id } }),
    onSuccess: () => invalidate(),
  });

  const markAttendance = useMutation({
    mutationFn: async (data: {
      periodId: string;
      date: string;
      status: AttendanceStatus;
    }) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await saveToOfflineQueue({
          url: "/api/sync",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "markAttendance", data }),
        });
        if ("serviceWorker" in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            // @ts-expect-error sync is not strictly typed in standard lib
            if (reg.sync) await reg.sync.register("sync-attendance");
          } catch (e) {
            console.error("Failed to register sync", e);
          }
        }
        return null; // Optimistic return
      }
      return api.markAttendance({ data });
    },
    onSuccess: () => invalidate(),
  });

  const markDayStatus = useMutation({
    mutationFn: async (data: {
      date: string;
      status: AttendanceStatus;
      periodIds: string[];
    }) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await saveToOfflineQueue({
          url: "/api/sync",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "markDayStatus", data }),
        });
        if ("serviceWorker" in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            // @ts-expect-error sync is not strictly typed in standard lib
            if (reg.sync) await reg.sync.register("sync-attendance");
          } catch (e) {
            console.error("Failed to register sync", e);
          }
        }
        return null;
      }
      return api.markDayStatus({ data });
    },
    onSuccess: () => invalidate(),
  });

  const clearAttendance = useMutation({
    mutationFn: (data: { periodId: string; date: string }) =>
      api.clearAttendance({ data }),
    onSuccess: () => invalidate(),
  });

  const addCreditGrant = useMutation({
    mutationFn: (data: {
      subjectId: string;
      amount: number;
      type: CreditType;
      teacherName?: string;
      grantedOn: string;
      note?: string | null;
    }) => api.addCreditGrant({ data }),
    onSuccess: () => invalidate(),
  });

  const deleteCreditGrant = useMutation({
    mutationFn: (id: string) => api.deleteCreditGrant({ data: { id } }),
    onSuccess: () => invalidate(),
  });

  const upsertActivity = useMutation({
    mutationFn: (data: {
      id?: string;
      kind: ActivityKind;
      name: string;
      activityDate: string;
      startTime: string;
      endTime: string;
      description: string;
      credits: number | null;
    }) => api.upsertActivity({ data }),
    onSuccess: () => invalidate(),
  });

  const deleteActivity = useMutation({
    mutationFn: (id: string) => api.deleteActivity({ data: { id } }),
    onSuccess: () => invalidate(),
  });

  const importSnapshot = useMutation({
    mutationFn: (data: Snapshot & { version: 1 }) =>
      api.importSnapshot({ data }),
    onSuccess: () => invalidate(),
  });

  const archiveRoutine = useMutation({
    mutationFn: (data: { semesterId: string; newSemesterName: string }) =>
      api.archiveRoutine({ data }),
    onSuccess: () => invalidate(),
  });

  const upsertHoliday = useMutation({
    mutationFn: (data: {
      id?: string;
      name: string;
      startDate: string;
      endDate: string;
    }) => api.upsertHoliday({ data }),
    onSuccess: () => invalidate(),
  });

  const deleteHoliday = useMutation({
    mutationFn: (id: string) => api.deleteHoliday({ data: { id } }),
    onSuccess: () => invalidate(),
  });

  return {
    upsertProfile,
    upsertSemester,
    setActiveSemester,
    setSemesterClassesOver,
    upsertSubject,
    setSubjectClosed,
    deleteSubject,
    upsertPeriod,
    deletePeriod,
    markAttendance,
    markDayStatus,
    clearAttendance,
    addCreditGrant,
    deleteCreditGrant,
    upsertActivity,
    deleteActivity,
    importSnapshot,
    archiveRoutine,
    upsertHoliday,
    deleteHoliday,
  };
}
