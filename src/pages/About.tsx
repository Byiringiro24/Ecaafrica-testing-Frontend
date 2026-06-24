import { motion } from "framer-motion";
import Layout from "./Layout";
import { Shield, Lightbulb, Cpu, Layers, Smartphone, Database, CheckCircle2, TrendingUp, Key, Heart } from "lucide-react";
import aboutBg from "@/assets/about.jpg";
 
const successPillars = [
  { icon: Lightbulb, title: "Innovation", desc: "Leading the digital transformation of educational systems across Africa with cutting-edge tools." },
  { icon: Layers, title: "Scalability", desc: "Engineered to support schools of any size, growing effortlessly as your student body expands." },
  { icon: Shield, title: "Security", desc: "Enterprise-grade data isolation, full audit logging, and strict role-based access controls." },
  { icon: CheckCircle2, title: "Reliability", desc: "High availability, redundant cloud backups, and solid offline synchronization capabilities." },
  { icon: TrendingUp, title: "Educational Transformation", desc: "Moving schools beyond paper records into an automated, efficient operational ecosystem." },
  { icon: Cpu, title: "Real-Time Operations", desc: "Instant updates for attendance, fee receipts, and term results directly to administrators." },
  { icon: Database, title: "Multi-School SaaS Infrastructure", desc: "Empowering school groups and super administrators to manage multiple sites seamlessly." },
  { icon: Heart, title: "User-Friendly Experience", desc: "Simple, accessible interfaces for teachers, parents, staff, and super administrators." },
];

const highlights = [
  { icon: Layers, title: "Multi-tenant SaaS Architecture", desc: "Complete data isolation for each institution on a single centralized system." },
  { icon: Cpu, title: "School Management Ecosystem", desc: "Centralized controls for academic years, class cohorts, and registration records." },
  { icon: CheckCircle2, title: "Real-time Operations", desc: "Live event logging, immediate dashboard reports, and real-time query updates." },
  { icon: Shield, title: "Attendance Management", desc: "Biometric kiosk check-ins, gate entry logs, and boarding school tracking." },
  { icon: Smartphone, title: "Mobile & Web Ecosystem", desc: "Seamless accessibility via cross-platform parent apps and responsive administrative portals." },
  { icon: Database, title: "Secure Scalable Infrastructure", desc: "Hosted on enterprise cloud services, backed by modern secure API endpoints." },
];

