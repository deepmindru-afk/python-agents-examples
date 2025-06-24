import { headers } from 'next/headers';
import { getAppConfig, getOrigin } from '@/lib/utils';
import Link from 'next/link';

interface DemoLayoutProps {
  children: React.ReactNode;
}

export default async function DemoLayout({ children }: DemoLayoutProps) {
  const hdrs = await headers();
  const origin = getOrigin(hdrs);
  const { companyName, logo, logoDark } = await getAppConfig(origin);

  return children;
}