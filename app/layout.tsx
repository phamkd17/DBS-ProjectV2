import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ClerkProvider, Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Figtree } from "next/font/google";
import "./globals.css";
import { PageLoading } from "@/components/PageLoading";
import { focusRing } from "@/components/ui";
import { HelpButton } from "@/components/HelpButton";
import { HowItWorks } from "@/components/HowItWorks";
import { TopTabs } from "@/components/TopTabs";

// One font for everything (student, Nov 27): Figtree. Headings use it in semibold.
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Culinary Lab Book",
  description: "From inspiration to recipe: type or dictate your dish, and AI makes recipe development easy, with the food science built in.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ece7dc" };

// Clerk's sign-in screens, dressed in Line & Stone.
const clerkAppearance = {
  variables: {
    colorPrimary: "#ae1f2e",
    colorDanger: "#9a4a31",
    colorForeground: "#1c1d1f",
    colorMutedForeground: "#5e656e",
    colorBackground: "#f8f6f1",
    colorInput: "#f8f6f1",
    colorBorder: "#8a8377",
    fontFamily: "var(--font-figtree), system-ui, sans-serif",
    borderRadius: "0px",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en" className={`${figtree.variable} h-full antialiased`}>
        <body className="flex min-h-full flex-col bg-ls-bg font-ls-sans text-ls-ink">
          <header className="border-b border-ls-ink">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
              <Link href="/" className={`font-ls-serif text-2xl leading-none ${focusRing}`}>
                Culinary Lab Book
              </Link>
              <div className="flex items-center gap-1">
              <HelpButton>
                <HowItWorks headingLevel={3} />
              </HelpButton>
              <Suspense fallback={<span className="size-7" />}>
                <Show when="signed-in">
                  <UserButton />
                </Show>
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button
                      className={`min-h-11 px-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] underline decoration-ls-rule underline-offset-4 hover:decoration-ls-ink active:text-ls-muted ${focusRing}`}
                    >
                      Sign in
                    </button>
                  </SignInButton>
                </Show>
              </Suspense>
              </div>
            </div>
            <Suspense fallback={null}>
              <Show when="signed-in">
                <TopTabs />
              </Show>
            </Suspense>
          </header>
          <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
            <Suspense fallback={<PageLoading />}>{children}</Suspense>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
