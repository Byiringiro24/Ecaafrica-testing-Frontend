import Layout from "./Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FormEvent, useState } from "react";
import { normalizePhoneDigits } from "@/lib/countries";

export default function Contact() {
  const [phone, setPhone] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    toast.success("Thanks! We'll be in touch shortly.");
    (e.target as HTMLFormElement).reset();
    setPhone("");
  };

  return (
    <Layout>
    <div className="w-full overflow-hidden bg-white">
      <div className="bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-slate-600 text-base md:text-lg leading-relaxed max-w-3xl mx-auto font-medium text-center">
            Request a demo, ask a question, or schedule a consultation with our team.
          </p>
        </div>
      </div>

      {/* Page Content wrapped in centered max-width container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-lg lg:grid lg:grid-cols-[1.05fr_1fr]">
            <div className="relative min-h-[360px] bg-slate-100 lg:min-h-full">
              <img src="/contact.jpg" alt="Contact illustration" className="h-full w-full object-cover" />
            </div>
            <div className="p-8 md:p-10">
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Full name</Label>
                    <Input id="name" required className="bg-slate-50 border-slate-200 h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="school" className="text-xs uppercase tracking-wider text-slate-500 font-semibold">School name</Label>
                    <Input id="school" className="bg-slate-50 border-slate-200 h-12" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Email</Label>
                    <Input id="email" type="email" required className="bg-slate-50 border-slate-200 h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={9}
                      value={phone}
                      onChange={(e) => setPhone(normalizePhoneDigits(e.target.value))}
                      placeholder="9 digits"
                      className="bg-slate-50 border-slate-200 h-12"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message" className="text-xs uppercase tracking-wider text-slate-500 font-semibold">How can we help?</Label>
                  <Textarea id="message" rows={5} required className="bg-slate-50 border-slate-200 resize-none min-h-[150px]" />
                </div>
                <Button type="submit" className="w-full bg-[#0A3D91] hover:bg-[#1565C0] text-white rounded-2xl h-12 shadow-md">
                  Send message
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
}
