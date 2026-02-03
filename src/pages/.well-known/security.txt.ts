import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const securityEmail = import.meta.env.PUBLIC_SECURITY_EMAIL ?? 'security@clrhoa.com';
  const siteURL = import.meta.env.SITE || 'https://clrhoa.com';
  const expiresDate = new Date();
  expiresDate.setFullYear(expiresDate.getFullYear() + 1); // Expires 1 year from now
  
  const securityTxt = `# Security Policy for Crooked Lake Reserve HOA Website
# ${siteURL}/.well-known/security.txt

Contact: mailto:${securityEmail}
Expires: ${expiresDate.toISOString()}
Preferred-Languages: en
Canonical: ${siteURL}/.well-known/security.txt

# Please report security vulnerabilities responsibly
# Include:
# - Description of the vulnerability
# - Steps to reproduce
# - Potential impact
# - Suggested fix (if any)

# We will respond within 5 business days

# Acknowledgments
# We appreciate responsible disclosure and will credit researchers
# (with permission) for helping improve our security.
`;

  return new Response(securityTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
};
