import Layout from "./Layout";
import { Link } from "@tanstack/react-router";

const conditions = [
  {
    icon: "👥",
    color: "blue",
    title: "Billing by enrolled students",
    desc: "Pricing is based on total enrolled students, billed per student.",
  },
  {
    icon: "🏫",
    color: "green",
    title: "Min. 200 students required",
    desc: "Minimum 200 students required for per-student subscription.",
  },
  {
    icon: "📅",
    color: "amber",
    title: "10% off on termly billing",
    desc: "Save 10% when you subscribe on a termly billing cycle.",
  },
  {
    icon: "🏷️",
    color: "amber",
    title: "20% off on yearly billing",
    desc: "Save 20% when you subscribe on a yearly billing cycle.",
  },
  {
    icon: "🏢",
    color: "blue",
    title: "School plan covers all users",
    desc: "School Plan covers the entire school — all students and staff.",
  },
  {
    icon: "🛡️",
    color: "purple",
    title: "Includes updates & backups",
    desc: "All plans include updates, security, backups, and support.",
  },
];

const plans = [
  {
    key: "basic",
    badge: "Starter",
    name: "Basic",
    tagline: "Start Smart. Stay Connected.",
    price: "3,000",
    cta: "Request a quote",
    footer: "Perfect for schools starting their digital journey.",
    featured: false,
    parentsGet: [
      "Real-time attendance alerts",
      "Gate entry & exit notifications",
      "Attendance & absence SMS",
      "Fee reminder notifications",
      "Emergency alerts",
    ],
    schoolsBenefit: [
      "Smart gate attendance",
      "Staff attendance management",
      "Student management",
      "Basic dashboard & reports",
      "Fee status monitoring",
      "SMS communication system",
    ],
  },
  {
    key: "medium",
    badge: "Recommended",
    name: "Medium",
    tagline: "More Power. More Control. Better Engagement.",
    price: "5,000",
    cta: "Get a quote",
    footer: "Ideal for growing schools that want automation + engagement.",
    featured: true,
    mostPowerful: true,
    parentsGet: [
      "All Basic features",
      "Classroom attendance",
      "Timetable & results access",
      "Online fee payments (MoMo)",
      "Teacher communication",
      "School announcements",
      "Visitor & boarding alerts",
    ],
    schoolsBenefit: [
      "All Basic features",
      "Timetable management",
      "Result management",
      "Fee management",
      "Boarding management",
      "Visitor management",
      "Advanced reports & insights",
      "Teacher & staff access",
    ],
  },
  {
    key: "premium",
    badge: "Enterprise",
    name: "Premium",
    tagline: "Complete Control. Maximum Impact.",
    price: "7,000",
    cta: "Contact sales",
    footer: "For institutions that demand excellence and full control.",
    featured: false,
    parentsGet: [
      "All Medium features",
      "AI student insights",
      "Behavior & performance tracking",
      "Boarding activity monitoring",
      "Instant smart notifications",
      "Priority support",
    ],
    schoolsBenefit: [
      "All Medium features",
      "Payroll & HR management",
      "Examination management",
      "AI-powered analytics",
      "Advanced security & roles",
      "Financial & accounting reports",
      "Enterprise control & automation",
      "Priority support",
    ],
  },
];

const whyItems = [
  { icon: "", color: "blue", title: "All-in-one platform", desc: "Every tool your school needs in one place." },
  { icon: "", color: "green", title: "Real-time smart insights", desc: "Live dashboards with actionable analytics." },
  { icon: "", color: "purple", title: "Secure cloud infrastructure", desc: "Your data protected, always available." },
  { icon: "", color: "amber", title: "Scalable for every institution", desc: "Grows from a single school to a district." },
  { icon: "", color: "teal", title: "Trusted by schools", desc: "Proven reliability across African schools." },
  { icon: "", color: "coral", title: "Built for Africa", desc: "Designed for local needs and growth." },
];

const condIconBg = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  purple: "bg-purple-50 text-purple-700",
};

