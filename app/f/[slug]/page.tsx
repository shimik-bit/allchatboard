import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import type { FormRow } from '@/lib/forms/types';
import { isPublicSafeFieldType } from '@/lib/forms/types';
import PublicFormClient from './PublicFormClient';

export const dynamic = 'force-dynamic';

type Field = {
  id: string;
  name: string;
  slug: string;
  type: string;
  is_required: boolean;
  is_primary: boolean;
  position: number | null;
  config: any;
};

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('forms')
    .select('title, description')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!data) {
    return { title: 'Form not found' };
  }
  return {
    title: `${data.title} · TaskFlow`,
    description: data.description ?? data.title,
  };
}

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
}) {
  const admin = createAdminClient();

  // 1. Resolve the form by slug (only published forms are publicly accessible)
  const { data: form } = await admin
    .from('forms')
    .select('*')
    .eq('slug', params.slug)
    .in('status', ['published', 'archived'])
    .maybeSingle();

  if (!form) {
    notFound();
  }

  const typedForm = form as FormRow;

  // 2. If archived, render a "closed" state without the form body
  if (typedForm.status === 'archived') {
    return (
      <PublicFormClient
        form={typedForm}
        fields={[]}
        isClosed
        utmSource={searchParams.utm_source ?? null}
        utmMedium={searchParams.utm_medium ?? null}
        utmCampaign={searchParams.utm_campaign ?? null}
      />
    );
  }

  // 3. Fetch the table's fields and filter to those exposed by this form
  const { data: rawFields } = await admin
    .from('fields')
    .select('id, name, slug, type, is_required, is_primary, position, config')
    .eq('table_id', typedForm.table_id)
    .order('position', { ascending: true });

  const allFields = (rawFields ?? []) as Field[];

  // Filter: only include fields that are:
  //   1. Of a public-safe type
  //   2. Marked visible in field_settings (default: visible if no settings)
  const visibleFields = allFields.filter((f) => {
    if (!isPublicSafeFieldType(f.type)) return false;
    const settings = typedForm.field_settings[f.id];
    if (settings && settings.visible === false) return false;
    return true;
  });

  // Sort by field_settings.position if set, else by field's own position
  visibleFields.sort((a, b) => {
    const ap = typedForm.field_settings[a.id]?.position ?? a.position ?? 999;
    const bp = typedForm.field_settings[b.id]?.position ?? b.position ?? 999;
    return ap - bp;
  });

  return (
    <PublicFormClient
      form={typedForm}
      fields={visibleFields}
      utmSource={searchParams.utm_source ?? null}
      utmMedium={searchParams.utm_medium ?? null}
      utmCampaign={searchParams.utm_campaign ?? null}
    />
  );
}
