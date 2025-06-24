import Link from 'next/link';
import { demos } from './demo-config';

export default function DemosPage() {
  return (
    <div className="min-h-screen">
      <header className="bg-background/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-2xl font-bold">LiveKit Agent Demos</h1>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
                Main App
              </Link>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://github.com/livekit/agents"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(demos).map(([key, demo]) => (
            <Link
              key={key}
              href={`/demos/${key}`}
              className="block p-6 border rounded-lg hover:border-primary transition-colors bg-card"
            >
              <h2 className="text-xl font-semibold mb-2">{demo.name}</h2>
              <p className="text-muted-foreground mb-4">{demo.description}</p>
              <div className="flex flex-wrap gap-2">
                {demo.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}