import { Link } from "@tanstack/react-router";
import Layout from "./Layout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Users, Fingerprint, BookOpen, CreditCard, Bell,
  Shield, Smartphone, BarChart3, ArrowRight
} from "lucide-react";
import herosection from "@/assets/herosectionschol.jpg";

const features = [
  { icon: Fingerprint, title: "Biometric Attendance", desc: "Tablet-based gate and boarding attendance with offline sync." },
  { icon: Users, title: "Student Management", desc: "Registration, classes, sections, and full academic records." },
  { icon: CreditCard, title: "Fee & Payments", desc: "Track fees, receipts, transactions, and subscriptions." },
  { icon: BookOpen, title: "Exams & Results", desc: "Configurable grading systems and instant result publishing." },
  { icon: Bell, title: "SMS & Notifications", desc: "Attendance alerts, fee reminders, and operational messaging." },
  { icon: Shield, title: "Multi-Tenant Security", desc: "Strict tenant isolation, RBAC, and full audit logging." },
  { icon: Smartphone, title: "Parent Mobile App", desc: "Parents view attendance, fees, results, and notifications." },
  { icon: BarChart3, title: "Dashboards & Reports", desc: "Real-time analytics for admins, teachers, and owners." },
];

const roles = [
  { title: "Super Admin", desc: "Manages all schools, SaaS subscriptions and global monitoring." },
  { title: "School Admin", desc: "Full school operations: students, staff, fees, attendance." },
  { title: "Teacher", desc: "Attendance, academic operations and class-related activities." },
  { title: "Staff", desc: "Boarding operations, visitor management and gate operations." },
  { title: "Parent / Student", desc: "View attendance, fees, notifications and academic info." },
];

