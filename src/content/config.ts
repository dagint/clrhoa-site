import { defineCollection, z } from 'astro:content';

const newsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).optional(),
    published: z.boolean().default(true),
  }),
});

const documentsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(), // when set, can be overridden by board/ARB uploads (bylaws, covenants, proxy-form, arb-request-form)
    category: z.enum(['Governing Documents', 'Policies', 'Forms', 'Minutes', 'Other']),
    description: z.string(),
    // Accept full URLs or site-relative paths (e.g. /documents/files/name.pdf)
    fileUrl: z.string().refine((v) => v.startsWith('http') || v.startsWith('/'), {
      message: 'fileUrl must be a full URL (https://...) or a path starting with /',
    }),
    effectiveDate: z.coerce.date().optional(),
    published: z.boolean().default(true),
  }),
});

export const collections = {
  news: newsCollection,
  documents: documentsCollection,
};
