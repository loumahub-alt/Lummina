export const practiceAreas = [
  {
    title: 'Business Law',
    slug: 'business-law',
    icon: 'briefcase',
    hero: { heading: 'Business Law', supportingText: 'Durable businesses are built on sound legal foundations.' },
    shortDescription: 'Durable businesses are built on sound legal foundations. We design and implement the legal infrastructure that makes sustainable growth possible.',
    fullDescription: 'Clear ownership architecture and documented decision frameworks, contracts that allocate risk with precision, governance systems that scale as the business does, and regulatory compliance built into operations.',
    services: ['Business Formation', 'Corporate & Commercial Advisory', 'Corporate Structuring & Governance', 'Contract Drafting & Review', 'Legal & Regulatory Compliance', 'Commercial Documentation', 'Company Secretarial Services', 'Due Diligence'].map((name, displayOrder) => ({ name, displayOrder })),
  },
  {
    title: 'Real Estate & Property',
    slug: 'real-estate-property',
    icon: 'building',
    shortDescription: 'Property is one of the most significant assets an individual or business will ever hold. We advise on acquisition, structuring, and long-term protection.',
    fullDescription: 'We help clients assess property risk early, structure acquisitions clearly, and protect the value and continuity of significant real estate assets.',
    services: ['Property Transactions', 'Title Due Diligence', 'Asset Structuring & Protection'].map((name) => ({ name })),
  },
  {
    title: 'Transactions & Capital',
    slug: 'transactions-capital',
    icon: 'handshake',
    shortDescription: 'Capital deployment and corporate transactions require structured documentation and clear execution strategy.',
    fullDescription: 'We align transaction documentation, commercial objectives, diligence and execution so capital can move with clarity and control.',
    services: ['Investment Support & Documentation', 'Mergers & Acquisitions', 'Corporate Reorganisations & Restructuring'].map((name) => ({ name })),
  },
  {
    title: 'Intellectual Property',
    slug: 'intellectual-property',
    icon: 'badge',
    shortDescription: 'We advise on the full spectrum of intellectual property protection and enforcement, from brand identity to proprietary technology.',
    fullDescription: 'Our advice helps clients identify, protect, commercialise and enforce the intellectual property that gives their businesses value.',
    services: ['Patent Registration & Protection', 'Trademark Filings & Enforcement', 'Copyright Advisory', 'Trade Secret Protection'].map((name) => ({ name })),
  },
  {
    title: 'Cross-Border Transactions',
    slug: 'cross-border-transactions',
    icon: 'globe',
    shortDescription: 'Operating across jurisdictions introduces layers of legal complexity that require both local depth and international perspective.',
    fullDescription: 'We help clients coordinate local requirements, cross-border structures, regulatory obligations and transaction execution across jurisdictions.',
    services: [],
  },
  {
    title: 'Private Client Services',
    slug: 'private-client-services',
    icon: 'users',
    shortDescription: 'We work with founders and families to create durable legal structures that protect assets, plan for succession, and ensure continuity across generations.',
    fullDescription: 'Our private client counsel is discreet, practical and designed around long-term protection, continuity and family priorities.',
    services: ['Trust Structures & Family Office Advisory', 'Succession Planning', 'Long-Term Asset Protection'].map((name) => ({ name })),
  },
];

export const results = [
  { title: 'Debt-to-equity conversion support for a high-value commercial matter', slug: 'debt-equity-conversion', headlineFigure: '$21M', category: 'Debt Recovery', shortDescription: 'Experience includes facilitating a major debt-to-equity conversion while balancing business continuity, governance and recovery strategy.', matterDescription: 'Representative experience includes structured transaction and recovery strategy.', jurisdiction: 'Nigeria' },
  { title: 'Debt recoveries for local clients across commercial matters', slug: 'local-debt-recoveries', headlineFigure: 'NGN 500M+', category: 'Recovery Strategy', shortDescription: 'Representative experience includes structured recovery strategy, negotiation and dispute planning for significant local client debts.', matterDescription: 'Recovery support across significant local commercial matters.', jurisdiction: 'Nigeria' },
  { title: 'Recovery support for international client interests', slug: 'international-recovery', headlineFigure: '$2M+', category: 'Cross-Border Recovery', shortDescription: 'Experience includes advising on recovery considerations for international clients with Nigerian commercial touchpoints.', matterDescription: 'Cross-border recovery considerations and support.', jurisdiction: 'Cross-Border' },
  { title: 'Governance and compliance support for regulated business environments', slug: 'corporate-governance', headlineFigure: 'Board-Level', category: 'Corporate Governance', shortDescription: 'Advised on company restructuring, corporate governance and regulatory compliance for businesses operating in sensitive sectors.', matterDescription: 'Governance and compliance advisory for regulated environments.', jurisdiction: 'Nigeria' },
];