export default function Home() {
  return (
    <Layout>
    <div className="w-full">
      {/* Edge-to-Edge Hero Banner (No rounded corners, perfectly fitting the screen/page bounds) */}
      <div 
        style={{ backgroundColor: "#063970" }}
        className="text-white overflow-hidden relative w-full py-16 md:py-24"
      >
        {/* Ambient overlays to maintain a high-end feel */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#063970] via-[#063970] to-[#42A5F5]/30 opacity-90 z-0"></div>
        
        {/* Content restricted to max-w-7xl inside the full-width block to keep columns perfectly aligned with nav */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block bg-[#42A5F5] text-white text-xs font-semibold px-3 py-1 rounded-full mb-6 shadow-sm">
              Multi-Tenant SaaS · Built for Schools
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight text-white">
              The complete <span className="text-[#42A5F5]">Education Care System</span> Africa.
            </h1>
            <p className="mt-6 text-base text-white/90 max-w-xl leading-relaxed">
              Education Care System Africa helps schools run attendance, boarding, fees, exams and parent
              communication on a single secure, scalable platform  online and offline.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="bg-[#42A5F5] hover:bg-[#42A5F5]/90 text-white font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02]" asChild>
                <Link to="/login">Get Started <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10 rounded-xl" asChild>
                <Link to="/features">Explore Features</Link>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[["50+", "Schools"], ["20K+", "Students"], ["99.9%", "Uptime"]].map(([n, l]) => (
                <div key={l}>
                  <div className="font-display text-2xl font-bold text-[#42A5F5]">{n}</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/70">{l}</div>
                </div>
              ))}
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden md:flex justify-center"
          >
            <img src={herosection} alt="Education Care System Africa Hero" className="w-full max-w-md rounded-2xl shadow-2xl object-cover border-4 border-white/10" />
          </motion.div>
        </div>
      </div>

      {/* Main Home Content wrapped in centered max-width container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        
        {/* FEATURES WITH EXPLICIT HIGH CONTRAST TEXT FOR PLATFORM CAPABILITIES */}
        <div className="section-container">
          <div className="mb-8 px-2">
            <h2 className="font-display text-2xl font-bold text-primary">Platform Capabilities</h2>
            <p className="text-sm text-muted-foreground mt-1">
              From biometric attendance to fee collection  a configurable platform built for real schools.
            </p>
          </div>
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={{
              visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
              hidden: { opacity: 0 }
            }}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
          >
            {features.map((f, index) => {
              // Alternate between Blue theme and Pink theme soft gradients
              const isEven = index % 2 === 0;
              const themeClasses = isEven
                ? "bg-gradient-to-br from-[#EEF4FF] to-[#D0E1FD]/20 border-[#EEF4FF] hover:border-[#1565C0]/40 shadow-[0_4px_20px_-4px_rgba(21,101,192,0.06)] hover:shadow-[0_10px_30px_-5px_rgba(21,101,192,0.15)]"
                : "bg-gradient-to-br from-[#FFF0F5] to-[#FFD1DC]/20 border-[#FFF0F5] hover:border-[#FFB6C1]/40 shadow-[0_4px_20px_-4px_rgba(219,112,147,0.06)] hover:shadow-[0_10px_30px_-5px_rgba(219,112,147,0.15)]";
              const iconBg = isEven ? "bg-[#1565C0]/10 text-[#1565C0]" : "bg-[#DB7093]/10 text-[#DB7093]";

              return (
                <motion.div 
                  key={f.title} 
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  className={`card-container transition-all duration-300 ${themeClasses}`}
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-4 ${iconBg}`}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  {/* Title in Solid Dark Blue (#0A3D91) for maximum legibility */}
                  <h3 className="font-display font-bold text-base mb-2 text-[#0A3D91]">{f.title}</h3>
                  {/* Description in high-contrast solid slate blue (#2C3E50) for maximum readability */}
                  <p className="text-xs text-[#2C3E50] font-medium leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* ROLES */}
        <div className="section-container mt-16">
          <div className="mb-8 px-2">
            <h2 className="font-display text-2xl font-bold text-primary">Built for Every Role</h2>
            <p className="text-sm text-muted-foreground mt-1">One platform tailored for every user in the ecosystem.</p>
          </div>
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={{
              visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
              hidden: { opacity: 0 }
            }}
            className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6"
          >
            {roles.map((r, index) => {
              // Alternate between Blue theme and Pink theme soft gradients to match Features styling
              const isEven = index % 2 === 0;
              const themeClasses = isEven
                ? "bg-gradient-to-br from-[#EEF4FF] to-[#D0E1FD]/20 border-[#EEF4FF] hover:border-[#1565C0]/40 shadow-[0_4px_20px_-4px_rgba(21,101,192,0.06)] hover:shadow-[0_10px_30px_-5px_rgba(21,101,192,0.15)]"
                : "bg-gradient-to-br from-[#FFF0F5] to-[#FFD1DC]/20 border-[#FFF0F5] hover:border-[#FFB6C1]/40 shadow-[0_4px_20px_-4px_rgba(219,112,147,0.06)] hover:shadow-[0_10px_30px_-5px_rgba(219,112,147,0.15)]";
              const numberBg = isEven ? "bg-[#1565C0]/10 text-[#1565C0]" : "bg-[#DB7093]/10 text-[#DB7093]";

              return (
                <motion.div 
                  key={r.title} 
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  className={`card-container transition-all duration-300 ${themeClasses}`}
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-4 ${numberBg} font-display font-bold text-sm`}>
                    0{index + 1}
                  </div>
                  {/* Title in Solid Dark Blue (#0A3D91) for maximum legibility */}
                  <h3 className="font-display font-bold text-base mb-2 text-[#0A3D91]">{r.title}</h3>
                  {/* Description in high-contrast solid slate blue (#2C3E50) for maximum readability */}
                  <p className="text-xs text-[#2C3E50] font-medium leading-relaxed">{r.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* CTA / DEMO SECTION (Guaranteed Background to be exactly #063970) */}
        <div className="section-container mt-16 mb-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{ backgroundColor: "#063970" }}
            className="rounded-3xl text-white border-none text-center p-10 md:p-16 relative overflow-hidden shadow-xl"
          >
            {/* Subtle decoration overlay */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-white opacity-5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-[#42A5F5] opacity-10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
                Ready to modernize your school?
              </h2>
              <p className="text-white/95 text-sm md:text-base leading-relaxed">
                Get a personalized demo and see how Education Care System Africa can streamline operations for your institution.
              </p>
              <div className="pt-4 flex flex-wrap gap-4 justify-center">
                <Button size="lg" className="bg-[#42A5F5] hover:bg-[#42A5F5]/90 text-white font-bold rounded-xl px-8 h-12 shadow-lg transition-all hover:scale-[1.02]" asChild>
                  <Link to="/contact">Book a Demo</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
    </Layout>
  );
}
