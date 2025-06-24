import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { demos } from '../demo-config';
import { getAppConfig, getOrigin } from '@/lib/utils';
import DemoWrapper from '@/components/demo-wrapper';

interface DemoPageProps {
  params: Promise<{
    demo: string;
  }>;
}

export default async function DemoPage({ params }: DemoPageProps) {
  const { demo: demoKey } = await params;
  const demo = demos[demoKey];

  if (!demo) {
    notFound();
  }

  const hdrs = await headers();
  const origin = getOrigin(hdrs);
  const appConfig = await getAppConfig(origin);

  return (
    <DemoWrapper
      demoKey={demoKey}
      demo={demo}
      appConfig={appConfig}
    />
  );
}

export async function generateStaticParams() {
  return Object.keys(demos).map((demo) => ({
    demo,
  }));
}