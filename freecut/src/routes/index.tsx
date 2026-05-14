import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Layers, ArrowRight, Play, FolderOpen, Download, ExternalLink, Sparkles } from 'lucide-react';
import { FreeCutLogo } from '@/components/brand/freecut-logo';
import { Button } from '@/components/ui/button';
import { MarketingHeader } from '@/components/layout/marketing-header';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export const Route = createFileRoute('/')({
  component: LandingPage,
  // Authenticated users never see the marketing landing — send them straight to /projects.
  beforeLoad: () => {
    if (useAuthStore.getState().token) {
      throw redirect({ to: '/projects' });
    }
  },
});

const faqItems = [
  {
    question: 'Is alMotion really free?',
    answer: 'alMotion offers powerful video editing tools right in your browser. Contact our team for an enterprise or premium subscription plan.',
  },
  {
    question: 'Do I need to install anything?',
    answer: 'No installation required. alMotion runs entirely in your browser. Just open the website and let AI enhance your editing.',
  },
  {
    question: 'Where are my videos stored?',
    answer: 'Your videos and projects are stored locally in your browser or referenced to your local files using modern storage APIs.',
  },
  {
    id: 'browser-support',
    question: 'What browsers are supported?',
    answer: (
      <>
        <p className="mb-3">
          alMotion currently works best in Chrome or Edge 113+. It relies on
          modern browser APIs like WebGPU for fast AI processing, so everything is incredibly fast.
        </p>
      </>
    ),
  },
  {
    question: 'What export formats are supported?',
    answer: 'Video: MP4, MOV, WebM, MKV. Audio: MP3, AAC, WAV (PCM). The current export UI exposes H.264, H.265, VP8, VP9, and AV1 with low, medium, high, and ultra quality presets.',
  },
  {
    question: 'Future Improvements',
    answer: 'We are bringing advanced AI capabilities such as auto-captioning, object removal, and single-click style transfers directly in the browser.',
  }
];

const showcaseItems = [
  {
    id: 'timeline',
    title: 'AI Smart Timeline',
    description: 'Multi-track editing enhanced with smart capabilities',
    icon: Layers,
    media: '/assets/landing/timeline.png',
    className: 'md:col-span-2 md:row-span-1',
    aspectClass: 'aspect-[2/1]',
  },
  {
    id: 'keyframe',
    title: 'Automatic Transitions',
    description: 'Smooth and dynamic automatic transitions',
    icon: Play,
    media: '/assets/landing/keyframe.png',
    className: 'md:row-span-2',
    aspectClass: 'aspect-[3/4] md:aspect-auto md:h-full',
  },
  {
    id: 'projects',
    title: 'Productive Management',
    description: 'Create, organize, and manage your projects effortlessly',
    icon: FolderOpen,
    media: '/assets/landing/projects.png',
    className: '',
    aspectClass: 'aspect-video',
  },
  {
    id: 'export',
    title: 'Blazing Fast Export',
    description: 'Render your videos locally in seconds with high quality',
    icon: Download,
    media: '/assets/landing/export.png',
    className: '',
    aspectClass: 'aspect-video',
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground select-text">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="relative flex min-h-[60vh] flex-col items-center justify-center px-6 py-12">
        {/* Subtle gradient background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center animate-fade-in">
          <div className="mb-6 flex items-center gap-3">
            <FreeCutLogo size="lg" />
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI Powered
            </span>
          </div>

          <h1 className="mb-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Edit videos with <span className="text-primary">alMotion AI.</span>
          </h1>

          <p className="mb-6 max-w-lg text-lg text-muted-foreground sm:text-xl">
            Professional video editing powered by artificial intelligence.
            Create stunning content seamlessly in your browser.
          </p>

          <p className="mb-6 max-w-lg text-sm text-primary/70">
            Designed to be the easiest tool for both professionals and amateurs.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="gap-2 px-8 shadow-primary/20 shadow-lg">
              <Link to="/projects">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Showcase Bento Grid */}
      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Multi featured editing capabilities
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Just a few clicks to build the video of your dreams.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
            {showcaseItems.map((item) => (
              <div
                key={item.id}
                className={`group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 ${item.className}`}
              >
                {/* Media placeholder or actual media */}
                <div className={`relative ${item.aspectClass} w-full overflow-hidden bg-muted`}>
                  {item.media ? (
                    <img
                      src={item.media}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    /* Placeholder with icon */
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground/50">
                        <item.icon className="h-12 w-12" />
                        <span className="text-xs uppercase tracking-wider">Screenshot</span>
                      </div>
                      {/* Subtle grid pattern */}
                      <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
                                           linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
                          backgroundSize: '24px 24px',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Content overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-card via-card/95 to-transparent p-4 pt-8">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Video Section */}
      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              See it in Action
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Watch a quick demo of alMotion's editing capabilities.
            </p>
          </div>

          <a
            href="https://www.youtube.com/watch?v=2EWVUXpNntk"
            target="_blank"
            rel="noopener noreferrer"
            className="group block overflow-hidden rounded-xl border border-primary/20 bg-card shadow-[0_0_30px_-5px_rgba(var(--primary),0.3)] transition-all hover:border-primary/50"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              <img
                src="/assets/landing/timeline.png"
                alt="alMotion demo preview"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white shadow-2xl backdrop-blur-sm">
                  <Play className="ml-1 h-8 w-8 fill-current" />
                </div>
              </div>
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
                <span>Watch Demo on YouTube</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-t border-border bg-card/50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground">
              Everything you need to know about alMotion.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`} id={item.id}>
                <AccordionTrigger className="text-left">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
            Ready to start editing?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Jump in and create your first project in seconds.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="gap-2 px-8 shadow-primary/20 shadow-lg">
              <Link to="/projects">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto max-w-5xl text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} alMotion AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
