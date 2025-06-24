import { headers } from 'next/headers';
import { App } from '@/components/app';
import { getAppConfig, getOrigin } from '@/lib/utils';
import Link from 'next/link';

export default async function Page() {
  const hdrs = await headers();
  const origin = getOrigin(hdrs);
  const appConfig = await getAppConfig(origin);

  return (
    <>
      <App appConfig={appConfig} />
      <Link
        href="/demos"
        className="fixed bottom-8 right-8 z-50 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
      >
        View More Demos →
      </Link>
    </>
  );
}
