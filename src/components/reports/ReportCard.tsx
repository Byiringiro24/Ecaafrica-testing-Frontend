import {
  resolveLogoUrl,
  type ReportCardSchool,
  type ReportCardStudent,
  type ReportCardSubject,
  type ReportCardTerm,
} from "@/lib/report-cards-api";

interface ReportCardProps {
  school: ReportCardSchool;
  term: ReportCardTerm;
  student: ReportCardStudent;
  subjects: ReportCardSubject[];
  preparedBy: string | null;
  issuedOn: string;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const cell = "border border-black px-2 py-1 align-middle";

export function ReportCard({
  school,
  term,
  student,
  subjects,
  preparedBy,
  issuedOn,
}: ReportCardProps) {
  const logo = resolveLogoUrl(school.logo_url);
  const title = `${term.name} Assessment Report${term.academic_year ? ` ${term.academic_year}` : ""}`;

  return (
    <div className="report-card mx-auto w-full max-w-[820px] bg-white p-6 text-black">
      <div className="border border-black">
        <div className="flex items-center justify-between gap-4 border-b border-black px-4 py-3">
          <div className="flex-1 text-center">
            <h2 className="text-lg font-bold underline">{title}</h2>
            <div className="text-xs text-gray-600 mt-0.5">{school.name}</div>
          </div>
          {logo ? (
            <img src={logo} alt={school.name} className="h-12 w-auto object-contain" />
          ) : (
            <span className="text-sm font-semibold">{school.name}</span>
          )}
        </div>

        <div className="grid grid-cols-2">
          <div className="border-b border-r border-black px-3 py-2 text-sm font-semibold underline">
            Name: {student.full_name}
          </div>
          <div className="border-b border-black px-3 py-2 text-right text-sm font-semibold underline">
            Date: {formatDate(issuedOn)}
          </div>
          <div className="border-b border-r border-black px-3 py-2 text-sm font-semibold underline">
            Grade: {student.section?.full_name ?? "—"}
          </div>
          <div className="border-b border-black px-3 py-2 text-right text-sm font-semibold underline">
            Prepared by: {preparedBy ?? "—"}
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-center font-bold">
              <th className={cell}>Subject</th>
              <th className={`${cell} w-[80px]`}>%</th>
              <th className={`${cell} w-[90px]`}>Grade</th>
              <th className={cell}>Comments</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 ? (
              <tr>
                <td className={`${cell} text-center`} colSpan={4}>
                  No published results for this term yet.
                </td>
              </tr>
            ) : (
              subjects.map((subject) => (
                <tr key={subject.subject_id}>
                  <td className={`${cell} font-semibold underline`}>
                    {subject.subject_name}
                  </td>
                  <td className={`${cell} text-center`}>
                    {subject.is_absent
                      ? "ABS"
                      : subject.percentage !== null
                        ? `${subject.percentage}%`
                        : ""}
                  </td>
                  <td className={`${cell} text-center`}>{subject.grade ?? ""}</td>
                  <td className={`${cell} text-center`}>{subject.comments ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
