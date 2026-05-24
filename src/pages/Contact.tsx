import Layout from "./Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Phone, Mail, Globe, MapPin } from "lucide-react";
import { toast } from "sonner";
import { FormEvent } from "react";
import contactBg from "@/assets/contact.png";

export default function Contact() {
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    toast.success("Thanks! We'll be in touch shortly.");
    (e.target as HTMLFormElement).reset();
  };

  return (
    <Layout>
    <div className="w-full">
      {/* Edge-to-Edge Hero Banner (Highly visible background image with text drop-shadows) */}
      <div className="relative overflow-hidden text-center py-24 md:py-32 text-white shadow-md min-h-[300px] flex items-center justify-center w-full">
        {/* Background Image */}
        <img src={contactBg} alt="Contact Hero Background" className="absolute inset-0 w-full h-full object-cover z-0" />
        {/* Semi-transparent Dark Brand Overlay (Set to 35% for maximum image visibility) */}
        <div className="absolute inset-0 bg-[#063970]/35 backdrop-blur-[0.5px] z-10"></div>

        {/* Hero Content */}
        <div className="relative z-20 max-w-3xl px-6 mx-auto">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-white tracking-tight leading-tight drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)]">
            Contact Us
          </h1>
          <p className="text-white text-sm md:text-base leading-relaxed max-w-xl mx-auto font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            Request a demo, ask a question, or schedule a consultation with our team.
          </p>
        </div>
      </div>

      {/* Page Content wrapped in centered max-width container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="card-container border-none shadow-none bg-transparent lg:pr-8">
            <h2 className="font-display text-2xl font-bold mb-8 text-[#0A3D91]">Contact information</h2>
            <ul className="space-y-6">
              <li className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Phone</div>
                  <div className="text-sm text-muted-foreground mt-1">+250 786 378 333</div>
                  <div className="text-sm text-muted-foreground">+250 725 931 731</div>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-[#0A3D91]/10 text-[#0A3D91] flex items-center justify-center shrink-0">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Website</div>
                  <a href="https://www.netrackgroup.com" target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline mt-1 block">www.netrackgroup.com</a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-[#0A3D91]/10 text-[#0A3D91] flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Email</div>
                  <div className="text-sm text-muted-foreground mt-1">Netrackdevelopement@gmail.com</div>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-[#0A3D91]/10 text-[#0A3D91] flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Office</div>
                  <div className="text-sm text-muted-foreground mt-1">Kigali, Rwanda</div>
                </div>
              </li>
            </ul>
          </div>

          <div className="card-container bg-white">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Full name</Label>
                  <Input id="name" required className="bg-background/50 h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="school" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">School name</Label>
                  <Input id="school" className="bg-background/50 h-11" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Email</Label>
                  <Input id="email" type="email" required className="bg-background/50 h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Phone</Label>
                  <Input id="phone" type="tel" className="bg-background/50 h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">How can we help?</Label>
                <Textarea id="message" rows={5} required className="bg-background/50 resize-none" />
              </div>
              <Button type="submit" className="w-full bg-[#0A3D91] hover:bg-[#1565C0] text-white rounded-xl h-11 shadow-md">
                Send message
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
}
