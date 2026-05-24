import Layout from "./Layout";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import pricingBg from "@/assets/pricing.jpg";

const plans = [
  { name: "Starter", price: "Free Demo", desc: "Try the platform with a single school", features: ["Up to 100 students", "Basic attendance", "1 admin user", "Email support"], cta: "Request Demo", highlight: false },
  { name: "School", price: "Custom", period: "monthly", desc: "Best for individual schools", features: ["Unlimited students", "Biometric attendance", "Fees & exams", "Parent mobile app", "Priority support"], cta: "Get Quote", highlight: true },
  { name: "Enterprise", price: "Custom", desc: "For school groups & districts", features: ["Multi-school management", "Custom branding", "Dedicated infrastructure", "Onboarding & training", "24/7 support"], cta: "Contact Sales", highlight: false },
];

export default function Pricing() {
  return (
    <Layout>
    <div className="w-full">
      {/* Edge-to-Edge Hero Banner (Highly visible background image with text drop-shadows) */}
      <div className="relative overflow-hidden text-center py-24 md:py-32 text-white shadow-md min-h-[300px] flex items-center justify-center w-full">
        {/* Background Image */}
        <img src={pricingBg} alt="Pricing Hero Background" className="absolute inset-0 w-full h-full object-cover z-0" />
        {/* Semi-transparent Dark Brand Overlay (Set to 50% for maximum image visibility) */}
        <div className="absolute inset-0 bg-[#063970]/50 backdrop-blur-[0.5px] z-10"></div>
        
        {/* Hero Content */}
        <div className="relative z-20 max-w-3xl px-6 mx-auto">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-white tracking-tight leading-tight drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)]">
            
          </h1>
          <p className="text-white text-sm md:text-base leading-relaxed max-w-xl mx-auto font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
            Subscription plans designed to grow with your school.
          </p>
        </div>
      </div>
      
      {/* Page Content wrapped in centered max-width container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((p) => (
            <div key={p.name} className={`card-container bg-white flex flex-col relative transition-all duration-300 ${p.highlight ? "border-accent shadow-soft md:-translate-y-4 md:mb-4" : "border-border hover:border-accent/50"}`}>
              {p.highlight && (
                <div className="absolute top-0 inset-x-0 -translate-y-1/2 flex justify-center">
                  <span className="text-[10px] font-bold text-white bg-accent px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                    Most Popular
                  </span>
                </div>
              )}
              <h3 className={`font-display text-xl font-bold ${p.highlight ? 'text-accent' : 'text-[#0A3D91]'}`}>{p.name}</h3>
              <p className="text-xs text-[#5F6B7A] mt-2 min-h-[32px]">{p.desc}</p>
              
              <div className="my-6 py-6 border-y border-border/50">
                <span className="font-display text-3xl font-bold text-foreground">{p.price}</span>
                {p.period && <span className="text-muted-foreground text-xs font-medium"> /{p.period}</span>}
              </div>
              
              <ul className="space-y-3 flex-1 mb-8">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <div className={`mt-0.5 rounded-full p-0.5 ${p.highlight ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                      <Check className="h-3 w-3 flex-shrink-0" />
                    </div>
                    <span className="text-foreground/80">{f}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                className={`w-full rounded-xl ${p.highlight ? "bg-accent hover:bg-accent/90 text-white shadow-md" : "bg-primary/5 hover:bg-primary/10 text-primary border-none"}`} 
                variant={p.highlight ? "default" : "outline"} 
                asChild
              >
                <Link to="/contact">{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
    </Layout>
  );
}
