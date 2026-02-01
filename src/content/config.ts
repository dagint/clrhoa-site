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
    slug: z.string().optional(),
    category: z.enum(['Governing Documents', 'Policies', 'Forms', 'Meeting Minutes', 'Other']),
    description: z.string(),
    fileUrl: z.string().url(),
    effectiveDate: z.coerce.date().optional(),
    published: z.boolean().default(true),
  }),
});

export const collections = {
  news: newsCollection,
  documents: documentsCollection,
};
