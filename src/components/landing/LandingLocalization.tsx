import { createContext, useContext, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

export type LandingLanguage = "en" | "sw" | "fr" | "rw";

export const landingCurrencyByLanguage: Record<LandingLanguage, string> = {
  en: "FRW",
  sw: "FRW",
  fr: "FRW",
  rw: "FRW",
};

const LandingLanguageContext = createContext<LandingLanguage | undefined>(undefined);

function storedLandingLanguage(): LandingLanguage {
  if (typeof window === "undefined") return "en";
  const savedLanguage = localStorage.getItem("landing-language");
  return savedLanguage === "sw" || savedLanguage === "fr" || savedLanguage === "rw" ? savedLanguage : "en";
}

export function useLandingLanguage() {
  const contextLanguage = useContext(LandingLanguageContext);
  const storedLanguage = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("landing-language-change", onStoreChange);
      return () => window.removeEventListener("landing-language-change", onStoreChange);
    },
    storedLandingLanguage,
    () => "en",
  );

  return contextLanguage ?? storedLanguage;
}

type Translations = Partial<Record<LandingLanguage, string>>;

// Keeping the translations in one place means the public pages can keep their
// existing components while still being translated consistently.
const copy: Record<string, Translations> = {
  Home: { sw: "Mwanzo", fr: "Accueil", rw: "Ahabanza" },
  About: { sw: "Kuhusu", fr: "À propos", rw: "Ibyerekeye" },
  Features: { sw: "Vipengele", fr: "Fonctionnalités", rw: "Ibiranga" },
  "Book Demo": { sw: "Weka miadi ya onyesho", fr: "Réserver une démo", rw: "Saba demo" },
  Pricing: { sw: "Bei", fr: "Tarifs", rw: "Ibiciro" },
  Contact: { sw: "Wasiliana nasi", fr: "Contact", rw: "Twandikire" },
  Login: { sw: "Ingia", fr: "Connexion", rw: "Injira" },
  "Empowering African schools with modern cloud technology": {
    sw: "Kuwezesha shule za Afrika kwa teknolojia ya kisasa ya wingu",
    fr: "Accompagner les écoles africaines avec une technologie cloud moderne",
    rw: "Guha amashuri yo muri Afurika ikoranabuhanga rigezweho rya cloud",
  },
  "The complete": { sw: "Mfumo kamili wa", fr: "La plateforme complète", rw: "Sisitemu yuzuye ya" },
  "Education Care System": { sw: "Mfumo wa Elimu", fr: "Système de gestion scolaire", rw: "Sisitemu yo Kwita ku Burezi" },
  Africa: { sw: "Afrika", fr: "Afrique", rw: "Afurika" },
  "Education Care System Africa helps schools run attendance, boarding, fees, exams and parent communication on a single secure, scalable platform online and offline.": {
    sw: "Education Care System Africa husaidia shule kusimamia mahudhurio, bweni, ada, mitihani na mawasiliano ya wazazi kwenye mfumo mmoja salama unaoweza kukua, mtandaoni na nje ya mtandao.",
    fr: "Education Care System Africa aide les écoles à gérer les présences, l'internat, les frais, les examens et la communication avec les parents sur une plateforme unique, sécurisée et évolutive, en ligne et hors ligne.",
    rw: "Education Care System Africa ifasha amashuri gucunga ubwitabire, icumbi, amafaranga y'ishuri, ibizamini n'itumanaho n'ababyeyi kuri porogaramu imwe itekanye kandi yaguka, kuri interineti n'itayifite.",
  },
  "Explore Features": { sw: "Chunguza vipengele", fr: "Découvrir les fonctionnalités", rw: "Reba ibiranga" },
  Schools: { sw: "Shule", fr: "Écoles", rw: "Amashuri" },
  Students: { sw: "Wanafunzi", fr: "Élèves", rw: "Abanyeshuri" },
  Uptime: { sw: "Upatikanaji", fr: "Disponibilité", rw: "Igihe ikora" },
  "Platform Capabilities": { sw: "Uwezo wa jukwaa", fr: "Fonctionnalités de la plateforme", rw: "Ubushobozi bwa porogaramu" },
  "From biometric attendance to fee collection a configurable platform built for real schools.": {
    sw: "Kuanzia mahudhurio ya kibayometriki hadi ukusanyaji wa ada, ni jukwaa linaloweza kubadilishwa kwa shule halisi.",
    fr: "De la présence biométrique à la collecte des frais, une plateforme configurable conçue pour les vraies écoles.",
    rw: "Kuva ku kwandika ubwitabire hifashishijwe biometrike kugeza ku kwishyuza, ni porogaramu ihinduka yubakiwe amashuri nyayo.",
  },
  "Biometric Attendance": { sw: "Mahudhurio ya kibayometriki", fr: "Présence biométrique", rw: "Ubwitabire bwa biometrike" },
  "Student Management": { sw: "Usimamizi wa wanafunzi", fr: "Gestion des élèves", rw: "Gucunga abanyeshuri" },
  "Fee & Payments": { sw: "Ada na malipo", fr: "Frais et paiements", rw: "Amafaranga n'ubwishyu" },
  "Exams & Results": { sw: "Mitihani na matokeo", fr: "Examens et résultats", rw: "Ibizamini n'amanota" },
  "SMS & Notifications": { sw: "SMS na arifa", fr: "SMS et notifications", rw: "Ubutumwa na menyesha" },
  "Multi-Tenant Security": { sw: "Usalama wa taasisi nyingi", fr: "Sécurité multi-établissements", rw: "Umutekano w'amashuri menshi" },
  "Parent Mobile App": { sw: "Programu ya simu ya mzazi", fr: "Application mobile parents", rw: "Porogaramu ya telefoni y'ababyeyi" },
  "Dashboards & Reports": { sw: "Dashibodi na ripoti", fr: "Tableaux de bord et rapports", rw: "Imbonerahamwe na raporo" },
  "About the Platform": { sw: "Kuhusu jukwaa", fr: "À propos de la plateforme", rw: "Ibyerekeye porogaramu" },
  "Empowering schools across Africa through secure, modern, and intelligent digital infrastructure.": {
    sw: "Kuwezesha shule barani Afrika kupitia miundombinu salama, ya kisasa na ya kidijitali yenye akili.",
    fr: "Accompagner les écoles africaines grâce à une infrastructure numérique sécurisée, moderne et intelligente.",
    rw: "Guha amashuri muri Afurika ubushobozi binyuze mu ikoranabuhanga rya digitale ritekanye, rigezweho kandi rifite ubwenge.",
  },
  "About Education Care System Africa": { sw: "Kuhusu Education Care System Africa", fr: "À propos d'Education Care System Africa", rw: "Ibyerekeye Education Care System Africa" },
  "Our Vision": { sw: "Dira yetu", fr: "Notre vision", rw: "Icyerekezo cyacu" },
  "Our Mission": { sw: "Dhamira yetu", fr: "Notre mission", rw: "Intego yacu" },
  "Key to Success": { sw: "Funguo za mafanikio", fr: "Les clés du succès", rw: "Iby'ingenzi ku ntsinzi" },
  Innovation: { sw: "Ubunifu", fr: "Innovation", rw: "Guhanga udushya" },
  Scalability: { sw: "Uwezo wa kukua", fr: "Évolutivité", rw: "Kwaguka" },
  Security: { sw: "Usalama", fr: "Sécurité", rw: "Umutekano" },
  Reliability: { sw: "Uaminifu", fr: "Fiabilité", rw: "Kwizerwa" },
  "Educational Transformation": { sw: "Mageuzi ya elimu", fr: "Transformation éducative", rw: "Impinduka mu burezi" },
  "Real-Time Operations": { sw: "Uendeshaji wa wakati halisi", fr: "Opérations en temps réel", rw: "Imikorere y'ako kanya" },
  "User-Friendly Experience": { sw: "Matumizi rahisi", fr: "Expérience conviviale", rw: "Ukoreshwa byoroshye" },
  "A complete suite of tools designed to run modern schools from attendance to analytics.": {
    sw: "Seti kamili ya zana za kuendesha shule za kisasa, kuanzia mahudhurio hadi uchanganuzi.",
    fr: "Une suite complète d'outils conçus pour gérer les écoles modernes, de la présence aux analyses.",
    rw: "Ibikoresho byuzuye byubakiwe gucunga amashuri agezweho, kuva ku bwitabire kugeza ku isesengura.",
  },
  "Gate Attendance": { sw: "Mahudhurio ya getini", fr: "Présence au portail", rw: "Ubwitabire ku irembo" },
  "Boarding Attendance": { sw: "Mahudhurio ya bweni", fr: "Présence à l'internat", rw: "Ubwitabire mu icumbi" },
  "Leave Management": { sw: "Usimamizi wa ruhusa", fr: "Gestion des sorties", rw: "Gucunga uruhushya" },
  "Visitor Management": { sw: "Usimamizi wa wageni", fr: "Gestion des visiteurs", rw: "Gucunga abashyitsi" },
  "Payments & Fees": { sw: "Malipo na ada", fr: "Paiements et frais", rw: "Ubwishyu n'amafaranga" },
  "Security & RBAC": { sw: "Usalama na ruhusa", fr: "Sécurité et rôles", rw: "Umutekano n'inshingano" },
  "Multi-Tenant SaaS": { sw: "SaaS ya taasisi nyingi", fr: "SaaS multi-établissements", rw: "SaaS y'amashuri menshi" },
  "Book a Free Demo": { sw: "Weka miadi ya onyesho la bure", fr: "Réserver une démo gratuite", rw: "Saba demo y'ubuntu" },
  "Fill in your details and our team will contact you shortly.": {
    sw: "Jaza maelezo yako na timu yetu itawasiliana nawe hivi karibuni.",
    fr: "Renseignez vos coordonnées et notre équipe vous contactera prochainement.",
    rw: "Uzuza amakuru yawe maze itsinda ryacu rikuvugishe vuba.",
  },
  "School Name": { sw: "Jina la shule", fr: "Nom de l'école", rw: "Izina ry'ishuri" },
  Country: { sw: "Nchi", fr: "Pays", rw: "Igihugu" },
  "Contact Person Name": { sw: "Jina la mtu wa mawasiliano", fr: "Nom du contact", rw: "Amazina y'uwaduhamagara" },
  "Designation / Job Title": { sw: "Cheo / kazi", fr: "Fonction / poste", rw: "Umwanya w'akazi" },
  "Mobile Number": { sw: "Nambari ya simu", fr: "Numéro de mobile", rw: "Nomero ya telefoni" },
  "Email Address": { sw: "Anwani ya barua pepe", fr: "Adresse e-mail", rw: "Aderesi imeli" },
  "Number of Students": { sw: "Idadi ya wanafunzi", fr: "Nombre d'élèves", rw: "Umubare w'abanyeshuri" },
  "Number of Teachers": { sw: "Idadi ya walimu", fr: "Nombre d'enseignants", rw: "Umubare w'abarimu" },
  "Number of Office Staff": { sw: "Idadi ya wafanyakazi wa ofisi", fr: "Nombre de personnel administratif", rw: "Umubare w'abakozi bo mu biro" },
  "Current School Management System?": { sw: "Mfumo wa sasa wa usimamizi wa shule?", fr: "Système actuel de gestion scolaire ?", rw: "Mufite sisitemu yo gucunga ishuri?" },
  Yes: { sw: "Ndiyo", fr: "Oui", rw: "Yego" },
  No: { sw: "Hapana", fr: "Non", rw: "Oya" },
  "Current Software Name": { sw: "Jina la programu ya sasa", fr: "Nom du logiciel actuel", rw: "Izina rya porogaramu iriho" },
  "Interested Modules": { sw: "Moduli unazopenda", fr: "Modules qui vous intéressent", rw: "Ibyiciro mushaka" },
  Attendance: { sw: "Mahudhurio", fr: "Présence", rw: "Ubwitabire" },
  Fees: { sw: "Ada", fr: "Frais", rw: "Amafaranga" },
  Exams: { sw: "Mitihani", fr: "Examens", rw: "Ibizamini" },
  "Parent App": { sw: "Programu ya mzazi", fr: "Application parents", rw: "Porogaramu y'ababyeyi" },
  "HR & Payroll": { sw: "Rasilimali watu na mishahara", fr: "RH et paie", rw: "Abakozi n'imishahara" },
  Transport: { sw: "Usafiri", fr: "Transport", rw: "Ubwikorezi" },
  Library: { sw: "Maktaba", fr: "Bibliothèque", rw: "Isomero" },
  Accounting: { sw: "Uhasibu", fr: "Comptabilité", rw: "Ibaruramari" },
  "Preferred Demo Date": { sw: "Tarehe unayopendelea", fr: "Date souhaitée pour la démo", rw: "Itariki mwifuza demo" },
  "Preferred Demo Time": { sw: "Muda unaopendelea", fr: "Heure souhaitée pour la démo", rw: "Igihe mwifuza demo" },
  "Additional Requirements (Optional)": { sw: "Mahitaji ya ziada (si lazima)", fr: "Besoins complémentaires (facultatif)", rw: "Ibisabwa by'inyongera (ntabwo ari ngombwa)" },
  "I agree to be contacted regarding my demo request.": { sw: "Nakubali kuwasiliana nami kuhusu ombi langu la onyesho.", fr: "J'accepte d'être contacté au sujet de ma demande de démo.", rw: "Nemeye ko mwandikira cyangwa mukampamagara ku busabe bwanjye bwa demo." },
  "Book Free Demo": { sw: "Weka onyesho la bure", fr: "Réserver la démo gratuite", rw: "Saba demo y'ubuntu" },
  "Submitting…": { sw: "Inatuma…", fr: "Envoi en cours…", rw: "Birimo koherezwa…" },
  "Request received": { sw: "Ombi limepokelewa", fr: "Demande reçue", rw: "Ubusabe bwakiriwe" },
  "Thank you! Your demo request is on its way.": { sw: "Asante! Ombi lako la onyesho limepokelewa.", fr: "Merci ! Votre demande de démo est en route.", rw: "Murakoze! Ubusabe bwanyu bwa demo burakiriwe." },
  "Return Home": { sw: "Rudi mwanzo", fr: "Retour à l'accueil", rw: "Subira ahabanza" },
  "Request a demo, ask a question, or schedule a consultation with our team.": {
    sw: "Omba onyesho, uliza swali, au panga ushauri na timu yetu.",
    fr: "Demandez une démo, posez une question ou planifiez une consultation avec notre équipe.",
    rw: "Saba demo, ubaze ikibazo cyangwa utegure inama n'itsinda ryacu.",
  },
  "Full name": { sw: "Jina kamili", fr: "Nom complet", rw: "Amazina yose" },
  "School name": { sw: "Jina la shule", fr: "Nom de l'école", rw: "Izina ry'ishuri" },
  Email: { sw: "Barua pepe", fr: "E-mail", rw: "Imeli" },
  Phone: { sw: "Simu", fr: "Téléphone", rw: "Telefoni" },
  "How can we help?": { sw: "Tunaweza kukusaidiaje?", fr: "Comment pouvons-nous vous aider ?", rw: "Twagufasha dute?" },
  "Send message": { sw: "Tuma ujumbe", fr: "Envoyer le message", rw: "Ohereza ubutumwa" },
  "One Platform.": { sw: "Jukwaa moja.", fr: "Une plateforme.", rw: "Porogaramu imwe." },
  "Every Solution.": { sw: "Kila suluhisho.", fr: "Toutes les solutions.", rw: "Ibisubizo byose." },
  "Flexible pricing for schools that want a premium digital experience with clarity, control, and confidence.": {
    sw: "Bei rahisi kubadilika kwa shule zinazotaka uzoefu bora wa kidijitali wenye uwazi, udhibiti na imani.",
    fr: "Des tarifs flexibles pour les écoles qui veulent une expérience numérique premium, claire et maîtrisée.",
    rw: "Ibiciro byoroshye ku mashuri ashaka ubunararibonye buhebuje bwa digitale bufite ibisobanuro n'icyizere.",
  },
  "Important Conditions": { sw: "Masharti muhimu", fr: "Conditions importantes", rw: "Amabwiriza y'ingenzi" },
  "Parents get": { sw: "Wazazi wanapata", fr: "Les parents bénéficient de", rw: "Ababyeyi babona" },
  "Schools benefit": { sw: "Shule zinanufaika", fr: "Les écoles bénéficient de", rw: "Amashuri yunguka" },
  "A platform that feels as polished as your school brand": { sw: "Jukwaa lililoboreshwa kama chapa ya shule yako", fr: "Une plateforme aussi soignée que l'image de votre école", rw: "Porogaramu inoze nk'ikirango cy'ishuri ryanyu" },
  "Quick Navigation": { sw: "Urambazaji wa haraka", fr: "Navigation rapide", rw: "Uburyo bwihuse" },
  "Follow Us": { sw: "Tufuate", fr: "Suivez-nous", rw: "Dukurikire" },
  "Privacy Policy": { sw: "Sera ya faragha", fr: "Politique de confidentialité", rw: "Politiki y'ubuzima bwite" },
  "Terms & Conditions": { sw: "Masharti", fr: "Conditions générales", rw: "Amabwiriza" },
  "Africa.": { sw: "Afrika.", fr: "Afrique.", rw: "Afurika." },
  "Tablet-based gate and boarding attendance with offline sync.": {
    sw: "Mahudhurio ya getini na bweni kupitia tablet yenye usawazishaji wa nje ya mtandao.",
    fr: "Présence au portail et à l'internat sur tablette avec synchronisation hors ligne.",
    rw: "Kwandika ubwitabire ku irembo no mu icumbi ukoresheje tablet ikorana n'itafite interineti.",
  },
  "Registration, classes, sections, and full academic records.": {
    sw: "Usajili, madarasa, vitengo na rekodi kamili za masomo.",
    fr: "Inscriptions, classes, sections et dossiers scolaires complets.",
    rw: "Kwiyandikisha, amasomo, ibyiciro n'inyandiko zose z'amasomo.",
  },
  "Track fees, receipts, transactions, and subscriptions.": {
    sw: "Fuatilia ada, risiti, miamala na usajili.",
    fr: "Suivez les frais, reçus, transactions et abonnements.",
    rw: "Kurikirana amafaranga, inyemezabwishyu, ihererekanya n'ubwiyandikisho.",
  },
  "Configurable grading systems and instant result publishing.": {
    sw: "Mifumo ya upimaji inayoweza kubadilishwa na uchapishaji wa matokeo papo hapo.",
    fr: "Systèmes de notation configurables et publication instantanée des résultats.",
    rw: "Sisitemu z'itangwa ry'amanota zihinduka n'itangazwa ry'amanota ako kanya.",
  },
  "Attendance alerts, fee reminders, and operational messaging.": {
    sw: "Tahadhari za mahudhurio, vikumbusho vya ada na ujumbe wa uendeshaji.",
    fr: "Alertes de présence, rappels de frais et messages opérationnels.",
    rw: "Menyesha y'ubwitabire, kwibutsa amafaranga n'ubutumwa bw'imikorere.",
  },
  "Strict tenant isolation, RBAC, and full audit logging.": {
    sw: "Utenganishaji mkali wa taasisi, ruhusa kulingana na jukumu na kumbukumbu kamili za ukaguzi.",
    fr: "Isolation stricte des établissements, gestion des rôles et journalisation complète des audits.",
    rw: "Gutandukanya amashuri mu mutekano, uburenganzira bushingiye ku nshingano n'inyandiko zuzuye z'ubugenzuzi.",
  },
  "Parents view attendance, fees, results, and notifications.": {
    sw: "Wazazi huona mahudhurio, ada, matokeo na arifa.",
    fr: "Les parents consultent les présences, les frais, les résultats et les notifications.",
    rw: "Ababyeyi babona ubwitabire, amafaranga, amanota n'amenyesha.",
  },
  "Real-time analytics for admins, teachers, and owners.": {
    sw: "Uchanganuzi wa wakati halisi kwa wasimamizi, walimu na wamiliki.",
    fr: "Analyses en temps réel pour les administrateurs, enseignants et propriétaires.",
    rw: "Isesengura ryo mu gihe nyacyo ku bayobozi, abarimu na ba nyir'amashuri.",
  },
  "Built for Every Role": { sw: "Imeundwa kwa kila jukumu", fr: "Conçu pour chaque rôle", rw: "Yubakiwe buri nshingano" },
  "One platform tailored for every user in the ecosystem.": {
    sw: "Jukwaa moja lililoundwa kwa kila mtumiaji katika mfumo.",
    fr: "Une plateforme adaptée à chaque utilisateur de l'écosystème.",
    rw: "Porogaramu imwe ijyanye na buri ukoresha mu rwego rw'uburezi.",
  },
  "Super Admin": { sw: "Msimamizi mkuu", fr: "Super administrateur", rw: "Umuyobozi mukuru" },
  "School Admin": { sw: "Msimamizi wa shule", fr: "Administrateur de l'école", rw: "Umuyobozi w'ishuri" },
  Teacher: { sw: "Mwalimu", fr: "Enseignant", rw: "Mwarimu" },
  Staff: { sw: "Wafanyakazi", fr: "Personnel", rw: "Abakozi" },
  "Parent / Student": { sw: "Mzazi / Mwanafunzi", fr: "Parent / Élève", rw: "Umubyeyi / Umunyeshuri" },
  "Manages all schools, SaaS subscriptions and global monitoring.": {
    sw: "Husimamia shule zote, usajili wa SaaS na ufuatiliaji wa jumla.",
    fr: "Gère toutes les écoles, les abonnements SaaS et le suivi global.",
    rw: "Acunga amashuri yose, ubwiyandikisho bwa SaaS n'ubugenzuzi rusange.",
  },
  "Full school operations: students, staff, fees, attendance.": {
    sw: "Uendeshaji wote wa shule: wanafunzi, wafanyakazi, ada na mahudhurio.",
    fr: "Toutes les opérations de l'école : élèves, personnel, frais et présences.",
    rw: "Imikorere yose y'ishuri: abanyeshuri, abakozi, amafaranga n'ubwitabire.",
  },
  "Attendance, academic operations and class-related activities.": {
    sw: "Mahudhurio, shughuli za masomo na kazi za darasani.",
    fr: "Présences, opérations scolaires et activités liées aux classes.",
    rw: "Ubwitabire, imikorere y'amasomo n'ibikorwa byo mu ishuri.",
  },
  "Boarding operations, visitor management and gate operations.": {
    sw: "Uendeshaji wa bweni, usimamizi wa wageni na uendeshaji wa getini.",
    fr: "Opérations d'internat, gestion des visiteurs et gestion du portail.",
    rw: "Imikorere y'icumbi, gucunga abashyitsi n'imikorere ku irembo.",
  },
  "View attendance, fees, notifications and academic info.": {
    sw: "Angalia mahudhurio, ada, arifa na taarifa za masomo.",
    fr: "Consultez les présences, les frais, les notifications et les informations scolaires.",
    rw: "Reba ubwitabire, amafaranga, menyesha n'amakuru y'amasomo.",
  },
  "Ready to modernize your school?": { sw: "Uko tayari kuboresha shule yako?", fr: "Prêt à moderniser votre école ?", rw: "Mwiteguye kuvugurura ishuri ryanyu?" },
  "Get a personalized demo and see how Education Care System Africa can streamline operations for your institution.": {
    sw: "Pata onyesho la kibinafsi na uone jinsi Education Care System Africa inavyorahisisha uendeshaji wa taasisi yako.",
    fr: "Obtenez une démo personnalisée et découvrez comment Education Care System Africa simplifie les opérations de votre établissement.",
    rw: "Saba demo yihariye urebe uko Education Care System Africa yoroshya imikorere y'ikigo cyanyu.",
  },
  "Book a Demo": { sw: "Weka miadi ya onyesho", fr: "Réserver une démo", rw: "Saba demo" },
  "Tablet-based biometric capture with kiosk mode, PIN unlock, and automatic offline sync.": {
    sw: "Uchukuaji wa kibayometriki kwa tablet wenye hali ya kioski, PIN na usawazishaji wa nje ya mtandao.",
    fr: "Capture biométrique sur tablette avec mode kiosque, déverrouillage par PIN et synchronisation hors ligne automatique.",
    rw: "Kwandika biometrike ukoresheje tablet, uburyo bwa kiosk, PIN n'ihuzwa ryikora ridakoresha interineti.",
  },
  "Entry and exit logs, time tracking, and duplicate prevention.": {
    sw: "Kumbukumbu za kuingia na kutoka, ufuatiliaji wa muda na kuzuia kurudiwa.",
    fr: "Journaux d'entrée et de sortie, suivi du temps et prévention des doublons.",
    rw: "Inyandiko zo kwinjira no gusohoka, gukurikirana igihe no kwirinda kwikuba.",
  },
  "Morning and evening attendance with automated absence monitoring.": {
    sw: "Mahudhurio ya asubuhi na jioni yenye ufuatiliaji wa kiotomatiki wa kutokuwepo.",
    fr: "Présence du matin et du soir avec suivi automatique des absences.",
    rw: "Ubwitabire bwo mu gitondo na nimugoroba hamwe no gukurikirana abasibye byikora.",
  },
  "Requests, approvals, exit tracking, and unauthorized exit alerts.": {
    sw: "Maombi, idhini, ufuatiliaji wa kutoka na tahadhari za kutoka bila ruhusa.",
    fr: "Demandes, approbations, suivi des sorties et alertes de sortie non autorisée.",
    rw: "Gusaba, kwemeza, gukurikirana isohoka n'amenyesha y'isohoka ritabyemewe.",
  },
  "Registration, host assignment, appointments, and full logs.": {
    sw: "Usajili, kumteua mwenyeji, miadi na kumbukumbu kamili.",
    fr: "Enregistrement, affectation d'un hôte, rendez-vous et journaux complets.",
    rw: "Kwiyandikisha, kugenera uwakiriye, gahunda n'inyandiko zuzuye.",
  },
  "Registration, class/section setup, and academic structure management.": {
    sw: "Usajili, usanidi wa darasa/sehemu na usimamizi wa muundo wa masomo.",
    fr: "Inscriptions, configuration des classes et sections et gestion de la structure scolaire.",
    rw: "Kwiyandikisha, gutegura amasomo/ibyiciro no gucunga imiterere y'amasomo.",
  },
  "Fee tracking, receipts, transaction logs, and subscription handling.": {
    sw: "Ufuatiliaji wa ada, risiti, kumbukumbu za miamala na usimamizi wa usajili.",
    fr: "Suivi des frais, reçus, journaux des transactions et gestion des abonnements.",
    rw: "Gukurikirana amafaranga, inyemezabwishyu, inyandiko z'ihererekanya no gucunga ubwiyandikisho.",
  },
  "Configurable grading and instant result publishing for parents.": {
    sw: "Upimaji unaoweza kubadilishwa na uchapishaji wa haraka wa matokeo kwa wazazi.",
    fr: "Notation configurable et publication instantanée des résultats pour les parents.",
    rw: "Itangwa ry'amanota rihinduka n'itangazwa ry'amanota ako kanya ku babyeyi.",
  },
  "Queue-based delivery with retry for attendance and fee alerts.": {
    sw: "Utumaji kwa foleni wenye kujaribu tena kwa arifa za mahudhurio na ada.",
    fr: "Envoi par file d'attente avec nouvelles tentatives pour les alertes de présence et de frais.",
    rw: "Kohereza ku murongo bishobora kongera kugerageza ku menyesha y'ubwitabire n'amafaranga.",
  },
  "Operational analytics for super admins and school admins.": {
    sw: "Uchanganuzi wa uendeshaji kwa wasimamizi wakuu na wasimamizi wa shule.",
    fr: "Analyses opérationnelles pour les super administrateurs et les administrateurs d'école.",
    rw: "Isesengura ry'imikorere ku bayobozi bakuru n'abayobozi b'amashuri.",
  },
  "Strict tenant isolation, role-based access, and audit logging.": {
    sw: "Utenganishaji mkali wa taasisi, ruhusa kulingana na jukumu na kumbukumbu za ukaguzi.",
    fr: "Isolation stricte des établissements, accès par rôle et journalisation des audits.",
    rw: "Gutandukanya amashuri mu mutekano, uburenganzira bushingiye ku nshingano n'inyandiko z'ubugenzuzi.",
  },
  "Flutter app for attendance, fees, results, and notifications.": {
    sw: "Programu ya Flutter kwa mahudhurio, ada, matokeo na arifa.",
    fr: "Application Flutter pour les présences, les frais, les résultats et les notifications.",
    rw: "Porogaramu ya Flutter ku bwitabire, amafaranga, amanota n'amenyesha.",
  },
  "Run unlimited schools on one platform with isolated data.": {
    sw: "Endesha shule zisizo na kikomo kwenye jukwaa moja lenye data zilizotenganishwa.",
    fr: "Gérez un nombre illimité d'écoles sur une seule plateforme avec des données isolées.",
    rw: "Cunga amashuri atagira umubare kuri porogaramu imwe ifite amakuru atandukanye.",
  },
  "Configurable Academic Structures": { sw: "Miundo ya masomo inayoweza kubadilishwa", fr: "Structures académiques configurables", rw: "Imiterere y'amasomo ihinduka" },
  "Schools, classes, sections, terms â€” fully configurable.": {
    sw: "Shule, madarasa, vitengo na mihula — vinaweza kusanidiwa kikamilifu.",
    fr: "Écoles, classes, sections et trimestres — entièrement configurables.",
    rw: "Amashuri, amasomo, ibyiciro n'ibihembwe — byose birahinduka.",
  },
  "A premium, configurable SaaS platform built to power African schools from attendance and boarding to fee tracking and parent communication.": {
    sw: "Jukwaa bora la SaaS linaloweza kubadilishwa, lililoundwa kuimarisha shule za Afrika kuanzia mahudhurio na bweni hadi ada na mawasiliano ya wazazi.",
    fr: "Une plateforme SaaS premium et configurable conçue pour accompagner les écoles africaines, de la présence et l'internat au suivi des frais et à la communication avec les parents.",
    rw: "Porogaramu ya SaaS inoze kandi ihinduka yubakiwe gufasha amashuri yo muri Afurika, kuva ku bwitabire n'icumbi kugeza ku mafaranga n'itumanaho n'ababyeyi.",
  },
  "Education Care System Africa is a modern scalable SaaS-based school management platform designed to support schools through digital transformation, operational automation, attendance management, fee management, reporting, and centralized educational operations.": {
    sw: "Education Care System Africa ni jukwaa la kisasa la usimamizi wa shule la SaaS linaloweza kukua, lililoundwa kusaidia shule kupitia mageuzi ya kidijitali, automatisering, mahudhurio, ada, ripoti na uendeshaji wa elimu wa kati.",
    fr: "Education Care System Africa est une plateforme SaaS moderne et évolutive de gestion scolaire, conçue pour accompagner les écoles dans leur transformation numérique, l'automatisation, la gestion des présences, des frais, des rapports et des opérations éducatives centralisées.",
    rw: "Education Care System Africa ni porogaramu igezweho ya SaaS yo gucunga amashuri, yagenewe gufasha amashuri mu mpinduka za digitale, gukoresha imirimo byikora, gucunga ubwitabire, amafaranga, raporo n'imikorere y'uburezi ihuriweho.",
  },
  "By providing robust controls, role-based permission sets, and cross-device functionality (from administrative desktops to mobile tablets at school gates), we bridge the gap between parents, teachers, and system administrators.": {
    sw: "Kwa kutoa udhibiti imara, ruhusa kulingana na jukumu na matumizi kwenye vifaa tofauti, tunaunganisha wazazi, walimu na wasimamizi wa mfumo.",
    fr: "Grâce à des contrôles robustes, des autorisations par rôle et une utilisation multi-appareils, nous rapprochons les parents, les enseignants et les administrateurs.",
    rw: "Dutanga igenzura rikomeye, uburenganzira bushingiye ku nshingano n'imikoreshereze ku bikoresho bitandukanye, tugahuza ababyeyi, abarimu n'abayobozi ba sisitemu.",
  },
  "Multi-tenant SaaS Architecture": { sw: "Muundo wa SaaS wa taasisi nyingi", fr: "Architecture SaaS multi-établissements", rw: "Imiterere ya SaaS y'amashuri menshi" },
  "Complete data isolation for each institution on a single centralized system.": { sw: "Utenganishaji kamili wa data kwa kila taasisi kwenye mfumo mmoja wa kati.", fr: "Isolation complète des données de chaque établissement sur un système centralisé.", rw: "Gutandukanya amakuru yose ya buri shuri muri sisitemu imwe ihuriweho." },
  "School Management Ecosystem": { sw: "Mfumo wa usimamizi wa shule", fr: "Écosystème de gestion scolaire", rw: "Urwego rwo gucunga ishuri" },
  "Centralized controls for academic years, class cohorts, and registration records.": { sw: "Udhibiti wa kati wa miaka ya masomo, madarasa na rekodi za usajili.", fr: "Contrôles centralisés pour les années scolaires, les classes et les dossiers d'inscription.", rw: "Igenzura rihuriweho ry'imyaka y'amashuri, amasomo n'inyandiko z'iyandikisha." },
  "Real-time Operations": { sw: "Uendeshaji wa wakati halisi", fr: "Opérations en temps réel", rw: "Imikorere y'ako kanya" },
  "Live event logging, immediate dashboard reports, and real-time query updates.": { sw: "Kumbukumbu za matukio mubashara, ripoti za dashibodi za haraka na masasisho ya wakati halisi.", fr: "Journalisation d'événements en direct, rapports de tableau de bord immédiats et mises à jour en temps réel.", rw: "Kwandika ibyabaye ako kanya, raporo zihuse ku mbonerahamwe n'ivugurura ry'ibibazo rikorwa mu gihe nyacyo." },
  "Attendance Management": { sw: "Usimamizi wa mahudhurio", fr: "Gestion des présences", rw: "Gucunga ubwitabire" },
  "Biometric kiosk check-ins, gate entry logs, and boarding school tracking.": { sw: "Uingiaji wa kibayometriki wa kioski, kumbukumbu za getini na ufuatiliaji wa bweni.", fr: "Pointages biométriques en kiosque, journaux d'entrée au portail et suivi de l'internat.", rw: "Kwinjira kwa biometrike kuri kiosk, inyandiko z'irembo no gukurikirana icumbi." },
  "Mobile & Web Ecosystem": { sw: "Mfumo wa simu na wavuti", fr: "Écosystème mobile et web", rw: "Urwego rwa telefoni na web" },
  "Seamless accessibility via cross-platform parent apps and responsive administrative portals.": { sw: "Ufikiaji rahisi kupitia programu za wazazi za vifaa mbalimbali na tovuti za usimamizi.", fr: "Accessibilité fluide via des applications parents multiplateformes et des portails administratifs réactifs.", rw: "Kuboneka byoroshye binyuze muri porogaramu z'ababyeyi zikora ku bikoresho bitandukanye n'imbuga z'ubuyobozi zihinduka." },
  "Secure Scalable Infrastructure": { sw: "Miundombinu salama inayoweza kukua", fr: "Infrastructure sécurisée et évolutive", rw: "Ibikorwa remezo bitekanye kandi byaguka" },
  "Hosted on enterprise cloud services, backed by modern secure API endpoints.": { sw: "Inapangishwa kwenye huduma za wingu za biashara, ikisaidiwa na API salama za kisasa.", fr: "Hébergé sur des services cloud d'entreprise, soutenu par des API modernes et sécurisées.", rw: "Yakiriwe kuri serivisi za cloud z'ibigo, ishyigikiwe na API zigezweho zitekanye." },
  "To provide schools with reliable, scalable, and modern SaaS technology solutions that simplify administration, improve operational efficiency, and support long-term educational growth.": { sw: "Kutoa shule suluhisho za SaaS za kuaminika, zinazoweza kukua na za kisasa ili kurahisisha usimamizi na kukuza elimu.", fr: "Fournir aux écoles des solutions SaaS fiables, évolutives et modernes qui simplifient l'administration et soutiennent la croissance éducative.", rw: "Guha amashuri ibisubizo bya SaaS byizewe, byaguka kandi bigezweho byoroshya ubuyobozi, byongera imikorere kandi bigashyigikira iterambere rirambye ry'uburezi." },
  "Our core success pillars drive long-term value, reliability, and growth for partner institutions.": { sw: "Nguzo zetu kuu za mafanikio huleta thamani, uaminifu na ukuaji wa muda mrefu kwa taasisi washirika.", fr: "Nos piliers de réussite créent de la valeur, de la fiabilité et de la croissance à long terme pour nos établissements partenaires.", rw: "Inkingi zacu z'ingenzi zitanga agaciro karambye, ukwizerwa n'iterambere ku bigo dufatanya." },
  "School name is required.": { sw: "Jina la shule linahitajika.", fr: "Le nom de l'école est requis.", rw: "Izina ry'ishuri rirakenewe." },
  "Please select a country.": { sw: "Tafadhali chagua nchi.", fr: "Veuillez sélectionner un pays.", rw: "Hitamo igihugu." },
  "Contact person name is required.": { sw: "Jina la mtu wa mawasiliano linahitajika.", fr: "Le nom du contact est requis.", rw: "Izina ry'uwo twavugana rirakenewe." },
  "Designation or job title is required.": { sw: "Cheo au jina la kazi linahitajika.", fr: "La fonction ou le poste est requis.", rw: "Umwanya w'akazi urakenewe." },
  "Mobile number is required.": { sw: "Nambari ya simu inahitajika.", fr: "Le numéro de mobile est requis.", rw: "Nomero ya telefoni irakenewe." },
  "Enter a valid phone number.": { sw: "Weka nambari sahihi ya simu.", fr: "Saisissez un numéro de téléphone valide.", rw: "Andika nomero ya telefoni yemewe." },
  "Email address is required.": { sw: "Anwani ya barua pepe inahitajika.", fr: "L'adresse e-mail est requise.", rw: "Aderesi imeli irakenewe." },
  "Enter a valid email address.": { sw: "Weka anwani sahihi ya barua pepe.", fr: "Saisissez une adresse e-mail valide.", rw: "Andika aderesi imeli yemewe." },
  "Enter school name": { sw: "Weka jina la shule", fr: "Saisissez le nom de l'école", rw: "Andika izina ry'ishuri" },
  "Select your country": { sw: "Chagua nchi yako", fr: "Sélectionnez votre pays", rw: "Hitamo igihugu cyanyu" },
  "Enter full name": { sw: "Weka jina kamili", fr: "Saisissez le nom complet", rw: "Andika amazina yose" },
  "Enter designation": { sw: "Weka cheo", fr: "Saisissez la fonction", rw: "Andika umwanya w'akazi" },
  "Enter mobile number": { sw: "Weka nambari ya simu", fr: "Saisissez le numéro de mobile", rw: "Andika nomero ya telefoni" },
  "Enter email address": { sw: "Weka anwani ya barua pepe", fr: "Saisissez l'adresse e-mail", rw: "Andika aderesi imeli" },
  "Enter current software name": { sw: "Weka jina la programu ya sasa", fr: "Saisissez le nom du logiciel actuel", rw: "Andika izina rya porogaramu iriho" },
  "Select time": { sw: "Chagua muda", fr: "Sélectionnez une heure", rw: "Hitamo igihe" },
  "Morning (9AM - 12PM)": { sw: "Asubuhi (9:00 - 12:00)", fr: "Matin (9 h - 12 h)", rw: "Mu gitondo (9:00 - 12:00)" },
  "Afternoon (1PM - 4PM)": { sw: "Mchana (13:00 - 16:00)", fr: "Après-midi (13 h - 16 h)", rw: "Nyuma ya saa sita (13:00 - 16:00)" },
  "Evening (4PM - 6PM)": { sw: "Jioni (16:00 - 18:00)", fr: "Soir (16 h - 18 h)", rw: "Nimugoroba (16:00 - 18:00)" },
  "Tell us more about your requirements...": { sw: "Tuambie zaidi kuhusu mahitaji yako...", fr: "Dites-nous en plus sur vos besoins…", rw: "Tubwire byinshi ku byo mukeneye..." },
  "Optional — up to 500 characters.": { sw: "Si lazima — hadi herufi 500.", fr: "Facultatif — jusqu'à 500 caractères.", rw: "Si ngombwa — inyuguti zitarenze 500." },
  "We respect your privacy. Your information is safe with us.": { sw: "Tunaheshimu faragha yako. Taarifa zako ziko salama nasi.", fr: "Nous respectons votre vie privée. Vos informations sont en sécurité chez nous.", rw: "Twubaha ubuzima bwite bwanyu. Amakuru yanyu atekanye iwacu." },
  "Thanks! We'll be in touch shortly.": { sw: "Asante! Tutawasiliana nawe hivi karibuni.", fr: "Merci ! Nous vous contacterons prochainement.", rw: "Murakoze! Turabavugisha vuba." },
  "© 2026 ECA – Education Care Africa. All rights reserved": { sw: "© 2026 ECA – Education Care Africa. Haki zote zimehifadhiwa.", fr: "© 2026 ECA – Education Care Africa. Tous droits réservés.", rw: "© 2026 ECA – Education Care Africa. Uburenganzira bwose burabitswe." },
  "Powered by Netrack": { sw: "Inaendeshwa na Netrack", fr: "Propulsé par Netrack", rw: "Bikorwa na Netrack" },
  "Billing by enrolled students": { sw: "Malipo kulingana na wanafunzi waliosajiliwa", fr: "Facturation selon les élèves inscrits", rw: "Kwishyura hashingiwe ku banyeshuri biyandikishije" },
  "Pricing is based on total enrolled students, billed per student.": { sw: "Bei inategemea jumla ya wanafunzi waliosajiliwa, kwa kila mwanafunzi.", fr: "Les tarifs sont basés sur le nombre total d'élèves inscrits, par élève.", rw: "Ibiciro bishingira ku mubare w'abanyeshuri biyandikishije, ku munyeshuri umwe." },
  "Min. 200 students required": { sw: "Kima cha chini wanafunzi 200", fr: "Minimum de 200 élèves requis", rw: "Nibura abanyeshuri 200 barakenewe" },
  "Minimum 200 students required for per-student subscription.": { sw: "Wanafunzi wasiopungua 200 wanahitajika kwa usajili wa kila mwanafunzi.", fr: "Un minimum de 200 élèves est requis pour l'abonnement par élève.", rw: "Nibura abanyeshuri 200 barakenewe ku bwiyandikisho bwa buri munyeshuri." },
  "10% off on termly billing": { sw: "Punguzo la 10% kwa malipo ya muhula", fr: "10 % de réduction pour la facturation trimestrielle", rw: "Kugabanyirizwa 10% ku kwishyura kw'igihembwe" },
  "Save 10% when you subscribe on a termly billing cycle.": { sw: "Okoa 10% unapojiandikisha kwa muhula.", fr: "Économisez 10 % avec un abonnement trimestriel.", rw: "Bika 10% iyo wiyandikishije kwishyura mu gihembwe." },
  "20% off on yearly billing": { sw: "Punguzo la 20% kwa malipo ya mwaka", fr: "20 % de réduction pour la facturation annuelle", rw: "Kugabanyirizwa 20% ku kwishyura kw'umwaka" },
  "Save 20% when you subscribe on a yearly billing cycle.": { sw: "Okoa 20% unapojiandikisha kwa mwaka.", fr: "Économisez 20 % avec un abonnement annuel.", rw: "Bika 20% iyo wiyandikishije kwishyura buri mwaka." },
  "School plan covers all users": { sw: "Mpango wa shule unahusu watumiaji wote", fr: "Le forfait école couvre tous les utilisateurs", rw: "Gahunda y'ishuri ikubiyemo abakoresha bose" },
  "School Plan covers the entire school — all students and staff.": { sw: "Mpango wa shule unahusu shule nzima — wanafunzi na wafanyakazi wote.", fr: "Le forfait école couvre toute l'école — tous les élèves et le personnel.", rw: "Gahunda y'ishuri ikubiyemo ishuri ryose — abanyeshuri n'abakozi bose." },
  "Includes updates & backups": { sw: "Inajumuisha masasisho na nakala rudufu", fr: "Mises à jour et sauvegardes incluses", rw: "Harimo ivugurura n'ibika" },
  "All plans include updates, security, backups, and support.": { sw: "Mipango yote inajumuisha masasisho, usalama, nakala rudufu na msaada.", fr: "Tous les forfaits incluent les mises à jour, la sécurité, les sauvegardes et l'assistance.", rw: "Gahunda zose zirimo ivugurura, umutekano, ibika n'ubufasha." },
  Starter: { sw: "Mwanzo", fr: "Débutant", rw: "Intangiriro" },
  Recommended: { sw: "Inapendekezwa", fr: "Recommandé", rw: "Birasabwa" },
  Enterprise: { sw: "Kampuni", fr: "Entreprise", rw: "Ikigo" },
  "Start Smart. Stay Connected.": { sw: "Anza kwa akili. Endelea kuunganishwa.", fr: "Commencez intelligemment. Restez connecté.", rw: "Tangira neza. Komeza uhuze." },
  "More Power. More Control. Better Engagement.": { sw: "Nguvu zaidi. Udhibiti zaidi. Ushirikiano bora.", fr: "Plus de puissance. Plus de contrôle. Plus d'engagement.", rw: "Ubushobozi bwinshi. Igenzura ryinshi. Ubufatanye bwiza." },
  "Complete Control. Maximum Impact.": { sw: "Udhibiti kamili. Matokeo makubwa.", fr: "Contrôle complet. Impact maximal.", rw: "Igenzura ryuzuye. Umusaruro munini." },
  "Request a quote": { sw: "Omba bei", fr: "Demander un devis", rw: "Saba igiciro" },
  "Get a quote": { sw: "Pata bei", fr: "Obtenir un devis", rw: "Saba igiciro" },
  "Contact sales": { sw: "Wasiliana na mauzo", fr: "Contacter les ventes", rw: "Vugana n'ubucuruzi" },
  "per student / per month": { sw: "kwa mwanafunzi / kwa mwezi", fr: "par élève / par mois", rw: "ku munyeshuri / ku kwezi" },
  "Most Powerful": { sw: "Yenye nguvu zaidi", fr: "Le plus puissant", rw: "Ifite ubushobozi bwinshi" },
  "All Basic features": { sw: "Vipengele vyote vya Basic", fr: "Toutes les fonctionnalités Basic", rw: "Ibiranga byose bya Basic" },
  "All Medium features": { sw: "Vipengele vyote vya Medium", fr: "Toutes les fonctionnalités Medium", rw: "Ibiranga byose bya Medium" },
  "Purpose-built for schools": { sw: "Imeundwa mahsusi kwa shule", fr: "Conçu spécialement pour les écoles", rw: "Yubakiwe amashuri by'umwihariko" },
  "Every workflow is designed around attendance, parents, staff, and leadership needs.": { sw: "Kila mchakato umeundwa kwa mahudhurio, wazazi, wafanyakazi na viongozi.", fr: "Chaque processus est conçu pour les besoins des présences, parents, équipes et dirigeants.", rw: "Buri mikorere yubakiwe ubwitabire, ababyeyi, abakozi n'abayobozi." },
  "Reliable at scale": { sw: "Ya kuaminika inapokua", fr: "Fiable à grande échelle", rw: "Yizewe uko yaguka" },
  "The platform stays dependable for single schools, growing campuses, and multi-site groups.": { sw: "Jukwaa linabaki la kuaminika kwa shule moja, kampasi zinazokua na vikundi vya maeneo mengi.", fr: "La plateforme reste fiable pour les écoles uniques, les campus en croissance et les groupes multi-sites.", rw: "Porogaramu ikomeza kwizerwa ku ishuri rimwe, ibigo bigenda byaguka n'amatsinda y'amashuri menshi." },
  "Secure by design": { sw: "Salama kwa usanifu", fr: "Sécurisé par conception", rw: "Umutekano uhereye ku gishushanyo" },
  "Access controls, audit trails, and backups help your institution stay protected and compliant.": { sw: "Udhibiti wa ufikiaji, kumbukumbu za ukaguzi na nakala rudufu hulinda taasisi yako.", fr: "Les contrôles d'accès, les pistes d'audit et les sauvegardes protègent votre établissement.", rw: "Igenzura ry'uburenganzira, inyandiko z'ubugenzuzi n'ibika bifasha ikigo cyanyu kuguma gitekanye kandi cyubahiriza amabwiriza." },
  "Real-time attendance alerts": { sw: "Arifa za mahudhurio za wakati halisi", fr: "Alertes de présence en temps réel", rw: "Menyesha y'ubwitabire mu gihe nyacyo" },
  "Gate entry & exit notifications": { sw: "Arifa za kuingia na kutoka getini", fr: "Notifications d'entrée et de sortie au portail", rw: "Menyesha yo kwinjira no gusohoka ku irembo" },
  "Attendance & absence SMS": { sw: "SMS za mahudhurio na kutokuwepo", fr: "SMS de présence et d'absence", rw: "Ubutumwa bwa SMS ku bwitabire no gusiba" },
  "Fee reminder notifications": { sw: "Arifa za kukumbusha ada", fr: "Notifications de rappel des frais", rw: "Menyesha yo kwibutsa amafaranga" },
  "Emergency alerts": { sw: "Tahadhari za dharura", fr: "Alertes d'urgence", rw: "Menyesha z'ikorwa ryihutirwa" },
  "Smart gate attendance": { sw: "Mahudhurio mahiri ya getini", fr: "Présence intelligente au portail", rw: "Ubwitabire bw'ubwenge ku irembo" },
  "Staff attendance management": { sw: "Usimamizi wa mahudhurio ya wafanyakazi", fr: "Gestion des présences du personnel", rw: "Gucunga ubwitabire bw'abakozi" },
  "Basic dashboard & reports": { sw: "Dashibodi na ripoti za msingi", fr: "Tableau de bord et rapports de base", rw: "Imbonerahamwe na raporo by'ibanze" },
  "Fee status monitoring": { sw: "Ufuatiliaji wa hali ya ada", fr: "Suivi de l'état des frais", rw: "Gukurikirana imiterere y'amafaranga" },
  "SMS communication system": { sw: "Mfumo wa mawasiliano ya SMS", fr: "Système de communication SMS", rw: "Sisitemu y'itumanaho rya SMS" },
  "Classroom attendance": { sw: "Mahudhurio darasani", fr: "Présence en classe", rw: "Ubwitabire mu ishuri" },
  "Timetable & results access": { sw: "Ufikiaji wa ratiba na matokeo", fr: "Accès à l'emploi du temps et aux résultats", rw: "Kubona ingengabihe n'amanota" },
  "Online fee payments (MoMo)": { sw: "Malipo ya ada mtandaoni (MoMo)", fr: "Paiements de frais en ligne (MoMo)", rw: "Kwishyura amafaranga kuri interineti (MoMo)" },
  "Teacher communication": { sw: "Mawasiliano ya walimu", fr: "Communication avec les enseignants", rw: "Itumanaho n'abarimu" },
  "School announcements": { sw: "Matangazo ya shule", fr: "Annonces de l'école", rw: "Kwamamaza ry'ishuri" },
  "Visitor & boarding alerts": { sw: "Tahadhari za wageni na bweni", fr: "Alertes visiteurs et internat", rw: "Menyesha z'abashyitsi n'icumbi" },
  "Timetable management": { sw: "Usimamizi wa ratiba", fr: "Gestion des emplois du temps", rw: "Gucunga ingengabihe" },
  "Result management": { sw: "Usimamizi wa matokeo", fr: "Gestion des résultats", rw: "Gucunga amanota" },
  "Fee management": { sw: "Usimamizi wa ada", fr: "Gestion des frais", rw: "Gucunga amafaranga" },
  "Boarding management": { sw: "Usimamizi wa bweni", fr: "Gestion de l'internat", rw: "Gucunga icumbi" },
  "Visitor management": { sw: "Usimamizi wa wageni", fr: "Gestion des visiteurs", rw: "Gucunga abashyitsi" },
  "Advanced reports & insights": { sw: "Ripoti na uchambuzi wa hali ya juu", fr: "Rapports et analyses avancés", rw: "Raporo n'ubusesenguzi buhanitse" },
  "Teacher & staff access": { sw: "Ufikiaji wa walimu na wafanyakazi", fr: "Accès des enseignants et du personnel", rw: "Uburenganzira bw'abarimu n'abakozi" },
  "AI student insights": { sw: "Uchanganuzi wa wanafunzi kwa AI", fr: "Analyses élèves par IA", rw: "Ubusesenguzi bw'abanyeshuri na AI" },
  "Behavior & performance tracking": { sw: "Ufuatiliaji wa tabia na utendaji", fr: "Suivi du comportement et des performances", rw: "Gukurikirana imyitwarire n'imikorere" },
  "Boarding activity monitoring": { sw: "Ufuatiliaji wa shughuli za bweni", fr: "Suivi des activités de l'internat", rw: "Gukurikirana ibikorwa byo mu icumbi" },
  "Instant smart notifications": { sw: "Arifa mahiri za haraka", fr: "Notifications intelligentes instantanées", rw: "Menyesha z'ubwenge z'ako kanya" },
  "Priority support": { sw: "Msaada wa kipaumbele", fr: "Assistance prioritaire", rw: "Ubufasha bwihutirwa" },
  "Payroll & HR management": { sw: "Usimamizi wa mishahara na rasilimali watu", fr: "Gestion de la paie et des RH", rw: "Gucunga imishahara n'abakozi" },
  "Examination management": { sw: "Usimamizi wa mitihani", fr: "Gestion des examens", rw: "Gucunga ibizamini" },
  "AI-powered analytics": { sw: "Uchanganuzi unaoendeshwa na AI", fr: "Analyses propulsées par l'IA", rw: "Isesengura rikoresha AI" },
  "Advanced security & roles": { sw: "Usalama wa hali ya juu na majukumu", fr: "Sécurité avancée et rôles", rw: "Umutekano uhanitse n'inshingano" },
  "Financial & accounting reports": { sw: "Ripoti za fedha na uhasibu", fr: "Rapports financiers et comptables", rw: "Raporo z'imari n'ibaruramari" },
  "Enterprise control & automation": { sw: "Udhibiti na automatisering ya biashara", fr: "Contrôle et automatisation d'entreprise", rw: "Igenzura n'imikorere yikora by'ikigo" },
};

