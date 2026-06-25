import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { db, members } from "@/lib/db";
import { getCurrentMember } from "@/lib/identity";
import { ActingAs } from "@/components/ActingAs";

export const metadata: Metadata = {
  title: "Scrum Agents",
  description:
    "An AI agent org that listens to your team meetings and turns them into assigned, approved tickets.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [team, current] = await Promise.all([
    db.select().from(members),
    getCurrentMember(),
  ]);

  return (
    <html lang="en">
      <body>
        <header className="nav">
          <div className="container nav-inner">
            <Link href="/" className="brand">
              ⟁ Scrum Agents
            </Link>
            <div className="row" style={{ gap: "1.25rem" }}>
              <nav className="nav-links">
                <Link href="/">Dashboard</Link>
                <Link href="/meeting/new">New Meeting</Link>
                <Link href="/board">Board</Link>
                <Link href="/mesh">Mesh</Link>
              </nav>
              {team.length > 0 && current ? (
                <ActingAs
                  members={team.map((m) => ({
                    id: m.id,
                    name: m.name,
                    role: m.role,
                  }))}
                  currentId={current.id}
                />
              ) : null}
            </div>
          </div>
        </header>
        <main className="container main">{children}</main>
      </body>
    </html>
  );
}
