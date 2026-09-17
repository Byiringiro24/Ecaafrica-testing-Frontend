import { FormEvent, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bus, Calculator, Calendar, CheckCircle2, CircleDollarSign, FileText, Library, Smartphone, UsersRound } from "lucide-react";
import Layout from "./Layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitDemoRequest } from "@/lib/demoRequests";
import countries from "@/lib/countries.json";

type DemoFormState = {
  schoolName: string;
  country: string;
  contactName: string;
  jobTitle: string;
  phone: string;
  whatsapp: boolean;
  email: string;
  studentCount: string;
  teacherCount: string;
  staffCount: string;
  hasCurrentSystem: "yes" | "no";
  currentSoftware: string;
  modules: string[];
  preferredDate: string;
  preferredTime: string;
  additionalDetails: string;
  consent: boolean;
};

const MODULES = [
  { id: "attendance", label: "Attendance", icon: Calendar, color: "text-green-600" },
  { id: "fees", label: "Fees", icon: CircleDollarSign, color: "text-blue-600" },
  { id: "exams", label: "Exams", icon: FileText, color: "text-purple-600" },
  { id: "parent-app", label: "Parent App", icon: Smartphone, color: "text-emerald-600" },
  { id: "hr-payroll", label: "HR & Payroll", icon: UsersRound, color: "text-fuchsia-600" },
  { id: "transport", label: "Transport", icon: Bus, color: "text-orange-500" },
  { id: "library", label: "Library", icon: Library, color: "text-blue-500" },
  { id: "accounting", label: "Accounting", icon: Calculator, color: "text-slate-700" },
];

const initialState: DemoFormState = {
  schoolName: "",
  country: "",
  contactName: "",
  jobTitle: "",
  phone: "",
  whatsapp: true,
  email: "",
  studentCount: "",
  teacherCount: "",
  staffCount: "",
  hasCurrentSystem: "no",
  currentSoftware: "",
  modules: [],
  preferredDate: "",
  preferredTime: "",
  additionalDetails: "",
  consent: false,
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return /^\+?[0-9\s()-]{7,25}$/.test(value.trim());
}