export default function About() {
  return (
    <Layout>
    <div className="w-full">
      {/* Edge-to-Edge Hero Banner (Highly visible background image with text drop-shadows) */}
      <div className="relative overflow-hidden text-center py-24 md:py-32 text-white shadow-md min-h-[300px] flex items-center justify-center w-full">
        {/* Background Image */}
        <img src={aboutBg} alt="About Hero Background" className="absolute inset-0 w-full h-full object-cover z-0" />
        {/* Semi-transparent Dark Brand Overlay (Set to 50% for maximum image visibility) */}
        <div className="absolute inset-0 bg-[#063970]/50 backdrop-blur-[0.5px] z-10"></div>
        
        {/* Hero Content */}
        <div className="relative z-20 max-w-3xl px-6 mx-auto">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-white tracking-tight leading-tight drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)] animate-fade-up">
            About the Platform
          </h1>
          <p className="text-white text-sm md:text-base leading-relaxed max-w-xl mx-auto font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] animate-fade-up">
            Empowering schools across Africa through secure, modern, and intelligent digital infrastructure.
          </p>
        </div>
      </div>
      
      {/* Page Content wrapped in centered max-width container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        
        {/* SECTION 1: ABOUT THE SYSTEM */}
        <div className="section-container mb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <h2 className="font-display text-3xl font-bold text-black tracking-tight">
                About Education Care System Africa
              </h2>
              <p className="text-black text-sm md:text-base leading-relaxed font-semibold">
                Education Care System Africa is a modern scalable SaaS-based school management platform designed to support schools through digital transformation, operational automation, attendance management, fee management, reporting, and centralized educational operations.
              </p>
              <p className="text-black/80 text-xs md:text-sm leading-relaxed font-medium">
                By providing robust controls, role-based permission sets, and cross-device functionality (from administrative desktops to mobile tablets at school gates), we bridge the gap between parents, teachers, and system administrators.
              </p>
            </motion.div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {highlights.map((h, index) => {
                const isEven = index % 2 === 0;
                const themeClasses = isEven
                  ? "bg-gradient-to-br from-[#EEF4FF] to-[#D0E1FD]/20 border-[#EEF4FF] hover:border-[#1565C0]/40 shadow-[0_4px_15px_-4px_rgba(21,101,192,0.05)] hover:shadow-[0_8px_20px_-5px_rgba(21,101,192,0.1)]"
                  : "bg-gradient-to-br from-[#FFF0F5] to-[#FFD1DC]/20 border-[#FFF0F5] hover:border-[#FFB6C1]/40 shadow-[0_4px_15px_-4px_rgba(219,112,147,0.05)] hover:shadow-[0_8px_20px_-5px_rgba(219,112,147,0.1)]";
                const iconBg = isEven ? "bg-[#1565C0]/10 text-[#1565C0]" : "bg-[#DB7093]/10 text-[#DB7093]";

                return (
                  <div key={index} className={`card-container transition-all duration-300 p-5 rounded-xl flex items-start gap-4 ${themeClasses}`}>
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                      <h.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-sm text-black mb-1">{h.title}</h4>
                      <p className="text-xs text-black font-semibold leading-relaxed">{h.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 2 & 3: VISION & MISSION */}
        <div className="section-container mb-16 grid md:grid-cols-2 gap-8">
          {/* VISION CARD */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="card-container bg-gradient-to-br from-[#EEF4FF] to-[#D0E1FD]/20 border border-[#EEF4FF] border-t-4 border-t-[#0A3D91] hover:border-[#1565C0]/40 shadow-[0_4px_20px_-4px_rgba(21,101,192,0.06)] hover:shadow-[0_10px_30px_-5px_rgba(21,101,192,0.15)] transition-all duration-300 rounded-2xl p-8"
          >
            <div className="h-12 w-12 rounded-xl bg-[#0A3D91]/10 text-[#0A3D91] flex items-center justify-center mb-6">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="font-display text-2xl font-bold text-black mb-4">Our Vision</h3>
            <p className="text-black text-base leading-relaxed font-bold">
              To become Africa’s leading scalable education technology ecosystem empowering schools through secure, modern, and intelligent digital infrastructure.
            </p>
          </motion.div>

          {/* MISSION CARD */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="card-container bg-gradient-to-br from-[#FFF0F5] to-[#FFD1DC]/20 border border-[#FFF0F5] border-t-4 border-t-[#DB7093] hover:border-[#FFB6C1]/40 shadow-[0_4px_20px_-4px_rgba(219,112,147,0.06)] hover:shadow-[0_10px_30px_-5px_rgba(219,112,147,0.15)] transition-all duration-300 rounded-2xl p-8"
          >
            <div className="h-12 w-12 rounded-xl bg-[#DB7093]/10 text-[#DB7093] flex items-center justify-center mb-6">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="font-display text-2xl font-bold text-black mb-4">Our Mission</h3>
            <p className="text-black text-base leading-relaxed font-bold">
              To provide schools with reliable, scalable, and modern SaaS technology solutions that simplify administration, improve operational efficiency, and support long-term educational growth.
            </p>
          </motion.div>
        </div>

        {/* SECTION 4: KEY TO SUCCESS */}
        <div className="section-container">
          <div className="mb-8 text-center">
            <div className="inline-flex h-8 w-8 rounded-lg bg-[#0A3D91]/10 text-[#0A3D91] items-center justify-center mb-2">
              <Key className="h-4 w-4" />
            </div>
            <h2 className="font-display text-3xl font-bold text-black">Key to Success</h2>
            <p className="text-sm text-black font-semibold mt-2 max-w-lg mx-auto">
              Our core success pillars drive long-term value, reliability, and growth for partner institutions.
            </p>
          </div>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
              visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
              hidden: { opacity: 0 }
            }}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {successPillars.map((p, index) => {
              const isEven = index % 2 === 0;
              const themeClasses = isEven
                ? "bg-gradient-to-br from-[#EEF4FF] to-[#D0E1FD]/20 border-[#EEF4FF] hover:border-[#1565C0]/40 shadow-[0_4px_20px_-4px_rgba(21,101,192,0.06)] hover:shadow-[0_10px_30px_-5px_rgba(21,101,192,0.15)]"
                : "bg-gradient-to-br from-[#FFF0F5] to-[#FFD1DC]/20 border-[#FFF0F5] hover:border-[#FFB6C1]/40 shadow-[0_4px_20px_-4px_rgba(219,112,147,0.06)] hover:shadow-[0_10px_30px_-5px_rgba(219,112,147,0.15)]";
              const iconBg = isEven ? "bg-[#1565C0]/10 text-[#1565C0]" : "bg-[#DB7093]/10 text-[#DB7093]";

              return (
                <motion.div 
                  key={p.title}
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  className={`card-container transition-all duration-300 rounded-2xl flex flex-col p-6 ${themeClasses}`}
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-4 shrink-0 ${iconBg}`}>
                    <p.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display font-bold text-base mb-2 text-black">{p.title}</h3>
                  <p className="text-xs text-black font-semibold leading-relaxed flex-1">{p.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

      </div>
    </div>
    </Layout>
  );
}
