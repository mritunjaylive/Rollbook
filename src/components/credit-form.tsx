import { useState } from "react";
import { CREDIT_TYPES } from "@/lib/rollbook/days";
import type { CreditType, Subject } from "@/lib/rollbook/types";
import { localISODate } from "@/lib/utils";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/input";

export function CreditForm({
  subject,
  onSubmit,
  busy,
}: {
  subject: Subject;
  onSubmit: (data: {
    amount: number;
    type: CreditType;
    teacherName: string;
    grantedOn: string;
    note: string;
  }) => void;
  busy?: boolean;
}) {
  const [amount, setAmount] = useState(1);
  const [type, setType] = useState<CreditType>("assignment");
  const [teacherName, setTeacherName] = useState(subject.defaultTeacher ?? "");
  const [grantedOn, setGrantedOn] = useState(localISODate());
  const [note, setNote] = useState("");

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          amount,
          type,
          teacherName,
          grantedOn,
          note,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Classes granted">
          <Input
            type="number"
            min={1}
            max={40}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 1)}
          />
        </Field>
        <Field label="Type">
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as CreditType)}
          >
            {CREDIT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Teacher">
        <Input
          value={teacherName}
          onChange={(e) => setTeacherName(e.target.value)}
          placeholder="Who accepted the makeup"
        />
      </Field>
      <Field label="Date granted">
        <Input
          type="date"
          value={grantedOn}
          onChange={(e) => setGrantedOn(e.target.value)}
        />
      </Field>
      <Field label="Note (optional)">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Assignment title, topic of notes…"
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Add credit"}
      </Button>
    </form>
  );
}