export default function BookDemo() {
  const [form, setForm] = useState<DemoFormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const selectedCountry = countries.find((country) => country.isoAlpha2 === form.country);

  const handleChange = <K extends keyof DemoFormState>(field: K, value: DemoFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field as string];
      return next;
    });
  };

  const toggleModule = (id: string) => {
    setForm((current) => ({
      ...current,
      modules: current.modules.includes(id)
        ? current.modules.filter((moduleId) => moduleId !== id)
        : [...current.modules, id],
    }));
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.schoolName.trim()) nextErrors.schoolName = "School name is required.";
    if (!form.country.trim()) nextErrors.country = "Please select a country.";
    if (!form.contactName.trim()) nextErrors.contactName = "Contact person name is required.";
    if (!form.jobTitle.trim()) nextErrors.jobTitle = "Designation or job title is required.";
    if (!form.phone.trim()) nextErrors.phone = "Mobile number is required.";
    else if (!isValidPhone(form.phone)) nextErrors.phone = "Enter a valid phone number.";
    if (!form.email.trim()) nextErrors.email = "Email address is required.";
    else if (!isValidEmail(form.email)) nextErrors.email = "Enter a valid email address.";

    if (!form.studentCount.trim() || Number(form.studentCount) <= 0) nextErrors.studentCount = "Enter the number of students.";
    if (!form.teacherCount.trim() || Number(form.teacherCount) <= 0) nextErrors.teacherCount = "Enter the number of teachers.";
    if (!form.staffCount.trim() || Number(form.staffCount) < 0) nextErrors.staffCount = "Enter the number of office staff.";
    if (form.hasCurrentSystem === "yes" && !form.currentSoftware.trim()) {
      nextErrors.currentSoftware = "Please provide the current software name.";
    }

    if (!form.consent) nextErrors.consent = "You must agree to be contacted.";
    if (form.additionalDetails.length > 500) nextErrors.additionalDetails = "Keep this under 500 characters.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await submitDemoRequest({
        schoolName: form.schoolName.trim(),
        country: selectedCountry?.name || form.country,
        countryCode: selectedCountry?.isoAlpha2 || form.country,
        phoneCountryCode: selectedCountry?.phoneCode || "+250",
        contactName: form.contactName.trim(),
        jobTitle: form.jobTitle.trim(),
        phone: `${selectedCountry?.phoneCode || ""} ${form.phone.trim()}`.trim(),
        whatsapp: form.whatsapp,
        email: form.email.trim(),
        studentCount: Number(form.studentCount),
        teacherCount: Number(form.teacherCount),
        staffCount: Number(form.staffCount),
        hasCurrentSystem: form.hasCurrentSystem,
        currentSoftware: form.currentSoftware.trim(),
        modules: form.modules,
        preferredDate: form.preferredDate,
        preferredTime: form.preferredTime,
        additionalDetails: form.additionalDetails.trim(),
        consent: form.consent,
      });
      setIsSubmitted(true);
    } catch {
      setErrors({ form: "Unable to submit your request right now. Please try again later." });
    } finally {
      setSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Layout>
        <div className="w-full bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="rounded-4xl border border-slate-200 bg-white p-10 shadow-[0_35px_80px_-40px_rgba(10,61,145,0.25)] sm:p-12">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 mx-auto">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
              <div className="mt-8 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#0A3D91]">Request received</p>
                <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">Thank you! Your demo request is on its way.</h1>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  Our team will contact you shortly to schedule a personalized demo that matches your school’s needs.
                </p>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                <Button asChild className="h-14 rounded-xl bg-[#0A3D91] text-white hover:bg-[#0A3D91]/90">
                  <Link to="/">Return Home</Link>
                </Button>
                <Button asChild variant="outline" className="h-14 rounded-xl border-slate-200 text-slate-900 hover:bg-slate-50">
                  <Link to="/features">Explore Features</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="rounded-[40px] border border-slate-200 bg-white p-10 shadow-[0_35px_80px_-40px_rgba(10,61,145,0.12)]">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h1 className="text-4xl font-bold text-slate-900">Book a Free Demo</h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600">
                Fill in your details and our team will contact you shortly.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="schoolName">School Name</Label>
                  <Input id="schoolName" value={form.schoolName} onChange={(e) => handleChange("schoolName", e.target.value)} placeholder="Enter school name" />
                  {errors.schoolName && <p className="text-xs text-destructive">{errors.schoolName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <select
                    id="country"
                    value={form.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0A3D91] focus:ring-2 focus:ring-[#0A3D91]/10"
                  >
                    <option value="">Select your country</option>
                    {countries.map((country) => (
                      <option key={country.isoAlpha2} value={country.isoAlpha2}>
                        {country.name} ({country.phoneCode})
                      </option>
                    ))}
                  </select>
                  {selectedCountry && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <img src={`data:image/png;base64,${selectedCountry.flag}`} alt="" className="h-4 w-6 rounded-sm object-cover" />
                      {selectedCountry.name} · {selectedCountry.phoneCode}
                    </div>
                  )}
                  {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Person Name</Label>
                  <Input id="contactName" value={form.contactName} onChange={(e) => handleChange("contactName", e.target.value)} placeholder="Enter full name" />
                  {errors.contactName && <p className="text-xs text-destructive">{errors.contactName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Designation / Job Title</Label>
                  <Input id="jobTitle" value={form.jobTitle} onChange={(e) => handleChange("jobTitle", e.target.value)} placeholder="Enter designation" />
                  {errors.jobTitle && <p className="text-xs text-destructive">{errors.jobTitle}</p>}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile Number</Label>
                  <div className="flex overflow-hidden rounded-2xl border border-slate-200 focus-within:border-[#0A3D91] focus-within:ring-2 focus-within:ring-[#0A3D91]/10">
                    <div className="flex min-w-24 items-center gap-2 border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                      {selectedCountry && <img src={`data:image/png;base64,${selectedCountry.flag}`} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                      <span>{selectedCountry?.phoneCode || "+—"}</span>
                    </div>
                    <Input id="phone" type="tel" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="Enter mobile number" className="rounded-none border-0 focus-visible:ring-0" />
                  </div>
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="Enter email address" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="studentCount">Number of Students</Label>
                  <Input id="studentCount" type="number" min={0} value={form.studentCount} onChange={(e) => handleChange("studentCount", e.target.value)} placeholder="e.g. 500" />
                  {errors.studentCount && <p className="text-xs text-destructive">{errors.studentCount}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacherCount">Number of Teachers</Label>
                  <Input id="teacherCount" type="number" min={0} value={form.teacherCount} onChange={(e) => handleChange("teacherCount", e.target.value)} placeholder="e.g. 30" />
                  {errors.teacherCount && <p className="text-xs text-destructive">{errors.teacherCount}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staffCount">Number of Office Staff</Label>
                  <Input id="staffCount" type="number" min={0} value={form.staffCount} onChange={(e) => handleChange("staffCount", e.target.value)} placeholder="e.g. 10" />
                  {errors.staffCount && <p className="text-xs text-destructive">{errors.staffCount}</p>}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-900">Current School Management System?</Label>
                  <div className="flex gap-3">
                    <label className={`flex flex-1 cursor-pointer items-center justify-center rounded-2xl border p-4 text-sm transition ${form.hasCurrentSystem === "yes" ? "border-[#0A3D91] bg-[#0A3D91]/10" : "border-slate-200 bg-white"}`}>
                      <input type="radio" name="currentSystem" value="yes" checked={form.hasCurrentSystem === "yes"} onChange={() => handleChange("hasCurrentSystem", "yes")} className="h-4 w-4 text-[#0A3D91]" />
                      <span className="ml-2">Yes</span>
                    </label>
                    <label className={`flex flex-1 cursor-pointer items-center justify-center rounded-2xl border p-4 text-sm transition ${form.hasCurrentSystem === "no" ? "border-[#0A3D91] bg-[#0A3D91]/10" : "border-slate-200 bg-white"}`}>
                      <input type="radio" name="currentSystem" value="no" checked={form.hasCurrentSystem === "no"} onChange={() => handleChange("hasCurrentSystem", "no")} className="h-4 w-4 text-[#0A3D91]" />
                      <span className="ml-2">No</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentSoftware">Current Software Name</Label>
                  <Input
                    id="currentSoftware"
                    value={form.currentSoftware}
                    onChange={(e) => handleChange("currentSoftware", e.target.value)}
                    placeholder="Enter current software name"
                    disabled={form.hasCurrentSystem === "no"}
                  />
                  {errors.currentSoftware && <p className="text-xs text-destructive">{errors.currentSoftware}</p>}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-3">Interested Modules</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {MODULES.map((mod) => {
                      const selected = form.modules.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => toggleModule(mod.id)}
                          className={`flex items-center gap-3 rounded-2xl border p-3 text-sm transition ${selected ? "border-[#0A3D91] bg-[#0A3D91]/10" : "border-slate-200 bg-white hover:border-slate-300"}`}
                        >
                          <span className={`grid h-9 w-9 place-items-center rounded-2xl ${selected ? "bg-[#0A3D91] text-white" : "bg-slate-100 text-slate-500"}`}>
                            <mod.icon className={mod.color} />
                          </span>
                          <span>{mod.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="preferredDate">Preferred Demo Date</Label>
                    <Input id="preferredDate" type="date" value={form.preferredDate} onChange={(e) => handleChange("preferredDate", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferredTime">Preferred Demo Time</Label>
                    <select
                      id="preferredTime"
                      value={form.preferredTime}
                      onChange={(e) => handleChange("preferredTime", e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0A3D91] focus:ring-2 focus:ring-[#0A3D91]/10"
                    >
                      <option value="">Select time</option>
                      <option value="morning">Morning (9AM - 12PM)</option>
                      <option value="afternoon">Afternoon (1PM - 4PM)</option>
                      <option value="evening">Evening (4PM - 6PM)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="additionalDetails">Additional Requirements (Optional)</Label>
                  <Textarea
                    id="additionalDetails"
                    value={form.additionalDetails}
                    onChange={(e) => handleChange("additionalDetails", e.target.value)}
                    placeholder="Tell us more about your requirements..."
                    rows={5}
                    className="min-h-40 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-900"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Optional — up to 500 characters.</span>
                    <span>{form.additionalDetails.length}/500</span>
                  </div>
                  {errors.additionalDetails && <p className="text-xs text-destructive">{errors.additionalDetails}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="consent"
                    checked={form.consent}
                    onCheckedChange={(value) => handleChange("consent", value === true)}
                    className="rounded-sm"
                  />
                  <Label htmlFor="consent" className="text-sm text-slate-700">
                    I agree to be contacted regarding my demo request.
                  </Label>
                </div>
              </div>

              <div className="space-y-4">
                <Button type="submit" className="w-full h-14 rounded-2xl bg-[#0A3D91] text-white hover:bg-[#0A3D91]/90" disabled={submitting}>
                  {submitting ? "Submitting…" : "Book Free Demo"}
                </Button>
                <p className="text-center text-xs text-slate-500">We respect your privacy. Your information is safe with us.</p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
