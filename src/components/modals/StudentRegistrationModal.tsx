import { useEffect, useRef, useState } from "react";
import { X, Check, ChevronRight, ChevronLeft, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiRequest, API_BASE_URL } from "@/lib/api";
import { SaPhoneInput } from "@/components/super-admin/ui";
import { useSchoolCountryName } from "@/hooks/useSchoolCountry";
import { parsePhoneValue } from "@/lib/countries";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Section = { id: string; name: string; full_name: string };
type AcademicYear = { id: string; name: string; is_current: boolean; start_date: string; end_date: string };

interface FormData {
  studentIdNumber: string;
  firstName: string;
  lastName: string;
  residency: string;
  dob: string;
  gender: string;
  academicYearId: string;
  sectionId: string;
  sectionName: string;
  combination: string;
  year: string;
  religion: string;
  bloodGroup: string;
  previousSchool: string;
  parentFirstName: string;
  parentLastName: string;
  relationship: string;
  parentPhone: string;
  parentPhone2: string;
  email: string;
  address: string;
  parentOccupation: string;
  parentNationalId: string;
}

const EMPTY: FormData = {
  studentIdNumber: "", firstName: "", lastName: "", residency: "Day", dob: "", gender: "Male",
  academicYearId: "", sectionId: "", sectionName: "", combination: "",
  year: new Date().getFullYear().toString(),
  religion: "", bloodGroup: "", previousSchool: "",
  parentFirstName: "", parentLastName: "", relationship: "Father", parentPhone: "",
  parentPhone2: "", email: "", address: "",
  parentOccupation: "", parentNationalId: "",
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const STEPS = ["Student Info", "Parent Info", "Review"];
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const SUPPORTED_IMAGE_TEXT = "JPG, PNG or WEBP";

const isSupportedImageFile = (file?: File | null) => {
  if (!file) return false;
  const mime = file.type?.toLowerCase();
  const name = file.name?.toLowerCase() ?? "";
  return SUPPORTED_IMAGE_TYPES.includes(mime as typeof SUPPORTED_IMAGE_TYPES[number]) ||
    [".jpg", ".jpeg", ".png", ".webp"].some((ext) => name.endsWith(ext));
};

export function StudentRegistrationModal({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const schoolCountry = useSchoolCountryName();

  useEffect(() => {
    if (!open) return;
    setRefDataLoading(true);
    Promise.all([
      apiRequest<Section[]>("/sections?limit=1000", { auth: "school" }).catch(() => [] as Section[]),
      apiRequest<AcademicYear[]>("/academic-years?limit=100", { auth: "school" }).catch(() => [] as AcademicYear[]),
    ]).then(([secs, years]) => {
      setSections(Array.isArray(secs) ? secs : []);
      const yearsArr = Array.isArray(years) ? years : [];
      setAcademicYears(yearsArr);
      // auto-select the current academic year
      const current = yearsArr.find(y => y.is_current) ?? yearsArr[0];
      if (current) {
        setData(prev => ({ ...prev, academicYearId: current.id }));
      }
    }).finally(() => setRefDataLoading(false));
  }, [open]);

  if (!open) return null;

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setData(p => ({ ...p, [k]: v }));

  const handleSectionChange = (id: string) => {
    const sec = sections.find(s => s.id === id);
    set("sectionId", id);
    set("sectionName", sec?.full_name ?? "");
    if (sec && !["S4", "S5", "S6"].some(l => sec.full_name.startsWith(l))) {
      set("combination", "");
    }
  };

  const validateStep = () => {
    const e: typeof errors = {};
    if (step === 0) {
      if (!data.studentIdNumber.trim()) e.studentIdNumber = true;
      if (!data.firstName.trim()) e.firstName = true;
      if (!data.lastName.trim()) e.lastName = true;
      if (!data.residency) e.residency = true;
      if (!data.dob) e.dob = true;
      if (!data.sectionId) e.sectionId = true;
      if (!data.year) e.year = true;
    }
    if (step === 1) {
      if (!data.parentFirstName.trim()) e.parentFirstName = true;
      if (!data.parentLastName.trim()) e.parentLastName = true;
      if (parsePhoneValue(data.parentPhone).nationalNumber.length !== 9) e.parentPhone = true;
      if (data.parentPhone2.trim() && parsePhoneValue(data.parentPhone2).nationalNumber.length !== 9) {
        e.parentPhone2 = true;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep(s => Math.min(2, s + 1)); };
  const back = () => setStep(s => Math.max(0, s - 1));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSupportedImageFile(file)) {
      toast.error(`Unsupported image format. Please upload ${SUPPORTED_IMAGE_TEXT} files only.`);
      e.target.value = "";
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      // 1. Create student
      const student = await apiRequest<{ id: string }>("/students", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          student_id_number: data.studentIdNumber.trim(),
          date_of_birth: data.dob || undefined,
          gender: data.gender.toLowerCase(),
          student_type: data.residency.toLowerCase(),
          combination: data.combination || undefined,
          enrollment_year: parseInt(data.year, 10),
          religion: data.religion || undefined,
          blood_group: data.bloodGroup || undefined,
          previous_school: data.previousSchool || undefined,
        }),
      });

      // 2. Upload photo if provided
      if (photoFile) {
        try {
          const fd = new FormData();
          fd.append("photo", photoFile);
          await apiRequest(`/students/${student.id}/photo`, {
            method: "POST",
            auth: "school",
            body: fd,
          });
        } catch {
          toast.warning("Student registered but photo upload failed");
        }
      }

      // 3. Enroll in section (class) if both section and academic year are selected
      if (data.sectionId && data.academicYearId) {
        await apiRequest(`/students/${student.id}/enrollments`, {
          method: "POST",
          auth: "school",
          body: JSON.stringify({
            section_id: data.sectionId,
            academic_year_id: data.academicYearId,
            enrolled_at: new Date().toISOString().split("T")[0],
          }),
        });
      }

      // 4. Create parent and link if info provided
      if (data.parentFirstName.trim() && data.parentLastName.trim() && data.parentPhone.trim()) {
        const parent = await apiRequest<{ id: string }>("/parents", {
          method: "POST",
          auth: "school",
          body: JSON.stringify({
            first_name: data.parentFirstName.trim(),
            last_name: data.parentLastName.trim(),
            phone: data.parentPhone,
            phone_alt: data.parentPhone2 || undefined,
            email: data.email || undefined,
            national_id: data.parentNationalId || undefined,
            relationship: data.relationship,
            occupation: data.parentOccupation || undefined,
            address: data.address || undefined,
          }),
        });

        await apiRequest(`/students/${student.id}/parents`, {
          method: "POST",
          auth: "school",
          body: JSON.stringify({ parent_id: parent.id, is_primary: true }),
        });
      }

      toast.success(`${data.firstName} ${data.lastName}`.trim() + " registered successfully");
      setData(EMPTY);
      setStep(0);
      clearPhoto();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to register student");
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    if (submitting) return;
    setData(EMPTY); setStep(0); setErrors({}); clearPhoto(); onClose();
  };

  const showCombination = ["S4", "S5", "S6"].some(l => data.sectionName.startsWith(l));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl max-h-[90vh] flex flex-col">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-bold">Register New Student</h2>
          <button onClick={close} disabled={submitting} className="rounded-md p-1.5 hover:bg-muted disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* steps */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div className={cn(
                  "grid h-8 w-8 place-items-center rounded-full text-xs font-bold shrink-0",
                  i < step ? "bg-success text-success-foreground" :
                  i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-xs font-semibold", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-0.5 flex-1", i < step ? "bg-success" : "bg-border")} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {step === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Student ID Number *" required error={errors.studentIdNumber}>
                <input value={data.studentIdNumber} onChange={e => set("studentIdNumber", e.target.value)}
                  className={inputCls(errors.studentIdNumber, true)} placeholder="e.g. 2024001" />
              </Field>
              <Field label="First Name *" required error={errors.firstName}>
                <input value={data.firstName} onChange={e => set("firstName", e.target.value)}
                  className={inputCls(errors.firstName, true)} placeholder="e.g. Uwimana" />
              </Field>
              <Field label="Last Name *" required error={errors.lastName}>
                <input value={data.lastName} onChange={e => set("lastName", e.target.value)}
                  className={inputCls(errors.lastName, true)} placeholder="e.g. Marie" />
              </Field>
              <Field label="Date of Birth *" required error={errors.dob}>
                <input type="date" value={data.dob} onChange={e => set("dob", e.target.value)} className={inputCls(errors.dob, true)} />
              </Field>
              <Field label="Gender">
                <div className="flex gap-3 h-10 items-center">
                  {["Male", "Female"].map(g => (
                    <label key={g} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={data.gender === g} onChange={() => set("gender", g)} className="accent-primary" />
                      {g}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Boarding / Day scholar *" required error={errors.residency}>
                <select value={data.residency} onChange={e => set("residency", e.target.value)} className={inputCls(errors.residency, true)}>
                  <option value="Day">Day scholar</option>
                  <option value="Boarding">Boarding Student</option>
                </select>
              </Field>
              <Field label="Academic Year">
                <select
                  value={data.academicYearId}
                  onChange={e => set("academicYearId", e.target.value)}
                  className={inputCls()}
                  disabled={refDataLoading}
                >
                  <option value="">
                    {refDataLoading ? "Loading…" : academicYears.length === 0 ? "No academic years found" : "Select year…"}
                  </option>
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>
                      {y.name}{y.is_current ? " (Current)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Class *" required error={errors.sectionId}>
                <select
                  value={data.sectionId}
                  onChange={e => handleSectionChange(e.target.value)}
                  className={inputCls(errors.sectionId, true)}
                  disabled={refDataLoading}
                >
                  <option value="">
                    {refDataLoading ? "Loading classes…" : sections.length === 0 ? "No classes found" : "Select class…"}
                  </option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </Field>
              {showCombination && (
                <Field label="Combination (optional)">
                  <select value={data.combination} onChange={e => set("combination", e.target.value)} className={inputCls()}>
                    <option value="">Select…</option>
                    {["PCM", "PCB", "MCB", "HEG", "MEG", "MPC", "HGL"].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Year of Enrollment *" required error={errors.year}>
                <select value={data.year} onChange={e => set("year", e.target.value)} className={inputCls(errors.year, true)}>
                  {["2022", "2023", "2024", "2025", "2026"].map(y => <option key={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="Blood Group">
                <select value={data.bloodGroup} onChange={e => set("bloodGroup", e.target.value)} className={inputCls()}>
                  <option value="">Select…</option>
                  {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Religion (optional)">
                <input value={data.religion} onChange={e => set("religion", e.target.value)}
                  className={inputCls()} placeholder="e.g. Catholic" />
              </Field>
              <Field label="Previous School (optional)" className="sm:col-span-2">
                <input value={data.previousSchool} onChange={e => set("previousSchool", e.target.value)}
                  className={inputCls()} placeholder="e.g. GS Kicukiro" />
              </Field>
              {/* Photo upload — optional */}
              <div className="sm:col-span-2">
                <span className="text-xs font-semibold mb-1.5 block text-foreground">
                  Student Photo <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <div className="flex items-center gap-4">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="h-16 w-16 rounded-full object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-muted border border-dashed border-border grid place-items-center shrink-0">
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="h-9 px-4 rounded-lg border border-border text-sm font-semibold hover:bg-muted"
                    >
                      {photoPreview ? "Change photo" : "Upload photo"}
                    </button>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={clearPhoto}
                        className="text-xs text-destructive hover:underline text-left"
                      >
                        Remove
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">{SUPPORTED_IMAGE_TEXT} — max 5 MB</p>
                  </div>
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Parent First Name *" required error={errors.parentFirstName}>
                <input value={data.parentFirstName} onChange={e => set("parentFirstName", e.target.value)}
                  className={inputCls(errors.parentFirstName, true)} placeholder="e.g. Jean" />
              </Field>
              <Field label="Parent Last Name *" required error={errors.parentLastName}>
                <input value={data.parentLastName} onChange={e => set("parentLastName", e.target.value)}
                  className={inputCls(errors.parentLastName, true)} placeholder="e.g. Habimana" />
              </Field>
              <Field label="Relationship">
                <select value={data.relationship} onChange={e => set("relationship", e.target.value)} className={inputCls()}>
                  {["Father", "Mother", "Guardian"].map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Occupation">
                <input value={data.parentOccupation} onChange={e => set("parentOccupation", e.target.value)}
                  className={inputCls()} placeholder="e.g. Nurse" />
              </Field>
              <Field label="National ID">
                <input value={data.parentNationalId} onChange={e => set("parentNationalId", e.target.value)}
                  className={inputCls()} placeholder="1199…" />
              </Field>
              <SaPhoneInput
                label="Primary Phone (SMS) *"
                value={data.parentPhone}
                onChange={(v) => set("parentPhone", v)}
                defaultCountryName={schoolCountry ?? undefined}
                error={!!errors.parentPhone}
                required
                className="sm:col-span-2"
              />
              <SaPhoneInput
                label="Secondary Phone"
                value={data.parentPhone2}
                onChange={(v) => set("parentPhone2", v)}
                defaultCountryName={schoolCountry ?? undefined}
                error={!!errors.parentPhone2}
                className="sm:col-span-2"
              />
              <Field label="Email">
                <input type="email" value={data.email} onChange={e => set("email", e.target.value)}
                  className={inputCls()} placeholder="parent@example.com" />
              </Field>
              <Field label="Home Address / District">
                <input value={data.address} onChange={e => set("address", e.target.value)}
                  className={inputCls()} placeholder="e.g. Kicukiro, Kigali" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <ReviewBlock title="Student Information" rows={[
                ["Student ID", data.studentIdNumber || "—"],
                ["First Name", data.firstName],
                ["Last Name", data.lastName],
                ["Residency", data.residency],
                ["Date of Birth", data.dob],
                ["Gender", data.gender],
                ["Academic Year", academicYears.find(y => y.id === data.academicYearId)?.name || "—"],
                ["Class", data.sectionName || "—"],
                ...(showCombination ? [["Combination", data.combination || "—"] as [string, string]] : []),
                ["Year of Enrollment", data.year],
                ["Blood Group", data.bloodGroup || "—"],
                ["Religion", data.religion || "—"],
                ["Previous School", data.previousSchool || "—"],
              ]} />
              <ReviewBlock title="Parent / Guardian" rows={[
                ["First Name", data.parentFirstName],
                ["Last Name", data.parentLastName],
                ["Relationship", data.relationship],
                ["Occupation", data.parentOccupation || "—"],
                ["National ID", data.parentNationalId || "—"],
                ["Primary Phone", data.parentPhone],
                ["Secondary Phone", data.parentPhone2 || "—"],
                ["Email", data.email || "—"],
                ["Address", data.address || "—"],
              ]} />
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <button
            onClick={step === 0 ? close : back}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < 2 ? (
            <button onClick={next}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => void submit()} disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success px-5 py-2 text-sm font-semibold text-success-foreground hover:opacity-90 disabled:opacity-60">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting ? "Registering…" : "Register Student"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function inputCls(error?: boolean, required = false) {
  return cn(
    "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30",
    error ? "border-destructive" : required ? "border-orange-400 bg-orange-50/30" : "border-border"
  );
}

function Field({
  label, error, required, className, children,
}: {
  label: string; error?: boolean; required?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className={cn("text-xs font-semibold mb-1.5 block", error ? "text-destructive" : required ? "text-orange-700" : "text-foreground")}>
        {label}
      </span>
      {children}
    </label>
  );
}

function ReviewBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h4 className="font-display font-bold text-sm mb-3">{title}</h4>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
