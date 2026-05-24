import Layout from "./Layout";
import { Fingerprint, Users, CreditCard, BookOpen, Bell, Shield, Smartphone, BarChart3, Building2, Calendar, UserCheck, DoorOpen, ClipboardCheck, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";
import featuresBg from "@/assets/features.jpg";

const items = [
  { icon: Fingerprint, title: "Biometric Attendance", desc: "Tablet-based biometric capture with kiosk mode, PIN unlock, and automatic offline sync." },
  { icon: DoorOpen, title: "Gate Attendance", desc: "Entry and exit logs, time tracking, and duplicate prevention." },
  { icon: ClipboardCheck, title: "Boarding Attendance", desc: "Morning and evening attendance with automated absence monitoring." },
  { icon: Calendar, title: "Leave Management", desc: "Requests, approvals, exit tracking, and unauthorized exit alerts." },
  { icon: UserCheck, title: "Visitor Management", desc: "Registration, host assignment, appointments, and full logs." },
  { icon: Users, title: "Student Management", desc: "Registration, class/section setup, and academic structure management." },
  { icon: CreditCard, title: "Payments & Fees", desc: "Fee tracking, receipts, transaction logs, and subscription handling." },
  { icon: BookOpen, title: "Exams & Results", desc: "Configurable grading and instant result publishing for parents." },
  { icon: Bell, title: "SMS & Notifications", desc: "Queue-based delivery with retry for attendance and fee alerts." },
  { icon: BarChart3, title: "Dashboards & Reports", desc: "Operational analytics for super admins and school admins." },
  { icon: Shield, title: "Security & RBAC", desc: "Strict tenant isolation, role-based access, and audit logging." },
  { icon: Smartphone, title: "Parent Mobile App", desc: "Flutter app for attendance, fees, results, and notifications." },
  { icon: Building2, title: "Multi-Tenant SaaS", desc: "Run unlimited schools on one platform with isolated data." },
  { icon: GraduationCap, title: "Configurable Academic Structures", desc: "Schools, classes, sections, terms — fully configurable." },
];

export default function Features() {
  return (
    <Layout>
    <div className="w-full">
      {/* Edge-to-Edge Hero Banner (Highly visible background image with text drop-shadows) */}
      <div className="relative overflow-hidden text-center py-24 md:py-32 text-white shadow-md min-h-[300px] flex items-center justify-center w-full">
        {/* Background Image */}
        <img src={featuresBg} alt="Features Hero Background" className="absolute inset-0 w-full h-full object-cover z-0" />
        {/* Semi-transparent Dark Brand Overlay (Set to 50% for maximum image visibility) */}
        <div className="absolute inset-0 bg-[#063970]/50 backdrop-blur-[0.5px] z-10"></div>
        
        {/* Hero Content */}
        <div className="relative z-20 max-w-3xl px-6 mx-auto">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-white tracking-tight leading-tight drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)]">
            
          </h1>
          <p className="text-white text-sm md:text-base leading-relaxed max-w-xl mx-auto font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
            A complete suite of tools designed to run modern schools from attendance to analytics.
          </p>
        </div>
      </div>
      
      {/* Page Content wrapped in centered max-width container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
            hidden: { opacity: 0 }
          }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
        >
          {items.map((f) => (
            <motion.div 
              key={f.title} 
              variants={{
                hidden: { opacity: 0, y: 15 },
                visible: { opacity: 1, y: 0 }
              }}
              className="card-container bg-white border border-[#EEF4FF] hover:border-accent hover:shadow-soft transition-all duration-300 flex flex-col"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-semibold text-base mb-2 text-foreground">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
    </Layout>
  );
}