function translatedText(source: string, language: LandingLanguage) {
  return language === "en" ? source : copy[source]?.[language] ?? source;
}

function withWhitespace(source: string, translated: string) {
  const before = source.match(/^\s*/)?.[0] ?? "";
  const after = source.match(/\s*$/)?.[0] ?? "";
  return `${before}${translated}${after}`;
}

function translateRoot(root: HTMLElement, language: LandingLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;

  while ((node = walker.nextNode())) textNodes.push(node as Text);

  textNodes.forEach((textNode) => {
    if (!textNode.parentElement || textNode.parentElement.closest("[data-no-translate], script, style")) return;
    const source = textNode.nodeValue ?? "";
    const key = source.trim().replace(/\s+/g, " ");
    const translation = translatedText(key, language);
    if (key && translation !== key) textNode.nodeValue = withWhitespace(source, translation);
  });

  root.querySelectorAll<HTMLElement>("[placeholder], [title], [aria-label]").forEach((element) => {
    if (element.closest("[data-no-translate]")) return;
    ["placeholder", "title", "aria-label"].forEach((attribute) => {
      const source = element.getAttribute(attribute);
      if (!source) return;
      const translation = translatedText(source, language);
      if (translation !== source) element.setAttribute(attribute, translation);
    });
  });
}

export function LandingLocalization({ language, children }: { language: LandingLanguage; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!root.current) return;
    translateRoot(root.current, language);
    const observer = new MutationObserver(() => root.current && translateRoot(root.current, language));
    observer.observe(root.current, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return (
    <LandingLanguageContext.Provider value={language}>
      <div ref={root} className="contents">{children}</div>
    </LandingLanguageContext.Provider>
  );
}