export const insights = [
  { title: 'Building Stronger Legal Foundations for Nigerian Businesses', slug: 'business-law-nigeria', type: 'article', excerpt: 'A practical guide to contracts, governance and compliance steps that help companies grow with confidence.', content: 'A practical guide to contracts, governance and compliance steps that help companies grow with confidence.', isFeatured: true },
  { title: 'Debt Recovery Strategy: What Businesses Should Do Before Litigation', slug: 'debt-recovery-strategy', type: 'article', excerpt: 'How evidence, negotiation posture and debtor analysis can shape better recovery outcomes.', content: 'How evidence, negotiation posture and debtor analysis can shape better recovery outcomes.' },
  { title: 'Startup Legal Readiness Checklist', slug: 'startup-readiness', type: 'publication', excerpt: 'A founder-focused checklist covering incorporation, equity, contracts, IP and investor preparedness.', content: 'A founder-focused checklist covering incorporation, equity, contracts, IP and investor preparedness.' },
];

export const testimonials = [
  { clientDisplayName: 'Business Client', company: null, position: 'Commercial Advisory Matter', testimonial: 'Lummina brings thoughtful legal strategy and a practical understanding of the Nigerian business environment.', identityMode: 'anonymous' },
  { clientDisplayName: 'Private Client', company: null, position: 'Dispute Resolution Matter', testimonial: 'The team is responsive, precise and focused on solutions that fit the circumstances of the client.', identityMode: 'anonymous' },
];

export const statistics = [
  { value: '14', label: 'Practice Areas', supportingText: 'Legal support across the needs of growing businesses, founders and private clients.' },
  { value: '$21M', label: 'Debt-to-Equity Transaction Experience', supportingText: 'Representative firm experience.' },
  { value: 'NGN 500M+', label: 'Debt Recoveries Referenced in Firm Experience', supportingText: 'Representative firm experience.' },
  { value: '$2M+', label: 'International Client Recovery Experience', supportingText: 'Representative firm experience.' },
];

export const seo = [
  { pageKey: 'home', seoTitle: 'Lummina Law Firm Lagos | Legal Clarity for Businesses', metaDescription: 'Commercially intelligent legal advisory for businesses, founders, investors and private clients in Nigeria.' },
  { pageKey: 'about', seoTitle: 'About Lummina Law Firm | Commercial Legal Advisory Lagos', metaDescription: 'Learn how Lummina helps businesses navigate legal and regulatory complexity with clarity and structure.' },
  { pageKey: 'practice-areas', seoTitle: 'Commercial Law Firm Lagos | Practice Areas | Lummina Law Firm', metaDescription: 'Explore commercially minded legal advisory across business, property, transactions, IP, cross-border and private client needs.' },
  { pageKey: 'our-team', seoTitle: 'Our Team | Lummina Law Firm Lagos', metaDescription: 'Meet the Lummina team combining legal knowledge, commercial awareness and practical judgment.' },
  { pageKey: 'results', seoTitle: 'Commercial Legal Results | Lummina Law Firm Lagos', metaDescription: 'Representative Lummina outcomes and case highlights. Past results do not guarantee future outcomes.' },
  { pageKey: 'insights', seoTitle: 'Legal Insights Nigeria | Lummina Law Firm', metaDescription: 'Legal insights, publications and events from Lummina Law Firm in Lagos, Nigeria.' },
  { pageKey: 'consultation', seoTitle: 'Schedule a Consultation | Lummina Law Firm', metaDescription: 'Speak with Lummina Law Firm about the legal structure, transaction, risk or growth decision in front of you.' },
];

export const settings = {
  contact: {
    primaryPhone: '+234 201 330 7508',
    secondaryPhone: '+234 706 047 9068',
    email: 'info@lumminalaw.com',
    whatsapp: 'https://wa.me/2347060479068',
    address: 'Plot 5, Block 94, The Providence Street, Lekki Phase 1, Lagos State.',
    mapUrl: 'https://maps.google.com/?q=Plot+5,+Block+94,+The+Providence+Street,+Lekki+Phase+1,+Lagos+State',
  },
  social: {
    facebook: 'https://www.facebook.com/share/18gaSk6dJ5/?mibextid=wwXIfr',
    x: 'https://x.com/lumminalaw?s=11',
    linkedin: 'https://www.linkedin.com/company/lumminalawfirm/',
    instagram: 'https://www.instagram.com/lummina.law',
  },
  general: { firmName: 'Lummina Law Firm', timezone: 'Africa/Lagos', notificationEmail: 'info@lumminalaw.com' },
  legal: {
    resultsDisclaimer: 'Past results do not guarantee, warrant or predict a similar outcome in any future matter.',
    consultationDisclaimer: 'Submitting a consultation request does not create an attorney-client relationship.',
  },
};
