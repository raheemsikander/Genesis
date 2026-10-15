"use client";

import { useAuth } from "@clerk/nextjs";
import { buttonVariants } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { getYear } from "date-fns";
import {
	ActivityIcon,
	ArrowRightIcon,
	BotIcon,
	CloudIcon,
	LockIcon,
	RefreshCwIcon,
	ShieldCheckIcon,
	SquareCheckIcon,
	ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

interface HeroWin {
	icon: ReactNode;
	title: string;
	description: string;
}

interface SecondaryWin {
	icon: ReactNode;
	title: string;
	description: string;
}

const heroWins: HeroWin[] = [
	{
		icon: <ZapIcon className="size-5" />,
		title: "Launch-Ready Infrastructure",
		description:
			"Docker Compose for local dev, Vercel + Render for production.",
	},
	{
		icon: <ShieldCheckIcon className="size-5" />,
		title: "Type Safety Everywhere",
		description:
			"Shared Zod schemas and oRPC contracts. Errors caught at build, not in production.",
	},
	{
		icon: <ActivityIcon className="size-5" />,
		title: "Observability Out of the Box",
		description:
			"Pino structured logs, Rollbar error tracking with source maps, and request-level tracing.",
	},
];

const secondaryWins: SecondaryWin[] = [
	{
		icon: <SquareCheckIcon className="size-4" />,
		title: "Clerk Authentication",
		description:
			"Sign-in flows, user management, and session handling out of the box.",
	},
	{
		icon: <BotIcon className="size-4" />,
		title: "AI-Native Development",
		description:
			"CLAUDE.md gives AI agents architecture context, conventions, and reusable skills.",
	},
	{
		icon: <RefreshCwIcon className="size-4" />,
		title: "Background Jobs",
		description:
			"BullMQ + Redis with retries, dead-letter queues, and concurrency.",
	},
	{
		icon: <CloudIcon className="size-4" />,
		title: "S3-Compatible Storage",
		description:
			"Cloudflare R2 with standard S3 APIs. No vendor lock-in, switch providers freely.",
	},
	{
		icon: <LockIcon className="size-4" />,
		title: "Security Scanning",
		description:
			"Dependabot + Socket.dev catch vulnerable dependencies before they ship.",
	},
	{
		icon: <ShieldCheckIcon className="size-4" />,
		title: "Validated Environments",
		description:
			"Every env variable validated at startup. No silent config failures.",
	},
];

function Header() {
	return (
		<header className="flex h-16 items-center border-border border-b bg-card/60 px-6 backdrop-blur-md">
			<span className="font-semibold text-foreground text-sm tracking-tight">
				Genesis
			</span>
		</header>
	);
}

function Footer() {
	const year = getYear(new Date());
	return (
		<footer className="mt-auto border-border border-t px-4 pt-8 pb-10 text-muted-foreground">
			<div className="page-wrap flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
				<p className="m-0 text-sm">
					&copy; {year} Genesis. All rights reserved.
				</p>
				<p className="section-label m-0">Open · Fast · Yours</p>
			</div>
		</footer>
	);
}

function HeroGlow() {
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-0 overflow-hidden rounded-md"
		>
			<div className="absolute -top-24 -right-24 size-72 rounded-full bg-primary/8 blur-3xl" />
			<div className="absolute -bottom-16 -left-16 size-56 rounded-full bg-ring/6 blur-3xl" />
		</div>
	);
}

export default function LandingPage() {
	const { isSignedIn, isLoaded } = useAuth();

	if (isLoaded && isSignedIn) {
		redirect("/portal");
	}

	if (!isLoaded) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<Spinner className="size-8" />
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<Header />
			<main className="page-wrap flex-1 px-4 pt-14 pb-16">
				{/* Hero */}
				<section className="rise-in relative overflow-hidden rounded-md border border-border bg-card px-6 py-12 sm:px-10 sm:py-16">
					<HeroGlow />
					<div className="relative">
						<h1
							data-testid="hero-heading"
							className="display-title mb-5 max-w-3xl font-bold text-4xl text-foreground leading-[1.02] tracking-tight sm:text-6xl"
						>
							Everything you need
							<br />
							to launch.
						</h1>
						<p className="mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg">
							A production-ready platform with authentication, type-safe APIs,
							cloud deployment, and observability — wired up and ready to go.
						</p>

						<div className="flex flex-wrap gap-3">
							<Link
								data-testid="cta-get-started"
								href={{ pathname: "/sign-in/" }}
								className={cn(buttonVariants({ size: "lg" }))}
							>
								Get started
								<ArrowRightIcon className="h-4 w-4" />
							</Link>
							<Link
								href={{ pathname: "/portal/about" }}
								className={cn(
									buttonVariants({ variant: "outline", size: "lg" }),
								)}
							>
								Learn more
							</Link>
						</div>
					</div>
				</section>

				{/* Hero wins */}
				<section className="mt-6 grid gap-4 sm:grid-cols-3">
					{heroWins.map((win, i) => (
						<article
							key={win.title}
							className="rise-in group rounded-md border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-md"
							style={{ animationDelay: `${i * 80 + 80}ms` }}
						>
							<div className="mb-3 flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
								{win.icon}
							</div>
							<h2 className="mb-1.5 font-semibold text-foreground text-sm">
								{win.title}
							</h2>
							<p className="m-0 text-muted-foreground text-sm leading-relaxed">
								{win.description}
							</p>
						</article>
					))}
				</section>

				{/* Divider */}
				<div className="my-12 flex items-center gap-4">
					<div className="h-px flex-1 bg-border" />
					<p className="section-label m-0 shrink-0">And a lot more</p>
					<div className="h-px flex-1 bg-border" />
				</div>

				{/* Secondary wins */}
				<section>
					<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
						{secondaryWins.map((win, i) => (
							<article
								key={win.title}
								className="rise-in group rounded-md border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md"
								style={{ animationDelay: `${i * 60 + 300}ms` }}
							>
								<div className="mb-2.5 flex items-center gap-2.5">
									<div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
										{win.icon}
									</div>
									<h3 className="font-semibold text-foreground text-sm">
										{win.title}
									</h3>
								</div>
								<p className="m-0 text-muted-foreground text-sm leading-relaxed">
									{win.description}
								</p>
							</article>
						))}
					</div>
				</section>
			</main>
			<Footer />
		</div>
	);
}
