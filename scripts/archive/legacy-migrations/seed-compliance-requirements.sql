-- Seed data for Florida HOA Compliance Requirements
-- Based on FL Statute 720.303(4) effective January 1, 2025

INSERT INTO compliance_requirements (id, statute_ref, title, description, category, posting_location, posting_deadline_days, retention_years, requires_annual_update, is_repeating, sort_order) VALUES

-- Governing Documents (HOA-01 through HOA-04, HOA-15)
('HOA-01', '§720.303(4)(b)1.a', 'Articles of incorporation and all amendments',
'The articles of incorporation of the association and all amendments to the articles currently in effect. This is the founding document that creates the association as a legal entity under Florida law.',
'governing_docs', 'members', NULL, 9999, 0, 0, 1),

('HOA-02', '§720.303(4)(b)1.a', 'Recorded bylaws and all amendments',
'The recorded bylaws of the association and all amendments to the bylaws currently in effect. Bylaws govern the internal operations of the association including board elections, meetings, and member rights.',
'governing_docs', 'public', NULL, 9999, 0, 0, 2),

('HOA-03', '§720.303(4)(b)1.a', 'Declaration of covenants and all amendments',
'The recorded declaration of covenants and all amendments to the declaration currently in effect. This is the primary governing document that establishes the HOA and binds all property owners.',
'governing_docs', 'public', NULL, 9999, 0, 0, 3),

('HOA-04', '§720.303(4)(b)1.a', 'Current rules of the association',
'A copy of the current rules of the association. Rules are adopted by the board and govern day-to-day operations, architectural standards, and community conduct.',
'governing_docs', 'public', NULL, 7, 0, 0, 4),

('HOA-15', '§720.303(15)', 'Rules and covenants provided to every member via homepage',
'The declaration of covenants and bylaws of the association and all amendments to either, provided via a conspicuous link or a subpage of the homepage. This satisfies the delivery requirement to all members.',
'governing_docs', 'homepage', NULL, 9999, 0, 0, 15),

-- Contracts (HOA-05, HOA-10, HOA-11)
('HOA-05', '§720.303(4)(b)1.b', 'Executory contracts and bids (last year)',
'A list of all executory contracts, including, but not limited to, contracts for architectural, engineering, landscaping, and legal services, and a list of all bids for work to be performed received in the last 12 months. Each contract or bid must identify the parties, the date entered into or received, the contract subject matter and term, and the contract or bid amount.',
'contracts', 'members', NULL, 7, 1, 0, 5),

('HOA-10', '§720.303(4)(b)1.j', 'Contracts/transactions with directors or officers',
'Contracts or transactions between the association and any director, officer, corporation, firm, or association that is not an affiliated homeowners association or any other entity in which an association director is also a director or an officer and financially interested.',
'contracts', 'members', NULL, 7, 1, 0, 10),

('HOA-11', '§720.303(4)(b)1.k', 'Conflict of interest disclosure documents',
'Conflict of interest or financial disclosure documents required under §468.436(2)(b)6 (for community association managers) and §720.3033(2) (for directors/officers).',
'contracts', 'members', NULL, 7, 1, 0, 11),

-- Financial Documents (HOA-06, HOA-07)
('HOA-06', '§720.303(4)(b)1.c', 'Annual budget and proposed budgets for meetings',
'The annual budget required by §720.303(1) and any proposed budget to be considered at the annual meeting. Budget must include estimated revenue and expenses, reserves funding method, and special assessments (if any).',
'financial', 'members', NULL, 7, 1, 0, 6),

('HOA-07', '§720.303(4)(b)1.d', 'Financial reports and monthly statements',
'The financial report required by §720.303(7) (annual financial statements) and any monthly income or expense statement to be considered at a meeting. Quarterly or annual financial statements showing revenue, expenses, and reserve balances.',
'financial', 'members', NULL, 7, 1, 0, 7),

-- Insurance (HOA-08)
('HOA-08', '§720.303(4)(b)1.e', 'Current insurance policies',
'A copy of each current insurance policy held by or on behalf of the association. This typically includes general liability, directors & officers (D&O), and property insurance. Policy summaries showing coverage amounts, deductibles, and effective dates are acceptable.',
'insurance', 'members', NULL, 7, 1, 0, 8),

-- Board & Officers (HOA-09)
('HOA-09', '§720.303(4)(b)1.f', 'Director certifications (§720.3033(1)(a))',
'Certifications of each director as required by §720.3033(1)(a). Every director must certify in writing within 90 days of election or appointment that they have read the association''s governing documents, will work to uphold them, and will faithfully discharge their fiduciary duties.',
'governance', 'members', NULL, 7, 0, 0, 9),

-- Meeting Notices (HOA-12, HOA-13)
('HOA-12', '§720.303(4)(b)1.g', 'Member meeting notices (14 days) and agenda (7 days)',
'All contracts or transactions between the association and any director, officer, corporation, firm, or association. Notice of any meeting of the membership must be posted on the website or app at least 14 days before the meeting. The agenda and any proposed amendments to the declaration or bylaws must be posted at least 7 days before the meeting.',
'meetings', 'homepage', 14, 7, 0, 1, 12),

('HOA-13', '§720.303(4)(b)1.h', 'Board meeting notices (48 hours/7 days) and agenda',
'Notice of any board meeting, the agenda, and any other document required for the meeting as required by §720.303(2)(c). Board meeting notices must be posted at least 48 hours before the meeting if posted on the website/app, or 7 days if mailed. Agenda and meeting packet must also be posted.',
'meetings', 'homepage', 2, 7, 0, 1, 13),

-- Records Retention (HOA-14)
('HOA-14', '§720.303(4)(b)1.i', 'Written records retention policy',
'A copy of the association''s written records retention policy adopted pursuant to §720.303(5). The policy must describe the association''s retention method and retention periods for maintaining its records. Minimum retention: 7 years for most records, permanent for governing documents.',
'other', 'members', NULL, 9999, 0, 0, 14);
