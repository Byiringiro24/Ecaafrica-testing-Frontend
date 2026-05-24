import Layout from "./Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/netrack-logo.png";

export default function Register() {
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    toast.success("Registration will be connected to your backend soon!");
  };

  return (
    <Layout>
    <div className="min-h-screen bg-white text-[#1A1A1A] font-sans antialiased flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Soft decorative background blurs */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br from-[#42A5F5]/5 to-transparent rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-[#0A3D91]/5 to-transparent rounded-full blur-[80px] pointer-events-none"></div>

      {/* Top Header holding Back to Home button */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#5F6B7A] hover:text-[#0A3D91] transition-all group">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Return Home
        </Link>
        
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="ECA System" className="h-8 w-8 object-contain" />
          <span className="font-display font-bold text-sm text-[#0A3D91] tracking-tight">ECA System</span>
        </Link>
      </div>

      {/* Main Register Form Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 my-auto">
        <div className="bg-white border border-[#EEF4FF] p-8 sm:p-10 rounded-2xl shadow-[0_10px_30px_-5px_rgba(10,61,145,0.05)]">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#0A3D91]/5 rounded-2xl mx-auto flex items-center justify-center mb-4 text-[#0A3D91]">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            </div>
            <h1 className="font-display text-2xl font-bold text-[#0A3D91] mb-2">Create an account</h1>
            <p className="text-xs text-[#5F6B7A]">Sign up your school to get started on ECA platform</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[10px] uppercase tracking-wider text-[#5F6B7A] font-bold">Full Name</Label>
              <Input id="name" placeholder="John Doe" required className="bg-[#F4F7FC]/50 h-11 border-[#EEF4FF] focus-visible:ring-[#0A3D91] rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school" className="text-[10px] uppercase tracking-wider text-[#5F6B7A] font-bold">School Name</Label>
              <Input id="school" placeholder="Greenwood High School" required className="bg-[#F4F7FC]/50 h-11 border-[#EEF4FF] focus-visible:ring-[#0A3D91] rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] uppercase tracking-wider text-[#5F6B7A] font-bold">Work Email</Label>
              <Input id="email" type="email" placeholder="name@school.edu" required className="bg-[#F4F7FC]/50 h-11 border-[#EEF4FF] focus-visible:ring-[#0A3D91] rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] uppercase tracking-wider text-[#5F6B7A] font-bold">Password</Label>
              <Input id="password" type="password" required className="bg-[#F4F7FC]/50 h-11 border-[#EEF4FF] focus-visible:ring-[#0A3D91] rounded-xl" />
            </div>
            
            <Button type="submit" className="w-full bg-[#0A3D91] hover:bg-[#1565C0] text-white rounded-xl h-11 shadow-md font-semibold transition-all hover:scale-[1.01] mt-2">
              Create Account
            </Button>
          </form>

          <div className="mt-8 text-center text-xs text-[#5F6B7A] pt-6 border-t border-[#EEF4FF]">
            Already have an account?{" "}
            <Link to="/login" className="text-[#42A5F5] font-bold hover:underline">Sign in here</Link>
          </div>
        </div>
      </div>

      {/* Small copyright footer info */}
      <div className="text-center text-xs text-[#8A94A6] z-10 mt-auto">
        © 2026 ECA – Education Care Africa. Powered by Netrack.
      </div>
    </div>
    </Layout>
  );
}
