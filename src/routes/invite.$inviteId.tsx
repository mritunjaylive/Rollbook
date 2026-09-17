import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Import, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getSharedRoutinePreview, importSharedRoutine } from "@/lib/rollbook/api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/invite/$inviteId")({
  component: InvitePage,
});

function InvitePage() {
  const { inviteId } = Route.useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    courseName: string;
    semesterName: string;
    subjectCount: number;
    periodCount: number;
  } | null>(null);
  
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await getSharedRoutinePreview({ data: { id: inviteId } });
        setPreview(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invite.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [inviteId]);

  async function handleImport() {
    try {
      setImporting(true);
      await importSharedRoutine({ data: { id: inviteId } });
      toast.success("Routine imported successfully!");
      navigate({ to: "/timetable" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import routine. Make sure you are logged in.");
      // If error is related to auth, redirecting to login might be needed, but Better Auth handles this generally,
      // or we can show a specific message.
    } finally {
      setImporting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md pt-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid size-16 place-items-center rounded-full bg-accent/10 text-accent">
            <Import className="size-8" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Import Routine</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Someone shared a class timetable with you.
          </p>
        </div>

        <Card className="p-6">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-ink-faint">Loading invite details...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-warn">{error}</p>
              <Button variant="outline" onClick={() => navigate({ to: "/" })}>
                Go to Dashboard
              </Button>
            </div>
          ) : preview ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <span className="text-sm font-medium text-ink-soft">Course</span>
                  <span className="font-semibold">{preview.courseName}</span>
                </div>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <span className="text-sm font-medium text-ink-soft">Semester</span>
                  <span className="font-semibold">{preview.semesterName}</span>
                </div>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <span className="text-sm font-medium text-ink-soft">Subjects</span>
                  <span className="font-semibold">{preview.subjectCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-soft">Total Periods</span>
                  <span className="font-semibold">{preview.periodCount}</span>
                </div>
              </div>

              <div className="rounded-[var(--radius-md)] bg-blue-50 p-3 text-xs text-blue-800">
                <strong>Note:</strong> Importing this routine will archive your current active semester and set this one as active. Your past attendance records will remain safe.
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={importing}
                onClick={() => void handleImport()}
              >
                {importing ? "Importing..." : "Import Routine"}
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
