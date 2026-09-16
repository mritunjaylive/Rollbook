import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import * as api from "./api";
import type {
  AttendanceStatus,
  CreditType,
  Snapshot,
} from "./types";

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
    mutationFn: (data: {
      periodId: string;
      date: string;
      status: AttendanceStatus;
    }) => api.markAttendance({ data }),
    onSuccess: () => invalidate(),
  });

  const markDayStatus = useMutation({
    mutationFn: (data: {
      date: string;
      status: AttendanceStatus;
      periodIds: string[];
    }) => api.markDayStatus({ data }),
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

  const importSnapshot = useMutation({
    mutationFn: (data: Snapshot & { version: 1 }) =>
      api.importSnapshot({ data }),
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
    importSnapshot,
  };
}