const planStyles = {
  basic: {
    badge: "bg-green-50 text-green-800",
    name: "text-[#1a7a3c]",
    priceBg: "bg-green-50/60",
    price: "text-[#1a7a3c]",
    per: "text-green-700",
    sectionHead: "text-green-800 border-green-200",
    check: "text-[#1a7a3c]",
    cta: "bg-green-50 text-[#1a7a3c] border-green-300 hover:bg-green-100",
  },
  medium: {
    badge: "bg-blue-50 text-blue-900",
    name: "text-[#063970]",
    priceBg: "bg-blue-50/60",
    price: "text-[#063970]",
    per: "text-blue-700",
    sectionHead: "text-blue-900 border-blue-200",
    check: "text-blue-600",
    cta: "bg-blue-50 text-[#063970] border-blue-300 hover:bg-blue-100",
  },
  premium: {
    badge: "bg-purple-50 text-purple-900",
    name: "text-[#5b2d8e]",
    priceBg: "bg-purple-50/60",
    price: "text-[#5b2d8e]",
    per: "text-purple-700",
    sectionHead: "text-purple-900 border-purple-200",
    check: "text-purple-600",
    cta: "bg-purple-50 text-[#5b2d8e] border-purple-300 hover:bg-purple-100",
  },
};

function CheckIcon({ className }) {
  return (
    <svg className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${className}`} viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="7" fill="currentColor" fillOpacity="0.12" />
      <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlanCard({ plan }) {
  const s = planStyles[plan.key];
  const isFeatured = plan.featured;

  if (isFeatured) {
    return (
      <div className="relative flex flex-col bg-[#063970] rounded-2xl overflow-hidden border border-[#063970]">
        {plan.mostPowerful && (
          <div className="absolute top-0 right-4 bg-amber-400 text-amber-900 text-[9px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-b-lg">
            Most Powerful
          </div>
        )}
        {/* Header */}
        <div className="px-5 pt-6 pb-4 text-center">
          <span className="inline-block bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
            {plan.badge}
          </span>
          <h3 className="font-display text-2xl font-extrabold text-sky-200 mb-1">{plan.name}</h3>
          <p className="text-white/60 text-xs leading-relaxed">{plan.tagline}</p>
        </div>
        {/* Price */}
        <div className="px-5 py-4 text-center bg-white/10 border-y border-white/10">
          <span className="font-display text-3xl font-extrabold text-white">
            <span className="text-base align-super mr-0.5">RWF</span>
            {plan.price}
          </span>
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-wide mt-1">per student / per month</p>
        </div>
        {/* Parents */}
        <div className="px-5 py-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[2px] text-white/40 border-b border-white/10 pb-2 mb-3">
            Parents get
          </p>
          <ul className="space-y-2">
            {plan.parentsGet.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckIcon className="text-emerald-400" />
                <span className="text-white/80 text-xs leading-snug">{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <hr className="border-white/10 mx-5" />
        {/* Schools */}
        <div className="px-5 py-4 flex-1">
          <p className="text-[9px] font-extrabold uppercase tracking-[2px] text-white/40 border-b border-white/10 pb-2 mb-3">
            Schools benefit
          </p>
          <ul className="space-y-2">
            {plan.schoolsBenefit.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckIcon className="text-emerald-400" />
                <span className="text-white/80 text-xs leading-snug">{f}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* CTA */}
        <div className="px-5 pb-5 pt-3">
          <Link
            to="/contact"
            className="block w-full text-center bg-white text-[#063970] font-bold text-xs py-2.5 rounded-xl hover:bg-blue-50 transition-colors"
          >
            {plan.cta}
          </Link>
        </div>
        <div className="px-5 pb-4 text-[10.5px] text-white/40 border-t border-white/10 pt-3 flex items-start gap-1.5">
          <span>★</span>
          <span>{plan.footer}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden hover:border-[#cbd5e1] transition-colors">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 text-center">
        <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 ${s.badge}`}>
          {plan.badge}
        </span>
        <h3 className={`font-display text-2xl font-extrabold mb-1 ${s.name}`}>{plan.name}</h3>
        <p className="text-slate-400 text-xs leading-relaxed">{plan.tagline}</p>
      </div>
      {/* Price */}
      <div className={`px-5 py-4 text-center border-y border-slate-100 ${s.priceBg}`}>
        <span className={`font-display text-3xl font-extrabold ${s.price}`}>
          <span className="text-base align-super mr-0.5">RWF</span>
          {plan.price}
        </span>
        <p className={`text-[10px] font-bold uppercase tracking-wide mt-1 ${s.per}`}>per student / per month</p>
      </div>
      {/* Parents */}
      <div className="px-5 py-4">
        <p className={`text-[9px] font-extrabold uppercase tracking-[2px] pb-2 mb-3 border-b ${s.sectionHead}`}>
          Parents get
        </p>
        <ul className="space-y-2">
          {plan.parentsGet.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <CheckIcon className={s.check} />
              <span className="text-slate-600 text-xs leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      </div>
      <hr className="border-slate-100 mx-5" />
      {/* Schools */}
      <div className="px-5 py-4 flex-1">
        <p className={`text-[9px] font-extrabold uppercase tracking-[2px] pb-2 mb-3 border-b ${s.sectionHead}`}>
          Schools benefit
        </p>
        <ul className="space-y-2">
          {plan.schoolsBenefit.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <CheckIcon className={s.check} />
              <span className="text-slate-600 text-xs leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* CTA */}
      <div className="px-5 pb-5 pt-3">
        <Link
          to="/contact"
          className={`block w-full text-center font-bold text-xs py-2.5 rounded-xl border transition-colors ${s.cta}`}
        >
          {plan.cta}
        </Link>
      </div>
      <div className="px-5 pb-4 text-[10.5px] text-slate-400 border-t border-slate-100 pt-3 flex items-start gap-1.5">
        <span>★</span>
        <span>{plan.footer}</span>
      </div>
    </div>
  );
}

export default function Pricing() {
  return (
    <Layout>
      <div className="w-full">
        {/* HERO */}
        <div className="relative overflow-hidden text-center py-20 md:py-28 text-white w-full"
          style={{ background: "linear-gradient(135deg, #063970 0%, #0a5aad 55%, #1a7a3c 100%)" }}>
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10 max-w-2xl mx-auto px-6">
            <span className="inline-block bg-white/15 text-white text-[10px] font-bold uppercase tracking-[2.5px] px-4 py-1.5 rounded-full mb-5">
              Subscription Plans
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight mb-4 drop-shadow-md">
              One Platform.{" "}
              <span className="text-yellow-300">Every Solution.</span>
            </h1>
            <p className="text-white/75 text-sm md:text-base leading-relaxed max-w-lg mx-auto">
              Complete School Management Ecosystem — built for African institutions.
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-14">

          {/* IMPORTANT CONDITIONS */}
                {/* CONDITIONS */}
        <div className="max-w-5xl mx-auto px-4 mt-4">
          <div className="bg-white rounded-xl overflow-hidden border border-slate-200">
            <div className="bg-[#063970] flex items-center gap-2 px-4 py-2.5">
              <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-white text-[11px] font-black uppercase tracking-[2px]">Important Conditions</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3">
              {conditions.map((c, i) => (
                <div
                  key={c.title}
                  className={`flex items-start gap-2.5 p-3
                    ${i % 3 !== 2 ? "border-r border-slate-100" : ""}
                    ${i < 3 ? "border-b border-slate-100" : ""}`}
                >
                  <div className={`w-9 h-9 min-w-[36px] rounded-full flex items-center justify-center ${c.bg}`}>
                    <i className={`ti ${c.ico}`} style={{ fontSize: 16 }} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-800 leading-snug">{c.title}</p>
                    {c.desc && <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{c.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

          {/* PLANS */}
          <section>
            <div className="grid md:grid-cols-3 gap-5">
              {plans.map((plan) => (
                <PlanCard key={plan.key} plan={plan} />
              ))}
            </div>
          </section>

          {/* WHY SECTION */}
          <section>
            <div className="mb-5">
              <h2 className="font-display text-xl font-bold text-slate-800">Why choose Education Care Africa?</h2>
              <p className="text-slate-400 text-sm">Built for Africa, designed for growth.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {whyItems.map((w) => (
                <div key={w.title} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3.5">
                  <div className="w-9 h-9 min-w-[36px] rounded-lg bg-white shadow-sm flex items-center justify-center text-base">
                    {w.icon}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 leading-snug mb-0.5">{w.title}</p>
                    <p className="text-[11px] text-slate-500 leading-snug">{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

    

        </div>
      </div>
    </Layout>
  );
}